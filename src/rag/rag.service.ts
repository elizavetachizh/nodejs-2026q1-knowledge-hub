import { Injectable } from '@nestjs/common';
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

type ChunkedArticle = {
  chunkId: string;
  chunkIndex: number;
  chunkText: string;
};
@Injectable()
export class RagService {
  private static readonly QDRANT_POINT_NAMESPACE = uuidv5.URL;
  constructor(
    private readonly geminiHttpService: GeminiHttpService,
    private readonly articleService: ArticleService,
    private readonly ragQdrantService: RagQdrantService,
    private readonly ragConversationService: RagConversationService,
  ) {}
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

  private toQdrantPointId(articleId: string, chunkId: string): string {
    return uuidv5(`${articleId}:${chunkId}`, RagService.QDRANT_POINT_NAMESPACE);
  }

  async indexArticle(body: RagIndexRequestDto) {
    const onlyPublished = body.onlyPublished ?? true;
    const articles = await this.articleService.getArticles(
      onlyPublished ? ArticleStatus.PUBLISHED : undefined,
    );
    const filtered = body.articleIds?.length
      ? articles.filter((a) => body.articleIds!.includes(a.id))
      : articles;

    let indexedArticles = 0;
    let indexedChunks = 0;

    await this.ragQdrantService.ensureCollection();
    for (const article of filtered) {
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
    return {
      indexedArticles,
      indexedChunks,
      vectorCollection:
        process.env.RAG_VECTOR_COLLECTION || 'knowledge_hub_articles',
    };
  }
  async search(body: RagSearchRequestDto): Promise<RagSearchResponse> {
    const { query, articleStatus, categoryId, tags, limit = 5 } = body;
    const queryVector = await this.geminiHttpService.embedContent(query);
    const results = await this.ragQdrantService.searchByVector({
      queryVector,
      articleStatus,
      categoryId,
      tags,
      limit,
    });
    return {
      results: results.map((r) => ({
        articleId: r.payload?.articleId as string,
        articleTitle: r.payload?.articleTitle as string,
        chunk: r.payload?.chunkText as string,
        similarity: r.score,
      })),
    };
  }
  async deleteByArticleId(articleId: string): Promise<void> {
    await this.ragQdrantService.deleteByArticleId(articleId);
  }

  async chat(body: RagChatRequestDto): Promise<RagChatResponse> {
    const { question, conversationId } = body;
    const queryVector = await this.geminiHttpService.embedContent(question);
    const chunks = await this.ragQdrantService.searchByVector({
      queryVector,
      limit: 5,
    });

    const conversationIdForResponse = conversationId || randomUUID();

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

    const result = await this.geminiHttpService.generateContent(
      ragChatPrompt({
        question,
        chunks: chunks.map((c) => ({
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
      sources: chunks.map((c) => ({
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
