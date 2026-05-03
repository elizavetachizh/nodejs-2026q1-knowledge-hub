import { describe, it, expect } from 'vitest';
import { PageDto } from 'src/common/dto/page-query.dto';

describe('PageDto', () => {
  it('computes totalPages from total and limit', () => {
    const page = new PageDto([1, 2, 3], 25, 2, 10);
    expect(page.data).toEqual([1, 2, 3]);
    expect(page.total).toBe(25);
    expect(page.page).toBe(2);
    expect(page.limit).toBe(10);
    expect(page.totalPages).toBe(3);
  });
});
