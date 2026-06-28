/**
 * Zero-decimal currency helpers.
 *
 * Currencies like UGX, KES, JPY have no fractional units —
 * 1 minor unit = 1 major unit.  For these currencies the
 * internal "minor" value IS the display value and must NOT
 * be divided by 100 when sending to payment gateways or
 * formatting for humans.
 */

export const ZERO_DECIMAL_CURRENCIES = new Set([
  'UGX', 'KES', 'TZS', 'RWF',
  'JPY', 'KRW', 'VND', 'CLP', 'PYG',
]);

/** Convert internal minor-unit amount to the major-unit value a gateway expects. */
export function minorToMajor(minor: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? minor : minor / 100;
}

/** Convert a gateway's major-unit amount back to internal minor units. */
export function majorToMinor(major: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? major : Math.round(major * 100);
}

/** Human-readable money string, e.g. "UGX 1,500,000" or "USD 15.00". */
export function fmtMoney(minor: number, currency: string): string {
  const divisor = ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
  const fractionDigits = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  return `${currency} ${(minor / divisor).toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}`;
}
