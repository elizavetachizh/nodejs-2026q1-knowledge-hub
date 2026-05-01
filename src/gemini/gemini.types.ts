export enum SummarizeArticleMaxLength {
  SHORT = 'short',
  MEDIUM = 'medium',
  DETAILED = 'detailed',
}

export interface SummarizeArticleResponse {
  articleId: string;
  summary: string;
  originalLength: number;
  summaryLength: number;
}

export interface TranslateArticleResponse {
  articleId: string;
  translatedText: string;
  detectedLanguage: string;
}

export interface AnalyzeArticleResponse {
  articleId: string;
  analysis: string;
  suggestions: string[];
  severity: 'info' | 'warning' | 'error';
}
export enum AnalyzeArticleTask {
  REVIEW = 'review',
  BUGS = 'bugs',
  OPTIMIZE = 'optimize',
  EXPLAIN = 'explain',
}
export interface AnalyzePayload {
  analysis: string;
  suggestions: string[];
  severity: 'info' | 'warning' | 'error';
}
