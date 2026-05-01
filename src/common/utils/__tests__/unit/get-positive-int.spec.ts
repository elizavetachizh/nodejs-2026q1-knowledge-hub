import { describe, it, expect } from 'vitest';
import { getPositiveInt } from 'src/common/utils/get-positive-int';

describe('getPositiveInt', () => {
  it('returns fallback when value is missing', () => {
    expect(getPositiveInt(undefined, 10)).toBe(10);
  });

  it('returns parsed int when positive', () => {
    expect(getPositiveInt('20', 1)).toBe(20);
  });

  it('truncates decimals', () => {
    expect(getPositiveInt('3.9', 1)).toBe(3);
  });

  it('falls back when non-numeric', () => {
    expect(getPositiveInt('x', 5)).toBe(5);
  });

  it('falls back when zero or negative', () => {
    expect(getPositiveInt('0', 7)).toBe(7);
    expect(getPositiveInt('-2', 7)).toBe(7);
  });
});
