// Shared utilities for /reports pages.
// Keep this small and dependency-free — it's imported by every report page.

export type DateRange = 'today' | 'week' | 'month' | 'year' | 'custom';

export const num = (v: unknown): number => {
  // The analytics endpoints frequently return numeric columns as strings
  // (postgres-via-typeorm raw queries). Always coerce at the boundary so
  // string-concat bugs don't poison reduce()/percentage maths downstream.
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const csvEscape = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: Array<Array<unknown>>): string =>
  rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');

export const downloadBlob = (filename: string, mime: string, content: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const fmtDateISODay = (d: Date): string => d.toISOString().slice(0, 10);

export const periodLabelFor = (
  range: DateRange,
  customFrom: string,
  customTo: string,
): string => {
  switch (range) {
    case 'today':
      return 'Today';
    case 'week':
      return 'This Week';
    case 'month':
      return 'This Month';
    case 'year':
      return 'This Year';
    case 'custom':
      return `${customFrom} → ${customTo}`;
  }
};

export const titleCase = (s: string): string =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

export const ageGroupOrder = (g: string): number => {
  const m = g.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : 999;
};

export const pct = (n: number, d: number): string =>
  d > 0 ? ((n / d) * 100).toFixed(1) + '%' : '—';
