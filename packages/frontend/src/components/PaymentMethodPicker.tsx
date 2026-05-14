import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_SHORT_LABELS,
  PAYMENT_METHOD_ICONS,
  PAYMENT_METHOD_COLORS,
  DEFAULT_ENABLED_METHODS,
  type PaymentMethod,
} from '../shared/payment-methods';
import api from '../services/api';

interface EnabledMethodRow {
  type?: string;
  slug?: string;
  isActive?: boolean;
  enabled?: boolean;
}

/**
 * Canonical picker used by every form that captures a payment method
 * (OPD token, billing, POS, vendor payments).
 *
 * - Reads the tenant's enabled methods from /admin/finance/payment-methods
 *   so disabling "cheque" in admin removes it everywhere.
 * - `allow` lets a screen further restrict the list (e.g. vendor payments
 *   only allow VENDOR_PAYMENT_METHODS).
 * - Renders the same chip layout used across the app.
 */
export interface PaymentMethodPickerProps {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
  /** Optional whitelist — methods not in this list are hidden. */
  allow?: readonly PaymentMethod[];
  /** Show short labels (good for tight rows). */
  compact?: boolean;
  /** Additional class on the wrapping grid. */
  className?: string;
  /** Disable the entire picker. */
  disabled?: boolean;
  /** Show the short admin link when no methods are enabled. */
  showEmptyHint?: boolean;
}

export function PaymentMethodPicker({
  value,
  onChange,
  allow,
  compact = false,
  className = '',
  disabled = false,
  showEmptyHint = true,
}: PaymentMethodPickerProps) {
  const { data: tenantMethods } = useQuery({
    queryKey: ['enabled-payment-methods'],
    queryFn: async (): Promise<PaymentMethod[]> => {
      try {
        const res = await api.get<EnabledMethodRow[]>('/admin/finance/payment-methods');
        const rows = Array.isArray(res.data) ? res.data : [];
        const enabled = rows
          .filter((r) => r.isActive !== false && r.enabled !== false)
          .map((r) => (r.slug || r.type || '').toLowerCase())
          .filter((s): s is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(s));
        return enabled.length > 0 ? enabled : [...DEFAULT_ENABLED_METHODS];
      } catch {
        return [...DEFAULT_ENABLED_METHODS];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const methods = useMemo(() => {
    const enabled = tenantMethods || DEFAULT_ENABLED_METHODS;
    const list = allow ? enabled.filter((m) => allow.includes(m)) : enabled;
    return list;
  }, [tenantMethods, allow]);

  if (methods.length === 0) {
    return showEmptyHint ? (
      <p className="text-xs text-gray-400 py-2">
        No payment methods enabled. Configure them under{' '}
        <a href="/admin/finance/payment-methods" className="text-blue-600 hover:underline">
          Finance · Payment Methods
        </a>
        .
      </p>
    ) : null;
  }

  return (
    <div
      className={`grid gap-1.5 ${
        compact ? 'grid-cols-4 sm:grid-cols-5' : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5'
      } ${className}`}
    >
      {methods.map((m) => {
        const Icon = PAYMENT_METHOD_ICONS[m];
        const colors = PAYMENT_METHOD_COLORS[m];
        const isActive = value === m;
        const label = compact ? PAYMENT_METHOD_SHORT_LABELS[m] : PAYMENT_METHOD_LABELS[m];
        return (
          <button
            key={m}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m)}
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
              isActive ? colors.active : colors.idle
            }`}
            aria-pressed={isActive}
            title={PAYMENT_METHOD_LABELS[m]}
          >
            <Icon className="w-4 h-4" />
            <span className="truncate w-full text-center">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default PaymentMethodPicker;
