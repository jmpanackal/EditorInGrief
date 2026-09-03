/** Newspaper dateline, e.g. "WEDNESDAY, SEPTEMBER 2, 2026". */
export function dateline(d: Date = new Date()): string {
  return d
    .toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    .toUpperCase();
}
