import { QdrantClient } from '@qdrant/js-client-rest';
import { Injectable } from '@nestjs/common';
import { ArticleStatus } from 'src/article/dto/create-article.dto';
import { AppHttpError, NotFoundError } from 'src/common/errors/app-http.error';

type SearchByVectorParams = {
  queryVector: number[];
  articleId?: string;
  articleStatus?: ArticleStatus;
  categoryId?: string;
  tags?: string[];
  limit?: number;
};
type UpsertChunkParams = {
  id: string;
  vector: number[];
  articleId: string;
  articleTitle: string;
  articleContent: string;
  articleStatus: ArticleStatus;
  categoryId: string;
  tags: string[];
  chunkIndex: number;
  chunkText: string;
};

@Injectable()
export class RagQdrantService {
  private readonly qdrantClient = new QdrantClient({
    url: process.env.RAG_VECTOR_DB_URL || 'http://localhost:6333',
  });
  private readonly collectionName =
    process.env.RAG_VECTOR_COLLECTION || 'knowledge_hub_articles';
  private readonly vectorSize = Number(process.env.RAG_VECTOR_SIZE || 768);
  constructor() {}

  async ensureCollection() {
    try {
      const collections = await this.qdrantClient.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName,
      );
      if (exists) return;
      await this.qdrantClient.createCollection(this.collectionName, {
        vectors: {
          size: this.vectorSize,
          distance: 'Cosine',
        },
      });
    } catch (error) {
      throw new AppHttpError(
        503,
        `Vector database error: Failed to create collection`,
      );
    }
  }
  async upsertChunks(chunks: UpsertChunkParams[]) {
    try {
      await this.qdrantClient.upsert(this.collectionName, {
        batch: {
          ids: chunks.map((c) => c.id),
          vectors: chunks.map((c) => c.vector),
          payloads: chunks.map((c) => ({
            articleId: c.articleId,
            articleTitle: c.articleTitle,
            articleStatus: c.articleStatus,
            categoryId: c.categoryId,
            tags: c.tags,
            chunkIndex: c.chunkIndex,
            chunkText: c.chunkText,
          })),
        },
      });
    } catch (error) {
      throw new AppHttpError(
        503,
        `Vector database error: Failed to upsert chunks${
          error instanceof Error ? ` (${error.message})` : ''
        }`,
      );
    }
  }
  private async getIndexedArticleIds(): Promise<string[]> {
    const articleIds = new Set<string>();
    let offset: string | number | undefined;
    try {
      while (true) {
        const page = await this.qdrantClient.scroll(this.collectionName, {
          limit: 256,
          with_payload: ['articleId'],
          with_vector: false,
          ...(offset !== undefined ? { offset } : {}),
        });
        for (const point of page.points ?? []) {
          const articleId = point.payload?.articleId;
          if (typeof articleId === 'string' && articleId.length > 0) {
            articleIds.add(articleId);
          }
        }
        const next = page.next_page_offset;
        if (next === null || next === undefined) break;
        offset = next as string | number;
      }
      return [...articleIds];
    } catch (error) {
      throw new AppHttpError(
        503,
        `Vector database error: Failed to read indexed article ids`,
      );
    }
  }
  async cleanupStaleArticleVectors(keepArticleIds: string[]): Promise<void> {
    const keep = new Set(keepArticleIds);
    const indexed = await this.getIndexedArticleIds();
    const stale = indexed.filter((id) => !keep.has(id));
    for (const articleId of stale) {
      try {
        await this.deleteByArticleId(articleId);
      } catch (error) {
        if (error instanceof NotFoundError) continue;
        throw error;
      }
    }
  }
  async searchByVector(params: SearchByVectorParams) {
    const {
      queryVector,
      articleId,
      articleStatus,
      categoryId,
      tags,
      limit = 5,
    } = params;
    const fixedLimit = Math.min(20, Math.max(1, limit ?? 5));
    const must: Array<Record<string, unknown>> = [];
    const should: Array<Record<string, unknown>> = [];
    if (articleId) {
      must.push({
        key: 'articleId',
        match: {
          value: articleId,
        },
      });
    }
    if (articleStatus) {
      must.push({
        key: 'articleStatus',
        match: {
          value: articleStatus,
        },
      });
    }
    if (categoryId) {
      must.push({
        key: 'categoryId',
        match: {
          value: categoryId,
        },
      });
    }
    if (tags?.length) {
      should.push(
        ...tags.map((tag) => ({
          key: 'tags',
          match: {
            value: tag,
          },
        })),
      );
    }
    const filter: Record<string, unknown> = {};
    if (must.length) filter.must = must;
    if (should.length) filter.should = should;
    try {
      return await this.qdrantClient.search(this.collectionName, {
        vector: queryVector,
        limit: fixedLimit,
        with_payload: true,
        ...(Object.keys(filter).length > 0 ? { filter } : {}),
      });
    } catch (error) {
      throw new AppHttpError(503, `Vector database error: ${error.message}`);
    }
  }
  async deleteByArticleId(articleId: string): Promise<number> {
    const filter = {
      must: [{ key: 'articleId', match: { value: articleId } }],
    };

    try {
      const countResult = await this.qdrantClient.count(this.collectionName, {
        filter,
        exact: true,
      });
      const pointsToDelete = countResult.count ?? 0;
      if (pointsToDelete === 0) {
        throw new NotFoundError(`Article ${articleId} not found in index`);
      }

      await this.qdrantClient.delete(this.collectionName, {
        filter,
        wait: true,
      });

      return pointsToDelete;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new AppHttpError(503, `Vector database error: ${error.message}`);
    }
  }
}
