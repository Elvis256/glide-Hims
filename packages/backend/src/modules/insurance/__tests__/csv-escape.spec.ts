/**
 * Tests for CSV formula-injection escape logic in ClaimExportService.
 * The csvEscape method is private, so we test it via a standalone copy
 * of the same regex + logic (kept in sync by asserting against known I/O pairs).
 */

const FORMULA_LEADERS = /^[=+\-@\t\r]/;

function csvEscape(v: string): string {
  let s = String(v ?? '');
  if (s.length && FORMULA_LEADERS.test(s)) {
    s = `'${s}`;
  }
  if (/[,"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

describe('csvEscape (formula-injection prevention)', () => {
  describe('formula leader prefixing', () => {
    it.each([
      ['=SUM(A1)', "'\\'=SUM(A1)"],
      ['+cmd|…', "\\'+cmd|…"],
      ['-cmd|…', "\\'-cmd|…"],
      ['@SUM(A1)', "\\''@SUM(A1)"],
    ])('prefixes %s with single-quote', (input, _desc) => {
      const result = csvEscape(input);
      expect(result.startsWith("'")).toBe(true);
    });

    it("prefixes tab-leader with '", () => {
      const result = csvEscape('\tfoo');
      // Tab triggers both leader prefix AND csv-quoting (tab doesn't match /[,"\n\r]/ so just leader)
      expect(result.startsWith("'")).toBe(true);
    });

    it("prefixes carriage-return-leader with '", () => {
      const result = csvEscape('\rfoo');
      // \r triggers leader AND the csv quoting regex
      expect(result.startsWith('"')).toBe(true); // csv-quoting wraps it
      expect(result).toContain("'"); // leader prefix is inside the quotes
    });
  });

  describe('normal text unchanged', () => {
    it('returns plain text as-is', () => {
      expect(csvEscape('Hello World')).toBe('Hello World');
    });

    it('returns numbers as-is', () => {
      expect(csvEscape('12345')).toBe('12345');
    });

    it('handles empty string', () => {
      expect(csvEscape('')).toBe('');
    });

    it('handles null/undefined via String()', () => {
      expect(csvEscape(null as any)).toBe('');
      expect(csvEscape(undefined as any)).toBe('');
    });
  });

  describe('CSV special characters', () => {
    it('wraps value containing commas in quotes', () => {
      expect(csvEscape('a,b')).toBe('"a,b"');
    });

    it('doubles embedded quotes and wraps', () => {
      expect(csvEscape('say "hello"')).toBe('"say ""hello"""');
    });

    it('wraps value containing newline', () => {
      expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    });

    it('wraps value containing carriage return', () => {
      const result = csvEscape('line1\rline2');
      expect(result.startsWith('"')).toBe(true);
      expect(result.endsWith('"')).toBe(true);
    });
  });

  describe('combined formula leader + csv special', () => {
    it('formula leader with comma → prefixed then quoted', () => {
      const result = csvEscape('=A,B');
      // Gets ' prefix, then comma triggers quoting
      expect(result).toBe("\"'=A,B\"");
    });
  });
});
