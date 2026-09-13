export function addDays(dateKey: string, n: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dateRange(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}
