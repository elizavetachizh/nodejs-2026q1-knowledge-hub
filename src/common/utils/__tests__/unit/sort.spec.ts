import { BadRequestException } from '@nestjs/common';
import { describe, it, expect } from 'vitest';
import { sortData } from 'src/common/utils/sort';

describe('sortData', () => {
  const rows = [
    { title: 'b', n: 2 },
    { title: 'a', n: 1 },
  ];

  it('returns original array when sortBy is missing', () => {
    expect(sortData(rows, undefined, 'asc', ['title'])).toEqual(rows);
  });

  it('sorts by allowed string field asc', () => {
    const out = sortData(rows, 'title', 'asc', ['title']);
    expect(out.map((r) => r.title)).toEqual(['a', 'b']);
  });

  it('sorts by allowed string field desc', () => {
    const out = sortData(rows, 'title', 'desc', ['title']);
    expect(out.map((r) => r.title)).toEqual(['b', 'a']);
  });

  it('sorts numeric fields', () => {
    const out = sortData(rows, 'n', 'asc', ['n']);
    expect(out.map((r) => r.n)).toEqual([1, 2]);
  });

  it('throws when sortBy is not allowed', () => {
    expect(() => sortData(rows, 'oops', 'asc', ['title'])).toThrow(
      BadRequestException,
    );
  });

  it('throws when order is invalid', () => {
    expect(() =>
      sortData(rows, 'title', 'oops' as unknown as 'asc', ['title']),
    ).toThrow(BadRequestException);
  });

  it('handles null field values', () => {
    const withNull = [{ k: null as unknown as string }, { k: 'a' }];
    const out = sortData(withNull, 'k', 'asc', ['k']);
    expect(out[0].k).toBe('a');
  });
});
