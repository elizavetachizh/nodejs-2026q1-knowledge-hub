import { Injectable, Logger } from '@nestjs/common';
import { RagIndexRequestDto } from './dto/rag-index.request.dto';
import { ArticleService } from 'src/article/article.service';
import { ArticleStatus } from 'src/article/dto/create-article.dto';
import { RagQdrantService } from './rag-qdrant.service';
import { GeminiHttpService } from 'src/gemini/gemini-http.service';
import { createHash, randomUUID } from 'crypto';
import { RagSearchRequestDto } from './dto/rag-search-request.dto';
import { RagChatResponse, RagSearchResponse } from './rag.types';
import { RagChatRequestDto } from './dto/rag-chat.dto';
import { ragChatPrompt } from './prompts/rag-chat.prompt';
import { NotFoundError } from 'src/common/errors/app-http.error';
import { v5 as uuidv5 } from 'uuid';
import { RagConversationService } from './rag-conversation.service';
import { fromPrismaConversationRole } from './utils/conversation-role.mapper';
import { hybridRank } from './utils/hybrid-retrieval.util';
import { RagRerankService } from './rag-rerank.service';
import { Article } from 'src/article/article.types';
import { PrismaService } from 'prisma/prisma.service';

type ChunkedArticle = {
  chunkId: string;
  chunkIndex: number;
  chunkText: string;
};
type RankedCandidate = {
  id: string;
  semanticScore: number;
  chunkText: string;
  payload: Record<string, unknown>;
  finalScore?: number;
  rerankScore?: number;
};
@Injectable()
export class RagService {
  private static readonly QDRANT_POINT_NAMESPACE = uuidv5.URL;
  private readonly logger = new Logger(RagService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiHttpService: GeminiHttpService,
    private readonly articleService: ArticleService,
    private readonly ragQdrantService: RagQdrantService,
    private readonly ragConversationService: RagConversationService,
    private readonly ragRerankService: RagRerankService,
  ) {}
  private async buildRankedCandidates(
    query: string,
    limit: number,
    filters?: {
      articleStatus?: ArticleStatus;
      categoryId?: string;
      tags?: string[];
    },
  ) {
    const queryVector = await this.geminiHttpService.embedContent(query);
    const parsePositiveInt = (value: string | undefined, fallback: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0
        ? Math.trunc(parsed)
        : fallback;
    };
    const parsePositiveNumber = (
      value: string | undefined,
      fallback: number,
    ) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };
    const parseUnitFloat = (value: string | undefined, fallback: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
        ? parsed
        : fallback;
    };

    const rerankCandidates = Math.max(
      1,
      parsePositiveInt(process.env.RAG_RERANK_CANDIDATES, 10),
    );
    const candidateLimit = Math.max(
      limit,
      parsePositiveInt(process.env.RAG_HYBRID_CANDIDATES, 40),
    );
    const useHybrid = (process.env.RAG_HYBRID_ENABLED ?? 'true') === 'true';
    const rerankEnabled =
      (process.env.RAG_RERANK_ENABLED ?? 'false') === 'true';
    const qdrantHits = await this.ragQdrantService.searchByVector({
      queryVector,
      ...filters,
      limit: useHybrid ? candidateLimit : limit,
    });

    let ranked: RankedCandidate[] = qdrantHits.map((h) => ({
      id: String(h.id),
      semanticScore: h.score,
      chunkText: String(h.payload?.chunkText ?? ''),
      payload: (h.payload ?? {}) as Record<string, unknown>,
    }));

    if (useHybrid) {
      ranked = hybridRank(
        query,
        ranked,
        parseUnitFloat(process.env.RAG_HYBRID_W_SEMANTIC, 0.75),
        parseUnitFloat(process.env.RAG_HYBRID_W_LEXICAL, 0.25),
        parsePositiveNumber(process.env.RAG_HYBRID_BM25_K1, 1.2),
        parseUnitFloat(process.env.RAG_HYBRID_BM25_B, 0.75),
      );
    }

    if (rerankEnabled) {
      const pool = ranked.slice(0, rerankCandidates);

      try {
        const reranked = await this.ragRerankService.rerank(
          query,
          pool.map((r) => ({
            id: r.id,
            articleId: String(r.payload.articleId ?? ''),
            articleTitle: String(r.payload.articleTitle ?? ''),
            chunkText: String(r.payload.chunkText ?? ''),
            baseScore: r.finalScore ?? r.semanticScore,
          })),
        );

        const rel = new Map(reranked.map((x) => [x.id, x.relevance]));
        ranked = pool
          .map((r) => ({
            ...r,
            rerankScore: rel.get(r.id) ?? 0,
          }))
          .sort((a, b) => b.rerankScore - a.rerankScore);
      } catch (error) {
        this.logger.warn(
          `Reranker failed, falling back to hybrid/vector ranking: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return ranked;
  }

  private chunkText(text: string): ChunkedArticle[] {
    const size = Number(process.env.RAG_CHUNK_SIZE ?? 800);
    const overlap = Number(process.env.RAG_CHUNK_OVERLAP ?? 200);
    const chunkSize = Number.isFinite(size) && size > 0 ? size : 800;
    const chunkOverlap =
      Number.isFinite(overlap) && overlap >= 0 && overlap < chunkSize
        ? overlap
        : 200;
    const step = chunkSize - chunkOverlap;
    const chunks: ChunkedArticle[] = [];
    for (let i = 0, idx = 0; i < text.length; i += step, idx++) {
      const chunkText = text.slice(i, i + chunkSize).trim();
      if (!chunkText) continue;
      const chunkId = createHash('sha1')
        .update(`${idx}:${chunkText}`)
        .digest('hex');
      chunks.push({
        chunkId,
        chunkIndex: idx,
        chunkText,
      });
    }
    return chunks;
  }
  private computeArticleHash(article: Article): string {
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
  private toQdrantPointId(articleId: string, chunkId: string): string {
    return uuidv5(`${articleId}:${chunkId}`, RagService.QDRANT_POINT_NAMESPACE);
  }

  async indexArticle(body: RagIndexRequestDto) {
    const onlyPublished = body.onlyPublished ?? true;
    const isSelectiveReindex = Boolean(body.articleIds?.length);
    const articles = await this.articleService.getArticles(
      onlyPublished ? ArticleStatus.PUBLISHED : undefined,
    );
    const filtered = body.articleIds?.length
      ? articles.filter((a) => body.articleIds!.includes(a.id))
      : articles;
    let indexedArticles = 0;
    let indexedChunks = 0;

    const existingStates = await this.prisma.ragIndexState.findMany({
      where: {
        articleId: {
          in: filtered.map((a) => a.id),
        },
      },
    });
    const indexedArticlesMap = new Map(
      existingStates.map((a) => [a.articleId, a]),
    );

    await this.ragQdrantService.ensureCollection();
    for (const article of filtered) {
      const newHash = this.computeArticleHash(article);
      const oldState = indexedArticlesMap.get(article.id);
      if (oldState && oldState?.contentHash === newHash) {
        continue;
      } else {
        await this.prisma.ragIndexState.upsert({
          where: { articleId: article.id },
          update: {
            contentHash: newHash,
            sourceUpdatedAt: new Date(article.updatedAt),
          },
          create: {
            articleId: article.id,
            contentHash: newHash,
            sourceUpdatedAt: new Date(article.updatedAt),
          },
        });
      }
      try {
        await this.ragQdrantService.deleteByArticleId(article.id);
      } catch (e) {
        if (!(e instanceof NotFoundError)) throw e;
      }

      const chunks = await this.chunkText(article.content);
      if (!chunks.length) continue;

      const vectors = await Promise.all(
        chunks.map((c) => this.geminiHttpService.embedContent(c.chunkText)),
      );

      await this.ragQdrantService.upsertChunks(
        chunks.map((c, i) => ({
          id: this.toQdrantPointId(article.id, c.chunkId),
          vector: vectors[i],
          articleId: article.id,
          articleTitle: article.title,
          articleContent: article.content,
          articleStatus: article.status,
          categoryId: article.categoryId,
          tags: article.tags,
          chunkIndex: c.chunkIndex,
          chunkText: c.chunkText,
        })),
      );
      indexedArticles++;
      indexedChunks += chunks.length;
    }
    if (!isSelectiveReindex) {
      const keepIds = filtered.map((a) => a.id);
      await this.ragQdrantService.cleanupStaleArticleVectors(keepIds);
      await this.prisma.ragIndexState.deleteMany({
        where: {
          articleId: { notIn: keepIds },
        },
      });
    }
    return {
      indexedArticles,
      skippedArticles: filtered.length - indexedArticles,
      indexedChunks,
      vectorCollection:
        process.env.RAG_VECTOR_COLLECTION || 'knowledge_hub_articles',
    };
  }
  async search(body: RagSearchRequestDto): Promise<RagSearchResponse> {
    const { query, articleStatus, categoryId, tags, limit = 5 } = body;
    const parsePositiveInt = (value: string | undefined, fallback: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0
        ? Math.trunc(parsed)
        : fallback;
    };

    const rerankTopK = Math.max(
      1,
      parsePositiveInt(process.env.RAG_RERANK_TOP_K, limit),
    );

    const finalRanked = await this.buildRankedCandidates(query, limit, {
      articleStatus,
      categoryId,
      tags,
    });

    const top = finalRanked.slice(0, Math.min(limit, rerankTopK));
    return {
      results: top.map((r) => ({
        articleId: r.payload?.articleId as string,
        articleTitle: r.payload?.articleTitle as string,
        chunk: r.payload?.chunkText as string,
        similarity: r.rerankScore ?? r.finalScore ?? r.semanticScore,
      })),
    };
  }

  async deleteByArticleId(articleId: string): Promise<void> {
    await this.ragQdrantService.deleteByArticleId(articleId);
  }

  async chat(body: RagChatRequestDto): Promise<RagChatResponse> {
    const { question, conversationId } = body;

    const conversationIdForResponse = conversationId || randomUUID();

    const finalRanked = await this.buildRankedCandidates(question, 5);

    const historyBeforeQuestion = (
      await this.ragConversationService.getRecentHistory(
        conversationIdForResponse,
      )
    ).map((h) => ({
      role: fromPrismaConversationRole(h.role),
      content: h.content,
      createdAt: h.createdAt,
      id: h.id,
      conversationId: h.conversationId,
    }));
    const topForChat = finalRanked.slice(0, 5);
    const result = await this.geminiHttpService.generateContent(
      ragChatPrompt({
        question,
        chunks: topForChat.map((c) => ({
          articleId: c.payload?.articleId as string,
          articleTitle: c.payload?.articleTitle as string,
          chunkText: c.payload?.chunkText as string,
        })),
        history: historyBeforeQuestion,
      }),
    );

    await this.ragConversationService.appendUserMessage(
      conversationIdForResponse,
      question,
    );

    const answer = result.text;
    await this.ragConversationService.appendAssistantMessage(
      conversationIdForResponse,
      answer,
    );
    await this.ragConversationService.trimHistory(conversationIdForResponse);

    return {
      answer,
      sources: topForChat.map((c) => ({
        articleId: c.payload?.articleId as string,
        articleTitle: c.payload?.articleTitle as string,
        relevantChunk: c.payload?.chunkText as string,
      })),
      conversationId: conversationIdForResponse,
    };
  }

  async chatHistory(conversationId: string) {
    const history =
      await this.ragConversationService.getHistory(conversationId);
    if (!history.length) throw new NotFoundError('Conversation not found');

    return history.map((h) => ({
      role: fromPrismaConversationRole(h.role),
      content: h.content,
      createdAt: h.createdAt,
      id: h.id,
      conversationId: h.conversationId,
    }));
  }
}
