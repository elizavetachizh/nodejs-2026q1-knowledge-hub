import { describe, it, expect, beforeEach } from 'vitest';
import { AppThrottlerGuard } from 'src/common/guards/throttler.guard';

describe('AppThrottlerGuard', () => {
  let guard: AppThrottlerGuard;

  beforeEach(() => {
    guard = new AppThrottlerGuard({} as never, {} as never, {} as never);
  });

  async function getTracker(req: Record<string, unknown>): Promise<string> {
    return (
      guard as unknown as { getTracker: (r: typeof req) => Promise<string> }
    ).getTracker(req);
  }

  describe('getTracker', () => {
    it('uses first address from x-forwarded-for', async () => {
      const tracker = await getTracker({
        headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1, 192.168.1.1' },
      });
      expect(tracker).toBe('203.0.113.1');
    });

    it('trims whitespace around first x-forwarded-for entry', async () => {
      const tracker = await getTracker({
        headers: { 'x-forwarded-for': '  198.51.100.2  , 10.0.0.1' },
      });
      expect(tracker).toBe('198.51.100.2');
    });

    it('falls back to req.ip when x-forwarded-for is absent', async () => {
      const tracker = await getTracker({
        headers: {},
        ip: '10.0.0.5',
      });
      expect(tracker).toBe('10.0.0.5');
    });

    it('falls back to req.connection.remoteAddress when ip is missing', async () => {
      const tracker = await getTracker({
        headers: {},
        connection: { remoteAddress: '::1' },
      });
      expect(tracker).toBe('::1');
    });

    it('ignores empty x-forwarded-for string and uses ip', async () => {
      const tracker = await getTracker({
        headers: { 'x-forwarded-for': '' },
        ip: '172.16.0.1',
      });
      expect(tracker).toBe('172.16.0.1');
    });

    it('returns unknown when no tracker can be resolved', async () => {
      const tracker = await getTracker({
        headers: {},
      });
      expect(tracker).toBe('unknown');
    });
  });
});
