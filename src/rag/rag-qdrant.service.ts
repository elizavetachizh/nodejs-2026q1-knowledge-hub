import { QdrantClient } from '@qdrant/js-client-rest';
import { Injectable } from '@nestjs/common';
import { ArticleStatus } from 'src/article/dto/create-article.dto';
import { AppHttpError } from 'src/common/errors/app-http.error';

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
        `Vector database error: Failed to upsert chunks`,
        { error: error },
      );
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
    const must: Array<Record<string, unknown>> = [];
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
      must.push({
        should: tags.map((tag) => ({
          key: 'tags',
          match: {
            value: tag,
          },
        })),
      });
    }
    try {
      return await this.qdrantClient.search(this.collectionName, {
        vector: queryVector,
        limit,
        with_payload: true,
        ...(must.length > 0 ? { filter: { must } } : {}),
      });
    } catch (error) {
      throw new AppHttpError(503, `Vector database error: ${error.message}`, {
        error: error,
      });
    }
  }
  async deleteByArticleId(articleId: string) {
    try {
      await this.qdrantClient.delete(this.collectionName, {
        filter: {
          must: [
            {
              key: 'articleId',
              match: {
                value: articleId,
              },
            },
          ],
        },
      });
    } catch (error) {
      throw new AppHttpError(
        503,
        `Failed to delete article ${articleId} from Qdrant`,
        { error: error },
      );
    }
    return true;
  }
}
