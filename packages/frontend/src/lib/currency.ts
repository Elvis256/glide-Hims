/**
 * Currency configuration and formatting utilities
 * Currency can be configured in Admin > Services & Pricing > Currency Settings
 */

// Storage key for system settings
const SETTINGS_KEY = 'glide_system_settings';

// Available currencies for Uganda and East Africa
export const AVAILABLE_CURRENCIES = [
  { code: 'UGX', symbol: 'UGX', name: 'Ugandan Shilling', country: 'Uganda', decimals: 0 },
  { code: 'USD', symbol: '$', name: 'US Dollar', country: 'United States', decimals: 2 },
  { code: 'EUR', symbol: '€', name: 'Euro', country: 'European Union', decimals: 2 },
  { code: 'GBP', symbol: '£', name: 'British Pound', country: 'United Kingdom', decimals: 2 },
  { code: 'KES', symbol: 'KES', name: 'Kenyan Shilling', country: 'Kenya', decimals: 0 },
  { code: 'TZS', symbol: 'TZS', name: 'Tanzanian Shilling', country: 'Tanzania', decimals: 0 },
  { code: 'RWF', symbol: 'RWF', name: 'Rwandan Franc', country: 'Rwanda', decimals: 0 },
  { code: 'SSP', symbol: 'SSP', name: 'South Sudanese Pound', country: 'South Sudan', decimals: 2 },
] as const;

export type CurrencyCode = typeof AVAILABLE_CURRENCIES[number]['code'];

interface SystemSettings {
  currencyCode: CurrencyCode;
  currencySymbol: string;
  currencyName: string;
  currencyDecimals: number;
  country: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
}

// Default settings for Uganda
const DEFAULT_SETTINGS: SystemSettings = {
  currencyCode: 'UGX',
  currencySymbol: 'UGX',
  currencyName: 'Ugandan Shilling',
  currencyDecimals: 0,
  country: 'Uganda',
  timezone: 'Africa/Kampala',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
};

// Get settings from localStorage
function getStoredSettings(): SystemSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Fall back to defaults
  }
  return DEFAULT_SETTINGS;
}

// Save settings to localStorage
export function saveSystemSettings(settings: Partial<SystemSettings>): void {
  const current = getStoredSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  // Dispatch event for components to react to settings change
  window.dispatchEvent(new CustomEvent('system-settings-changed', { detail: updated }));
}

// Set currency by code
export function setSystemCurrency(code: CurrencyCode): void {
  const currency = AVAILABLE_CURRENCIES.find(c => c.code === code);
  if (currency) {
    saveSystemSettings({
      currencyCode: currency.code,
      currencySymbol: currency.symbol,
      currencyName: currency.name,
      currencyDecimals: currency.decimals,
    });
  }
}

// Get current settings (reactive)
export function getSystemSettings(): SystemSettings {
  return getStoredSettings();
}

// System-wide currency configuration (computed from settings)
export function getCurrencyCode(): CurrencyCode {
  return getStoredSettings().currencyCode;
}

export function getCurrencySymbol(): string {
  return getStoredSettings().currencySymbol;
}

export function getCurrencyName(): string {
  return getStoredSettings().currencyName;
}

export function getCurrencyDecimals(): number {
  return getStoredSettings().currencyDecimals;
}

// Legacy exports for backward compatibility
export const CURRENCY_CODE = DEFAULT_SETTINGS.currencyCode;
export const CURRENCY_SYMBOL = DEFAULT_SETTINGS.currencySymbol;
export const CURRENCY_NAME = DEFAULT_SETTINGS.currencyName;

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
    currencyCode?: CurrencyCode;
  }
): string {
  const settings = getStoredSettings();
  const symbol = options?.currencyCode 
    ? (AVAILABLE_CURRENCIES.find(c => c.code === options.currencyCode)?.symbol || settings.currencySymbol)
    : settings.currencySymbol;
  const defaultDecimals = settings.currencyDecimals;
  
  const { showSymbol = true, compact = false, decimals = defaultDecimals } = options || {};
  
  if (amount === undefined || amount === null || isNaN(amount)) {
    return showSymbol ? `${symbol} 0` : '0';
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

  return showSymbol ? `${symbol} ${formatted}` : formatted;
}

/**
 * Parse a currency string back to number
 * @param value - Currency string to parse
 * @returns Parsed number or 0
 */
export function parseCurrency(value: string): number {
  if (!value) return 0;
  const symbol = getCurrencySymbol();
  const cleaned = value.replace(new RegExp(`[${symbol}\\s,]`, 'g'), '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export default {
  CURRENCY_CODE,
  CURRENCY_SYMBOL,
  CURRENCY_NAME,
  AVAILABLE_CURRENCIES,
  formatCurrency,
  parseCurrency,
  getCurrencyCode,
  getCurrencySymbol,
  getCurrencyName,
  getCurrencyDecimals,
  setSystemCurrency,
  saveSystemSettings,
  getSystemSettings,
};
