/**
 * CANONICAL payment-method definitions for the whole platform.
 *
 * KEEP IN SYNC with packages/frontend/src/shared/payment-methods.ts
 * (kept as twin files because there is no shared workspace yet).
 *
 * Every entity / DTO / UI that references a payment method MUST import
 * from this file. Do not introduce local string-literal unions.
 */

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

/**
 * Subset used by supplier / vendor payments (no patient-side methods).
 * Kept here so reports/joins use one canonical slug list.
 */
export const VENDOR_PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'bank_transfer',
  'cheque',
  'mobile_money',
  'card',
];
