import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Repository,
  In,
  LessThanOrEqual,
  IsNull,
  MoreThan,
  Not,
  Between,
} from 'typeorm';
import {
  SaasPlan,
  SaasSubscription,
  SaasInvoice,
  SaasPayment,
  SaasCoupon,
  SaasSubscriptionEvent,
  BillingInterval,
  SubscriptionStatus,
  SubscriptionEventType,
} from './saas.entity';
import { License } from '../../database/entities/license.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import {
  CreatePlanDto,
  UpdatePlanDto,
  CreateSubscriptionDto,
  ChangePlanDto,
  RecordPaymentDto,
  CreateCouponDto,
} from './dtos';

const TIER_TO_LICENSE: Record<string, License['licenseType']> = {
  community: 'standard',
  standard: 'standard',
  professional: 'professional',
  enterprise: 'enterprise',
};

import { SaasMailerService } from './saas-mailer.service';
import { FlutterwaveService } from './flutterwave.service';
import { Lead } from '../leads/lead.entity';
import { SystemSettingsService } from '../system-settings/system-settings.service';

export const VENDOR_BILLING_KEY = 'vendor_billing';

export interface VendorBillingSettings {
  legalName: string;
  tradingName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
  logoUrl?: string;
  defaultCurrency?: string;
  invoiceFooter?: string;
}

const DEFAULT_VENDOR_BILLING: VendorBillingSettings = {
  legalName: 'Glide HIMS',
  tradingName: 'Glide HIMS',
  email: 'billing@itsolutionsuganda.com',
  defaultCurrency: 'UGX',
};

export const DUNNING_RULES_KEY = 'dunning_rules';

export interface DunningRules {
  enabled: boolean;
  graceDays: number;
  reminderIntervalDays: number;
  churnAfterDays: number;
}

const DEFAULT_DUNNING_RULES: DunningRules = {
  enabled: true,
  graceDays: 1,
  reminderIntervalDays: 3,
  churnAfterDays: 30,
};

@Injectable()
export class SaasRevenueService {
  private readonly logger = new Logger(SaasRevenueService.name);

  constructor(
    @InjectRepository(SaasPlan) private readonly plans: Repository<SaasPlan>,
    @InjectRepository(SaasSubscription) private readonly subs: Repository<SaasSubscription>,
    @InjectRepository(SaasInvoice) private readonly invoices: Repository<SaasInvoice>,
    @InjectRepository(SaasPayment) private readonly payments: Repository<SaasPayment>,
    @InjectRepository(SaasCoupon) private readonly coupons: Repository<SaasCoupon>,
    @InjectRepository(SaasSubscriptionEvent) private readonly events: Repository<SaasSubscriptionEvent>,
    @InjectRepository(License) private readonly licenses: Repository<License>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly mailer: SaasMailerService,
    private readonly flw: FlutterwaveService,
    private readonly settings: SystemSettingsService,
  ) {}

  // ============================================================
  // VENDOR BILLING SETTINGS (system-wide, tenantId NULL)
  // ============================================================
  async getVendorBilling(): Promise<VendorBillingSettings> {
    try {
      const s = await this.settings.getByKey(VENDOR_BILLING_KEY);
      return { ...DEFAULT_VENDOR_BILLING, ...((s.value || {}) as VendorBillingSettings) };
    } catch {
      return { ...DEFAULT_VENDOR_BILLING };
    }
  }

  async updateVendorBilling(dto: Partial<VendorBillingSettings>): Promise<VendorBillingSettings> {
    const current = await this.getVendorBilling();
    const merged: VendorBillingSettings = { ...current, ...dto };
    if (!merged.legalName || !merged.legalName.trim()) {
      throw new BadRequestException('legalName is required');
    }
    await this.settings.upsert(VENDOR_BILLING_KEY, merged, undefined, 'Vendor billing identity used on SaaS invoices');
    return merged;
  }

  // ============================================================
  // DUNNING RULES (system-wide, tenantId NULL)
  // ============================================================
  async getDunningRules(): Promise<DunningRules> {
    try {
      const s = await this.settings.getByKey(DUNNING_RULES_KEY);
      const v = (s.value || {}) as Partial<DunningRules>;
      return {
        enabled: v.enabled ?? DEFAULT_DUNNING_RULES.enabled,
        graceDays: Math.max(0, Number(v.graceDays ?? DEFAULT_DUNNING_RULES.graceDays)),
        reminderIntervalDays: Math.max(1, Number(v.reminderIntervalDays ?? DEFAULT_DUNNING_RULES.reminderIntervalDays)),
        churnAfterDays: Math.max(1, Number(v.churnAfterDays ?? DEFAULT_DUNNING_RULES.churnAfterDays)),
      };
    } catch {
      return { ...DEFAULT_DUNNING_RULES };
    }
  }

  async updateDunningRules(dto: Partial<DunningRules>): Promise<DunningRules> {
    const current = await this.getDunningRules();
    const merged: DunningRules = {
      enabled: dto.enabled ?? current.enabled,
      graceDays: Math.max(0, Number(dto.graceDays ?? current.graceDays)),
      reminderIntervalDays: Math.max(1, Number(dto.reminderIntervalDays ?? current.reminderIntervalDays)),
      churnAfterDays: Math.max(1, Number(dto.churnAfterDays ?? current.churnAfterDays)),
    };
    if (merged.churnAfterDays < merged.graceDays) {
      throw new BadRequestException('churnAfterDays must be greater than or equal to graceDays');
    }
    await this.settings.upsert(DUNNING_RULES_KEY, merged, undefined, 'SaaS dunning schedule (grace period, reminder cadence, auto-churn)');
    return merged;
  }

  // ============================================================
  // PRINTABLE INVOICE (HTML — browser saves as PDF)
  // ============================================================
  async renderInvoiceHtml(id: string, requireTenantId?: string): Promise<string> {
    const inv = await this.getInvoice(id);
    if (requireTenantId && inv.tenantId !== requireTenantId) {
      throw new ForbiddenException('Invoice does not belong to your tenant');
    }
    const sub = await this.subs.findOne({ where: { id: inv.subscriptionId } });
    const plan = sub ? await this.plans.findOne({ where: { id: sub.planId } }) : null;
    const tenant = await this.tenants.findOne({ where: { id: inv.tenantId }, select: ['id', 'name', 'slug'] as any });
    const vendor = await this.getVendorBilling();
    const fmt = (n: number) => this.fmtMoney(n, inv.currency);
    const fmtD = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
    const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
    const lines = (inv.lines || []) as Array<{ description: string; quantity: number; unitPriceMinor: number; amountMinor: number }>;
    const paidRows = (inv as any).payments as Array<{ paidAt: any; amountMinor: number; gateway: string; method?: string | null; gatewayRef?: string | null }> | undefined;
    const vendorAddr = [vendor.addressLine1, vendor.addressLine2, [vendor.city, vendor.country].filter(Boolean).join(', ')].filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join('');

    return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<title>Invoice ${esc(inv.invoiceNumber)}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0;padding:32px;background:#f8fafc}
  .sheet{max-width:820px;margin:0 auto;background:#fff;padding:48px;border:1px solid #e2e8f0;border-radius:8px}
  h1{margin:0 0 4px;font-size:28px} h2{margin:0 0 12px;font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:.08em}
  .grid{display:flex;justify-content:space-between;gap:32px;margin-bottom:32px}
  .col{flex:1} .muted{color:#64748b;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:16px} th,td{padding:10px 8px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:13px}
  th{background:#f1f5f9;font-weight:600;color:#475569} .right{text-align:right} .totals{margin-top:16px;width:100%}
  .totals td{border:none;padding:4px 8px;font-size:14px} .totals .grand{font-size:18px;font-weight:700;border-top:2px solid #0f172a;padding-top:12px}
  .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
  .b-paid{background:#d1fae5;color:#065f46} .b-open{background:#fef3c7;color:#92400e} .b-void{background:#e5e7eb;color:#374151} .b-draft{background:#dbeafe;color:#1e3a8a}
  .footer{margin-top:40px;padding-top:24px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5}
  @media print{ body{padding:0;background:#fff} .sheet{border:none;box-shadow:none;padding:24px} .noprint{display:none} }
  .noprint{position:fixed;top:16px;right:16px;background:#0f172a;color:#fff;padding:10px 16px;border:none;border-radius:6px;cursor:pointer;font-weight:600}
</style>
</head><body>
<button class="noprint" onclick="window.print()">Print / Save as PDF</button>
<div class="sheet">
  <div class="grid">
    <div class="col">
      ${vendor.logoUrl ? `<img src="${esc(vendor.logoUrl)}" alt="logo" style="max-height:56px;margin-bottom:8px" />` : ''}
      <h1>${esc(vendor.tradingName || vendor.legalName)}</h1>
      <div class="muted">${esc(vendor.legalName)}</div>
      ${vendorAddr}
      ${vendor.taxId ? `<div class="muted">Tax ID: ${esc(vendor.taxId)}</div>` : ''}
      ${vendor.email ? `<div class="muted">${esc(vendor.email)}</div>` : ''}
      ${vendor.phone ? `<div class="muted">${esc(vendor.phone)}</div>` : ''}
      ${vendor.website ? `<div class="muted">${esc(vendor.website)}</div>` : ''}
    </div>
    <div class="col" style="text-align:right">
      <h1>INVOICE</h1>
      <div class="muted"># ${esc(inv.invoiceNumber)}</div>
      <div style="margin-top:8px"><span class="badge b-${esc(inv.status)}">${esc(inv.status)}</span></div>
      <div class="muted" style="margin-top:12px">Issued: ${fmtD(inv.issuedAt)}</div>
      <div class="muted">Due: ${fmtD(inv.dueAt)}</div>
      ${inv.paidAt ? `<div class="muted">Paid: ${fmtD(inv.paidAt)}</div>` : ''}
    </div>
  </div>

  <div class="grid">
    <div class="col">
      <h2>Bill to</h2>
      <div style="font-weight:600">${esc(tenant?.name || inv.tenantId)}</div>
      ${tenant?.slug ? `<div class="muted">${esc(tenant.slug)}</div>` : ''}
      ${sub?.billingName ? `<div>${esc(sub.billingName)}</div>` : ''}
      ${sub?.billingEmail ? `<div class="muted">${esc(sub.billingEmail)}</div>` : ''}
    </div>
    <div class="col">
      <h2>Subscription</h2>
      <div>${esc(plan?.name || '—')} <span class="muted">(${esc(sub?.billingInterval || '')})</span></div>
      ${inv.periodStart || inv.periodEnd ? `<div class="muted">Period: ${fmtD(inv.periodStart)} → ${fmtD(inv.periodEnd)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Unit price</th><th class="right">Amount</th></tr></thead>
    <tbody>
      ${lines.map((l) => `<tr><td>${esc(l.description)}</td><td class="right">${l.quantity}</td><td class="right">${fmt(l.unitPriceMinor)}</td><td class="right">${fmt(l.amountMinor)}</td></tr>`).join('')}
    </tbody>
  </table>

  <table class="totals">
    <tr><td class="right" style="width:80%">Subtotal</td><td class="right">${fmt(inv.subtotalMinor)}</td></tr>
    ${inv.discountMinor > 0 ? `<tr><td class="right">Discount</td><td class="right">-${fmt(inv.discountMinor)}</td></tr>` : ''}
    ${inv.taxMinor > 0 ? `<tr><td class="right">Tax</td><td class="right">${fmt(inv.taxMinor)}</td></tr>` : ''}
    <tr class="grand"><td class="right">Total due</td><td class="right">${fmt(inv.totalMinor)}</td></tr>
    ${inv.amountPaidMinor > 0 ? `<tr><td class="right">Paid</td><td class="right">-${fmt(inv.amountPaidMinor)}</td></tr>` : ''}
    ${inv.amountPaidMinor > 0 && inv.amountPaidMinor < inv.totalMinor ? `<tr class="grand"><td class="right">Balance</td><td class="right">${fmt(inv.totalMinor - inv.amountPaidMinor)}</td></tr>` : ''}
  </table>

  ${paidRows && paidRows.length ? `
    <h2 style="margin-top:32px">Payments</h2>
    <table><thead><tr><th>Date</th><th>Gateway</th><th>Method</th><th>Reference</th><th class="right">Amount</th></tr></thead>
    <tbody>${paidRows.map((p) => `<tr><td>${fmtD(p.paidAt)}</td><td>${esc(p.gateway)}</td><td>${esc(p.method || '—')}</td><td class="muted">${esc(p.gatewayRef || '—')}</td><td class="right">${fmt(p.amountMinor)}</td></tr>`).join('')}</tbody>
    </table>` : ''}

  ${inv.memo ? `<div class="footer">${esc(inv.memo)}</div>` : ''}
  ${vendor.invoiceFooter ? `<div class="footer">${esc(vendor.invoiceFooter)}</div>` : ''}
</div>
</body></html>`;
  }

  // ============================================================
  // PLANS
  // ============================================================
  listPlans(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    return this.plans.find({ where, order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async getPlan(id: string) {
    const p = await this.plans.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Plan not found');
    return p;
  }

  createPlan(dto: CreatePlanDto) {
    return this.plans.save(this.plans.create(dto as any));
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const p = await this.getPlan(id);
    Object.assign(p, dto);
    return this.plans.save(p);
  }

  async deletePlan(id: string) {
    const subCount = await this.subs.count({ where: { planId: id, status: Not('churned' as any) } as any });
    if (subCount > 0) throw new BadRequestException(`Plan has ${subCount} active subscription(s); deactivate instead.`);
    await this.plans.delete(id);
    return { deleted: true };
  }

  // ============================================================
  // COUPONS
  // ============================================================
  listCoupons() {
    return this.coupons.find({ order: { createdAt: 'DESC' } });
  }

  createCoupon(dto: CreateCouponDto) {
    const c = this.coupons.create(<Partial<SaasCoupon>>{
      ...dto,
      code: dto.code.toUpperCase().trim(),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    return this.coupons.save(c);
  }

  async deleteCoupon(id: string) {
    await this.coupons.delete(id);
    return { deleted: true };
  }

  async findValidCoupon(code: string, planId?: string): Promise<SaasCoupon | null> {
    const c = await this.coupons.findOne({ where: { code: code.toUpperCase().trim(), isActive: true } });
    if (!c) return null;
    if (c.expiresAt && c.expiresAt < new Date()) return null;
    if (c.maxRedemptions != null && c.timesRedeemed >= c.maxRedemptions) return null;
    if (planId && c.appliesToPlanIds && c.appliesToPlanIds.length > 0 && !c.appliesToPlanIds.includes(planId)) return null;
    return c;
  }

  // ============================================================
  // SUBSCRIPTIONS
  // ============================================================
  private async tenantMap(ids: string[]): Promise<Map<string, { id: string; name: string; slug: string }>> {
    const m = new Map<string, { id: string; name: string; slug: string }>();
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return m;
    const rows = await this.tenants.find({
      where: { id: In(unique) as any },
      select: ['id', 'name', 'slug'] as any,
    });
    for (const t of rows) m.set(t.id, { id: t.id, name: t.name, slug: t.slug });
    return m;
  }

  async listSubscriptions(opts: { status?: string; tenantId?: string; q?: string } = {}) {
    const qb = this.subs.createQueryBuilder('s')
      .leftJoinAndSelect('s.plan', 'plan')
      .orderBy('s.createdAt', 'DESC');
    if (opts.status) qb.andWhere('s.status = :status', { status: opts.status });
    if (opts.tenantId) qb.andWhere('s.tenantId = :tid', { tid: opts.tenantId });
    const rows = await qb.getMany();
    const tmap = await this.tenantMap(rows.map((r) => r.tenantId));
    return rows.map((r) => ({ ...r, tenant: tmap.get(r.tenantId) ?? null }));
  }

  async getSubscription(id: string) {
    const s = await this.subs.findOne({ where: { id }, relations: ['plan'] });
    if (!s) throw new NotFoundException('Subscription not found');
    const recentInvoices = await this.invoices.find({
      where: { subscriptionId: id },
      order: { issuedAt: 'DESC' },
      take: 50,
    });
    const recentEvents = await this.events.find({
      where: { subscriptionId: id },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    const payments = await this.payments.find({
      where: { subscriptionId: id },
      order: { paidAt: 'DESC' },
      take: 50,
    });
    const tmap = await this.tenantMap([s.tenantId]);
    const tenant = tmap.get(s.tenantId) ?? null;
    // Compute current plan price for the same billing interval (for grandfathering UI).
    const currentPlanUnitPriceMinor = s.billingInterval === 'annual'
      ? (s.plan?.priceAnnualMinor ?? s.unitPriceMinor)
      : (s.plan?.priceMonthlyMinor ?? s.unitPriceMinor);
    const isPriceLockedBelow = currentPlanUnitPriceMinor > s.unitPriceMinor;
    const isPriceLockedAbove = currentPlanUnitPriceMinor < s.unitPriceMinor;
    return {
      ...s,
      tenant,
      currentPlanUnitPriceMinor,
      isPriceLockedBelow,
      isPriceLockedAbove,
      invoices: recentInvoices,
      events: recentEvents,
      payments,
    };
  }

  async syncSubscriptionPrice(id: string, actorId?: string) {
    const sub = await this.subs.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');
    const plan = await this.getPlan(sub.planId);
    const newUnit = sub.billingInterval === 'annual' ? plan.priceAnnualMinor : plan.priceMonthlyMinor;
    if (newUnit === sub.unitPriceMinor) {
      return { ...(await this.getSubscription(sub.id)), changed: false };
    }
    const oldUnit = sub.unitPriceMinor;
    sub.unitPriceMinor = newUnit;
    await this.subs.save(sub);
    await this.recordEvent(sub.id, 'plan_changed', `Unit price synced from ${sub.currency} ${(oldUnit / 100).toLocaleString()} to ${sub.currency} ${(newUnit / 100).toLocaleString()} (${sub.billingInterval})`, { oldUnit, newUnit, source: 'sync-price' }, actorId);
    return { ...(await this.getSubscription(sub.id)), changed: true, oldUnit, newUnit };
  }

  async createSubscription(dto: CreateSubscriptionDto, actorId?: string) {
    const plan = await this.getPlan(dto.planId);
    const now = new Date();
    const interval: BillingInterval = dto.billingInterval;
    const unitPriceMinor = interval === 'annual' ? plan.priceAnnualMinor : plan.priceMonthlyMinor;
    const seats = dto.seats ?? 1;
    const startTrial = dto.startTrial ?? plan.trialDays > 0;

    let coupon: SaasCoupon | null = null;
    if (dto.couponCode) {
      coupon = await this.findValidCoupon(dto.couponCode, plan.id);
      if (!coupon) throw new BadRequestException('Coupon invalid or expired');
    }

    const trialEndsAt = startTrial && plan.trialDays > 0 ? this.addDays(now, plan.trialDays) : null;
    const status: SubscriptionStatus = trialEndsAt ? 'trial' : 'active';
    const periodStart = trialEndsAt ? trialEndsAt : now;
    const periodEnd = this.addPeriod(periodStart, interval);

    const sub = this.subs.create(<Partial<SaasSubscription>>{
      tenantId: dto.tenantId,
      deploymentId: dto.deploymentId ?? null,
      leadId: dto.leadId ?? null,
      planId: plan.id,
      status,
      billingInterval: interval,
      currency: plan.currency,
      unitPriceMinor,
      seats,
      couponId: coupon?.id ?? null,
      discountPercent: coupon?.discountType === 'percent' ? coupon.amount : 0,
      discountFixedMinor: coupon?.discountType === 'fixed' ? coupon.amount : 0,
      startDate: now,
      trialEndsAt,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextRenewalAt: periodEnd,
      autoRenew: dto.autoRenew ?? true,
      billingEmail: (dto as any).billingEmail ?? null,
      billingName: (dto as any).billingName ?? null,
      notes: dto.notes ?? null,
    });
    const saved = await this.subs.save(sub );

    if (coupon) {
      coupon.timesRedeemed += 1;
      await this.coupons.save(coupon);
    }

    await this.recordEvent(saved.id, status === 'trial' ? 'trial_started' : 'created', 'Subscription created', { planCode: plan.code }, actorId);

    // Issue first invoice for active (non-trial) subscriptions immediately.
    if (status === 'active') {
      await this.issueRenewalInvoice(saved, periodStart, periodEnd, actorId);
    }

    await this.syncLicenseFromSubscription(saved.id);
    return this.getSubscription(saved.id);
  }

  async changePlan(id: string, dto: ChangePlanDto, actorId?: string) {
    const sub = await this.subs.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');
    const newPlan = await this.getPlan(dto.planId);
    const interval = dto.billingInterval ?? sub.billingInterval;
    const newUnit = interval === 'annual' ? newPlan.priceAnnualMinor : newPlan.priceMonthlyMinor;

    sub.planId = newPlan.id;
    sub.billingInterval = interval;
    sub.unitPriceMinor = newUnit;
    sub.currency = newPlan.currency;
    if (sub.status === 'cancelled' || sub.status === 'churned') sub.status = 'active';
    await this.subs.save(sub);

    await this.recordEvent(sub.id, 'plan_changed', `Plan changed to ${newPlan.name} (${interval})`, { planId: newPlan.id }, actorId);
    await this.syncLicenseFromSubscription(sub.id);
    return this.getSubscription(sub.id);
  }

  async cancelSubscription(id: string, atPeriodEnd: boolean, reason: string | undefined, actorId?: string) {
    const sub = await this.subs.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (atPeriodEnd) {
      sub.cancelAtPeriodEnd = true;
      sub.autoRenew = false;
      await this.subs.save(sub);
      await this.recordEvent(sub.id, 'cancelled', `Cancellation scheduled at period end. Reason: ${reason ?? 'n/a'}`, null, actorId);
    } else {
      sub.status = 'cancelled';
      sub.cancelledAt = new Date();
      sub.autoRenew = false;
      await this.subs.save(sub);
      await this.recordEvent(sub.id, 'cancelled', `Cancelled immediately. Reason: ${reason ?? 'n/a'}`, null, actorId);
    }
    return this.getSubscription(sub.id);
  }

  async pauseSubscription(id: string, actorId?: string) {
    const sub = await this.subs.findOne({ where: { id } });
    if (!sub) throw new NotFoundException();
    sub.status = 'paused';
    await this.subs.save(sub);
    await this.recordEvent(sub.id, 'paused', 'Paused', null, actorId);
    return this.getSubscription(sub.id);
  }

  async resumeSubscription(id: string, actorId?: string) {
    const sub = await this.subs.findOne({ where: { id } });
    if (!sub) throw new NotFoundException();
    sub.status = 'active';
    await this.subs.save(sub);
    await this.recordEvent(sub.id, 'resumed', 'Resumed', null, actorId);
    return this.getSubscription(sub.id);
  }

  // ============================================================
  // INVOICES
  // ============================================================
  async listInvoices(opts: { status?: string; tenantId?: string; subscriptionId?: string } = {}) {
    const qb = this.invoices.createQueryBuilder('i').orderBy('i.issuedAt', 'DESC');
    if (opts.status) qb.andWhere('i.status = :st', { st: opts.status });
    if (opts.tenantId) qb.andWhere('i.tenantId = :t', { t: opts.tenantId });
    if (opts.subscriptionId) qb.andWhere('i.subscriptionId = :s', { s: opts.subscriptionId });
    const rows = await qb.limit(500).getMany();
    const tmap = await this.tenantMap(rows.map((r) => r.tenantId));
    return rows.map((r) => ({ ...r, tenant: tmap.get(r.tenantId) ?? null }));
  }

  async getInvoice(id: string) {
    const inv = await this.invoices.findOne({ where: { id } });
    if (!inv) throw new NotFoundException();
    const payments = await this.payments.find({ where: { invoiceId: id }, order: { paidAt: 'DESC' } });
    return { ...inv, payments };
  }

  async sendInvoiceEmail(invoiceId: string, overrideTo?: string) {
    const inv = await this.invoices.findOne({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const sub = await this.subs.findOne({ where: { id: inv.subscriptionId } });
    const plan = sub ? await this.plans.findOne({ where: { id: sub.planId } }) : null;
    const tenant = await this.tenants.findOne({ where: { id: inv.tenantId } });
    const to = (overrideTo && overrideTo.trim()) || sub?.billingEmail || (tenant as any)?.contactEmail || (tenant as any)?.adminEmail || null;
    if (!to) throw new BadRequestException('No recipient email available — set billingEmail on the subscription or pass `to` in the request body.');
    try {
      await this.mailer.sendInvoiceIssued(to, inv as any, plan ?? undefined);
      await this.recordEvent(inv.subscriptionId, 'invoice_issued', `Invoice ${inv.invoiceNumber} re-sent to ${to}`, { invoiceId: inv.id, to });
      return { ok: true, to };
    } catch (e: any) {
      throw new BadRequestException(`Failed to send: ${e?.message || 'unknown error'}`);
    }
  }

  async issueRenewalInvoice(sub: SaasSubscription, periodStart: Date, periodEnd: Date, actorId?: string) {
    const subtotal = sub.unitPriceMinor * sub.seats;
    let discount = 0;
    if (sub.discountPercent > 0) discount = Math.floor((subtotal * sub.discountPercent) / 100);
    if (sub.discountFixedMinor > 0) discount += sub.discountFixedMinor;
    if (discount > subtotal) discount = subtotal;
    const tax = 0; // VAT calculated downstream / per region in future
    const total = subtotal - discount + tax;
    const invoiceNumber = await this.nextInvoiceNumber();
    const inv = this.invoices.create(<Partial<SaasInvoice>>{
      invoiceNumber,
      subscriptionId: sub.id,
      tenantId: sub.tenantId,
      status: 'open',
      currency: sub.currency,
      subtotalMinor: subtotal,
      discountMinor: discount,
      taxMinor: tax,
      totalMinor: total,
      amountPaidMinor: 0,
      issuedAt: new Date(),
      dueAt: this.addDays(new Date(), 7),
      periodStart,
      periodEnd,
      lines: [
        {
          description: `Subscription · ${sub.billingInterval} · ${sub.seats} seat(s)`,
          quantity: sub.seats,
          unitPriceMinor: sub.unitPriceMinor,
          amountMinor: subtotal,
        },
      ],
    });
    const saved = await this.invoices.save(inv );
    sub.lastInvoicedAt = new Date();
    await this.subs.save(sub);
    await this.recordEvent(sub.id, 'invoice_issued', `Invoice ${invoiceNumber} issued for ${this.fmtMoney(total, sub.currency)}`, { invoiceId: saved.id }, actorId);
    if (sub.billingEmail) {
      const plan = await this.plans.findOne({ where: { id: sub.planId } });
      this.mailer.sendInvoiceIssued(sub.billingEmail, saved, plan ?? undefined).catch(() => {});
    }
    return saved;
  }

  async recordPayment(invoiceId: string, dto: RecordPaymentDto, actorId?: string) {
    const inv = await this.invoices.findOne({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const sub = await this.subs.findOne({ where: { id: inv.subscriptionId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    const pay = this.payments.create(<Partial<SaasPayment>>{
      invoiceId: inv.id,
      subscriptionId: sub.id,
      tenantId: sub.tenantId,
      currency: dto.currency ?? inv.currency,
      amountMinor: dto.amountMinor,
      status: 'succeeded',
      gateway: dto.gateway ?? 'manual',
      gatewayRef: dto.gatewayRef ?? null,
      method: dto.method ?? null,
      paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
      recordedBy: actorId ?? null,
      notes: dto.notes ?? null,
    });
    const savedPay = await this.payments.save(pay );

    inv.amountPaidMinor += dto.amountMinor;
    if (inv.amountPaidMinor >= inv.totalMinor) {
      inv.status = 'paid';
      inv.paidAt = new Date();
    }
    await this.invoices.save(inv);

    if (inv.status === 'paid') {
      sub.failedPaymentAttempts = 0;
      if (sub.status === 'past_due' || sub.status === 'trial') {
        const wasTrial = sub.status === 'trial';
        sub.status = 'active';
        await this.recordEvent(sub.id, wasTrial ? 'trial_converted' : 'activated', 'Subscription activated by payment', { invoiceId: inv.id }, actorId);
      }
      await this.subs.save(sub);
    }
    await this.recordEvent(sub.id, 'payment_recorded', `Payment ${this.fmtMoney(dto.amountMinor, inv.currency)} via ${dto.gateway ?? 'manual'}`, { paymentId: savedPay.id, invoiceId: inv.id }, actorId);
    await this.syncLicenseFromSubscription(sub.id);
    if (sub.billingEmail) this.mailer.sendPaymentReceipt(sub.billingEmail, savedPay, inv).catch(() => {});
    return savedPay;
  }

  async voidInvoice(id: string, actorId?: string) {
    const inv = await this.invoices.findOne({ where: { id } });
    if (!inv) throw new NotFoundException();
    if (inv.status === 'paid') throw new BadRequestException('Cannot void a paid invoice');
    inv.status = 'void';
    await this.invoices.save(inv);
    await this.recordEvent(inv.subscriptionId, 'note', `Invoice ${inv.invoiceNumber} voided`, null, actorId);
    return inv;
  }

  // ============================================================
  // REVENUE DASHBOARD
  // ============================================================
  async getRevenueDashboard() {
    const subs = await this.subs.find({ relations: ['plan'] });
    const active = subs.filter((s) => s.status === 'active' || s.status === 'past_due');
    const trial = subs.filter((s) => s.status === 'trial');
    const churned30d = subs.filter((s) => s.churnedAt && s.churnedAt > this.addDays(new Date(), -30));

    // MRR: convert annual to monthly.
    const mrrMinor = active.reduce((acc, s) => {
      const monthly = s.billingInterval === 'annual' ? Math.round(s.unitPriceMinor / 12) : s.unitPriceMinor;
      const net = this.applyDiscount(monthly * s.seats, s);
      return acc + net;
    }, 0);

    const arrMinor = mrrMinor * 12;

    // Last 12 months revenue (paid invoices).
    const since = this.addDays(new Date(), -365);
    const paidInv = await this.invoices.find({ where: { status: 'paid', paidAt: MoreThan(since) } });
    const monthly = new Map<string, number>();
    for (const inv of paidInv) {
      if (!inv.paidAt) continue;
      const k = `${inv.paidAt.getFullYear()}-${String(inv.paidAt.getMonth() + 1).padStart(2, '0')}`;
      monthly.set(k, (monthly.get(k) ?? 0) + inv.totalMinor);
    }
    const monthlyRevenue = Array.from(monthly.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, total]) => ({ month, totalMinor: total }));

    // Churn rate (last 30d): churned / (active at start of period). Simplified: churned30d / (active + churned30d).
    const churnRatePct = active.length + churned30d.length === 0 ? 0 : (churned30d.length / (active.length + churned30d.length)) * 100;

    // Outstanding A/R (open + past_due invoices).
    const openInv = await this.invoices.find({ where: { status: In(['open']) as any } });
    const outstandingMinor = openInv.reduce((a, i) => a + (i.totalMinor - i.amountPaidMinor), 0);
    const overdue = openInv.filter((i) => i.dueAt < new Date());

    // Top customers by lifetime revenue.
    const allPaid = await this.invoices.find({ where: { status: 'paid' } });
    const byTenant = new Map<string, number>();
    for (const i of allPaid) byTenant.set(i.tenantId, (byTenant.get(i.tenantId) ?? 0) + i.totalMinor);
    const topRaw = Array.from(byTenant.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    const topTenantsMap = await this.tenantMap(topRaw.map(([id]) => id));
    const topCustomers = topRaw.map(([tenantId, totalMinor]) => ({
      tenantId,
      totalMinor,
      tenant: topTenantsMap.get(tenantId) ?? null,
    }));

    // Plan breakdown.
    const byPlan = new Map<string, { planId: string; planName: string; count: number; mrrMinor: number }>();
    for (const s of active) {
      const k = s.planId;
      const monthlyAmt = s.billingInterval === 'annual' ? Math.round(s.unitPriceMinor / 12) : s.unitPriceMinor;
      const net = this.applyDiscount(monthlyAmt * s.seats, s);
      const cur = byPlan.get(k) ?? { planId: k, planName: s.plan?.name ?? '?', count: 0, mrrMinor: 0 };
      cur.count += 1;
      cur.mrrMinor += net;
      byPlan.set(k, cur);
    }

    // Forecast next 30/60/90 days from nextRenewalAt of active subs.
    const now = new Date();
    const horizons = [30, 60, 90];
    const forecast: Record<string, number> = {};
    for (const h of horizons) {
      const end = this.addDays(now, h);
      forecast[`d${h}Minor`] = active
        .filter((s) => s.autoRenew && s.nextRenewalAt && s.nextRenewalAt <= end && s.nextRenewalAt > now)
        .reduce((a, s) => a + this.applyDiscount(s.unitPriceMinor * s.seats, s), 0);
    }

    // Expiring soon (renewal within 14 days).
    const expiringRaw = active
      .filter((s) => s.nextRenewalAt && s.nextRenewalAt <= this.addDays(now, 14));
    const expiringTenants = await this.tenantMap(expiringRaw.map((s) => s.tenantId));
    const expiringSoon = expiringRaw.map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      tenant: expiringTenants.get(s.tenantId) ?? null,
      planName: s.plan?.name,
      nextRenewalAt: s.nextRenewalAt,
      amountMinor: this.applyDiscount(s.unitPriceMinor * s.seats, s),
      currency: s.currency,
      autoRenew: s.autoRenew,
    }));

    // LTV (avg revenue per customer / monthly churn). Simplified.
    const arpa = active.length > 0 ? mrrMinor / active.length : 0;
    const monthlyChurn = active.length + churned30d.length === 0 ? 0 : churned30d.length / (active.length + churned30d.length);
    const ltvMinor = monthlyChurn > 0 ? Math.round(arpa / monthlyChurn) : arpa * 24; // cap at 24 months if no churn yet

    return {
      currency: 'UGX',
      counts: {
        active: active.length,
        trial: trial.length,
        pastDue: subs.filter((s) => s.status === 'past_due').length,
        cancelled: subs.filter((s) => s.status === 'cancelled').length,
        churned30d: churned30d.length,
        total: subs.length,
      },
      mrrMinor,
      arrMinor,
      arpaMinor: Math.round(arpa),
      ltvMinor,
      churnRatePct: +churnRatePct.toFixed(2),
      outstandingMinor,
      overdueCount: overdue.length,
      monthlyRevenue,
      topCustomers,
      planBreakdown: Array.from(byPlan.values()).sort((a, b) => b.mrrMinor - a.mrrMinor),
      forecast,
      expiringSoon,
    };
  }

  // ============================================================
  // CRON: nightly renewal + dunning + trial expiry
  // ============================================================
  @Cron(CronExpression.EVERY_HOUR)
  async renewalTick() {
    try {
      await this.processTrialExpiry();
      await this.processRenewals();
      await this.processDunning();
    } catch (e: any) {
      this.logger.error(`renewalTick failed: ${e?.message ?? e}`);
    }
  }

  async processTrialExpiry() {
    const now = new Date();
    const expired = await this.subs.find({
      where: { status: 'trial' as any, trialEndsAt: LessThanOrEqual(now) },
    });
    for (const s of expired) {
      // Convert to active and issue first invoice.
      s.status = 'active';
      s.currentPeriodStart = now;
      s.currentPeriodEnd = this.addPeriod(now, s.billingInterval);
      s.nextRenewalAt = s.currentPeriodEnd;
      await this.subs.save(s);
      await this.issueRenewalInvoice(s, s.currentPeriodStart, s.currentPeriodEnd);
      await this.recordEvent(s.id, 'trial_converted', 'Trial expired → converted to active');
      await this.syncLicenseFromSubscription(s.id);
    }
    return expired.length;
  }

  async processRenewals() {
    const now = new Date();
    const due = await this.subs.find({
      where: [
        { status: 'active' as any, autoRenew: true, nextRenewalAt: LessThanOrEqual(now) },
      ],
    });
    let count = 0;
    for (const s of due) {
      if (s.cancelAtPeriodEnd) {
        s.status = 'cancelled';
        s.cancelledAt = now;
        await this.subs.save(s);
        await this.recordEvent(s.id, 'cancelled', 'Cancelled at period end');
        continue;
      }
      const start = s.currentPeriodEnd ?? now;
      const end = this.addPeriod(start, s.billingInterval);
      s.currentPeriodStart = start;
      s.currentPeriodEnd = end;
      s.nextRenewalAt = end;
      await this.subs.save(s);
      await this.issueRenewalInvoice(s, start, end);
      await this.recordEvent(s.id, 'renewed', `Renewed for ${s.billingInterval} period`);
      count++;
    }
    return count;
  }

  async processDunning() {
    const rules = await this.getDunningRules();
    if (!rules.enabled) {
      this.logger.log('Dunning is disabled — skipping');
      return;
    }
    const now = new Date();
    // Mark overdue invoices' subscriptions as past_due.
    const overdueInv = await this.invoices.find({
      where: { status: 'open' as any, dueAt: LessThanOrEqual(now) },
    });
    for (const inv of overdueInv) {
      const sub = await this.subs.findOne({ where: { id: inv.subscriptionId } });
      if (!sub) continue;
      const daysOverdue = Math.floor((now.getTime() - inv.dueAt.getTime()) / 86400000);
      if (sub.status === 'active' && daysOverdue >= rules.graceDays) {
        sub.status = 'past_due';
        sub.failedPaymentAttempts += 1;
        sub.lastDunningAt = now;
        await this.subs.save(sub);
        await this.recordEvent(sub.id, 'past_due', `Invoice ${inv.invoiceNumber} ${daysOverdue}d overdue`);
        if (sub.billingEmail) this.mailer.sendDunning(sub.billingEmail, sub, inv, daysOverdue).catch(() => {});
      } else if (
        sub.status === 'past_due' &&
        daysOverdue > rules.graceDays &&
        ((daysOverdue - rules.graceDays) % rules.reminderIntervalDays === 0)
      ) {
        // Send a reminder every reminderIntervalDays after the grace period.
        if (sub.billingEmail) this.mailer.sendDunning(sub.billingEmail, sub, inv, daysOverdue).catch(() => {});
      }
      // Auto-churn at churnAfterDays past due.
      if (daysOverdue >= rules.churnAfterDays && sub.status === 'past_due') {
        sub.status = 'churned';
        sub.churnedAt = now;
        await this.subs.save(sub);
        await this.recordEvent(sub.id, 'churned', `Auto-churn after ${rules.churnAfterDays}d unpaid`);
        await this.syncLicenseFromSubscription(sub.id);
      }
    }
  }

  // ============================================================
  // LICENSE SYNC
  // ============================================================
  async syncLicenseFromSubscription(subscriptionId: string) {
    const sub = await this.subs.findOne({ where: { id: subscriptionId }, relations: ['plan'] });
    if (!sub) return;
    const lic = await this.licenses.findOne({ where: { tenantId: sub.tenantId } });
    if (!lic) return; // license auto-created via deployment provisioning workflow elsewhere
    const targetType = TIER_TO_LICENSE[sub.plan.tier] ?? 'professional';
    let changed = false;
    if (lic.licenseType !== targetType) { lic.licenseType = targetType; changed = true; }
    if (sub.plan.maxUsers && lic.maxUsers !== sub.plan.maxUsers) { lic.maxUsers = sub.plan.maxUsers; changed = true; }
    if (sub.currentPeriodEnd && (!lic.expiresAt || lic.expiresAt.getTime() !== sub.currentPeriodEnd.getTime())) {
      lic.expiresAt = sub.currentPeriodEnd;
      changed = true;
    }
    if (sub.status === 'churned' || sub.status === 'cancelled') {
      if (lic.status !== 'expired') { lic.status = 'expired'; changed = true; }
    } else if (sub.status === 'active' || sub.status === 'trial') {
      if (lic.status !== 'active') { lic.status = 'active'; changed = true; }
    }
    if (changed) await this.licenses.save(lic);
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private async recordEvent(subscriptionId: string, type: SubscriptionEventType, message?: string, payload?: any, actorId?: string) {
    return this.events.save(this.events.create(<Partial<SaasSubscriptionEvent>>{ subscriptionId, type, message: message ?? null, payload: payload ?? null, actorId: actorId ?? null }));
  }

  private async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const last = await this.invoices.createQueryBuilder('i')
      .where('i.invoiceNumber LIKE :p', { p: `${prefix}%` })
      .orderBy('i.invoiceNumber', 'DESC').limit(1).getOne();
    let nextSeq = 1;
    if (last) {
      const m = last.invoiceNumber.match(/(\d+)$/);
      if (m) nextSeq = parseInt(m[1], 10) + 1;
    }
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }

  private addDays(d: Date, days: number) {
    const r = new Date(d); r.setDate(r.getDate() + days); return r;
  }
  private addPeriod(d: Date, interval: BillingInterval) {
    const r = new Date(d);
    if (interval === 'monthly') r.setMonth(r.getMonth() + 1);
    else r.setFullYear(r.getFullYear() + 1);
    return r;
  }
  private applyDiscount(amount: number, sub: SaasSubscription) {
    let v = amount;
    if (sub.discountPercent > 0) v -= Math.floor((v * sub.discountPercent) / 100);
    if (sub.discountFixedMinor > 0) v -= sub.discountFixedMinor;
    return Math.max(v, 0);
  }
  private fmtMoney(minor: number, currency: string) {
    return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  }

  // ============================================================
  // PUBLIC PRICING (no auth)
  // ============================================================
  async listPublicPlans() {
    return this.plans.find({ where: { isActive: true, isPublic: true } as any, order: { sortOrder: 'ASC', priceMonthlyMinor: 'ASC' } });
  }

  // ============================================================
  // LEAD CONVERSION
  // ============================================================
  async convertLead(leadId: string, dto: any, actorId?: string) {
    const lead = await this.leads.findOne({ where: { id: leadId } });
    const billingEmail = dto.billingEmail ?? lead?.email ?? null;
    const billingName = lead?.fullName ?? null;
    const created = await this.createSubscription({
      tenantId: dto.tenantId, planId: dto.planId, billingInterval: dto.billingInterval,
      seats: dto.seats ?? 1, leadId, startTrial: dto.startTrial ?? false, autoRenew: true,
      billingEmail, billingName,
    } as any, actorId);
    if (lead) {
      lead.status = 'won';
      await this.leads.save(lead);
    }
    return created;
  }

  // ============================================================
  // TENANT SELF-SERVE BILLING PORTAL
  // ============================================================
  async getMyBilling(tenantId: string) {
    const subs = await this.subs.find({ where: { tenantId }, relations: ['plan'], order: { createdAt: 'DESC' } });
    const invoices = await this.invoices.find({ where: { tenantId }, order: { issuedAt: 'DESC' }, take: 100 });
    const payments = await this.payments.find({ where: { tenantId }, order: { paidAt: 'DESC' }, take: 50 });
    const outstanding = invoices.filter((i) => i.status === 'open').reduce((a, i) => a + (i.totalMinor - i.amountPaidMinor), 0);
    return { subscriptions: subs, invoices, payments, outstandingMinor: outstanding };
  }

  // ============================================================
  // GATEWAY (Flutterwave)
  // ============================================================
  async initCheckout(invoiceId: string, opts: { redirectUrl: string; customerEmail?: string; customerName?: string }, tenantId?: string) {
    const inv = await this.invoices.findOne({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (tenantId && inv.tenantId !== tenantId) throw new ForbiddenException('Cross-tenant access');
    if (inv.status === 'paid') throw new BadRequestException('Invoice already paid');
    const sub = await this.subs.findOne({ where: { id: inv.subscriptionId } });
    const due = inv.totalMinor - inv.amountPaidMinor;
    const customerEmail = opts.customerEmail || sub?.billingEmail || `tenant-${inv.tenantId}@noemail.local`;
    const result = await this.flw.initCheckout({
      txRef: `inv_${inv.id.slice(0, 8)}_${Date.now()}`,
      amount: due,
      currency: inv.currency,
      customerEmail,
      customerName: opts.customerName || sub?.billingName || undefined,
      redirectUrl: opts.redirectUrl,
      meta: { invoiceId: inv.id, subscriptionId: inv.subscriptionId, tenantId: inv.tenantId, description: `Invoice ${inv.invoiceNumber}` },
    });
    return { ...result, invoiceId: inv.id, amountMinor: due, currency: inv.currency };
  }

  async handleFlutterwaveWebhook(rawBody: string, signature: string | undefined) {
    if (!this.flw.verifyWebhookSignature(signature, rawBody)) {
      throw new ForbiddenException('Invalid webhook signature');
    }
    const evt = JSON.parse(rawBody || '{}');
    const data = evt.data || evt;
    const event = evt.event || evt['event.type'] || data?.status;
    const txId = data?.id ?? data?.transaction_id;
    const txRef: string | undefined = data?.tx_ref ?? data?.txRef;
    const status: string | undefined = data?.status;
    if (!txId || status !== 'successful') {
      this.logger.log(`Webhook ignored: event=${event} status=${status}`);
      return { ok: true, ignored: true };
    }
    const verified = await this.flw.verifyTransaction(txId);
    if (!verified.ok) {
      this.logger.warn(`Verify failed for tx=${txId}`);
      return { ok: false };
    }
    const invoiceId: string | undefined = data?.meta?.invoiceId;
    if (!invoiceId) {
      this.logger.warn(`Webhook tx=${txId} missing meta.invoiceId`);
      return { ok: true, ignored: true };
    }
    // Idempotency guard: skip if a payment with this gateway ref already exists.
    const existing = await this.payments.findOne({ where: { gatewayRef: String(txId) } });
    if (existing) return { ok: true, duplicate: true };
    const inv = await this.invoices.findOne({ where: { id: invoiceId } });
    if (!inv) return { ok: false };
    await this.recordPayment(inv.id, {
      amountMinor: verified.amount ?? (inv.totalMinor - inv.amountPaidMinor),
      currency: verified.currency ?? inv.currency,
      gateway: 'flutterwave',
      gatewayRef: String(txId),
      method: data?.payment_type || 'card',
      paidAt: new Date().toISOString(),
      notes: `Flutterwave tx_ref=${txRef ?? ''}`,
    } as any);
    // Persist gateway payload on the latest payment.
    const latest = await this.payments.findOne({ where: { gatewayRef: String(txId) } });
    if (latest) {
      latest.gatewayPayload = data;
      await this.payments.save(latest);
    }
    return { ok: true };
  }
}
