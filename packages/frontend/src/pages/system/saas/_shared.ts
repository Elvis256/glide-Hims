// Shared helpers + types for SaaS revenue UI.
export type PlanTier = 'community' | 'standard' | 'professional' | 'enterprise';
export type BillingInterval = 'monthly' | 'annual';
export type SubStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'churned' | 'paused';
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface Plan {
  id: string; code: string; name: string; description: string | null;
  tier: PlanTier; priceMonthlyMinor: number; priceAnnualMinor: number; currency: string;
  annualDiscountPercent: number; trialDays: number;
  maxUsers: number | null; maxFacilities: number | null;
  enabledModules: string[] | null; features: any;
  isActive: boolean; isPublic: boolean; sortOrder: number;
  createdAt: string; updatedAt: string;
}

export interface TenantRef { id: string; name: string; slug: string }

export interface Subscription {
  id: string; tenantId: string; tenant?: TenantRef | null;
  deploymentId: string | null; leadId: string | null;
  planId: string; plan?: Plan; status: SubStatus; billingInterval: BillingInterval;
  currency: string; unitPriceMinor: number; seats: number;
  discountPercent: number; discountFixedMinor: number;
  startDate: string; trialEndsAt: string | null;
  currentPeriodStart: string | null; currentPeriodEnd: string | null;
  nextRenewalAt: string | null; cancelledAt: string | null; churnedAt: string | null;
  lastInvoicedAt: string | null;
  autoRenew: boolean; cancelAtPeriodEnd: boolean;
  notes: string | null; failedPaymentAttempts: number; lastDunningAt: string | null;
  createdAt: string; updatedAt: string;
}

export interface SaasInvoice {
  id: string; invoiceNumber: string; subscriptionId: string; tenantId: string; tenant?: TenantRef | null;
  status: InvoiceStatus; currency: string;
  subtotalMinor: number; discountMinor: number; taxMinor: number; totalMinor: number;
  amountPaidMinor: number; issuedAt: string; dueAt: string; paidAt: string | null;
  periodStart: string | null; periodEnd: string | null;
  memo: string | null;
  lines: Array<{ description: string; quantity: number; unitPriceMinor: number; amountMinor: number }> | null;
}

export interface SaasPayment {
  id: string; invoiceId: string; subscriptionId: string; tenantId: string;
  currency: string; amountMinor: number; status: string; gateway: string;
  gatewayRef: string | null; method: string | null; paidAt: string;
  notes: string | null;
}

export interface Coupon {
  id: string; code: string; discountType: 'percent' | 'fixed'; amount: number; currency: string;
  maxRedemptions: number | null; timesRedeemed: number; durationMonths: number | null;
  expiresAt: string | null; appliesToPlanIds: string[] | null;
  isActive: boolean; notes: string | null; createdAt: string;
}

export function fmtMoney(minor: number, currency = 'UGX'): string {
  const value = (minor || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

export const SUB_STATUS_STYLES: Record<SubStatus, string> = {
  trial: 'bg-blue-100 text-blue-700',
  active: 'bg-emerald-100 text-emerald-700',
  past_due: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-gray-100 text-gray-600',
  churned: 'bg-red-100 text-red-700',
  paused: 'bg-purple-100 text-purple-700',
};

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  open: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  void: 'bg-gray-100 text-gray-500',
  uncollectible: 'bg-red-100 text-red-700',
};

export function unwrap<T = any>(res: any): T {
  return res?.data?.data ?? res?.data;
}
