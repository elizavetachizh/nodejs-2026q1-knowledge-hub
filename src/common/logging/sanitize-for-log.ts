const REDACTED = '[REDACTED]';

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  if (k === 'authorization') return true;
  if (k.includes('password')) return true;
  if (k.includes('token')) return true;
  if (k.includes('secret')) return true;
  return k === 'cookie' || k === 'set-cookie';
}

/**
 * Returns a deep clone safe for logging (passwords, tokens → [REDACTED]).
 */
export function sanitizeForLog<T>(value: T): T {
  if (value === null || value === undefined) return value;

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item)) as T;
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : sanitizeForLog(v);
    }
    return out as T;
  }

  return value;
}
