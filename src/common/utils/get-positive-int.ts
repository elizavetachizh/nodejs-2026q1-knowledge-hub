/** Parses env string into a finite positive integer, else returns `fallback`. */
export function getPositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
}
