import { Injectable } from '@nestjs/common';
import { GeminiGenerationUsage } from './gemini-http.types';

export type GeminiUsageOperation =
  | 'summarize'
  | 'translate'
  | 'analyze'
  | 'generate';

export type GeminiLatencyStats = {
  count: number;
  totalMs: number;
  maxMs: number;
  avgMs: number;
};

export type GeminiCacheStats = {
  hits: number;
  misses: number;
  hitRatio: number | null;
};

export type GeminiUsageSnapshot = {
  totalRequests: number;
  byEndpoint: Record<GeminiUsageOperation, number>;
  totalPromptTokens: number;
  totalCandidateTokens: number;
  totalTokens: number;
  /** Wall-clock round-trip of each successful Gemini HTTP call (summarize/translate/analyze/generate). */
  latencyMsByEndpoint: Record<GeminiUsageOperation, GeminiLatencyStats | null>;
  /** summarize/translate application cache only (`AI_CACHE_TTL_SEC`). */
  cache: {
    summarize: GeminiCacheStats;
    translate: GeminiCacheStats;
  };
  diagnostics: {
    analyzeStructuredFallbacks: number;
    translateStructuredFallbacks: number;
  };
};

type LatencyAgg = {
  count: number;
  totalMs: number;
  maxMs: number;
};

function emptyLatencyAgg(): LatencyAgg {
  return { count: 0, totalMs: 0, maxMs: 0 };
}

function toLatencyStats(a: LatencyAgg): GeminiLatencyStats | null {
  if (a.count === 0) return null;
  return {
    count: a.count,
    totalMs: a.totalMs,
    maxMs: a.maxMs,
    avgMs: Math.round(a.totalMs / a.count),
  };
}

function toCacheStats(hits: number, misses: number): GeminiCacheStats {
  const d = hits + misses;
  return {
    hits,
    misses,
    hitRatio: d === 0 ? null : Math.round((hits * 10000) / d) / 100,
  };
}

@Injectable()
export class GeminiUsageService {
  private totalRequests = 0;
  private readonly byEndpoint: Record<GeminiUsageOperation, number> = {
    summarize: 0,
    translate: 0,
    analyze: 0,
    generate: 0,
  };
  private totalPromptTokens = 0;
  private totalCandidateTokens = 0;
  private totalTokens = 0;

  private readonly latency: Record<GeminiUsageOperation, LatencyAgg> = {
    summarize: emptyLatencyAgg(),
    translate: emptyLatencyAgg(),
    analyze: emptyLatencyAgg(),
    generate: emptyLatencyAgg(),
  };

  private summarizeCacheHits = 0;
  private summarizeCacheMisses = 0;
  private translateCacheHits = 0;
  private translateCacheMisses = 0;

  private analyzeStructuredFallbacks = 0;
  private translateStructuredFallbacks = 0;

  record(
    operation: GeminiUsageOperation,
    usage?: GeminiGenerationUsage,
    roundTripMs?: number,
  ): void {
    this.totalRequests += 1;
    this.byEndpoint[operation] += 1;
    if (typeof roundTripMs === 'number' && Number.isFinite(roundTripMs)) {
      const ms = Math.max(0, Math.trunc(roundTripMs));
      const a = this.latency[operation];
      a.count += 1;
      a.totalMs += ms;
      a.maxMs = Math.max(a.maxMs, ms);
    }
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

  recordCacheHit(kind: 'summarize' | 'translate'): void {
    if (kind === 'summarize') this.summarizeCacheHits += 1;
    else this.translateCacheHits += 1;
  }

  recordCacheMiss(kind: 'summarize' | 'translate'): void {
    if (kind === 'summarize') this.summarizeCacheMisses += 1;
    else this.translateCacheMisses += 1;
  }

  recordStructuredFallback(kind: 'analyze' | 'translate'): void {
    if (kind === 'analyze') this.analyzeStructuredFallbacks += 1;
    else this.translateStructuredFallbacks += 1;
  }

  snapshot(): GeminiUsageSnapshot {
    return {
      totalRequests: this.totalRequests,
      byEndpoint: {
        summarize: this.byEndpoint.summarize,
        translate: this.byEndpoint.translate,
        analyze: this.byEndpoint.analyze,
        generate: this.byEndpoint.generate,
      },
      totalPromptTokens: this.totalPromptTokens,
      totalCandidateTokens: this.totalCandidateTokens,
      totalTokens: this.totalTokens,
      latencyMsByEndpoint: {
        summarize: toLatencyStats(this.latency.summarize),
        translate: toLatencyStats(this.latency.translate),
        analyze: toLatencyStats(this.latency.analyze),
        generate: toLatencyStats(this.latency.generate),
      },
      cache: {
        summarize: toCacheStats(
          this.summarizeCacheHits,
          this.summarizeCacheMisses,
        ),
        translate: toCacheStats(
          this.translateCacheHits,
          this.translateCacheMisses,
        ),
      },
      diagnostics: {
        analyzeStructuredFallbacks: this.analyzeStructuredFallbacks,
        translateStructuredFallbacks: this.translateStructuredFallbacks,
      },
    };
  }
}
