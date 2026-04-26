import { describe, expect, it } from 'vitest';
import { sanitizeForLog } from '../../sanitize-for-log';

describe('sanitizeForLog', () => {
  it('redacts password fields', () => {
    expect(
      sanitizeForLog({ login: 'a', password: 'secret', nested: { Password: 'x' } }),
    ).toEqual({
      login: 'a',
      password: '[REDACTED]',
      nested: { Password: '[REDACTED]' },
    });
  });

  it('redacts token-like keys', () => {
    expect(
      sanitizeForLog({
        accessToken: 't1',
        refresh_token: 't2',
        data: { apiToken: 't3' },
      }),
    ).toEqual({
      accessToken: '[REDACTED]',
      refresh_token: '[REDACTED]',
      data: { apiToken: '[REDACTED]' },
    });
  });

  it('redacts authorization', () => {
    expect(sanitizeForLog({ Authorization: 'Bearer x' })).toEqual({
      Authorization: '[REDACTED]',
    });
  });

  it('leaves non-sensitive data intact', () => {
    expect(sanitizeForLog({ id: 1, title: 'Hi' })).toEqual({ id: 1, title: 'Hi' });
  });
});
