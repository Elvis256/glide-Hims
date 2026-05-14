/**
 * CANONICAL payment-method definitions for the whole platform (frontend twin).
 *
 * KEEP IN SYNC with packages/backend/src/shared/payment-methods.ts.
 * Every page that references a payment method MUST import from here.
 * Do not declare local `type PaymentType = …` string unions.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  CreditCard,
  Smartphone,
  Building2,
  FileText,
  Shield,
  BadgeCheck,
  Briefcase,
  UserCheck,
  Wallet,
} from 'lucide-react';

export const PAYMENT_METHODS = [
  'cash',
  'mobile_money',
  'card',
  'bank_transfer',
  'cheque',
  'insurance',
  'membership',
  'hospital_scheme',
  'staff',
  'credit',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  insurance: 'Insurance',
  membership: 'Membership',
  hospital_scheme: 'Hospital Scheme',
  staff: 'Staff Benefit',
  credit: 'Credit / Account',
};

export const PAYMENT_METHOD_SHORT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile',
  card: 'Card',
  bank_transfer: 'Bank',
  cheque: 'Cheque',
  insurance: 'Insurance',
  membership: 'Member',
  hospital_scheme: 'Scheme',
  staff: 'Staff',
  credit: 'Credit',
};

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  mobile_money: Smartphone,
  card: CreditCard,
  bank_transfer: Building2,
  cheque: FileText,
  insurance: Shield,
  membership: BadgeCheck,
  hospital_scheme: Briefcase,
  staff: UserCheck,
  credit: Wallet,
};

/**
 * Colour pair: bg + text. Used by the chip styling.
 * Keep low-saturation so they look good in a row.
 */
export const PAYMENT_METHOD_COLORS: Record<PaymentMethod, { active: string; idle: string }> = {
  cash: { active: 'bg-green-600 text-white', idle: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  mobile_money: { active: 'bg-yellow-500 text-white', idle: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  card: { active: 'bg-blue-600 text-white', idle: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  bank_transfer: { active: 'bg-indigo-600 text-white', idle: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  cheque: { active: 'bg-slate-600 text-white', idle: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  insurance: { active: 'bg-sky-600 text-white', idle: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  membership: { active: 'bg-purple-600 text-white', idle: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  hospital_scheme: { active: 'bg-teal-600 text-white', idle: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  staff: { active: 'bg-orange-600 text-white', idle: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  credit: { active: 'bg-rose-600 text-white', idle: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
};

/** Methods where the patient/customer pays in full at the counter. */
export const SETTLED_NOW_METHODS: readonly PaymentMethod[] = [
  'cash',
  'mobile_money',
  'card',
  'bank_transfer',
  'cheque',
];

/** Methods where charges are absorbed by a 3rd party / deferred — no upfront payment. */
export const COVERAGE_METHODS: readonly PaymentMethod[] = [
  'insurance',
  'membership',
  'hospital_scheme',
  'staff',
  'credit',
];

export function isCoverageMethod(m: PaymentMethod | string | null | undefined): boolean {
  return !!m && (COVERAGE_METHODS as readonly string[]).includes(m);
}

export function isValidPaymentMethod(m: unknown): m is PaymentMethod {
  return typeof m === 'string' && (PAYMENT_METHODS as readonly string[]).includes(m);
}

/** Vendor / supplier payments only have a subset of methods. */
export const VENDOR_PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'bank_transfer',
  'cheque',
  'mobile_money',
  'card',
];

/** Methods enabled by default in any new tenant (until they configure their own). */
export const DEFAULT_ENABLED_METHODS: readonly PaymentMethod[] = [
  'cash',
  'mobile_money',
  'card',
  'insurance',
  'membership',
  'hospital_scheme',
  'staff',
];

/**
 * Normalise legacy slugs that may still exist in the database.
 *   'credit_card' → 'card'   (supplier-payment legacy)
 *   'check'       → 'cheque' (typo)
 *   'corporate'   → 'hospital_scheme'
 *   'mobile'      → 'mobile_money'
 */
export function normalisePaymentMethod(raw: string | null | undefined): PaymentMethod | null {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_');
  const map: Record<string, PaymentMethod> = {
    credit_card: 'card',
    creditcard: 'card',
    debit_card: 'card',
    check: 'cheque',
    mobile: 'mobile_money',
    momo: 'mobile_money',
    corporate: 'hospital_scheme',
    scheme: 'hospital_scheme',
    member: 'membership',
  };
  if (map[v]) return map[v];
  return isValidPaymentMethod(v) ? v : null;
}
