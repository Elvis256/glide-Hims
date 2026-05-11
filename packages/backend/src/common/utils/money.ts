/**
 * Money — minimal cents-based fixed-point arithmetic helper.
 *
 * Why: PostgreSQL `numeric` columns are returned by TypeORM as `string`
 * (or sometimes already-coerced `number`). Operating on them with
 * JavaScript floats (`Number(a) + Number(b)`) introduces IEEE 754 drift
 * (e.g. `0.1 + 0.2 === 0.30000000000000004`). For currency this is
 * unacceptable: it breaks balance checks, approval-threshold routing,
 * and reconciliation deltas.
 *
 * This module models money as integer **minor units** (cents) and
 * exposes the small set of operations finance code actually needs.
 *
 * Scope (Sprint-4): used in journal entry posting / approval routing /
 * trial balance aggregation. Sprint-5 will extend coverage to billing,
 * payroll, and report aggregators.
 */

export type MoneyCents = number;

/** Convert a decimal-string or number to integer cents. */
export function toCents(value: string | number | null | undefined): MoneyCents {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return 0;
  // Math.round for a single boundary; for sub-cent inputs this rounds
  // to the nearest cent (banking convention). We deliberately do NOT
  // expose sub-cent precision — anything finer must be handled by the
  // caller before reaching this helper.
  return Math.round(n * 100);
}

/** Convert integer cents back to a 2-decimal number for display/serialisation. */
export function fromCents(cents: MoneyCents): number {
  return Math.round(cents) / 100;
}

/** Sum any number of decimal-string/number values exactly (in cents, returned as cents). */
export function sumCents(...values: Array<string | number | null | undefined>): MoneyCents {
  let acc = 0;
  for (const v of values) acc += toCents(v);
  return acc;
}

/** Strict equality between two cent values. */
export function eqCents(a: MoneyCents, b: MoneyCents): boolean {
  return Math.round(a) === Math.round(b);
}

/**
 * Compare two decimal-string/number money amounts at cents precision.
 * Returns -1 / 0 / 1 like a standard comparator.
 */
export function cmpMoney(
  a: string | number,
  b: string | number,
): -1 | 0 | 1 {
  const ac = toCents(a);
  const bc = toCents(b);
  if (ac < bc) return -1;
  if (ac > bc) return 1;
  return 0;
}

/**
 * Maximum of any number of money values at cents precision.
 * Returns the value as a plain decimal number suitable for threshold compares.
 */
export function maxMoney(...values: Array<string | number>): number {
  let max = -Infinity;
  for (const v of values) {
    const c = toCents(v);
    if (c > max) max = c;
  }
  return max === -Infinity ? 0 : fromCents(max);
}
