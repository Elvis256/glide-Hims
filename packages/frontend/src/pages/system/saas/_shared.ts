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
  billingEmail?: string | null; billingCurrency?: string | null;
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

export type PaymentVerificationStatus = 'unverified' | 'pending_verification' | 'verified' | 'rejected';

export interface SaasPayment {
  id: string; invoiceId: string; subscriptionId: string; tenantId: string;
  currency: string; amountMinor: number; status: string; gateway: string;
  gatewayRef: string | null; method: string | null; paidAt: string;
  notes: string | null;
  verificationStatus: PaymentVerificationStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationNotes: string | null;
  proofs?: PaymentProof[];
}

export interface PaymentProof {
  id: string;
  paymentId: string;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  notes: string | null;
  createdAt: string;
}

export const VERIFICATION_STATUS_STYLES: Record<PaymentVerificationStatus, string> = {
  unverified: 'bg-gray-100 text-gray-600',
  pending_verification: 'bg-amber-100 text-amber-700',
  verified: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

export const VERIFICATION_STATUS_LABELS: Record<PaymentVerificationStatus, string> = {
  unverified: 'Unverified',
  pending_verification: 'Pending Verification',
  verified: 'Verified',
  rejected: 'Rejected',
};

export interface Coupon {
  id: string; code: string; discountType: 'percent' | 'fixed'; amount: number; currency: string;
  maxRedemptions: number | null; timesRedeemed: number; durationMonths: number | null;
  expiresAt: string | null; appliesToPlanIds: string[] | null;
  isActive: boolean; notes: string | null; createdAt: string;
}

const ZERO_DECIMAL_CURRENCIES = new Set(['UGX', 'KES', 'TZS', 'RWF', 'JPY', 'KRW', 'VND', 'CLP', 'PYG']);

export function fmtMoney(minor: number, currency = 'UGX'): string {
  const divisor = ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
  const value = (minor || 0) / divisor;
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

// ---------------------------------------------------------------------------
// Quotation types
// ---------------------------------------------------------------------------

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'superseded';
export type CatalogItemCategory = 'module' | 'hardware' | 'training' | 'implementation' | 'support' | 'other';

export interface CatalogItem {
  id: string; code: string; name: string; description: string | null;
  category: CatalogItemCategory; unitPriceMinor: number; currency: string;
  isActive: boolean; sortOrder: number; metadata: any;
  createdAt: string; updatedAt: string;
}

export interface QuotationLineItem {
  catalogItemId?: string | null; moduleId?: string | null;
  description: string; quantity: number; unitPriceMinor: number;
  amountMinor: number; category: CatalogItemCategory;
}

export interface QuotationRevision {
  id: string; quotationId: string; revisionNumber: number;
  subtotalMinor: number; discountMinor: number; taxMinor: number; totalMinor: number;
  lineItems: QuotationLineItem[];
  changeNotes: string | null; createdBy: string | null; createdAt: string;
}

export interface Quotation {
  id: string; quotationNumber: string;
  leadId: string | null; planId: string | null;
  clientName: string; clientOrganization: string | null;
  clientEmail: string | null; clientPhone: string | null; clientCountry: string | null;
  currency: string; fxRateToBase: string; billingInterval: string; seats: number;
  includeVat: boolean; vatRatePercent: string; deductWht: boolean; whtRatePercent: string;
  discountPercent: string; discountFixedMinor: number;
  issueDate: string; validUntil: string | null; sentAt: string | null;
  acceptedAt: string | null; rejectedAt: string | null;
  currentRevisionNumber: number; status: QuotationStatus;
  subscriptionId: string | null; contractId: string | null;
  deploymentType: string | null; deploymentDomain: string | null; deploymentId: string | null;
  notes: string | null; internalNotes: string | null;
  createdBy: string | null; metadata: any;
  revisions: QuotationRevision[];
  createdAt: string; updatedAt: string;
}

export const QUOTATION_STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  superseded: 'bg-purple-100 text-purple-700',
};

// ---------------------------------------------------------------------------
// Contract types
// ---------------------------------------------------------------------------

export type ContractStatus = 'draft' | 'pending_signature' | 'active' | 'expired' | 'terminated';

export interface Contract {
  id: string; contractNumber: string;
  quotationId: string | null; subscriptionId: string | null; tenantId: string | null;
  clientName: string; clientOrganization: string | null;
  status: ContractStatus; contractType: string;
  startDate: string; endDate: string | null;
  totalValueMinor: number; currency: string;
  autoRenew: boolean; renewalNoticeDays: number;
  termsText: string | null;
  signatories: Array<{ name: string; title: string; email: string; signedAt: string | null }> | null;
  notes: string | null; createdBy: string | null; metadata: any;
  createdAt: string; updatedAt: string;
}

export const CONTRACT_STATUS_STYLES: Record<ContractStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_signature: 'bg-amber-100 text-amber-700',
  active: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-700',
  terminated: 'bg-gray-100 text-gray-500',
};

// ---------------------------------------------------------------------------
// Onboarding types
// ---------------------------------------------------------------------------

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';
export type OnboardingItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';
export type OnboardingPhase = 'setup' | 'configuration' | 'data_migration' | 'training' | 'testing' | 'go_live';

export interface OnboardingItem {
  id: string; onboardingId: string; phase: OnboardingPhase;
  title: string; description: string | null; sortOrder: number;
  status: OnboardingItemStatus; assignedTo: string | null;
  dueDate: string | null; completedAt: string | null; notes: string | null;
}

export interface Onboarding {
  id: string; tenantId: string | null; tenant?: TenantRef | null;
  deploymentId: string | null;
  quotationId: string | null; subscriptionId: string | null;
  status: OnboardingStatus; progressPercent: number;
  targetGoLiveDate: string | null; actualGoLiveDate: string | null;
  assignedTo: string | null; notes: string | null; metadata: any;
  items: OnboardingItem[];
  createdAt: string; updatedAt: string;
}

export const ONBOARDING_STATUS_STYLES: Record<OnboardingStatus, string> = {
  not_started: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-red-100 text-red-700',
};

// ---------------------------------------------------------------------------
// Client Health types
// ---------------------------------------------------------------------------

export type HealthStatus = 'healthy' | 'at_risk' | 'critical';

export interface ClientHealth {
  id: string; tenantId: string; subscriptionId: string | null;
  tenant?: TenantRef | null;
  overallScore: number; healthStatus: HealthStatus;
  usageScore: number; paymentScore: number; supportScore: number;
  adoptionScore: number; deploymentScore: number;
  componentDetails: any; alerts: any[];
  lastCalculatedAt: string | null;
}

export const HEALTH_STATUS_STYLES: Record<HealthStatus, string> = {
  healthy: 'bg-emerald-100 text-emerald-700',
  at_risk: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

export function unwrap<T = any>(res: any): T {
  return res?.data?.data ?? res?.data;
}

export interface DiffItem {
  key: string;
  oldValue: string | null;
  newValue: string | null;
}

export function getObjectDiff(oldVal: any, newVal: any): DiffItem[] {
  if (!oldVal && !newVal) return [];
  const oldObj = oldVal && typeof oldVal === 'object' ? oldVal : {};
  const newObj = newVal && typeof newVal === 'object' ? newVal : {};
  
  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)])).sort();
  const diffs: DiffItem[] = [];
  
  for (const key of allKeys) {
    const oVal = oldObj[key];
    const nVal = newObj[key];
    
    const oStr = oVal !== undefined ? (typeof oVal === 'object' ? JSON.stringify(oVal) : String(oVal)) : null;
    const nStr = nVal !== undefined ? (typeof nVal === 'object' ? JSON.stringify(nVal) : String(nVal)) : null;
    
    if (oStr !== nStr) {
      diffs.push({ key, oldValue: oStr, newValue: nStr });
    }
  }
  return diffs;
}

