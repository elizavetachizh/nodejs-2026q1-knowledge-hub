import { HttpStatus } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Response } from 'express';
import { ensureRetryAfterHeader } from '../../retry-after.helper';

describe('ensureRetryAfterHeader', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  function mockRes(headerMap: Record<string, string>): Response {
    return {
      get: (name: string) =>
        headerMap[String(name).toLowerCase()] ?? undefined,
      setHeader: vi.fn(),
      headersSent: false,
    } as unknown as Response;
  }

  it('no-op when status is not 429', () => {
    const res = mockRes({});
    ensureRetryAfterHeader(res, HttpStatus.BAD_REQUEST);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('no-op when headers already sent', () => {
    const res = {
      headersSent: true,
      get: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as Response;
    ensureRetryAfterHeader(res, HttpStatus.TOO_MANY_REQUESTS);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('copies existing Retry-After', () => {
    const res = mockRes({ 'retry-after': '7' });
    ensureRetryAfterHeader(res, HttpStatus.TOO_MANY_REQUESTS);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '7');
  });

  it('uses X-RateLimit-Reset when Retry-After is missing', () => {
    const res = mockRes({ 'x-ratelimit-reset': '52' });
    ensureRetryAfterHeader(res, HttpStatus.TOO_MANY_REQUESTS);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '52');
  });

  it('rounds fractional reset up to whole seconds >= 1', () => {
    const res = mockRes({ 'x-ratelimit-reset': '0.2' });
    ensureRetryAfterHeader(res, HttpStatus.TOO_MANY_REQUESTS);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '1');
  });

  it('falls back to THROTTLE_TTL / AI_RATE_WINDOW when no headers', () => {
    delete process.env.THROTTLE_TTL;
    delete process.env.AI_RATE_WINDOW_MS;
    const res = mockRes({});
    ensureRetryAfterHeader(res, HttpStatus.TOO_MANY_REQUESTS);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('falls back using THROTTLE_TTL when set', () => {
    process.env.THROTTLE_TTL = '45000';
    const res = mockRes({});
    ensureRetryAfterHeader(res, HttpStatus.TOO_MANY_REQUESTS);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '45');
  });
});
