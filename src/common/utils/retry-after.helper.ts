import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { getPositiveInt } from './get-positive-int';

function defaultThrottleWindowSec(): number {
  const ttlMs = getPositiveInt(
    process.env.THROTTLE_TTL,
    getPositiveInt(process.env.AI_RATE_WINDOW_MS, 60_000),
  );
  return Math.max(1, Math.ceil(ttlMs / 1000));
}

export function ensureRetryAfterHeader(
  res: Response,
  statusCode: number,
): void {
  if (statusCode !== HttpStatus.TOO_MANY_REQUESTS) return;
  if (res.headersSent) return;

  const rawGet = (names: readonly string[]): string | undefined => {
    for (const name of names) {
      try {
        const v = res.get(name);
        if (v !== undefined && v !== '') return String(v).trim();
      } catch {
        /** ignore */
      }
    }
    return undefined;
  };

  let seconds = rawGet(['Retry-After', 'retry-after', 'Retry-After-Default']);

  if (seconds === undefined) {
    const reset = rawGet(['X-RateLimit-Reset', 'x-ratelimit-reset']);
    if (reset !== undefined) {
      const n = Number.parseFloat(reset);
      if (Number.isFinite(n) && n >= 0) {
        seconds = String(Math.max(1, Math.ceil(n)));
      }
    }
  }

  if (seconds === undefined) {
    seconds = String(defaultThrottleWindowSec());
  }

  res.setHeader('Retry-After', seconds);
}
