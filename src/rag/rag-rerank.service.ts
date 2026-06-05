import { Injectable } from '@nestjs/common';
import { GeminiHttpService } from 'src/gemini/gemini-http.service';
import { AppHttpError } from 'src/common/errors/app-http.error';
import { RerankInputChunk, RerankOutputItem } from './rag.types';
import { ragRerankPrompt } from './prompts/rag-rerank.prompt';

@Injectable()
export class RagRerankService {
  constructor(private readonly geminiHttpService: GeminiHttpService) {}

  async rerank(
    query: string,
    candidates: RerankInputChunk[],
  ): Promise<RerankOutputItem[]> {
    if (!candidates.length) return [];

    const prompt = ragRerankPrompt(query, candidates);
    const result = await this.geminiHttpService.generateContent(prompt);

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      throw new AppHttpError(502, 'Reranker returned non-JSON response');
    }

    const items =
      (parsed as { items?: Array<{ id?: string; relevance?: number }> })
        .items ?? [];
    return items
      .filter(
        (x) => typeof x.id === 'string' && typeof x.relevance === 'number',
      )
      .map((x) => ({
        id: x.id as string,
        relevance: Math.max(0, Math.min(1, x.relevance as number)),
      }));
  }
}
