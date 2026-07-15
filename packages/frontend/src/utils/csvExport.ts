/**
 * Canonical CSV export utilities for the whole app.
 *
 * `pages/reports/_reportUtils.ts` re-exports `csvEscape` / `toCsv` /
 * `downloadBlob` from here, so every CSV the app produces — reports, admin
 * pages, asset registers — goes through one escaping implementation.
 *
 * Two entry points:
 *  - `exportToCsv(filename, data, columns)` — object rows + column accessors.
 *  - `toCsv(rows)` + `downloadBlob(name, mime, content)` — pre-built 2D arrays.
 */

interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

/**
 * Neutralise CSV formula injection. A cell starting with =, +, -, @, TAB or CR
 * is evaluated as a formula by Excel/Sheets when the file is opened, so a value
 * like `=cmd|'/c calc'!A0` stored in a patient or staff name becomes code
 * execution on the machine of whoever opens the export. Prefixing with an
 * apostrophe forces the spreadsheet to treat the cell as literal text.
 *
 * The backend export module already does this (bb77241e); the frontend
 * exporters did not, so the same payload was still weaponisable via any
 * client-side "Export CSV" button.
 */
function neutralizeFormula(str: string): string {
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

/** Escape a single cell: neutralise formulas, then RFC-4180 quote if needed. */
export const csvEscape = (v: unknown): string => {
  const raw = v === null || v === undefined ? '' : String(v);
  const s = neutralizeFormula(raw);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Serialise a 2D array (including its header row) to RFC-4180 CSV text. */
export const toCsv = (rows: Array<Array<unknown>>): string =>
  rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');

/** Trigger a client-side file download. */
export const downloadBlob = (filename: string, mime: string, content: BlobPart): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export function exportToCsv<T>(
  filename: string,
  data: T[],
  columns: CsvColumn<T>[],
) {
  if (data.length === 0) return;

  const rows: Array<Array<unknown>> = [
    columns.map((c) => c.header),
    ...data.map((row) => columns.map((c) => c.accessor(row))),
  ];

  downloadBlob(
    `${filename}-${new Date().toISOString().slice(0, 10)}.csv`,
    'text/csv;charset=utf-8;',
    toCsv(rows),
  );
}
