import { ValidationError } from 'src/common/errors/app-http.error';

export function sortData<T extends object>(
  data: T[],
  sortBy?: string,
  order: 'asc' | 'desc' = 'asc',
  allowedFields: string[] = [],
): T[] {
  if (!sortBy) {
    return data;
  }
  if (!allowedFields.includes(sortBy))
    throw new ValidationError('Invalid sortBy');
  if (sortBy && !['asc', 'desc'].includes(order)) {
    throw new ValidationError('Invalid order value');
  }
  const direction = order === 'asc' ? 1 : -1;
  const copy = [...data];
  copy.sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * direction;
    }
    return String(aValue).localeCompare(String(bValue)) * direction;
  });
  return copy;
}
