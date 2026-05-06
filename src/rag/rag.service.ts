import { Injectable } from '@nestjs/common';
import { RagIndexRequestDto } from './dto/rag-index.request.dto';
import { ArticleService } from 'src/article/article.service';
import { ArticleStatus } from 'src/article/dto/create-article.dto';
import { RagQdrantService } from './rag-qdrant.service';
import { GeminiHttpService } from 'src/gemini/gemini-http.service';
import { createHash } from 'crypto';
import { RagSearchRequestDto } from './dto/rag-search-request.dto';

type ChunkedArticle = {
  chunkId: string;
  chunkIndex: number;
  chunkText: string;
};
@Injectable()
export class RagService {
  constructor(
    private readonly geminiHttpService: GeminiHttpService,
    private readonly articleService: ArticleService,
    private readonly ragQdrantService: RagQdrantService,
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

  async indexArticle(body: RagIndexRequestDto) {
    const articles = await this.articleService.getArticles(
      ArticleStatus.PUBLISHED,
    );
    const filtered = body.articleIds?.length
      ? articles.filter((a) => body.articleIds!.includes(a.id))
      : articles;
    let indexedArticles = 0;
    let indexedChunks = 0;
    for (const article of filtered) {
      const chunks = await this.chunkText(article.content);
      if (!chunks.length) continue;
      const vectors = await Promise.all(
        chunks.map((c) => this.geminiHttpService.embedContent(c.chunkText)),
      );
      await this.ragQdrantService.upsertChunks(
        chunks.map((c, i) => ({
          id: c.chunkId,
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
  async search(body: RagSearchRequestDto) {
    const { query, articleStatus, categoryId, tags, limit = 5 } = body;
    const queryVector = await this.geminiHttpService.embedContent(query);
    return await this.ragQdrantService.searchByVector({
      queryVector,
      articleStatus,
      categoryId,
      tags,
      limit,
    });
  }
}
