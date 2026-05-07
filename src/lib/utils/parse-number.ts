export function parsePositiveNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
