import { describe, it, expect, beforeEach } from 'vitest';
import {
  GeminiUsageService,
} from '../../gemini-usage.service';

describe('GeminiUsageService observability snapshot', () => {
  let s: GeminiUsageService;

  beforeEach(() => {
    s = new GeminiUsageService();
  });

  it('tracks latency aggregates and averages', () => {
    s.record('summarize', undefined, 100);
    s.record('summarize', undefined, 200);
    const snap = s.snapshot().latencyMsByEndpoint.summarize!;
    expect(snap.count).toBe(2);
    expect(snap.totalMs).toBe(300);
    expect(snap.maxMs).toBe(200);
    expect(snap.avgMs).toBe(150);
  });

  it('computes cache hit ratio over summarize and translate lookups', () => {
    s.recordCacheHit('summarize');
    s.recordCacheMiss('summarize');
    s.recordCacheMiss('translate');
    s.recordCacheMiss('translate');
    s.recordCacheHit('translate');

    expect(s.snapshot().cache.summarize.hitRatio).toBe(50);
    expect(s.snapshot().cache.translate.hitRatio).toBeCloseTo(33.33, 1);

    expect(s.snapshot().cache.summarize.hits).toBe(1);
    expect(s.snapshot().cache.translate.misses).toBe(2);
  });

  it('counts structured fallbacks separately', () => {
    s.recordStructuredFallback('analyze');
    s.recordStructuredFallback('translate');
    s.recordStructuredFallback('translate');
    expect(s.snapshot().diagnostics).toEqual({
      analyzeStructuredFallbacks: 1,
      translateStructuredFallbacks: 2,
    });
  });
});
