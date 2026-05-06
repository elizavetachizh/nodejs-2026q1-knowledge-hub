export interface RagIndexResponse {
  indexedArticles: number;
  indexedChunks: number;
  vectorCollection: string;
}

export interface RagSearchResponse {
  results: Array<{
    articleId: string;
    articleTitle: string;
    chunk: string;
    similarity: number;
  }>;
}
