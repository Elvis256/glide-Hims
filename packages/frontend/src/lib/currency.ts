/**
 * Currency configuration and formatting utilities
 * Change CURRENCY_CODE and CURRENCY_SYMBOL to update the system currency
 */

// System-wide currency configuration
export const CURRENCY_CODE = 'UGX';
export const CURRENCY_SYMBOL = 'UGX';
export const CURRENCY_NAME = 'Ugandan Shilling';

/**
 * Format a number as currency
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number | undefined | null,
  options?: {
    showSymbol?: boolean;
    compact?: boolean;
    decimals?: number;
  }
): string {
  const { showSymbol = true, compact = false, decimals = 0 } = options || {};
  
  if (amount === undefined || amount === null || isNaN(amount)) {
    return showSymbol ? `${CURRENCY_SYMBOL} 0` : '0';
  }

  let formatted: string;
  
  if (compact) {
    if (amount >= 1_000_000_000) {
      formatted = `${(amount / 1_000_000_000).toFixed(1)}B`;
    } else if (amount >= 1_000_000) {
      formatted = `${(amount / 1_000_000).toFixed(1)}M`;
    } else if (amount >= 1_000) {
      formatted = `${(amount / 1_000).toFixed(0)}K`;
    } else {
      formatted = amount.toLocaleString(undefined, { 
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals 
      });
    }
  } else {
    formatted = amount.toLocaleString(undefined, { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    });
  }

  return showSymbol ? `${CURRENCY_SYMBOL} ${formatted}` : formatted;
}

/**
 * Parse a currency string back to number
 * @param value - Currency string to parse
 * @returns Parsed number or 0
 */
export function parseCurrency(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(new RegExp(`[${CURRENCY_SYMBOL}\\s,]`, 'g'), '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export default {
  CURRENCY_CODE,
  CURRENCY_SYMBOL,
  CURRENCY_NAME,
  formatCurrency,
  parseCurrency,
};
