import { createHash } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RagService } from 'src/rag/rag.service';
import { ArticleStatus } from 'src/article/dto/create-article.dto';
import { NotFoundError } from 'src/common/errors/app-http.error';
import { Article } from 'src/article/article.types';

function makeDeps() {
  return {
    prisma: {
      ragIndexState: {
        findMany: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
    geminiHttpService: {
      embedContent: vi.fn(),
      generateContent: vi.fn(),
    },
    articleService: {
      getArticles: vi.fn(),
    },
    ragQdrantService: {
      ensureCollection: vi.fn(),
      searchByVector: vi.fn(),
      deleteByArticleId: vi.fn(),
      upsertChunks: vi.fn(),
      cleanupStaleArticleVectors: vi.fn(),
    },
    ragConversationService: {
      getRecentHistory: vi.fn(),
      appendUserMessage: vi.fn(),
      appendAssistantMessage: vi.fn(),
      trimHistory: vi.fn(),
      getHistory: vi.fn(),
    },
    ragRerankService: {
      rerank: vi.fn(),
    },
  };
}

function makeArticle(overrides?: Partial<Article>): Article {
  return {
    id: 'art-1',
    title: 'NodeJS guide',
    content: 'This is content for RAG indexing.',
    status: ArticleStatus.PUBLISHED,
    authorId: null,
    categoryId: 'cat-1',
    tags: ['node', 'nest'],
    createdAt: Date.now() - 1000,
    updatedAt: Date.now(),
    ...overrides,
  };
}

function computeArticleHash(article: Article): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: article.id,
        title: article.title,
        content: article.content,
        status: article.status,
        categoryId: article.categoryId,
        tags: [...article.tags].sort(),
        updatedAt: article.updatedAt,
      }),
    )
    .digest('hex');
}

describe('RagService', () => {
  const originalEnv = { ...process.env };
  let deps: ReturnType<typeof makeDeps>;
  let service: RagService;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    deps = makeDeps();
    service = new RagService(
      deps.prisma as never,
      deps.geminiHttpService as never,
      deps.articleService as never,
      deps.ragQdrantService as never,
      deps.ragConversationService as never,
      deps.ragRerankService as never,
    );
  });

  it('indexArticle skips unchanged article and runs stale cleanup on full reindex', async () => {
    const article = makeArticle();
    deps.articleService.getArticles.mockResolvedValue([article]);
    deps.prisma.ragIndexState.findMany.mockResolvedValue([
      { articleId: article.id, contentHash: computeArticleHash(article) },
    ]);
    deps.ragQdrantService.ensureCollection.mockResolvedValue(undefined);
    deps.ragQdrantService.cleanupStaleArticleVectors.mockResolvedValue(
      undefined,
    );
    deps.prisma.ragIndexState.deleteMany.mockResolvedValue({ count: 0 });

    const result = await service.indexArticle({});

    expect(result).toMatchObject({
      indexedArticles: 0,
      skippedArticles: 1,
      indexedChunks: 0,
    });
    expect(deps.ragQdrantService.ensureCollection).toHaveBeenCalledOnce();
    expect(deps.prisma.ragIndexState.upsert).not.toHaveBeenCalled();
    expect(deps.ragQdrantService.deleteByArticleId).not.toHaveBeenCalled();
    expect(deps.geminiHttpService.embedContent).not.toHaveBeenCalled();
    expect(deps.ragQdrantService.upsertChunks).not.toHaveBeenCalled();
    expect(
      deps.ragQdrantService.cleanupStaleArticleVectors,
    ).toHaveBeenCalledWith([article.id]);
    expect(deps.prisma.ragIndexState.deleteMany).toHaveBeenCalledWith({
      where: { articleId: { notIn: [article.id] } },
    });
  });

  it('indexArticle reindexes changed selective article and skips global cleanup', async () => {
    const target = makeArticle({
      id: 'art-1',
      content: 'Changed article text',
      updatedAt: 1_736_000_000_000,
    });
    const untouched = makeArticle({
      id: 'art-2',
      content: 'Untouched',
      updatedAt: 1_736_000_000_100,
    });
    deps.articleService.getArticles.mockResolvedValue([target, untouched]);
    deps.prisma.ragIndexState.findMany.mockResolvedValue([
      { articleId: target.id, contentHash: 'old-hash' },
    ]);
    deps.ragQdrantService.ensureCollection.mockResolvedValue(undefined);
    deps.ragQdrantService.deleteByArticleId.mockRejectedValue(
      new NotFoundError('not in index'),
    );
    deps.geminiHttpService.embedContent.mockResolvedValue([0.1, 0.2, 0.3]);
    deps.ragQdrantService.upsertChunks.mockResolvedValue(undefined);

    const result = await service.indexArticle({
      onlyPublished: false,
      articleIds: [target.id],
    });

    expect(result.indexedArticles).toBe(1);
    expect(result.skippedArticles).toBe(0);
    expect(result.indexedChunks).toBeGreaterThan(0);
    expect(deps.prisma.ragIndexState.upsert).toHaveBeenCalledWith({
      where: { articleId: target.id },
      update: {
        contentHash: computeArticleHash(target),
        sourceUpdatedAt: new Date(target.updatedAt),
      },
      create: {
        articleId: target.id,
        contentHash: computeArticleHash(target),
        sourceUpdatedAt: new Date(target.updatedAt),
      },
    });
    expect(
      deps.ragQdrantService.cleanupStaleArticleVectors,
    ).not.toHaveBeenCalled();
    expect(deps.prisma.ragIndexState.deleteMany).not.toHaveBeenCalled();
  });

  it('search applies rerank top-k cap and uses semantic score fallback', async () => {
    process.env.RAG_HYBRID_ENABLED = 'false';
    process.env.RAG_RERANK_ENABLED = 'false';
    process.env.RAG_RERANK_TOP_K = '2';
    deps.geminiHttpService.embedContent.mockResolvedValue([0.2, 0.3, 0.4]);
    deps.ragQdrantService.searchByVector.mockResolvedValue([
      {
        id: 'p1',
        score: 0.91,
        payload: {
          articleId: 'a1',
          articleTitle: 'A1',
          chunkText: 'Chunk 1',
        },
      },
      {
        id: 'p2',
        score: 0.77,
        payload: {
          articleId: 'a2',
          articleTitle: 'A2',
          chunkText: 'Chunk 2',
        },
      },
      {
        id: 'p3',
        score: 0.62,
        payload: {
          articleId: 'a3',
          articleTitle: 'A3',
          chunkText: 'Chunk 3',
        },
      },
    ]);

    const result = await service.search({
      query: 'nestjs qdrant',
      limit: 3,
    });

    expect(deps.ragQdrantService.searchByVector).toHaveBeenCalledWith({
      queryVector: [0.2, 0.3, 0.4],
      limit: 3,
      articleStatus: undefined,
      categoryId: undefined,
      tags: undefined,
    });
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({
      articleId: 'a1',
      similarity: 0.91,
    });
    expect(result.results[1]).toMatchObject({
      articleId: 'a2',
      similarity: 0.77,
    });
  });

  it('chat persists messages and trims history after generation', async () => {
    process.env.RAG_HYBRID_ENABLED = 'false';
    process.env.RAG_RERANK_ENABLED = 'false';
    const conversationId = '550e8400-e29b-41d4-a716-446655440000';
    deps.geminiHttpService.embedContent.mockResolvedValue([0.2, 0.3, 0.4]);
    deps.ragQdrantService.searchByVector.mockResolvedValue([
      {
        id: 'p1',
        score: 0.8,
        payload: {
          articleId: 'a1',
          articleTitle: 'A1',
          chunkText: 'Chunk 1',
        },
      },
    ]);
    deps.ragConversationService.getRecentHistory.mockResolvedValue([
      {
        id: 'm-1',
        conversationId,
        role: 'USER',
        content: 'previous question',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    deps.geminiHttpService.generateContent.mockResolvedValue({
      text: 'Grounded answer',
    });
    deps.ragConversationService.appendUserMessage.mockResolvedValue(undefined);
    deps.ragConversationService.appendAssistantMessage.mockResolvedValue(
      undefined,
    );
    deps.ragConversationService.trimHistory.mockResolvedValue(0);

    const result = await service.chat({
      question: 'How to run qdrant in docker?',
      conversationId,
    });

    expect(result).toMatchObject({
      answer: 'Grounded answer',
      conversationId,
    });
    expect(result.sources).toHaveLength(1);
    const getRecentCall =
      deps.ragConversationService.getRecentHistory.mock.invocationCallOrder[0];
    const generateCall =
      deps.geminiHttpService.generateContent.mock.invocationCallOrder[0];
    const appendUserCall =
      deps.ragConversationService.appendUserMessage.mock.invocationCallOrder[0];
    const appendAssistantCall =
      deps.ragConversationService.appendAssistantMessage.mock
        .invocationCallOrder[0];
    const trimCall =
      deps.ragConversationService.trimHistory.mock.invocationCallOrder[0];

    expect(getRecentCall).toBeLessThan(generateCall);
    expect(generateCall).toBeLessThan(appendUserCall);
    expect(appendUserCall).toBeLessThan(appendAssistantCall);
    expect(appendAssistantCall).toBeLessThan(trimCall);
  });

  it('chatHistory throws NotFoundError when conversation is absent', async () => {
    deps.ragConversationService.getHistory.mockResolvedValue([]);

    await expect(
      service.chatHistory('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
