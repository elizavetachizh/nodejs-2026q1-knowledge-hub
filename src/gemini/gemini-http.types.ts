export interface GeminiGenerationUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

export interface GeminiGenerateContentResult {
  text: string;
  usageMetadata?: GeminiGenerationUsage;
}
