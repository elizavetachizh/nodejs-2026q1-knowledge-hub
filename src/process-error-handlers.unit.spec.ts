import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerProcessErrorHandlers } from './process-error-handlers';

describe('registerProcessErrorHandlers', () => {
  type Listener = (...args: unknown[]) => void;
  let listeners: Record<string, Listener[]>;

  beforeEach(() => {
    listeners = {};
    vi.spyOn(process, 'on').mockImplementation(((event: string, cb: Listener) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(cb);
      return process;
    }) as typeof process.on);
    vi.spyOn(process, 'exit').mockReturnValue(undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('on uncaughtException logs, closes app, exits 1', async () => {
    const logger = { error: vi.fn() };
    const close = vi.fn().mockResolvedValue(undefined);
    registerProcessErrorHandlers(logger as never, () =>
      ({ close } as never),
    );

    const err = new Error('boom');
    err.stack = 'trace';
    const handler = listeners['uncaughtException']?.[0];
    expect(handler).toBeDefined();
    await handler!(err);

    expect(logger.error).toHaveBeenCalledWith(
      'uncaughtException: boom',
      'trace',
      'Process',
    );
    expect(close).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('second shutdown is ignored', async () => {
    const logger = { error: vi.fn() };
    const close = vi.fn().mockResolvedValue(undefined);
    registerProcessErrorHandlers(logger as never, () =>
      ({ close } as never),
    );

    const handler = listeners['uncaughtException']?.[0]!;
    await handler(new Error('first'));
    await handler(new Error('second'));

    expect(close).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledTimes(1);
  });

  it('logs shutdown failure when app.close rejects', async () => {
    const logger = { error: vi.fn() };
    const close = vi.fn().mockRejectedValue(new Error('close failed'));
    registerProcessErrorHandlers(logger as never, () =>
      ({ close } as never),
    );

    await listeners['uncaughtException']![0]!(new Error('orig'));

    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('unhandledRejection wraps non-Error reason', async () => {
    const logger = { error: vi.fn() };
    const close = vi.fn().mockResolvedValue(undefined);
    registerProcessErrorHandlers(logger as never, () =>
      ({ close } as never),
    );

    await listeners['unhandledRejection']![0]!('reason');

    expect(logger.error).toHaveBeenCalledWith(
      'unhandledRejection: reason',
      expect.any(String),
      'Process',
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('skips close when getApp returns undefined', async () => {
    const logger = { error: vi.fn() };
    registerProcessErrorHandlers(logger as never, () => undefined);

    await listeners['uncaughtException']![0]!(new Error('x'));

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
