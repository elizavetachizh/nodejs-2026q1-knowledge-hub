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

export interface RagChatResponse {
  answer: string;
  sources: Array<{
    articleId: string;
    articleTitle: string;
    relevantChunk: string;
  }>;
  conversationId: string;
}
export enum ConversationUserRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}
export interface ConversationMessage {
  role: ConversationUserRole;
  content: string;
  createdAt: Date;
  id: string;
  conversationId: string;
}
