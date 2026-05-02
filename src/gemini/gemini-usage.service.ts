import { Injectable } from '@nestjs/common';
import { GeminiGenerationUsage } from './gemini-http.types';

export type GeminiUsageOperation = 'summarize' | 'translate' | 'analyze';

export type GeminiUsageSnapshot = {
  totalRequests: number;
  byEndpoint: Record<GeminiUsageOperation, number>;
  totalPromptTokens: number;
  totalCandidateTokens: number;
  totalTokens: number;
};

@Injectable()
export class GeminiUsageService {
  private totalRequests = 0;
  private readonly byEndpoint: Record<GeminiUsageOperation, number> = {
    summarize: 0,
    translate: 0,
    analyze: 0,
  };
  private totalPromptTokens = 0;
  private totalCandidateTokens = 0;
  private totalTokens = 0;

  record(operation: GeminiUsageOperation, usage?: GeminiGenerationUsage): void {
    this.totalRequests += 1;
    this.byEndpoint[operation] += 1;
    if (!usage) return;
    const p = usage.promptTokenCount;
    const c = usage.candidatesTokenCount;
    const t = usage.totalTokenCount;
    if (typeof p === 'number' && Number.isFinite(p) && p >= 0) {
      this.totalPromptTokens += Math.trunc(p);
    }
    if (typeof c === 'number' && Number.isFinite(c) && c >= 0) {
      this.totalCandidateTokens += Math.trunc(c);
    }
    if (typeof t === 'number' && Number.isFinite(t) && t >= 0) {
      this.totalTokens += Math.trunc(t);
    }
  }

  snapshot(): GeminiUsageSnapshot {
    return {
      totalRequests: this.totalRequests,
      byEndpoint: {
        summarize: this.byEndpoint.summarize,
        translate: this.byEndpoint.translate,
        analyze: this.byEndpoint.analyze,
      },
      totalPromptTokens: this.totalPromptTokens,
      totalCandidateTokens: this.totalCandidateTokens,
      totalTokens: this.totalTokens,
    };
  }
}
