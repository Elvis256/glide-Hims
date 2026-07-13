import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, In, LessThan, LessThanOrEqual, IsNull, MoreThan, Not, Between, DeepPartial } from 'typeorm';
import {
  SaasPlan,
  SaasSubscription,
  SaasInvoice,
  SaasPayment,
  SaasCoupon,
  SaasSubscriptionEvent,
  SaasPaymentMethod,
  SaasPaymentMethodKind,
  SaasWebhookEndpoint,
  SaasWebhookDelivery,
  BillingInterval,
  SubscriptionStatus,
  SubscriptionEventType,
  SaasPaymentVerificationStatus,
} from './saas.entity';
import { SaasPaymentProof } from './payment-proof.entity';
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
import { fmtMoney } from './currency-utils';
import { FlutterwaveService } from './flutterwave.service';
import { PesapalService } from './pesapal.service';
import {
  WebhookDispatcherService,
  WebhookEventType,
  WEBHOOK_EVENT_TYPES,
} from './webhook-dispatcher.service';
import * as crypto from 'crypto';
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

export const VAT_RULES_KEY = 'vat_rules';

export interface VatRule {
  country: string;
  rate: number; // percent
  taxNumberLabel?: string; // e.g. 'TIN', 'VAT No.'
}

export interface VatSettings {
  enabled: boolean;
  taxLabel: string; // default 'VAT' — shown on invoices
  defaultRate: number; // applied when no country match
  rules: VatRule[];
}

const DEFAULT_VAT_SETTINGS: VatSettings = {
  enabled: false,
  taxLabel: 'VAT',
  defaultRate: 0,
  rules: [
    { country: 'Uganda', rate: 18, taxNumberLabel: 'TIN' },
    { country: 'Kenya', rate: 16, taxNumberLabel: 'KRA PIN' },
    { country: 'Tanzania', rate: 18, taxNumberLabel: 'TIN' },
    { country: 'Rwanda', rate: 18, taxNumberLabel: 'TIN' },
  ],
};

export const CURRENCY_RATES_KEY = 'currency_rates';

export interface CurrencyRates {
  base: string; // e.g. 'UGX'
  rates: Record<string, number>; // 1 base unit = N target units (e.g. UGX→KES ≈ 0.034)
  updatedAt: string | null;
}

const DEFAULT_CURRENCY_RATES: CurrencyRates = {
  base: 'UGX',
  rates: {
    UGX: 1,
    KES: 0.034,
    TZS: 0.71,
    RWF: 0.36,
    USD: 0.00027,
    EUR: 0.00025,
  },
  updatedAt: null,
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
    @InjectRepository(SaasSubscriptionEvent)
    private readonly events: Repository<SaasSubscriptionEvent>,
    @InjectRepository(License) private readonly licenses: Repository<License>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(SaasPaymentMethod)
    private readonly paymentMethods: Repository<SaasPaymentMethod>,
    @InjectRepository(SaasWebhookEndpoint)
    private readonly webhookEndpoints: Repository<SaasWebhookEndpoint>,
    @InjectRepository(SaasWebhookDelivery)
    private readonly webhookDeliveries: Repository<SaasWebhookDelivery>,
    @InjectRepository(SaasPaymentProof)
    private readonly paymentProofs: Repository<SaasPaymentProof>,
    private readonly mailer: SaasMailerService,
    private readonly flw: FlutterwaveService,
    private readonly pesapal: PesapalService,
    private readonly webhooks: WebhookDispatcherService,
    private readonly settings: SystemSettingsService,
  ) {}

  /**
   * Resolve the best email for a subscription: billingEmail → tenant admin email fallback.
   */
  private async resolveBillingEmail(sub: SaasSubscription): Promise<string | null> {
    if (sub.billingEmail) return sub.billingEmail;
    try {
      const rows = await this.tenants.manager.query(
        `SELECT email FROM users WHERE tenant_id = $1 AND deleted_at IS NULL AND status = 'active' ORDER BY created_at LIMIT 1`,
        [sub.tenantId],
      );
      return rows?.[0]?.email ?? null;
    } catch {
      return null;
    }
  }

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
    await this.settings.upsert(
      VENDOR_BILLING_KEY,
      merged,
      undefined,
      'Vendor billing identity used on SaaS invoices',
    );
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
        reminderIntervalDays: Math.max(
          1,
          Number(v.reminderIntervalDays ?? DEFAULT_DUNNING_RULES.reminderIntervalDays),
        ),
        churnAfterDays: Math.max(
          1,
          Number(v.churnAfterDays ?? DEFAULT_DUNNING_RULES.churnAfterDays),
        ),
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
      reminderIntervalDays: Math.max(
        1,
        Number(dto.reminderIntervalDays ?? current.reminderIntervalDays),
      ),
      churnAfterDays: Math.max(1, Number(dto.churnAfterDays ?? current.churnAfterDays)),
    };
    if (merged.churnAfterDays < merged.graceDays) {
      throw new BadRequestException('churnAfterDays must be greater than or equal to graceDays');
    }
    await this.settings.upsert(
      DUNNING_RULES_KEY,
      merged,
      undefined,
      'SaaS dunning schedule (grace period, reminder cadence, auto-churn)',
    );
    return merged;
  }

  // ============================================================
  // VAT / TAX RULES (system-wide, tenantId NULL)
  // ============================================================
  async getVatSettings(): Promise<VatSettings> {
    try {
      const s = await this.settings.getByKey(VAT_RULES_KEY);
      const v = (s.value || {}) as Partial<VatSettings>;
      return {
        enabled: v.enabled ?? DEFAULT_VAT_SETTINGS.enabled,
        taxLabel: v.taxLabel ?? DEFAULT_VAT_SETTINGS.taxLabel,
        defaultRate: Math.max(0, Number(v.defaultRate ?? DEFAULT_VAT_SETTINGS.defaultRate)),
        rules: Array.isArray(v.rules)
          ? v.rules
              .map((r) => ({
                country: String(r.country || '').trim(),
                rate: Math.max(0, Number(r.rate ?? 0)),
                taxNumberLabel: r.taxNumberLabel?.trim() || undefined,
              }))
              .filter((r) => r.country.length > 0)
          : DEFAULT_VAT_SETTINGS.rules,
      };
    } catch {
      return { ...DEFAULT_VAT_SETTINGS, rules: [...DEFAULT_VAT_SETTINGS.rules] };
    }
  }

  async updateVatSettings(dto: Partial<VatSettings>): Promise<VatSettings> {
    const current = await this.getVatSettings();
    const merged: VatSettings = {
      enabled: dto.enabled ?? current.enabled,
      taxLabel: (dto.taxLabel ?? current.taxLabel).trim() || 'VAT',
      defaultRate: Math.max(0, Number(dto.defaultRate ?? current.defaultRate)),
      rules: Array.isArray(dto.rules)
        ? dto.rules
            .map((r) => ({
              country: String(r.country || '').trim(),
              rate: Math.max(0, Number(r.rate ?? 0)),
              taxNumberLabel: r.taxNumberLabel?.trim() || undefined,
            }))
            .filter((r) => r.country.length > 0)
        : current.rules,
    };
    if (merged.defaultRate > 100 || merged.rules.some((r) => r.rate > 100)) {
      throw new BadRequestException('Tax rates must be between 0 and 100');
    }
    await this.settings.upsert(VAT_RULES_KEY, merged, undefined, 'SaaS VAT/tax rules per country');
    return merged;
  }

  // ============================================================
  // CURRENCY / FX RATES
  // ============================================================
  async getCurrencyRates(): Promise<CurrencyRates> {
    try {
      const s = await this.settings.getPlatformByKey(CURRENCY_RATES_KEY);
      const v = (s.value || {}) as Partial<CurrencyRates>;
      return {
        base: v.base || DEFAULT_CURRENCY_RATES.base,
        rates: { ...DEFAULT_CURRENCY_RATES.rates, ...(v.rates || {}) },
        updatedAt: v.updatedAt || null,
      };
    } catch {
      return { ...DEFAULT_CURRENCY_RATES };
    }
  }

  async updateCurrencyRates(dto: Partial<CurrencyRates>): Promise<CurrencyRates> {
    const current = await this.getCurrencyRates();
    const base = (dto.base || current.base || 'UGX').toUpperCase();
    const rates: Record<string, number> = {};
    const src = dto.rates && typeof dto.rates === 'object' ? dto.rates : current.rates;
    for (const [k, v] of Object.entries(src)) {
      const ccy = k.toUpperCase();
      const num = Number(v);
      if (!isFinite(num) || num <= 0) throw new BadRequestException(`Invalid rate for ${ccy}`);
      rates[ccy] = num;
    }
    rates[base] = 1;
    const merged: CurrencyRates = { base, rates, updatedAt: new Date().toISOString() };
    // Platform-scoped (tenant_id IS NULL): FX rates are global, and the old
    // tenant-required upsert threw "Missing tenant context" from the cron
    await this.settings.upsertPlatform(
      CURRENCY_RATES_KEY,
      merged,
      'SaaS plan FX rates relative to base',
    );
    return merged;
  }

  /**
   * Convert a minor-unit price from one currency to another using stored
   * FX rates. Returns null if the target currency has no rate.
   */
  async convertMinor(amountMinor: number, fromCcy: string, toCcy: string): Promise<number | null> {
    const from = (fromCcy || 'UGX').toUpperCase();
    const to = (toCcy || from).toUpperCase();
    if (from === to) return amountMinor;
    const fx = await this.getCurrencyRates();
    const fromRate = from === fx.base ? 1 : fx.rates[from];
    const toRate = to === fx.base ? 1 : fx.rates[to];
    if (!fromRate || !toRate) return null;
    // rates table holds value: 1 base = N target, so price_target = price_source / from * to
    const inBase = amountMinor / fromRate;
    return Math.round(inBase * toRate);
  }

  /**
   * Refresh FX rates from a public provider. Defaults to open.er-api.com
   * (no API key required). Falls back to exchangerate.host if env override is set.
   * Preserves currencies already in our table — only updates values for matches.
   */
  async refreshCurrencyRatesFromProvider(opts?: {
    providerUrl?: string;
  }): Promise<
    CurrencyRates & { _refreshed: { provider: string; updated: string[]; missing: string[] } }
  > {
    const current = await this.getCurrencyRates();
    const base = (current.base || 'UGX').toUpperCase();
    const tpl =
      opts?.providerUrl ||
      process.env.SAAS_FX_PROVIDER_URL ||
      'https://open.er-api.com/v6/latest/{base}';
    const url = tpl.replace('{base}', encodeURIComponent(base));
    let body: any;
    try {
      const fetchFn = (globalThis as any).fetch;
      if (!fetchFn) throw new Error('fetch unavailable in runtime');
      const res = await fetchFn(url, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`provider HTTP ${res.status}`);
      body = await res.json();
    } catch (e: any) {
      throw new BadRequestException(`FX provider fetch failed: ${e?.message || e}`);
    }
    // Normalise — support open.er-api.com {result, rates} and exchangerate.host {success, rates}
    const providerRates: Record<string, number> =
      (body && (body.rates || body.conversion_rates)) || {};
    if (!providerRates || typeof providerRates !== 'object' || !Object.keys(providerRates).length) {
      throw new BadRequestException('FX provider returned no rates');
    }
    const updated: string[] = [];
    const missing: string[] = [];
    const merged: Record<string, number> = { ...current.rates };
    for (const ccy of Object.keys(current.rates)) {
      if (ccy === base) {
        merged[ccy] = 1;
        continue;
      }
      const v = Number(providerRates[ccy]);
      if (isFinite(v) && v > 0) {
        merged[ccy] = v;
        updated.push(ccy);
      } else missing.push(ccy);
    }
    const out: CurrencyRates = { base, rates: merged, updatedAt: new Date().toISOString() };
    await this.settings.upsertPlatform(
      CURRENCY_RATES_KEY,
      out,
      `SaaS plan FX rates refreshed from ${url}`,
    );
    return { ...out, _refreshed: { provider: url, updated, missing } } as any;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'saas-fx-refresh-rates' })
  async cronRefreshFxRates() {
    try {
      if (process.env.SAAS_FX_AUTOREFRESH === 'off') return;
      const r = await this.refreshCurrencyRatesFromProvider();
      // eslint-disable-next-line no-console
      console.log(
        `[saas-fx] cron refresh ok base=${r.base} updated=${r._refreshed?.updated?.length || 0} missing=${r._refreshed?.missing?.length || 0}`,
      );
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn(`[saas-fx] cron refresh failed: ${e?.message || e}`);
    }
  }

  async listPublicPlansLocalized(currency?: string) {
    const plans = await this.plans.find({
      where: { isActive: true, isPublic: true },
      order: { sortOrder: 'ASC', priceMonthlyMinor: 'ASC' },
    });
    if (!currency) return plans;
    const target = currency.toUpperCase();
    const fx = await this.getCurrencyRates();
    return Promise.all(
      plans.map(async (p) => {
        if (p.currency === target) return p;
        const m = await this.convertMinor(p.priceMonthlyMinor, p.currency, target);
        const a = await this.convertMinor(p.priceAnnualMinor, p.currency, target);
        if (m === null || a === null) return p;
        return {
          ...p,
          currency: target,
          priceMonthlyMinor: m,
          priceAnnualMinor: a,
          _converted: true,
          _baseCurrency: p.currency,
          _fxBase: fx.base,
        } as any;
      }),
    );
  }

  /**
   * Resolve the tax rate to apply for a tenant. Returns 0 (no tax) when
   * VAT is globally disabled or no rule matches and defaultRate is 0.
   */
  private async resolveTaxForTenant(
    tenantId: string,
  ): Promise<{ rate: number; label: string; country: string }> {
    const vat = await this.getVatSettings();
    if (!vat.enabled) return { rate: 0, label: vat.taxLabel, country: '' };
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    const country = (tenant?.settings?.country as string | undefined)?.trim() || '';
    const match = country
      ? vat.rules.find((r) => r.country.toLowerCase() === country.toLowerCase())
      : null;
    return { rate: match ? match.rate : vat.defaultRate, label: vat.taxLabel, country };
  }

  // ============================================================
  // PRINTABLE INVOICE (HTML — browser saves as PDF)
  // ============================================================
  async renderInvoiceHtml(id: string, requireTenantId?: string): Promise<string> {
    const inv = await this.getInvoice(id);
    if (
      requireTenantId &&
      inv.tenantId !== requireTenantId &&
      inv.billingPayerTenantId !== requireTenantId
    ) {
      throw new ForbiddenException('Invoice does not belong to your tenant');
    }
    const sub = await this.subs.findOne({ where: { id: inv.subscriptionId } });
    const plan = sub ? await this.plans.findOne({ where: { id: sub.planId } }) : null;
    const tenant = await this.tenants.findOne({
      where: { id: inv.tenantId },
      select: ['id', 'name', 'slug'],
    });
    const vendor = await this.getVendorBilling();
    const fmt = (n: number) => this.fmtMoney(n, inv.currency);
    const fmtD = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
    const esc = (s: any) =>
      String(s ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
      );
    const lines = (inv.lines || []) as Array<{
      description: string;
      quantity: number;
      unitPriceMinor: number;
      amountMinor: number;
    }>;
    const paidRows = (inv as any).payments as
      | Array<{
          paidAt: any;
          amountMinor: number;
          gateway: string;
          method?: string | null;
          gatewayRef?: string | null;
        }>
      | undefined;
    const vendorAddr = [
      vendor.addressLine1,
      vendor.addressLine2,
      [vendor.city, vendor.country].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .map((l) => `<div>${esc(l)}</div>`)
      .join('');

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
    ${
      inv.taxMinor > 0
        ? (() => {
            const base = inv.subtotalMinor - inv.discountMinor;
            const rate = base > 0 ? Math.round((inv.taxMinor / base) * 1000) / 10 : 0;
            const label = rate > 0 ? `Tax (${rate}%)` : 'Tax';
            return `<tr><td class="right">${label}</td><td class="right">${fmt(inv.taxMinor)}</td></tr>`;
          })()
        : ''
    }
    <tr class="grand"><td class="right">Total due</td><td class="right">${fmt(inv.totalMinor)}</td></tr>
    ${inv.amountPaidMinor > 0 ? `<tr><td class="right">Paid</td><td class="right">-${fmt(inv.amountPaidMinor)}</td></tr>` : ''}
    ${inv.amountPaidMinor > 0 && inv.amountPaidMinor < inv.totalMinor ? `<tr class="grand"><td class="right">Balance</td><td class="right">${fmt(inv.totalMinor - inv.amountPaidMinor)}</td></tr>` : ''}
  </table>

  ${
    paidRows && paidRows.length
      ? `
    <h2 style="margin-top:32px">Payments</h2>
    <table><thead><tr><th>Date</th><th>Gateway</th><th>Method</th><th>Reference</th><th class="right">Amount</th></tr></thead>
    <tbody>${paidRows.map((p) => `<tr><td>${fmtD(p.paidAt)}</td><td>${esc(p.gateway)}</td><td>${esc(p.method || '—')}</td><td class="muted">${esc(p.gatewayRef || '—')}</td><td class="right">${fmt(p.amountMinor)}</td></tr>`).join('')}</tbody>
    </table>`
      : ''
  }

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
    return this.plans.save(this.plans.create(dto as DeepPartial<SaasPlan>));
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const p = await this.getPlan(id);
    Object.assign(p, dto);
    return this.plans.save(p);
  }

  async deletePlan(id: string) {
    const subCount = await this.subs.count({
      where: { planId: id, status: Not('churned') },
    });
    if (subCount > 0)
      throw new BadRequestException(
        `Plan has ${subCount} active subscription(s); deactivate instead.`,
      );
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

  async updateCoupon(id: string, dto: Partial<SaasCoupon> & { expiresAt?: any }) {
    const c = await this.coupons.findOne({ where: { id } });
    if (!c) throw new BadRequestException('Coupon not found');
    const next: Partial<SaasCoupon> = { ...dto };
    if (dto.code) next.code = String(dto.code).toUpperCase().trim();
    if ('expiresAt' in dto) {
      next.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    Object.assign(c, next);
    return this.coupons.save(c);
  }

  async previewCoupon(
    code: string,
    planId?: string,
    billingInterval: 'monthly' | 'annual' = 'monthly',
    seats = 1,
  ) {
    const c = await this.findValidCoupon(code, planId);
    if (!c)
      return {
        valid: false,
        reason: 'Coupon code is invalid, expired, exhausted, or not applicable to this plan.',
      };
    let baseMinor = 0;
    let currency = c.currency;
    if (planId) {
      const plan = await this.plans.findOne({ where: { id: planId } });
      if (plan) {
        baseMinor =
          (billingInterval === 'annual' ? plan.priceAnnualMinor : plan.priceMonthlyMinor) *
          Math.max(seats, 1);
        currency = plan.currency || currency;
      }
    }
    let discountMinor = 0;
    if (c.discountType === 'percent') discountMinor = Math.floor((baseMinor * c.amount) / 100);
    else discountMinor = Math.min(c.amount, baseMinor);
    return {
      valid: true,
      code: c.code,
      discountType: c.discountType,
      amount: c.amount,
      durationMonths: c.durationMonths,
      currency,
      baseMinor,
      discountMinor,
      payableMinor: Math.max(0, baseMinor - discountMinor),
    };
  }

  async listCouponRedemptions(id: string) {
    const c = await this.coupons.findOne({ where: { id } });
    if (!c) throw new BadRequestException('Coupon not found');
    const subs = await this.subs.find({ where: { couponId: id }, order: { createdAt: 'DESC' } });
    const tmap = await this.tenantMap(subs.map((s) => s.tenantId));
    return {
      coupon: c,
      subscriptions: subs.map((s) => ({
        id: s.id,
        tenantId: s.tenantId,
        tenant: tmap.get(s.tenantId) ?? null,
        planId: s.planId,
        billingInterval: s.billingInterval,
        status: s.status,
        discountPercent: s.discountPercent,
        discountFixedMinor: s.discountFixedMinor,
        createdAt: s.createdAt,
      })),
    };
  }

  async findValidCoupon(code: string, planId?: string): Promise<SaasCoupon | null> {
    const c = await this.coupons.findOne({
      where: { code: code.toUpperCase().trim(), isActive: true },
    });
    if (!c) return null;
    if (c.expiresAt && c.expiresAt < new Date()) return null;
    if (c.maxRedemptions != null && c.timesRedeemed >= c.maxRedemptions) return null;
    if (
      planId &&
      c.appliesToPlanIds &&
      c.appliesToPlanIds.length > 0 &&
      !c.appliesToPlanIds.includes(planId)
    )
      return null;
    return c;
  }

  // ============================================================
  // SUBSCRIPTIONS
  // ============================================================
  private async tenantMap(
    ids: string[],
  ): Promise<Map<string, { id: string; name: string; slug: string }>> {
    const m = new Map<string, { id: string; name: string; slug: string }>();
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return m;
    const rows = await this.tenants.find({
      where: { id: In(unique) },
      select: ['id', 'name', 'slug'],
    });
    for (const t of rows) m.set(t.id, { id: t.id, name: t.name, slug: t.slug });
    return m;
  }

  async listSubscriptions(opts: { status?: string; tenantId?: string; q?: string } = {}) {
    const qb = this.subs
      .createQueryBuilder('s')
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
    const currentPlanUnitPriceMinor =
      s.billingInterval === 'annual'
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
    const newUnit =
      sub.billingInterval === 'annual' ? plan.priceAnnualMinor : plan.priceMonthlyMinor;
    if (newUnit === sub.unitPriceMinor) {
      return { ...(await this.getSubscription(sub.id)), changed: false };
    }
    const oldUnit = sub.unitPriceMinor;
    sub.unitPriceMinor = newUnit;
    await this.subs.save(sub);
    await this.recordEvent(
      sub.id,
      'plan_changed',
      `Unit price synced from ${sub.currency} ${(oldUnit / 100).toLocaleString()} to ${sub.currency} ${(newUnit / 100).toLocaleString()} (${sub.billingInterval})`,
      { oldUnit, newUnit, source: 'sync-price' },
      actorId,
    );
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
      couponAppliedAt: coupon ? new Date() : null,
      discountPercent: coupon?.discountType === 'percent' ? coupon.amount : 0,
      discountFixedMinor: coupon?.discountType === 'fixed' ? coupon.amount : 0,
      startDate: now,
      trialEndsAt,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextRenewalAt: periodEnd,
      autoRenew: dto.autoRenew ?? true,
      billingEmail: dto.billingEmail ?? null,
      billingName: dto.billingName ?? null,
      notes: dto.notes ?? null,
    });
    const saved = await this.subs.save(sub);

    if (coupon) {
      coupon.timesRedeemed += 1;
      await this.coupons.save(coupon);
    }

    await this.recordEvent(
      saved.id,
      status === 'trial' ? 'trial_started' : 'created',
      'Subscription created',
      { planCode: plan.code },
      actorId,
    );

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

    await this.recordEvent(
      sub.id,
      'plan_changed',
      `Plan changed to ${newPlan.name} (${interval})`,
      { planId: newPlan.id },
      actorId,
    );
    await this.syncLicenseFromSubscription(sub.id);
    return this.getSubscription(sub.id);
  }

  async cancelSubscription(
    id: string,
    atPeriodEnd: boolean,
    reason: string | undefined,
    actorId?: string,
  ) {
    const sub = await this.subs.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (atPeriodEnd) {
      sub.cancelAtPeriodEnd = true;
      sub.autoRenew = false;
      await this.subs.save(sub);
      await this.recordEvent(
        sub.id,
        'cancelled',
        `Cancellation scheduled at period end. Reason: ${reason ?? 'n/a'}`,
        null,
        actorId,
      );
    } else {
      sub.status = 'cancelled';
      sub.cancelledAt = new Date();
      sub.autoRenew = false;
      await this.subs.save(sub);
      await this.recordEvent(
        sub.id,
        'cancelled',
        `Cancelled immediately. Reason: ${reason ?? 'n/a'}`,
        null,
        actorId,
      );
    }
    this.webhooks
      .enqueue(sub.tenantId, 'subscription.cancelled', {
        subscriptionId: sub.id,
        planId: sub.planId,
        atPeriodEnd: !!atPeriodEnd,
        reason: reason ?? null,
        periodEnd: sub.currentPeriodEnd,
        cancelledAt: sub.cancelledAt,
      })
      .catch(() => {});
    return this.getSubscription(sub.id);
  }

  async pauseSubscription(id: string, actorId?: string) {
    const sub = await this.subs.findOne({ where: { id } });
    if (!sub) throw new NotFoundException();
    sub.status = 'paused';
    sub.metadata = { ...(sub.metadata || {}), pausedAt: new Date().toISOString() };
    await this.subs.save(sub);
    await this.syncLicenseFromSubscription(sub.id);
    await this.recordEvent(sub.id, 'paused', 'Paused', null, actorId);
    return this.getSubscription(sub.id);
  }

  async resumeSubscription(id: string, actorId?: string) {
    const sub = await this.subs.findOne({ where: { id } });
    if (!sub) throw new NotFoundException();
    const now = new Date();
    // Advance period dates by the time the subscription was paused
    const pausedAt = sub.metadata?.pausedAt ? new Date(sub.metadata.pausedAt) : null;
    if (pausedAt && sub.currentPeriodEnd) {
      const pausedMs = now.getTime() - pausedAt.getTime();
      sub.currentPeriodEnd = new Date(sub.currentPeriodEnd.getTime() + pausedMs);
      if (sub.nextRenewalAt) {
        sub.nextRenewalAt = new Date(sub.nextRenewalAt.getTime() + pausedMs);
      }
    }
    sub.status = 'active';
    const meta = { ...(sub.metadata || {}) };
    delete meta.pausedAt;
    sub.metadata = meta;
    await this.subs.save(sub);
    await this.syncLicenseFromSubscription(sub.id);
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
    const payments = await this.payments.find({
      where: { invoiceId: id },
      order: { paidAt: 'DESC' },
    });
    return { ...inv, payments };
  }

  async sendInvoiceEmail(invoiceId: string, overrideTo?: string) {
    const inv = await this.invoices.findOne({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const sub = await this.subs.findOne({ where: { id: inv.subscriptionId } });
    const plan = sub ? await this.plans.findOne({ where: { id: sub.planId } }) : null;
    const tenant = await this.tenants.findOne({ where: { id: inv.tenantId } });
    const to =
      (overrideTo && overrideTo.trim()) ||
      sub?.billingEmail ||
      (tenant as any)?.contactEmail ||
      (tenant as any)?.adminEmail ||
      null;
    if (!to)
      throw new BadRequestException(
        'No recipient email available — set billingEmail on the subscription or pass `to` in the request body.',
      );
    try {
      await this.mailer.sendInvoiceIssued(to, inv, plan ?? undefined);
      await this.recordEvent(
        inv.subscriptionId,
        'invoice_issued',
        `Invoice ${inv.invoiceNumber} re-sent to ${to}`,
        { invoiceId: inv.id, to },
      );
      return { ok: true, to };
    } catch (e: any) {
      throw new BadRequestException(`Failed to send: ${e?.message || 'unknown error'}`);
    }
  }

  async createManualInvoice(
    dto: {
      subscriptionId: string;
      lines: Array<{ description: string; quantity: number; unitPriceMinor: number }>;
      memo?: string;
      dueInDays?: number;
      sendEmail?: boolean;
    },
    actorId?: string,
  ) {
    const sub = await this.subs.findOne({ where: { id: dto.subscriptionId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (!dto.lines?.length) throw new BadRequestException('At least one line item is required');

    const lines = dto.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      amountMinor: l.quantity * l.unitPriceMinor,
    }));
    const subtotal = lines.reduce((sum, l) => sum + l.amountMinor, 0);

    let discount = 0;
    if (sub.discountPercent > 0) discount = Math.floor((subtotal * sub.discountPercent) / 100);
    if (sub.discountFixedMinor > 0) discount += sub.discountFixedMinor;
    if (discount > subtotal) discount = subtotal;

    const taxBase = subtotal - discount;
    const taxInfo = await this.resolveTaxForTenant(sub.tenantId);
    const tax = taxInfo.rate > 0 ? Math.floor((taxBase * taxInfo.rate) / 100) : 0;
    const total = taxBase + tax;

    const now = new Date();
    const dueInDays = dto.dueInDays ?? 7;
    const invoiceNumber = await this.nextInvoiceNumber();

    const inv = this.invoices.create(<Partial<SaasInvoice>>{
      invoiceNumber,
      subscriptionId: sub.id,
      tenantId: sub.tenantId,
      billingPayerTenantId: sub.billingPayerTenantId ?? null,
      status: 'open',
      currency: sub.currency,
      subtotalMinor: subtotal,
      discountMinor: discount,
      taxMinor: tax,
      totalMinor: total,
      amountPaidMinor: 0,
      issuedAt: now,
      dueAt: this.addDays(now, dueInDays),
      memo: dto.memo ?? null,
      lines,
    });
    const saved = await this.invoices.save(inv);

    await this.recordEvent(
      sub.id,
      'invoice_issued',
      `Manual invoice ${invoiceNumber} issued for ${this.fmtMoney(total, sub.currency)}`,
      { invoiceId: saved.id, manual: true },
      actorId,
    );

    if (dto.sendEmail) {
      const plan = await this.plans.findOne({ where: { id: sub.planId } });
      const tenant = await this.tenants.findOne({ where: { id: sub.tenantId } });
      const to =
        sub.billingEmail || (tenant as any)?.contactEmail || (tenant as any)?.adminEmail || null;
      if (to) {
        this.mailer.sendInvoiceIssued(to, saved, plan ?? undefined).catch(() => {});
      }
    }

    return saved;
  }

  async issueRenewalInvoice(
    sub: SaasSubscription,
    periodStart: Date,
    periodEnd: Date,
    actorId?: string,
  ) {
    // Check coupon expiry based on durationMonths
    if (sub.couponId && sub.couponAppliedAt) {
      const coupon = await this.coupons.findOne({ where: { id: sub.couponId } });
      if (coupon?.durationMonths) {
        const expiresAt = new Date(sub.couponAppliedAt);
        expiresAt.setMonth(expiresAt.getMonth() + coupon.durationMonths);
        if (new Date() >= expiresAt) {
          sub.discountPercent = 0;
          sub.discountFixedMinor = 0;
          sub.couponId = null;
          await this.subs.save(sub);
        }
      }
    }

    const subtotal = sub.unitPriceMinor * sub.seats;
    let discount = 0;
    if (sub.discountPercent > 0) discount = Math.floor((subtotal * sub.discountPercent) / 100);
    if (sub.discountFixedMinor > 0) discount += sub.discountFixedMinor;
    if (discount > subtotal) discount = subtotal;
    const taxBase = subtotal - discount;
    const taxInfo = await this.resolveTaxForTenant(sub.tenantId);
    const tax = taxInfo.rate > 0 ? Math.floor((taxBase * taxInfo.rate) / 100) : 0;
    const total = taxBase + tax;

    // ---- Optional invoice-currency conversion --------------------------------
    // If the subscription has a billingCurrency override that differs from the
    // plan/sub currency, convert all monetary fields at issue time using the
    // current FX rates table. Original amounts are preserved on the line memo
    // for audit; fxRateToBase records the multiplier from sub.currency -> invoice.currency.
    const sourceCcy = (sub.currency || 'UGX').toUpperCase();
    const billingCcy = (sub.billingCurrency || sourceCcy).toUpperCase();
    const fxApplied = billingCcy !== sourceCcy;
    let invSubtotal = subtotal,
      invDiscount = discount,
      invTax = tax,
      invTotal = total;
    let invUnitPrice = sub.unitPriceMinor;
    let fxRate = 1;
    let fxMemo: string | null = null;
    if (fxApplied) {
      const cs = await this.convertMinor(subtotal, sourceCcy, billingCcy);
      const cd = await this.convertMinor(discount, sourceCcy, billingCcy);
      const ct = await this.convertMinor(tax, sourceCcy, billingCcy);
      const co = await this.convertMinor(total, sourceCcy, billingCcy);
      const cu = await this.convertMinor(sub.unitPriceMinor, sourceCcy, billingCcy);
      if (cs == null || cd == null || ct == null || co == null || cu == null) {
        throw new BadRequestException(
          `Cannot convert invoice from ${sourceCcy} to ${billingCcy}: missing FX rate. Add the rate at /system/currency-rates or clear the subscription's billing currency.`,
        );
      }
      invSubtotal = cs;
      invDiscount = cd;
      invTax = ct;
      invTotal = co;
      invUnitPrice = cu;
      fxRate = subtotal > 0 ? invSubtotal / subtotal : 1;
      fxMemo = `Converted from ${sourceCcy} ${this.fmtMoney(total, sourceCcy)} at rate ${fxRate.toFixed(6)}.`;
    }

    const invoiceNumber = await this.nextInvoiceNumber();
    const inv = this.invoices.create(<Partial<SaasInvoice>>{
      invoiceNumber,
      subscriptionId: sub.id,
      tenantId: sub.tenantId,
      billingPayerTenantId: sub.billingPayerTenantId ?? null,
      status: 'open',
      currency: billingCcy,
      subtotalMinor: invSubtotal,
      discountMinor: invDiscount,
      taxMinor: invTax,
      totalMinor: invTotal,
      amountPaidMinor: 0,
      fxRateToBase: fxRate.toFixed(6),
      issuedAt: new Date(),
      dueAt: this.addDays(new Date(), 7),
      periodStart,
      periodEnd,
      memo: fxMemo,
      lines: [
        {
          description: `Subscription · ${sub.billingInterval} · ${sub.seats} seat(s)${fxApplied ? ` (${sourceCcy}→${billingCcy} @ ${fxRate.toFixed(4)})` : ''}`,
          quantity: sub.seats,
          unitPriceMinor: invUnitPrice,
          amountMinor: invSubtotal,
        },
      ],
    });
    const saved = await this.invoices.save(inv);
    sub.lastInvoicedAt = new Date();
    await this.subs.save(sub);
    await this.recordEvent(
      sub.id,
      'invoice_issued',
      `Invoice ${invoiceNumber} issued for ${this.fmtMoney(invTotal, billingCcy)}${fxApplied ? ` (FX ${sourceCcy}→${billingCcy})` : ''}`,
      { invoiceId: saved.id, fxApplied, fxRate, sourceCcy, billingCcy },
      actorId,
    );
    const invoiceTo = await this.resolveBillingEmail(sub);
    if (invoiceTo) {
      const plan = await this.plans.findOne({ where: { id: sub.planId } });
      this.mailer.sendInvoiceIssued(invoiceTo, saved, plan ?? undefined).catch(() => {});
    }
    this.webhooks
      .enqueue(sub.tenantId, 'invoice.issued', {
        invoiceId: saved.id,
        invoiceNumber,
        subscriptionId: sub.id,
        totalMinor: saved.totalMinor,
        currency: saved.currency,
        issuedAt: saved.issuedAt,
        dueAt: saved.dueAt,
        fxApplied,
        fxRate,
        sourceCurrency: sourceCcy,
        billingCurrency: billingCcy,
      })
      .catch(() => {});
    return saved;
  }

  async updateSubscription(
    id: string,
    dto: { billingEmail?: string | null; billingCurrency?: string | null; autoRenew?: boolean },
    actorId?: string,
  ) {
    const sub = await this.subs.findOne({ where: { id } });
    if (!sub) throw new NotFoundException();
    const changes: string[] = [];
    if (dto.billingEmail !== undefined) {
      const v = dto.billingEmail ? String(dto.billingEmail).trim() : null;
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        throw new BadRequestException('Invalid billing email');
      if (v !== sub.billingEmail) {
        sub.billingEmail = v;
        changes.push(`billingEmail=${v ?? 'null'}`);
      }
    }
    if (dto.billingCurrency !== undefined) {
      const raw = dto.billingCurrency ? String(dto.billingCurrency).trim().toUpperCase() : null;
      if (raw && raw.length !== 3)
        throw new BadRequestException('Billing currency must be a 3-letter code');
      if (raw && raw !== (sub.currency || '').toUpperCase()) {
        // Validate FX rate exists either way
        const fx = await this.getCurrencyRates();
        const knows = raw === fx.base || !!fx.rates[raw];
        if (!knows)
          throw new BadRequestException(
            `No FX rate for ${raw}. Add it at /system/currency-rates first.`,
          );
      }
      const next = raw && raw !== (sub.currency || '').toUpperCase() ? raw : null;
      if (next !== sub.billingCurrency) {
        sub.billingCurrency = next;
        changes.push(`billingCurrency=${next ?? 'null'}`);
      }
    }
    if (dto.autoRenew !== undefined && dto.autoRenew !== sub.autoRenew) {
      sub.autoRenew = !!dto.autoRenew;
      changes.push(`autoRenew=${sub.autoRenew}`);
    }
    if (changes.length === 0) return this.getSubscription(sub.id);
    await this.subs.save(sub);
    await this.recordEvent(sub.id, 'note', `Updated: ${changes.join(', ')}`, { changes }, actorId);
    return this.getSubscription(sub.id);
  }

  async recordPayment(invoiceId: string, dto: RecordPaymentDto, actorId?: string) {
    const inv = await this.invoices.findOne({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const sub = await this.subs.findOne({ where: { id: inv.subscriptionId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    const gw = dto.gateway ?? 'manual';
    const isGateway = gw !== 'manual';
    const pay = this.payments.create(<Partial<SaasPayment>>{
      invoiceId: inv.id,
      subscriptionId: sub.id,
      tenantId: sub.tenantId,
      billingPayerTenantId: inv.billingPayerTenantId ?? sub.billingPayerTenantId ?? null,
      currency: dto.currency ?? inv.currency,
      amountMinor: dto.amountMinor,
      status: 'succeeded',
      gateway: gw,
      gatewayRef: dto.gatewayRef ?? null,
      method: dto.method ?? null,
      paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
      recordedBy: actorId ?? null,
      notes: dto.notes ?? null,
      verificationStatus: isGateway ? 'verified' : 'pending_verification',
      verifiedAt: isGateway ? new Date() : null,
    });
    const savedPay = await this.payments.save(pay);

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
        await this.recordEvent(
          sub.id,
          wasTrial ? 'trial_converted' : 'activated',
          'Subscription activated by payment',
          { invoiceId: inv.id },
          actorId,
        );
      }
      await this.subs.save(sub);
    }
    await this.recordEvent(
      sub.id,
      'payment_recorded',
      `Payment ${this.fmtMoney(dto.amountMinor, inv.currency)} via ${dto.gateway ?? 'manual'}`,
      { paymentId: savedPay.id, invoiceId: inv.id },
      actorId,
    );
    await this.syncLicenseFromSubscription(sub.id);
    const receiptTo = await this.resolveBillingEmail(sub);
    if (receiptTo) this.mailer.sendPaymentReceipt(receiptTo, savedPay, inv).catch(() => {});
    this.webhooks
      .enqueue(sub.tenantId, 'payment.recorded', {
        paymentId: savedPay.id,
        invoiceId: inv.id,
        subscriptionId: sub.id,
        amountMinor: savedPay.amountMinor,
        currency: savedPay.currency,
        gateway: savedPay.gateway,
        method: savedPay.method,
        paidAt: savedPay.paidAt,
      })
      .catch(() => {});
    if (inv.status === 'paid') {
      this.webhooks
        .enqueue(sub.tenantId, 'invoice.paid', {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          subscriptionId: sub.id,
          totalMinor: inv.totalMinor,
          currency: inv.currency,
          paidAt: inv.paidAt,
        })
        .catch(() => {});
    }
    return savedPay;
  }

  // ============================================================
  // PAYMENT PROOF & VERIFICATION
  // ============================================================

  async uploadPaymentProof(
    paymentId: string,
    file: Express.Multer.File,
    uploadedBy: string,
    notes?: string,
  ) {
    const pay = await this.payments.findOne({ where: { id: paymentId } });
    if (!pay) throw new NotFoundException('Payment not found');
    const proof = this.paymentProofs.create({
      paymentId,
      filePath: file.path,
      originalFilename: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      uploadedBy,
      notes: notes ?? null,
    });
    return this.paymentProofs.save(proof);
  }

  async listPaymentProofs(paymentId: string) {
    return this.paymentProofs.find({ where: { paymentId }, order: { createdAt: 'DESC' } });
  }

  async getPaymentProof(proofId: string) {
    const proof = await this.paymentProofs.findOne({ where: { id: proofId } });
    if (!proof) throw new NotFoundException('Proof not found');
    return proof;
  }

  async verifyPayment(
    paymentId: string,
    dto: { status: 'verified' | 'rejected'; notes?: string },
    verifierId: string,
  ) {
    const pay = await this.payments.findOne({ where: { id: paymentId } });
    if (!pay) throw new NotFoundException('Payment not found');
    if (pay.verificationStatus === 'verified')
      throw new BadRequestException('Payment already verified');
    if (dto.status !== 'verified' && dto.status !== 'rejected')
      throw new BadRequestException('Status must be verified or rejected');

    pay.verificationStatus = dto.status;
    pay.verifiedBy = verifierId;
    pay.verifiedAt = new Date();
    pay.verificationNotes = dto.notes ?? null;
    await this.payments.save(pay);

    await this.recordEvent(
      pay.subscriptionId,
      'payment_recorded',
      `Payment ${this.fmtMoney(pay.amountMinor, pay.currency)} ${dto.status} by verifier`,
      { paymentId: pay.id, verificationStatus: dto.status },
      verifierId,
    );

    return pay;
  }

  async listPaymentsForVerification() {
    return this.payments.find({
      where: { verificationStatus: 'pending_verification' },
      order: { createdAt: 'DESC' },
    });
  }

  async voidInvoice(id: string, actorId?: string) {
    const inv = await this.invoices.findOne({ where: { id } });
    if (!inv) throw new NotFoundException();
    if (inv.status === 'paid') throw new BadRequestException('Cannot void a paid invoice');
    inv.status = 'void';
    await this.invoices.save(inv);
    await this.recordEvent(
      inv.subscriptionId,
      'note',
      `Invoice ${inv.invoiceNumber} voided`,
      null,
      actorId,
    );
    return inv;
  }

  async refundPayment(
    paymentId: string,
    dto: { amountMinor?: number; reason?: string },
    actorId?: string,
  ) {
    const pay = await this.payments.findOne({ where: { id: paymentId } });
    if (!pay) throw new NotFoundException('Payment not found');
    if (pay.status === 'refunded') throw new BadRequestException('Payment already fully refunded');
    if (pay.status !== 'succeeded')
      throw new BadRequestException(`Cannot refund a ${pay.status} payment`);

    const meta = (pay.gatewayPayload || {}) as Record<string, any>;
    const alreadyRefunded = Number(meta.refundedMinor || 0);
    const refundable = pay.amountMinor - alreadyRefunded;
    if (refundable <= 0) throw new BadRequestException('Nothing left to refund');

    const amount =
      dto.amountMinor && dto.amountMinor > 0 ? Math.floor(dto.amountMinor) : refundable;
    if (amount > refundable)
      throw new BadRequestException(`Refund exceeds refundable balance (${refundable})`);

    const reason = (dto.reason || '').trim() || null;

    // Call Flutterwave refund API if this was a Flutterwave payment
    let gatewayRefundId: string | undefined;
    let gatewayRefundStatus = 'completed';
    if (pay.gateway === 'flutterwave') {
      const txId = meta.transaction_id || meta.transactionId || pay.gatewayRef;
      if (txId) {
        const refundResult = await this.flw.refundTransaction(String(txId), amount / 100);
        if (refundResult.ok) {
          gatewayRefundId = refundResult.refundId;
        } else {
          gatewayRefundStatus = 'refund_pending';
          this.logger.warn(
            `Flutterwave refund failed for payment ${paymentId}: ${refundResult.error} — recorded locally as refund_pending`,
          );
        }
      }
    }

    const refundRecord = {
      at: new Date().toISOString(),
      amountMinor: amount,
      reason,
      by: actorId || null,
      gatewayRefundId,
      gatewayRefundStatus,
    };
    const newRefundedTotal = alreadyRefunded + amount;
    pay.gatewayPayload = {
      ...meta,
      refundedMinor: newRefundedTotal,
      refunds: [...(meta.refunds || []), refundRecord],
    };
    if (newRefundedTotal >= pay.amountMinor) pay.status = 'refunded';
    await this.payments.save(pay);

    const inv = await this.invoices.findOne({ where: { id: pay.invoiceId } });
    if (inv) {
      inv.amountPaidMinor = Math.max(0, inv.amountPaidMinor - amount);
      if (inv.status === 'paid' && inv.amountPaidMinor < inv.totalMinor) {
        inv.status = 'open';
        inv.paidAt = null;
      }
      await this.invoices.save(inv);
    }

    await this.recordEvent(
      pay.subscriptionId,
      'payment_refunded',
      `Refund ${this.fmtMoney(amount, pay.currency)} on payment ${pay.id}${reason ? ` — ${reason}` : ''}`,
      { paymentId: pay.id, invoiceId: pay.invoiceId, amountMinor: amount, reason },
      actorId,
    );
    const subForRefund = await this.subs.findOne({ where: { id: pay.subscriptionId } });
    if (subForRefund) {
      this.webhooks
        .enqueue(subForRefund.tenantId, 'payment.refunded', {
          paymentId: pay.id,
          invoiceId: pay.invoiceId,
          subscriptionId: pay.subscriptionId,
          amountMinor: amount,
          currency: pay.currency,
          reason,
          refundedTotalMinor: newRefundedTotal,
        })
        .catch(() => {});
    }

    return pay;
  }

  // ============================================================
  // REVENUE DASHBOARD
  // ============================================================
  async getRevenueDashboard() {
    const subs = await this.subs.find({ relations: ['plan'] });
    const active = subs.filter((s) => s.status === 'active' || s.status === 'past_due');
    const trial = subs.filter((s) => s.status === 'trial');
    const churned30d = subs.filter(
      (s) => s.churnedAt && s.churnedAt > this.addDays(new Date(), -30),
    );

    // MRR: convert annual to monthly.
    const mrrMinor = active.reduce((acc, s) => {
      const monthly =
        s.billingInterval === 'annual' ? Math.round(s.unitPriceMinor / 12) : s.unitPriceMinor;
      const net = this.applyDiscount(monthly * s.seats, s);
      return acc + net;
    }, 0);

    const arrMinor = mrrMinor * 12;

    // Last 12 months revenue (paid invoices).
    const since = this.addDays(new Date(), -365);
    const paidInv = await this.invoices.find({
      where: { status: 'paid', paidAt: MoreThan(since) },
    });
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
    const churnRatePct =
      active.length + churned30d.length === 0
        ? 0
        : (churned30d.length / (active.length + churned30d.length)) * 100;

    // Outstanding A/R (open + past_due invoices).
    const openInv = await this.invoices.find({ where: { status: In(['open']) } });
    const outstandingMinor = openInv.reduce((a, i) => a + (i.totalMinor - i.amountPaidMinor), 0);
    const overdue = openInv.filter((i) => i.dueAt < new Date());

    // Top customers by lifetime revenue.
    const allPaid = await this.invoices.find({ where: { status: 'paid' } });
    const byTenant = new Map<string, number>();
    for (const i of allPaid)
      byTenant.set(i.tenantId, (byTenant.get(i.tenantId) ?? 0) + i.totalMinor);
    const topRaw = Array.from(byTenant.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    const topTenantsMap = await this.tenantMap(topRaw.map(([id]) => id));
    const topCustomers = topRaw.map(([tenantId, totalMinor]) => ({
      tenantId,
      totalMinor,
      tenant: topTenantsMap.get(tenantId) ?? null,
    }));

    // Plan breakdown — enriched with trials, churned, ARR, lifetime, ARPA.
    const allInv = allPaid; // alias for clarity
    const subsByPlanId = new Map<string, typeof subs>();
    for (const s of subs) {
      const arr = subsByPlanId.get(s.planId) || [];
      arr.push(s);
      subsByPlanId.set(s.planId, arr);
    }
    const subToPlan = new Map(subs.map((s) => [s.id, s.planId] as const));
    const lifetimeByPlan = new Map<string, number>();
    for (const i of allInv) {
      const pid = subToPlan.get(i.subscriptionId);
      if (!pid) continue;
      lifetimeByPlan.set(pid, (lifetimeByPlan.get(pid) || 0) + (i.amountPaidMinor || i.totalMinor));
    }
    const byPlan = new Map<
      string,
      {
        planId: string;
        planName: string;
        planCode?: string;
        tier?: string;
        count: number;
        trialCount: number;
        churnedCount: number;
        pastDueCount: number;
        mrrMinor: number;
        arrMinor: number;
        lifetimeMinor: number;
        arpaMinor: number;
        sharePct: number;
      }
    >();
    for (const s of active) {
      const k = s.planId;
      const monthlyAmt =
        s.billingInterval === 'annual' ? Math.round(s.unitPriceMinor / 12) : s.unitPriceMinor;
      const net = this.applyDiscount(monthlyAmt * s.seats, s);
      const cur = byPlan.get(k) ?? {
        planId: k,
        planName: s.plan?.name ?? '?',
        planCode: s.plan?.code,
        tier: s.plan?.tier,
        count: 0,
        trialCount: 0,
        churnedCount: 0,
        pastDueCount: 0,
        mrrMinor: 0,
        arrMinor: 0,
        lifetimeMinor: 0,
        arpaMinor: 0,
        sharePct: 0,
      };
      cur.count += 1;
      cur.mrrMinor += net;
      byPlan.set(k, cur);
    }
    // Make sure every plan that has trial/churned/past-due/lifetime shows up too.
    const allPlanIds = new Set<string>([
      ...byPlan.keys(),
      ...subsByPlanId.keys(),
      ...lifetimeByPlan.keys(),
    ]);
    for (const pid of allPlanIds) {
      const planSubs = subsByPlanId.get(pid) || [];
      const sample = planSubs[0];
      const cur = byPlan.get(pid) ?? {
        planId: pid,
        planName: sample?.plan?.name ?? '?',
        planCode: sample?.plan?.code,
        tier: sample?.plan?.tier,
        count: 0,
        trialCount: 0,
        churnedCount: 0,
        pastDueCount: 0,
        mrrMinor: 0,
        arrMinor: 0,
        lifetimeMinor: 0,
        arpaMinor: 0,
        sharePct: 0,
      };
      cur.trialCount = planSubs.filter((s) => s.status === 'trial').length;
      cur.churnedCount = planSubs.filter(
        (s) => s.status === 'churned' || s.status === 'cancelled',
      ).length;
      cur.pastDueCount = planSubs.filter((s) => s.status === 'past_due').length;
      cur.arrMinor = cur.mrrMinor * 12;
      cur.lifetimeMinor = lifetimeByPlan.get(pid) || 0;
      cur.arpaMinor = cur.count > 0 ? Math.round(cur.mrrMinor / cur.count) : 0;
      byPlan.set(pid, cur);
    }
    const totalPlanMrr = Array.from(byPlan.values()).reduce((a, p) => a + p.mrrMinor, 0) || 1;
    for (const p of byPlan.values()) p.sharePct = +((p.mrrMinor / totalPlanMrr) * 100).toFixed(1);

    // Forecast next 30/60/90 days from nextRenewalAt of active subs.
    const now = new Date();
    const horizons = [30, 60, 90];
    const forecast: Record<string, number> = {};
    for (const h of horizons) {
      const end = this.addDays(now, h);
      forecast[`d${h}Minor`] = active
        .filter(
          (s) => s.autoRenew && s.nextRenewalAt && s.nextRenewalAt <= end && s.nextRenewalAt > now,
        )
        .reduce((a, s) => a + this.applyDiscount(s.unitPriceMinor * s.seats, s), 0);
    }

    // Expiring soon (renewal within 14 days).
    const expiringRaw = active.filter(
      (s) => s.nextRenewalAt && s.nextRenewalAt <= this.addDays(now, 14),
    );
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
    const monthlyChurn =
      active.length + churned30d.length === 0
        ? 0
        : churned30d.length / (active.length + churned30d.length);
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

  async getPlanAnalytics(planId: string) {
    const plan = await this.plans.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    const subs = await this.subs.find({ where: { planId } });
    const active = subs.filter((s) => s.status === 'active' || s.status === 'past_due');
    const trial = subs.filter((s) => s.status === 'trial');
    const churned = subs.filter((s) => s.status === 'churned' || s.status === 'cancelled');
    const churned30d = subs.filter(
      (s) => s.churnedAt && s.churnedAt > this.addDays(new Date(), -30),
    );

    const mrrMinor = active.reduce((acc, s) => {
      const monthly =
        s.billingInterval === 'annual' ? Math.round(s.unitPriceMinor / 12) : s.unitPriceMinor;
      return acc + this.applyDiscount(monthly * s.seats, s);
    }, 0);
    const arrMinor = mrrMinor * 12;
    const arpaMinor = active.length ? Math.round(mrrMinor / active.length) : 0;

    // Per-plan invoice/payment metrics.
    const subIds = subs.map((s) => s.id);
    const planInv = subIds.length
      ? await this.invoices.find({ where: { subscriptionId: In(subIds) } })
      : [];
    const paid = planInv.filter((i) => i.status === 'paid');
    const lifetimeMinor = paid.reduce((a, i) => a + (i.amountPaidMinor || i.totalMinor), 0);
    const outstandingMinor = planInv
      .filter((i) => ['open', 'past_due', 'uncollectible'].includes(i.status as string))
      .reduce((a, i) => a + Math.max(0, i.totalMinor - (i.amountPaidMinor || 0)), 0);

    // 12-month revenue trend for this plan.
    const since = this.addDays(new Date(), -365);
    const recent = paid.filter((i) => i.paidAt && i.paidAt > since);
    const monthly = new Map<string, number>();
    for (const inv of recent) {
      if (!inv.paidAt) continue;
      const k = `${inv.paidAt.getFullYear()}-${String(inv.paidAt.getMonth() + 1).padStart(2, '0')}`;
      monthly.set(k, (monthly.get(k) ?? 0) + (inv.amountPaidMinor || inv.totalMinor));
    }
    const monthlyRevenue = Array.from(monthly.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, total]) => ({ month, totalMinor: total }));

    // Conversion: trial → active. Use churnedAt-less subs that left trial.
    const startedTrial = subs.filter(
      (s) =>
        s.trialEndsAt ||
        s.status === 'trial' ||
        s.status === 'active' ||
        s.status === 'churned' ||
        s.status === 'cancelled',
    );
    const convertedFromTrial = startedTrial.filter(
      (s) => s.status === 'active' || s.status === 'past_due',
    );
    const trialConversionPct =
      startedTrial.length > 0
        ? +((convertedFromTrial.length / startedTrial.length) * 100).toFixed(1)
        : 0;

    // Churn (per-plan, 30d).
    const churnRatePct =
      active.length + churned30d.length === 0
        ? 0
        : +((churned30d.length / (active.length + churned30d.length)) * 100).toFixed(2);

    // Recent customers on this plan.
    const recentSubs = [...active, ...trial]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 20);
    const tmap = await this.tenantMap(recentSubs.map((s) => s.tenantId));
    const customers = recentSubs.map((s) => ({
      subscriptionId: s.id,
      tenantId: s.tenantId,
      tenant: tmap.get(s.tenantId) ?? null,
      status: s.status,
      billingInterval: s.billingInterval,
      seats: s.seats,
      mrrMinor: this.applyDiscount(
        (s.billingInterval === 'annual' ? Math.round(s.unitPriceMinor / 12) : s.unitPriceMinor) *
          s.seats,
        s,
      ),
      currency: s.currency,
      nextRenewalAt: s.nextRenewalAt,
      createdAt: s.createdAt,
    }));

    return {
      plan: {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        tier: plan.tier,
        priceMonthlyMinor: plan.priceMonthlyMinor,
        priceAnnualMinor: plan.priceAnnualMinor,
        currency: plan.currency,
        isActive: plan.isActive,
      },
      counts: {
        total: subs.length,
        active: active.length,
        trial: trial.length,
        churned: churned.length,
        churned30d: churned30d.length,
      },
      mrrMinor,
      arrMinor,
      arpaMinor,
      lifetimeMinor,
      outstandingMinor,
      churnRatePct,
      trialConversionPct,
      monthlyRevenue,
      customers,
    };
  }

  // ============================================================
  // CRON: nightly renewal + dunning + trial expiry
  // ============================================================
  @Cron(CronExpression.EVERY_HOUR, { name: 'saas-renewals-dunning-trial' })
  async renewalTick() {
    try {
      await this.processTrialExpiry();
      await this.processRenewals();
      await this.processDunning();
      await this.processRenewalReminders();
      await this.processTrialEndingReminders();
    } catch (e: any) {
      this.logger.error(`renewalTick failed: ${e?.message ?? e}`);
    }
  }

  async processTrialExpiry() {
    const now = new Date();
    const expired = await this.subs.find({
      where: { status: 'trial', trialEndsAt: LessThanOrEqual(now) },
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
      where: [{ status: 'active', autoRenew: true, nextRenewalAt: LessThanOrEqual(now) }],
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
      await this.syncLicenseFromSubscription(s.id);
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
      where: { status: 'open', dueAt: LessThanOrEqual(now) },
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
        await this.recordEvent(
          sub.id,
          'past_due',
          `Invoice ${inv.invoiceNumber} ${daysOverdue}d overdue`,
        );
        const to = await this.resolveBillingEmail(sub);
        this.mailer.sendDunning(to, sub, inv, daysOverdue).catch(() => {});
      } else if (
        sub.status === 'past_due' &&
        daysOverdue > rules.graceDays &&
        (daysOverdue - rules.graceDays) % rules.reminderIntervalDays === 0
      ) {
        // Send a reminder every reminderIntervalDays after the grace period.
        // Guard: skip if we already sent a dunning email today (cron runs hourly).
        const lastSent = sub.lastDunningAt ? sub.lastDunningAt.getTime() : 0;
        const hoursSinceLastSent = (now.getTime() - lastSent) / 3600000;
        if (hoursSinceLastSent >= 23) {
          sub.lastDunningAt = now;
          await this.subs.save(sub);
          const to = await this.resolveBillingEmail(sub);
          this.mailer.sendDunning(to, sub, inv, daysOverdue).catch(() => {});
        }
      }
      // Auto-churn at churnAfterDays past due.
      if (daysOverdue >= rules.churnAfterDays && sub.status === 'past_due') {
        sub.status = 'churned';
        sub.churnedAt = now;
        await this.subs.save(sub);
        await this.recordEvent(
          sub.id,
          'churned',
          `Auto-churn after ${rules.churnAfterDays}d unpaid`,
        );
        await this.syncLicenseFromSubscription(sub.id);
        // Notify tenant and dispatch webhook on auto-churn
        this.webhooks.enqueue(sub.tenantId, 'subscription.churned', {
          subscriptionId: sub.id,
          tenantId: sub.tenantId,
          reason: `Auto-churned after ${rules.churnAfterDays} days unpaid`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
        });
        const to = await this.resolveBillingEmail(sub);
        this.mailer.sendDunning(to, sub, inv, daysOverdue).catch(() => {});
      }
    }
  }

  // ============================================================
  // RENEWAL & TRIAL REMINDERS
  // ============================================================

  private async processRenewalReminders() {
    const now = new Date();
    const reminderDays = [7, 3, 1];
    for (const days of reminderDays) {
      const windowStart = new Date(now.getTime() + (days - 0.5) * 86400000);
      const windowEnd = new Date(now.getTime() + (days + 0.5) * 86400000);
      const upcoming = await this.subs.find({
        where: {
          status: 'active',
          autoRenew: true,
          nextRenewalAt: Between(windowStart, windowEnd),
        },
        relations: ['plan'],
      });
      for (const sub of upcoming) {
        // Only send once per day by checking metadata
        const sentKey = `renewal_reminder_${days}d`;
        if (sub.metadata?.[sentKey]) continue;
        const reminderTo = await this.resolveBillingEmail(sub);
        this.mailer.sendRenewalReminder(reminderTo, sub, days).catch(() => {});
        sub.metadata = { ...(sub.metadata || {}), [sentKey]: now.toISOString() };
        await this.subs.save(sub);
      }
    }
  }

  private async processTrialEndingReminders() {
    const now = new Date();
    const reminderDays = [3, 1];
    for (const days of reminderDays) {
      const windowStart = new Date(now.getTime() + (days - 0.5) * 86400000);
      const windowEnd = new Date(now.getTime() + (days + 0.5) * 86400000);
      const expiring = await this.subs.find({
        where: { status: 'trial', trialEndsAt: Between(windowStart, windowEnd) },
        relations: ['plan'],
      });
      for (const sub of expiring) {
        const sentKey = `trial_ending_${days}d`;
        if (sub.metadata?.[sentKey]) continue;
        const trialTo = await this.resolveBillingEmail(sub);
        this.mailer.sendTrialEnding(trialTo, sub).catch(() => {});
        sub.metadata = { ...(sub.metadata || {}), [sentKey]: now.toISOString() };
        await this.subs.save(sub);
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
    if (lic.licenseType !== targetType) {
      lic.licenseType = targetType;
      changed = true;
    }
    if (sub.plan.maxUsers && lic.maxUsers !== sub.plan.maxUsers) {
      lic.maxUsers = sub.plan.maxUsers;
      changed = true;
    }
    if (
      sub.currentPeriodEnd &&
      (!lic.expiresAt || lic.expiresAt.getTime() !== sub.currentPeriodEnd.getTime())
    ) {
      lic.expiresAt = sub.currentPeriodEnd;
      changed = true;
    }
    if (sub.status === 'churned' || sub.status === 'cancelled') {
      if (lic.status !== 'expired') {
        lic.status = 'expired';
        changed = true;
      }
    } else if (sub.status === 'paused') {
      if (lic.status !== 'suspended') {
        lic.status = 'suspended';
        changed = true;
      }
    } else if (sub.status === 'active' || sub.status === 'trial') {
      if (lic.status !== 'active') {
        lic.status = 'active';
        changed = true;
      }
    }
    // Sync enabledModules from plan to license
    if (sub.plan?.enabledModules?.length) {
      const sorted = [...sub.plan.enabledModules].sort();
      const licSorted = lic.enabledModules ? [...lic.enabledModules].sort() : [];
      if (JSON.stringify(sorted) !== JSON.stringify(licSorted)) {
        lic.enabledModules = sub.plan.enabledModules;
        changed = true;
      }
    }
    if (changed) {
      await this.licenses.save(lic);
      // Propagate enabledModules to system_settings so tenant config stays in sync
      if (lic.enabledModules?.length && sub.tenantId) {
        await this.subs.manager.query(
          `INSERT INTO system_settings (tenant_id, key, value, description)
           VALUES ($1, 'enabled_modules', $2::jsonb, 'Synced from subscription plan')
           ON CONFLICT (key, tenant_id)
           DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [sub.tenantId, JSON.stringify(lic.enabledModules)],
        );
      }
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private async recordEvent(
    subscriptionId: string,
    type: SubscriptionEventType,
    message?: string,
    payload?: any,
    actorId?: string,
  ) {
    return this.events.save(
      this.events.create(<Partial<SaasSubscriptionEvent>>{
        subscriptionId,
        type,
        message: message ?? null,
        payload: payload ?? null,
        actorId: actorId ?? null,
      }),
    );
  }

  private async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    // Use advisory lock to prevent race conditions on concurrent invoice creation
    const lockId = 900000 + year; // stable lock ID per year
    const mgr = this.invoices.manager;
    await mgr.query(`SELECT pg_advisory_lock($1)`, [lockId]);
    try {
      const last = await this.invoices
        .createQueryBuilder('i')
        .where('i.invoiceNumber LIKE :p', { p: `${prefix}%` })
        .orderBy('i.invoiceNumber', 'DESC')
        .limit(1)
        .getOne();
      let nextSeq = 1;
      if (last) {
        const m = last.invoiceNumber.match(/(\d+)$/);
        if (m) nextSeq = parseInt(m[1], 10) + 1;
      }
      return `${prefix}${String(nextSeq).padStart(5, '0')}`;
    } finally {
      await mgr.query(`SELECT pg_advisory_unlock($1)`, [lockId]);
    }
  }

  private addDays(d: Date, days: number) {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
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
    return fmtMoney(minor, currency);
  }

  // ============================================================
  // PUBLIC PRICING (no auth)
  // ============================================================
  async listPublicPlans() {
    return this.plans.find({
      where: { isActive: true, isPublic: true },
      order: { sortOrder: 'ASC', priceMonthlyMinor: 'ASC' },
    });
  }

  // ============================================================
  // LEAD CONVERSION
  // ============================================================
  async convertLead(leadId: string, dto: any, actorId?: string) {
    const lead = await this.leads.findOne({ where: { id: leadId } });
    const billingEmail = dto.billingEmail ?? lead?.email ?? null;
    const billingName = lead?.fullName ?? undefined;
    const created = await this.createSubscription(
      {
        tenantId: dto.tenantId,
        planId: dto.planId,
        billingInterval: dto.billingInterval,
        seats: dto.seats ?? 1,
        leadId,
        startTrial: dto.startTrial ?? false,
        autoRenew: true,
        billingEmail,
        billingName,
      },
      actorId,
    );
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
    return this.getMyBillingOverview(tenantId);
  }

  // ============================================================
  // GATEWAY (Flutterwave + Pesapal)
  // ============================================================
  gatewaysStatus() {
    return {
      flutterwave: { configured: this.flw.isConfigured() },
      pesapal: this.pesapal.status(),
    };
  }

  async initCheckout(
    invoiceId: string,
    opts: {
      redirectUrl: string;
      customerEmail?: string;
      customerName?: string;
      customerPhone?: string;
      gateway?: 'flutterwave' | 'pesapal';
      originUrl?: string;
      savedPaymentMethodId?: string;
      enableRecurring?: boolean;
    },
    tenantId?: string,
  ) {
    const inv = await this.invoices.findOne({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (tenantId && inv.tenantId !== tenantId && inv.billingPayerTenantId !== tenantId)
      throw new ForbiddenException('Cross-tenant access');
    if (inv.status === 'paid') throw new BadRequestException('Invoice already paid');
    const sub = await this.subs.findOne({ where: { id: inv.subscriptionId } });
    const due = inv.totalMinor - inv.amountPaidMinor;
    const customerEmail =
      opts.customerEmail || sub?.billingEmail || `tenant-${inv.tenantId}@noemail.local`;
    const txRef = `inv_${inv.id.slice(0, 8)}_${Date.now()}`;
    const gateway = opts.gateway || 'flutterwave';
    if (gateway === 'pesapal') {
      // Saved-token reuse: if the tenant has a Pesapal payment method, reuse its
      // accountNumber so Pesapal can debit the saved instrument without re-enrolling.
      let accountNumber: string | undefined;
      let pmRecord: SaasPaymentMethod | null = null;
      if (opts.savedPaymentMethodId) {
        pmRecord = await this.paymentMethods.findOne({
          where: { id: opts.savedPaymentMethodId, tenantId: inv.tenantId },
        });
        if (!pmRecord) throw new NotFoundException('Saved payment method not found');
        accountNumber = String((pmRecord.metadata as Record<string, unknown>)?.accountNumber || '');
      } else {
        // Auto-pick default Pesapal method if any exists.
        const def = await this.paymentMethods.findOne({
          where: { tenantId: inv.tenantId, isDefault: true },
        });
        if (
          def &&
          def.metadata?.gateway === 'pesapal' &&
          def.metadata?.accountNumber
        ) {
          pmRecord = def;
          accountNumber = def.metadata.accountNumber;
        }
      }
      if (!accountNumber && opts.enableRecurring) {
        // Generate a stable account number tied to this subscription so future
        // charges can re-use it.
        accountNumber = `psp_${inv.tenantId.slice(0, 8)}_${(sub?.id ?? inv.id).slice(0, 8)}`;
      }
      const subscription =
        opts.enableRecurring && sub
          ? {
              frequency: (sub.billingInterval === 'annual' ? 'YEARLY' : 'MONTHLY') as
                | 'DAILY'
                | 'WEEKLY'
                | 'MONTHLY'
                | 'YEARLY',
            }
          : undefined;
      const result = await this.pesapal.initCheckout(
        {
          txRef,
          amount: due,
          currency: inv.currency,
          customerEmail,
          customerName: opts.customerName || sub?.billingName || undefined,
          customerPhone: opts.customerPhone,
          callbackUrl: opts.redirectUrl,
          description: `Invoice ${inv.invoiceNumber}`,
          accountNumber,
          subscription,
        },
        opts.originUrl,
      );
      return {
        ...result,
        gateway: 'pesapal',
        invoiceId: inv.id,
        amountMinor: due,
        currency: inv.currency,
        txRef,
        accountNumber,
        recurringEnrolled: !!subscription,
      };
    }
    const result = await this.flw.initCheckout({
      txRef,
      amount: due,
      currency: inv.currency,
      customerEmail,
      customerName: opts.customerName || sub?.billingName || undefined,
      redirectUrl: opts.redirectUrl,
      meta: {
        invoiceId: inv.id,
        subscriptionId: inv.subscriptionId,
        tenantId: inv.tenantId,
        description: `Invoice ${inv.invoiceNumber}`,
      },
    });
    return {
      ...result,
      gateway: 'flutterwave',
      invoiceId: inv.id,
      amountMinor: due,
      currency: inv.currency,
    };
  }

  /**
   * Headless charge against a saved Pesapal token. Pesapal does not expose a
   * synchronous server-to-server charge endpoint — this submits a fresh order
   * with the saved account_number which is auto-debited against the previously
   * authorised instrument. Returns the order tracking link as a fallback for
   * SCA / customer confirmation when the saved auth is not sufficient.
   */
  async chargeSavedPesapalToken(
    invoiceId: string,
    paymentMethodId: string,
    opts: { redirectUrl: string; originUrl?: string },
    actorId?: string,
  ) {
    const inv = await this.invoices.findOne({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status === 'paid') throw new BadRequestException('Invoice already paid');
    const pm = await this.paymentMethods.findOne({
      where: { id: paymentMethodId, tenantId: inv.tenantId },
    });
    if (!pm) throw new NotFoundException('Saved payment method not found');
    const meta = pm.metadata || {};
    if (meta.gateway !== 'pesapal' || !meta.accountNumber) {
      throw new BadRequestException('Saved method is not a Pesapal-tokenised instrument');
    }
    const sub = await this.subs.findOne({ where: { id: inv.subscriptionId } });
    const due = inv.totalMinor - inv.amountPaidMinor;
    const txRef = `recur_${inv.id.slice(0, 8)}_${Date.now()}`;
    const customerEmail = sub?.billingEmail || `tenant-${inv.tenantId}@noemail.local`;
    const result = await this.pesapal.initCheckout(
      {
        txRef,
        amount: due,
        currency: inv.currency,
        customerEmail,
        customerName: sub?.billingName || undefined,
        callbackUrl: opts.redirectUrl,
        description: `Auto-charge ${inv.invoiceNumber}`,
        accountNumber: meta.accountNumber,
      },
      opts.originUrl,
    );
    await this.recordEvent(
      inv.subscriptionId,
      'note',
      `Pesapal saved-token charge initiated for invoice ${inv.invoiceNumber} (account=${String(meta.accountNumber).slice(0, 12)}…)`,
      { invoiceId: inv.id, paymentMethodId, txRef, orderTrackingId: result.orderTrackingId },
      actorId,
    );
    return {
      ...result,
      gateway: 'pesapal' as const,
      invoiceId: inv.id,
      amountMinor: due,
      currency: inv.currency,
      txRef,
      paymentMethodId,
    };
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
      amountMinor: verified.amount ?? inv.totalMinor - inv.amountPaidMinor,
      currency: verified.currency ?? inv.currency,
      gateway: 'flutterwave',
      gatewayRef: String(txId),
      method: data?.payment_type || 'card',
      paidAt: new Date().toISOString(),
      notes: `Flutterwave tx_ref=${txRef ?? ''}`,
    });
    // Persist gateway payload on the latest payment.
    const latest = await this.payments.findOne({ where: { gatewayRef: String(txId) } });
    if (latest) {
      latest.gatewayPayload = data;
      await this.payments.save(latest);
    }
    // Persist saved-card token on first successful charge so future renewals can auto-debit.
    const card = (verified.raw as Record<string, unknown>)?.card || data?.card || {};
    const cardToken: string | undefined = card?.token;
    if (cardToken) {
      const matched = await this.paymentMethods
        .createQueryBuilder('pm')
        .where('pm.tenantId = :tid', { tid: inv.tenantId })
        .andWhere(`pm.metadata ->> 'token' = :tok`, { tok: String(cardToken) })
        .getOne();
      if (!matched) {
        const existingPm = await this.paymentMethods.findOne({ where: { tenantId: inv.tenantId } });
        const pm = this.paymentMethods.create({
          tenantId: inv.tenantId,
          kind: 'card',
          label: `Flutterwave · ${card?.type || 'card'} ****${card?.last_4digits || ''}`,
          brand: card?.type || 'card',
          last4: card?.last_4digits || undefined,
          expMonth: card?.expiry ? Number(String(card.expiry).split('/')[0]) : undefined,
          expYear: card?.expiry ? Number(String(card.expiry).split('/')[1]) : undefined,
          isDefault: !existingPm,
          metadata: {
            gateway: 'flutterwave',
            token: String(cardToken),
            firstSeenTxId: String(txId),
            country: card?.country,
          },
        });
        await this.paymentMethods.save(pm);
        this.logger.log(
          `Saved Flutterwave card token for tenant=${inv.tenantId} last4=${card?.last_4digits || '?'}`,
        );
      }
    }
    return { ok: true };
  }

  /**
   * Charge a previously-saved Flutterwave card token (metadata.gateway='flutterwave', metadata.token=…).
   * Records a `note` event; the actual payment row is created when Flutterwave's
   * webhook (`charge.completed`) fires for the new transaction.
   */
  /** Inspect a saved payment method's metadata to choose the right charge path. */
  async detectSavedTokenGateway(
    paymentMethodId: string,
  ): Promise<'flutterwave' | 'pesapal' | null> {
    const pm = await this.paymentMethods.findOne({ where: { id: paymentMethodId } });
    if (!pm) return null;
    const g = (pm.metadata as Record<string, unknown>)?.gateway;
    return g === 'flutterwave' || g === 'pesapal' ? g : null;
  }

  async chargeSavedFlutterwaveToken(
    invoiceId: string,
    paymentMethodId: string,
    _opts: { redirectUrl?: string; originUrl?: string } = {},
    actorId?: string,
  ) {
    const inv = await this.invoices.findOne({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status === 'paid' || inv.status === 'void') {
      throw new BadRequestException(`Invoice is ${inv.status}; cannot charge`);
    }
    const due = Math.max(0, inv.totalMinor - (inv.amountPaidMinor || 0));
    if (due <= 0) throw new BadRequestException('Invoice has no balance due');
    const pm = await this.paymentMethods.findOne({ where: { id: paymentMethodId } });
    if (!pm) throw new NotFoundException('Payment method not found');
    if (pm.tenantId !== inv.tenantId && pm.tenantId !== inv.billingPayerTenantId) {
      throw new ForbiddenException('Payment method does not belong to invoice tenant');
    }
    const meta = pm.metadata || {};
    if (meta.gateway !== 'flutterwave' || !meta.token) {
      throw new BadRequestException('Selected payment method has no saved Flutterwave token');
    }
    const sub = inv.subscriptionId
      ? await this.subs.findOne({ where: { id: inv.subscriptionId } })
      : null;
    const tenant = await this.tenants.findOne({ where: { id: inv.tenantId } });
    const customerEmail = sub?.billingEmail || `tenant-${inv.tenantId}@noemail.local`;
    const customerName = tenant?.name || 'Customer';
    const txRef = `recur_${inv.id.slice(0, 8)}_${Date.now()}`;
    const result = await this.flw.chargeTokenized({
      token: String(meta.token),
      txRef,
      amountMinor: due,
      currency: inv.currency,
      customerEmail,
      customerName,
      narration: `Auto-renewal for invoice ${inv.invoiceNumber}`,
      meta: { invoiceId: inv.id, paymentMethodId, gateway: 'flutterwave', source: 'saved-token' },
    });
    if (!result.ok) {
      throw new BadRequestException('Flutterwave tokenized charge failed');
    }
    await this.recordEvent(
      inv.subscriptionId,
      'note',
      `Flutterwave saved-card charge initiated for invoice ${inv.invoiceNumber} (last4=${pm.last4 || '?'})`,
      { invoiceId: inv.id, paymentMethodId, txRef, transactionId: result.transactionId },
      actorId,
    );
    return {
      ok: true,
      gateway: 'flutterwave' as const,
      invoiceId: inv.id,
      amountMinor: due,
      currency: inv.currency,
      txRef,
      paymentMethodId,
      transactionId: result.transactionId,
      status: result.status,
    };
  }

  // ---------- Pesapal IPN ----------
  async handlePesapalIpn(
    orderTrackingId: string | undefined,
    merchantReference: string | undefined,
  ) {
    if (!orderTrackingId) return { ok: false, error: 'missing orderTrackingId' };
    const verified = await this.pesapal.verifyTransaction(orderTrackingId);
    if (!verified.ok) {
      this.logger.warn(
        `Pesapal IPN tx=${orderTrackingId} not completed (status=${verified.status})`,
      );
      return { ok: true, ignored: true, status: verified.status };
    }
    // Idempotency
    const existing = await this.payments.findOne({
      where: { gatewayRef: String(orderTrackingId) },
    });
    if (existing) return { ok: true, duplicate: true };
    // Locate invoice via merchant reference (txRef like inv_<8>_<ts>)
    const ref = merchantReference || verified.merchantReference || '';
    const m = ref.match(/^(?:inv|recur)_([0-9a-f]{8})_/i);
    if (!m) {
      this.logger.warn(`Pesapal IPN tx=${orderTrackingId} unrecognised merchant_ref=${ref}`);
      return { ok: true, ignored: true };
    }
    const inv = await this.invoices
      .createQueryBuilder('inv')
      .where('inv.id::text LIKE :prefix', { prefix: `${m[1]}%` })
      .getOne();
    if (!inv) return { ok: false, error: 'invoice not found' };
    await this.recordPayment(inv.id, {
      amountMinor: verified.amount ?? inv.totalMinor - inv.amountPaidMinor,
      currency: verified.currency ?? inv.currency,
      gateway: 'pesapal',
      gatewayRef: String(orderTrackingId),
      method: 'pesapal',
      paidAt: new Date().toISOString(),
      notes: `Pesapal merchant_ref=${ref}`,
    });
    const latest = await this.payments.findOne({ where: { gatewayRef: String(orderTrackingId) } });
    if (latest) {
      latest.gatewayPayload = verified.raw;
      await this.payments.save(latest);
    }
    // Persist saved-token payment method on first successful enrollment.
    const acct =
      verified.raw?.account_number ||
      verified.raw?.payment_account ||
      verified.raw?.billing_address?.account_number;
    if (acct) {
      const existingPm = await this.paymentMethods.findOne({
        where: { tenantId: inv.tenantId },
      });
      const matched = await this.paymentMethods
        .createQueryBuilder('pm')
        .where('pm.tenantId = :tid', { tid: inv.tenantId })
        .andWhere(`pm.metadata ->> 'accountNumber' = :acct`, { acct: String(acct) })
        .getOne();
      if (!matched) {
        const last4 = verified.raw?.confirmation_code
          ? String(verified.raw.confirmation_code).slice(-4)
          : String(acct).slice(-4);
        const pm = this.paymentMethods.create({
          tenantId: inv.tenantId,
          kind: (verified.raw?.payment_method?.toLowerCase()?.includes('mobile')
            ? 'mobile_money'
            : 'card') as SaasPaymentMethodKind,
          label: `Pesapal · ${verified.raw?.payment_method || 'saved'}`,
          brand: verified.raw?.payment_method || 'pesapal',
          last4,
          isDefault: !existingPm,
          metadata: {
            gateway: 'pesapal',
            accountNumber: String(acct),
            firstSeenTrackingId: String(orderTrackingId),
            paymentMethod: verified.raw?.payment_method,
          },
        });
        await this.paymentMethods.save(pm);
        this.logger.log(
          `Saved Pesapal token for tenant=${inv.tenantId} account=${String(acct).slice(0, 12)}…`,
        );
      }
    }
    return { ok: true };
  }

  // ============================================================
  // TENANT-SIDE BILLING PORTAL
  // ============================================================
  async getMyBillingOverview(tenantId: string) {
    const subsRows = await this.subs.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
    const planIds = Array.from(new Set(subsRows.map((s) => s.planId)));
    const plansRows = planIds.length ? await this.plans.find({ where: { id: In(planIds) } }) : [];
    const pmap = new Map(plansRows.map((p) => [p.id, p]));
    const subscriptions = subsRows.map((s) => ({ ...s, plan: pmap.get(s.planId) ?? null }));
    const active =
      subscriptions.find((s) => ['active', 'trial', 'past_due'].includes(s.status)) ||
      subscriptions[0] ||
      null;
    const invoiceRows = await this.invoices.find({
      where: { tenantId },
      order: { issuedAt: 'DESC' },
      take: 100,
    });
    const outstandingMinor = invoiceRows
      .filter((i) => ['open', 'past_due', 'uncollectible'].includes(i.status as string))
      .reduce((sum, i) => sum + Math.max(0, i.totalMinor - (i.amountPaidMinor || 0)), 0);
    const lifetimeMinor = invoiceRows
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + (i.amountPaidMinor || i.totalMinor), 0);
    const currency = active?.currency || invoiceRows[0]?.currency || 'UGX';
    const methods = await this.paymentMethods.find({
      where: { tenantId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
    const paymentsRows = await this.payments.find({
      where: { tenantId },
      order: { paidAt: 'DESC' },
      take: 50,
    });
    return {
      activeSubscription: active,
      subscriptions,
      invoices: invoiceRows,
      payments: paymentsRows,
      paymentMethods: methods,
      outstandingMinor,
      summary: {
        outstandingMinor,
        lifetimeMinor,
        currency,
        outstandingCount: invoiceRows.filter((i) =>
          ['open', 'past_due', 'uncollectible'].includes(i.status as string),
        ).length,
        nextRenewal: active?.currentPeriodEnd || null,
      },
    };
  }

  async listMyInvoices(tenantId: string, status?: string) {
    const qb = this.invoices
      .createQueryBuilder('i')
      .where('(i.tenantId = :tid OR i.billing_payer_tenant_id = :tid)', { tid: tenantId })
      .orderBy('i.issuedAt', 'DESC')
      .take(200);
    if (status) qb.andWhere('i.status = :status', { status });
    return qb.getMany();
  }

  async getMyInvoice(tenantId: string, id: string) {
    const inv = await this.getInvoice(id);
    if (inv.tenantId !== tenantId && inv.billingPayerTenantId !== tenantId) {
      throw new ForbiddenException('Invoice does not belong to your tenant');
    }
    return inv;
  }

  async listMyManagedSubscriptions(payerTenantId: string) {
    const subs = await this.subs.find({
      where: { billingPayerTenantId: payerTenantId },
      order: { createdAt: 'DESC' },
      take: 500,
    });
    if (subs.length === 0) return [];
    const tenantIds = Array.from(new Set(subs.map((s) => s.tenantId)));
    const planIds = Array.from(new Set(subs.map((s) => s.planId)));
    const [tenants, plans] = await Promise.all([
      this.tenants.find({ where: { id: In(tenantIds) }, select: ['id', 'name', 'slug'] }),
      this.plans.find({ where: { id: In(planIds) } }),
    ]);
    const tMap = new Map(tenants.map((t) => [t.id, t]));
    const pMap = new Map(plans.map((p) => [p.id, p]));
    return subs.map((s) => ({
      ...s,
      tenant: tMap.get(s.tenantId) ?? null,
      plan: pMap.get(s.planId) ?? null,
    }));
  }

  async setSubscriptionPayer(
    subscriptionId: string,
    payerTenantId: string | null,
    actorId?: string,
  ) {
    const sub = await this.subs.findOne({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (payerTenantId) {
      if (payerTenantId === sub.tenantId) {
        throw new BadRequestException('Payer tenant cannot be the same as the consumer tenant');
      }
      const payer = await this.tenants.findOne({ where: { id: payerTenantId } });
      if (!payer) throw new NotFoundException('Payer tenant not found');
    }
    const oldPayer = sub.billingPayerTenantId;
    sub.billingPayerTenantId = payerTenantId;
    await this.subs.save(sub);
    // Propagate to all open/draft invoices so the payer immediately sees them.
    await this.invoices
      .createQueryBuilder()
      .update()
      .set({ billingPayerTenantId: payerTenantId })
      .where('subscription_id = :sid AND status IN (:...sts)', {
        sid: sub.id,
        sts: ['draft', 'open', 'past_due'],
      })
      .execute();
    await this.recordEvent(
      sub.id,
      'note',
      payerTenantId
        ? `Billing payer set to tenant ${payerTenantId}`
        : `Billing payer cleared (was ${oldPayer ?? 'self'})`,
      { oldPayer, newPayer: payerTenantId },
      actorId,
    );
    return sub;
  }

  async renderInvoicePdf(id: string, requireTenantId?: string): Promise<Buffer> {
    const inv = await this.getInvoice(id);
    if (
      requireTenantId &&
      inv.tenantId !== requireTenantId &&
      inv.billingPayerTenantId !== requireTenantId
    ) {
      throw new ForbiddenException('Invoice does not belong to your tenant');
    }
    const sub = await this.subs.findOne({ where: { id: inv.subscriptionId } });
    const plan = sub ? await this.plans.findOne({ where: { id: sub.planId } }) : null;
    const tenant = await this.tenants.findOne({
      where: { id: inv.tenantId },
      select: ['id', 'name', 'slug'],
    });
    const vendor = await this.getVendorBilling();
    const fmt = (n: number) => this.fmtMoney(n, inv.currency);
    const fmtD = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
    const lines = (inv.lines || []) as Array<{
      description: string;
      quantity: number;
      unitPriceMinor: number;
      amountMinor: number;
    }>;
    const paidRows = ((inv as any).payments || []) as Array<{
      paidAt: any;
      amountMinor: number;
      gateway: string;
      method?: string | null;
      gatewayRef?: string | null;
    }>;

    const PDFDocumentMod = await import('pdfkit');
    const PDFDocument = PDFDocumentMod.default || PDFDocumentMod;
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done: Promise<Buffer> = new Promise((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    // Header — vendor (left) / INVOICE (right)
    const top = doc.y;
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(vendor.tradingName || vendor.legalName, 40, top);
    doc.fontSize(9).font('Helvetica').fillColor('#555');
    if (vendor.legalName && vendor.legalName !== vendor.tradingName) doc.text(vendor.legalName);
    if (vendor.addressLine1) doc.text(vendor.addressLine1);
    if (vendor.addressLine2) doc.text(vendor.addressLine2);
    const cityCountry = [vendor.city, vendor.country].filter(Boolean).join(', ');
    if (cityCountry) doc.text(cityCountry);
    if (vendor.taxId) doc.text(`Tax ID: ${vendor.taxId}`);
    if (vendor.email) doc.text(vendor.email);
    if (vendor.phone) doc.text(vendor.phone);
    doc.fillColor('black');

    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('INVOICE', 380, top, { width: 175, align: 'right' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#555')
      .text(`# ${inv.invoiceNumber}`, 380, top + 24, { width: 175, align: 'right' })
      .text(`Status: ${inv.status.toUpperCase()}`, 380, top + 38, { width: 175, align: 'right' })
      .text(`Issued: ${fmtD(inv.issuedAt)}`, 380, top + 52, { width: 175, align: 'right' })
      .text(`Due: ${fmtD(inv.dueAt)}`, 380, top + 66, { width: 175, align: 'right' });
    if (inv.paidAt)
      doc.text(`Paid: ${fmtD(inv.paidAt)}`, 380, top + 80, { width: 175, align: 'right' });
    doc.fillColor('black');

    doc.y = Math.max(doc.y, top + 110);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#ccc').stroke().strokeColor('black');
    doc.moveDown(0.6);

    // Bill-to + Subscription
    const blockTop = doc.y;
    doc.fontSize(8).fillColor('#64748b').font('Helvetica-Bold').text('BILL TO', 40, blockTop);
    doc
      .fontSize(10)
      .fillColor('black')
      .font('Helvetica-Bold')
      .text(tenant?.name || inv.tenantId, 40, blockTop + 12);
    doc.font('Helvetica').fontSize(9).fillColor('#555');
    if (tenant?.slug) doc.text(tenant.slug, 40);
    if (sub?.billingName) doc.text(sub.billingName, 40);
    if (sub?.billingEmail) doc.text(sub.billingEmail, 40);

    doc.fontSize(8).fillColor('#64748b').font('Helvetica-Bold').text('SUBSCRIPTION', 320, blockTop);
    doc
      .fontSize(10)
      .fillColor('black')
      .font('Helvetica')
      .text(`${plan?.name || '—'} (${sub?.billingInterval || ''})`, 320, blockTop + 12);
    if (inv.periodStart || inv.periodEnd) {
      doc
        .fontSize(9)
        .fillColor('#555')
        .text(`Period: ${fmtD(inv.periodStart)} → ${fmtD(inv.periodEnd)}`, 320);
    }
    doc.fillColor('black');

    doc.y = Math.max(doc.y, blockTop + 70);
    doc.moveDown(0.6);

    // Line items
    const tableTop = doc.y;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569');
    doc.text('Description', 40, tableTop, { width: 280 });
    doc.text('Qty', 320, tableTop, { width: 50, align: 'right' });
    doc.text('Unit price', 380, tableTop, { width: 80, align: 'right' });
    doc.text('Amount', 470, tableTop, { width: 85, align: 'right' });
    doc.fillColor('black').font('Helvetica');
    let y = tableTop + 16;
    doc
      .moveTo(40, y - 4)
      .lineTo(555, y - 4)
      .strokeColor('#e2e8f0')
      .stroke()
      .strokeColor('black');
    for (const ln of lines) {
      const desc = ln.description || '';
      doc.text(desc, 40, y, { width: 280 });
      doc.text(String(ln.quantity || 0), 320, y, { width: 50, align: 'right' });
      doc.text(fmt(ln.unitPriceMinor || 0), 380, y, { width: 80, align: 'right' });
      doc.text(fmt(ln.amountMinor || 0), 470, y, { width: 85, align: 'right' });
      y += 18;
      if (y > 740) {
        doc.addPage();
        y = 40;
      }
    }
    doc.moveTo(40, y).lineTo(555, y).strokeColor('#cbd5e1').stroke().strokeColor('black');
    y += 8;

    // Totals
    const totals: Array<[string, number]> = [
      ['Subtotal', inv.subtotalMinor],
      ['Discount', -(inv.discountMinor || 0)],
      ['Tax', inv.taxMinor || 0],
    ];
    for (const [lbl, val] of totals) {
      doc.fontSize(10).font('Helvetica').text(lbl, 380, y, { width: 80, align: 'right' });
      doc.text(fmt(val), 470, y, { width: 85, align: 'right' });
      y += 16;
    }
    doc
      .moveTo(380, y)
      .lineTo(555, y)
      .strokeColor('#0f172a')
      .lineWidth(1.2)
      .stroke()
      .lineWidth(1)
      .strokeColor('black');
    y += 6;
    doc.fontSize(12).font('Helvetica-Bold').text('Total', 380, y, { width: 80, align: 'right' });
    doc.text(fmt(inv.totalMinor), 470, y, { width: 85, align: 'right' });
    y += 18;
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#065f46')
      .text('Paid', 380, y, { width: 80, align: 'right' });
    doc.text(fmt(inv.amountPaidMinor || 0), 470, y, { width: 85, align: 'right' });
    y += 16;
    const balance = Math.max(0, inv.totalMinor - (inv.amountPaidMinor || 0));
    doc
      .fillColor(balance > 0 ? '#b91c1c' : '#0f172a')
      .font('Helvetica-Bold')
      .text('Balance due', 380, y, { width: 80, align: 'right' });
    doc.text(fmt(balance), 470, y, { width: 85, align: 'right' });
    doc.fillColor('black').font('Helvetica');
    y += 24;

    // Payments
    if (paidRows.length) {
      if (y > 700) {
        doc.addPage();
        y = 40;
      }
      doc.fontSize(10).font('Helvetica-Bold').text('Payments', 40, y);
      y += 14;
      doc.fontSize(9).font('Helvetica').fillColor('#475569');
      for (const p of paidRows) {
        doc.text(
          `${fmtD(p.paidAt)}  •  ${p.gateway}${p.method ? ' / ' + p.method : ''}  •  ${fmt(p.amountMinor)}${p.gatewayRef ? '  ref ' + p.gatewayRef : ''}`,
          40,
          y,
        );
        y += 14;
        if (y > 760) {
          doc.addPage();
          y = 40;
        }
      }
      doc.fillColor('black');
    }

    // Footer
    if (vendor.invoiceFooter) {
      doc
        .fontSize(8)
        .fillColor('#64748b')
        .text(vendor.invoiceFooter, 40, 770, { width: 515, align: 'center' });
    }

    doc.end();
    return done;
  }

  // ============================================================
  // TENANT STATEMENTS (multi-currency, FX-aware)
  // ============================================================
  async buildMyStatement(tenantId: string, opts: { from?: string; to?: string } = {}) {
    const tenant = await this.tenants.findOne({
      where: { id: tenantId },
      select: ['id', 'name', 'slug'],
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const vendor = await this.getVendorBilling();
    const baseCcy = (vendor.defaultCurrency || 'UGX').toUpperCase();

    // Date window: default last 12 full months.
    const to = opts.to ? new Date(opts.to) : new Date();
    const from = opts.from
      ? new Date(opts.from)
      : new Date(to.getFullYear() - 1, to.getMonth(), to.getDate());
    if (isNaN(+from) || isNaN(+to)) throw new BadRequestException('Invalid date range');

    const invoices = await this.invoices.find({
      where: { tenantId, issuedAt: Between(from, to) },
      order: { issuedAt: 'ASC' },
    });
    const payments = await this.payments.find({
      where: { tenantId, paidAt: Between(from, to) },
      order: { paidAt: 'ASC' },
    });

    const openingInvoices = await this.invoices.find({
      where: { tenantId, issuedAt: LessThan(from) },
    });
    const openingPayments = await this.payments.find({
      where: { tenantId, paidAt: LessThan(from) },
    });

    const sumInBase = (
      rows: Array<{
        totalMinor?: number;
        amountMinor?: number;
        currency: string;
        fxRateToBase: any;
      }>,
      kind: 'invoice' | 'payment',
    ) => {
      let total = 0;
      for (const r of rows) {
        const minor = kind === 'invoice' ? r.totalMinor || 0 : r.amountMinor || 0;
        const rate = Number(r.fxRateToBase || 1) || 1;
        total += Math.round(minor * rate);
      }
      return total;
    };

    const openingBalanceBase =
      sumInBase(openingInvoices, 'invoice') - sumInBase(openingPayments, 'payment');

    // Per-currency breakdown for the period.
    const byCcy = new Map<
      string,
      { currency: string; invoiced: number; paid: number; outstanding: number }
    >();
    const bumpC = (ccy: string, key: 'invoiced' | 'paid', minor: number) => {
      const k = (ccy || baseCcy).toUpperCase();
      const cur = byCcy.get(k) || { currency: k, invoiced: 0, paid: 0, outstanding: 0 };
      cur[key] += minor;
      byCcy.set(k, cur);
    };
    for (const inv of invoices) {
      bumpC(inv.currency, 'invoiced', inv.totalMinor || 0);
      bumpC(inv.currency, 'paid', inv.amountPaidMinor || 0);
    }
    for (const c of byCcy.values()) c.outstanding = c.invoiced - c.paid;

    // Build a chronological ledger with running base-currency balance.
    type Row = {
      date: Date;
      type: 'invoice' | 'payment';
      ref: string;
      description: string;
      currency: string;
      amountMinor: number;
      fxRate: number;
      baseMinor: number;
      signedBaseMinor: number;
      runningBalanceBase: number;
    };
    const ledger: Row[] = [];
    let running = openingBalanceBase;
    const events: Array<{ date: Date; row: Omit<Row, 'runningBalanceBase'> }> = [];
    for (const inv of invoices) {
      const rate = Number(inv.fxRateToBase || 1) || 1;
      const baseMinor = Math.round((inv.totalMinor || 0) * rate);
      events.push({
        date: inv.issuedAt,
        row: {
          date: inv.issuedAt,
          type: 'invoice',
          ref: inv.invoiceNumber,
          description: `Invoice ${inv.invoiceNumber}`,
          currency: inv.currency,
          amountMinor: inv.totalMinor || 0,
          fxRate: rate,
          baseMinor,
          signedBaseMinor: baseMinor,
        },
      });
    }
    for (const p of payments) {
      const rate = Number(p.fxRateToBase || 1) || 1;
      const baseMinor = Math.round((p.amountMinor || 0) * rate);
      const signed = (p.status === 'refunded' ? +1 : -1) * baseMinor;
      events.push({
        date: p.paidAt,
        row: {
          date: p.paidAt,
          type: 'payment',
          ref: p.gatewayRef || p.id.slice(0, 8),
          description: `Payment ${p.gateway}${p.method ? ` (${p.method})` : ''}${p.status === 'refunded' ? ' — REFUND' : ''}`,
          currency: p.currency,
          amountMinor: p.amountMinor || 0,
          fxRate: rate,
          baseMinor,
          signedBaseMinor: signed,
        },
      });
    }
    events.sort((a, b) => +a.date - +b.date);
    for (const e of events) {
      running += e.row.signedBaseMinor;
      ledger.push({ ...e.row, runningBalanceBase: running });
    }

    const totals = {
      invoicedBase: sumInBase(invoices, 'invoice'),
      paidBase: ledger
        .filter((r) => r.type === 'payment' && r.signedBaseMinor < 0)
        .reduce((s, r) => s + Math.abs(r.signedBaseMinor), 0),
      refundedBase: ledger
        .filter((r) => r.type === 'payment' && r.signedBaseMinor > 0)
        .reduce((s, r) => s + r.signedBaseMinor, 0),
      openingBalanceBase,
      closingBalanceBase: running,
    };

    return {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      vendor,
      period: { from: from.toISOString(), to: to.toISOString() },
      baseCurrency: baseCcy,
      byCurrency: Array.from(byCcy.values()).sort((a, b) => a.currency.localeCompare(b.currency)),
      ledger,
      totals,
    };
  }

  async renderMyStatementCsv(
    tenantId: string,
    opts: { from?: string; to?: string } = {},
  ): Promise<string> {
    const s = await this.buildMyStatement(tenantId, opts);
    const esc = (v: any) => {
      if (v === null || v === undefined) return '';
      const str = String(v);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines: string[] = [];
    lines.push(`# Statement for ${s.tenant.name}`);
    lines.push(`# Period: ${s.period.from.slice(0, 10)} to ${s.period.to.slice(0, 10)}`);
    lines.push(`# Base currency: ${s.baseCurrency}`);
    lines.push(
      `# Opening balance (${s.baseCurrency}): ${(s.totals.openingBalanceBase / 100).toFixed(2)}`,
    );
    lines.push('');
    lines.push(
      [
        'Date',
        'Type',
        'Ref',
        'Description',
        'Currency',
        'Amount',
        'FX rate to base',
        `Base amount (${s.baseCurrency})`,
        `Signed base`,
        `Running balance (${s.baseCurrency})`,
      ]
        .map(esc)
        .join(','),
    );
    for (const r of s.ledger) {
      lines.push(
        [
          new Date(r.date).toISOString().slice(0, 10),
          r.type,
          r.ref,
          r.description,
          r.currency,
          (r.amountMinor / 100).toFixed(2),
          r.fxRate.toString(),
          (r.baseMinor / 100).toFixed(2),
          (r.signedBaseMinor / 100).toFixed(2),
          (r.runningBalanceBase / 100).toFixed(2),
        ]
          .map(esc)
          .join(','),
      );
    }
    lines.push('');
    lines.push(
      `# Closing balance (${s.baseCurrency}): ${(s.totals.closingBalanceBase / 100).toFixed(2)}`,
    );
    lines.push('');
    lines.push('# Per-currency breakdown');
    lines.push(['Currency', 'Invoiced', 'Paid', 'Outstanding'].map(esc).join(','));
    for (const c of s.byCurrency) {
      lines.push(
        [
          c.currency,
          (c.invoiced / 100).toFixed(2),
          (c.paid / 100).toFixed(2),
          (c.outstanding / 100).toFixed(2),
        ]
          .map(esc)
          .join(','),
      );
    }
    return lines.join('\n') + '\n';
  }

  async renderMyStatementPdf(
    tenantId: string,
    opts: { from?: string; to?: string } = {},
  ): Promise<Buffer> {
    const s = await this.buildMyStatement(tenantId, opts);
    const PDFDocumentMod = await import('pdfkit');
    const PDFDocument = PDFDocumentMod.default || PDFDocumentMod;
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done: Promise<Buffer> = new Promise((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    const fmtBase = (n: number) => this.fmtMoney(n, s.baseCurrency);
    const fmtCcy = (n: number, c: string) => this.fmtMoney(n, c);
    const fmtD = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

    // Header
    const top = doc.y;
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(s.vendor.tradingName || s.vendor.legalName || 'Statement', 40, top);
    doc.fontSize(9).font('Helvetica').fillColor('#555');
    if (s.vendor.legalName && s.vendor.legalName !== s.vendor.tradingName)
      doc.text(s.vendor.legalName);
    if (s.vendor.addressLine1) doc.text(s.vendor.addressLine1);
    if (s.vendor.email) doc.text(s.vendor.email);
    doc.fillColor('black');

    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('STATEMENT', 380, top, { width: 175, align: 'right' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#555')
      .text(`${fmtD(s.period.from)} → ${fmtD(s.period.to)}`, 380, top + 24, {
        width: 175,
        align: 'right',
      })
      .text(`Base: ${s.baseCurrency}`, 380, top + 38, { width: 175, align: 'right' });
    doc.fillColor('black');

    doc.y = Math.max(doc.y, top + 90);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#ccc').stroke().strokeColor('black');
    doc.moveDown(0.6);

    // Bill-to
    doc.fontSize(8).fillColor('#64748b').font('Helvetica-Bold').text('BILL TO', 40, doc.y);
    doc
      .fontSize(11)
      .fillColor('black')
      .font('Helvetica-Bold')
      .text(s.tenant.name, 40, doc.y + 2);
    if (s.tenant.slug) doc.fontSize(9).font('Helvetica').fillColor('#555').text(s.tenant.slug, 40);
    doc.fillColor('black').moveDown(0.6);

    // Summary box
    const boxY = doc.y;
    doc.rect(40, boxY, 515, 56).fill('#f8fafc').stroke('#e2e8f0');
    doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold');
    doc.text('OPENING', 50, boxY + 8);
    doc.text('INVOICED', 180, boxY + 8);
    doc.text('PAID', 310, boxY + 8);
    doc.text('REFUNDED', 380, boxY + 8);
    doc.text('CLOSING', 470, boxY + 8);
    doc.fillColor('black').fontSize(11).font('Helvetica-Bold');
    doc.text(fmtBase(s.totals.openingBalanceBase), 50, boxY + 24, { width: 120 });
    doc.text(fmtBase(s.totals.invoicedBase), 180, boxY + 24, { width: 120 });
    doc.text(fmtBase(s.totals.paidBase), 310, boxY + 24, { width: 60 });
    doc.text(fmtBase(s.totals.refundedBase), 380, boxY + 24, { width: 80 });
    const closingColor = s.totals.closingBalanceBase > 0 ? '#b91c1c' : '#15803d';
    doc
      .fillColor(closingColor)
      .text(fmtBase(s.totals.closingBalanceBase), 470, boxY + 24, { width: 80 });
    doc.fillColor('black');
    doc.y = boxY + 64;
    doc.moveDown(0.4);

    // Per-currency breakdown
    if (s.byCurrency.length > 1) {
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#475569')
        .text('Per-currency breakdown', 40);
      doc.moveDown(0.2);
      const ch = doc.y;
      doc.fontSize(8).fillColor('#64748b');
      doc.text('Currency', 40, ch);
      doc.text('Invoiced', 140, ch, { width: 120, align: 'right' });
      doc.text('Paid', 270, ch, { width: 120, align: 'right' });
      doc.text('Outstanding', 400, ch, { width: 150, align: 'right' });
      let cy = ch + 12;
      doc.fillColor('black').font('Helvetica');
      for (const c of s.byCurrency) {
        doc.text(c.currency, 40, cy);
        doc.text(fmtCcy(c.invoiced, c.currency), 140, cy, { width: 120, align: 'right' });
        doc.text(fmtCcy(c.paid, c.currency), 270, cy, { width: 120, align: 'right' });
        doc.text(fmtCcy(c.outstanding, c.currency), 400, cy, { width: 150, align: 'right' });
        cy += 14;
      }
      doc.y = cy + 4;
    }

    // Ledger
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569').text('Ledger', 40);
    doc.moveDown(0.2);
    let y = doc.y;
    doc.fontSize(8).fillColor('#64748b');
    doc.text('Date', 40, y);
    doc.text('Type', 90, y);
    doc.text('Ref', 130, y);
    doc.text('Amount', 230, y, { width: 100, align: 'right' });
    doc.text(`Base (${s.baseCurrency})`, 340, y, { width: 90, align: 'right' });
    doc.text('Balance', 440, y, { width: 110, align: 'right' });
    y += 12;
    doc
      .moveTo(40, y - 2)
      .lineTo(555, y - 2)
      .strokeColor('#e2e8f0')
      .stroke()
      .strokeColor('black');
    doc.fillColor('black').font('Helvetica');
    for (const r of s.ledger) {
      if (y > 760) {
        doc.addPage();
        y = 40;
      }
      doc.text(fmtD(r.date), 40, y);
      doc.text(r.type, 90, y);
      doc.text(r.ref, 130, y, { width: 100 });
      doc.text(fmtCcy(r.amountMinor, r.currency), 230, y, { width: 100, align: 'right' });
      const signDisp =
        r.signedBaseMinor < 0
          ? `-${fmtBase(Math.abs(r.signedBaseMinor))}`
          : fmtBase(r.signedBaseMinor);
      doc
        .fillColor(r.signedBaseMinor < 0 ? '#15803d' : '#b91c1c')
        .text(signDisp, 340, y, { width: 90, align: 'right' });
      doc
        .fillColor('black')
        .text(fmtBase(r.runningBalanceBase), 440, y, { width: 110, align: 'right' });
      y += 14;
    }
    if (s.ledger.length === 0) {
      doc.fontSize(9).fillColor('#64748b').text('No activity in this period.', 40, y);
    }

    doc.end();
    return done;
  }

  async listMyPaymentMethods(tenantId: string) {
    return this.paymentMethods.find({
      where: { tenantId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async addMyPaymentMethod(
    tenantId: string,
    dto: {
      kind?: SaasPaymentMethodKind;
      label?: string;
      brand?: string;
      last4?: string;
      expMonth?: number;
      expYear?: number;
      holderName?: string;
      isDefault?: boolean;
    },
  ) {
    const kind = (dto.kind || 'card') as SaasPaymentMethodKind;
    const label =
      (dto.label || '').trim() ||
      `${kind === 'card' ? 'Card' : kind === 'mobile_money' ? 'Mobile money' : kind === 'bank' ? 'Bank' : 'Method'}${dto.last4 ? ' •••• ' + dto.last4 : ''}`;
    const last4 = dto.last4 ? String(dto.last4).replace(/\D/g, '').slice(-4) : null;
    const pm = this.paymentMethods.create({
      tenantId,
      kind,
      label,
      brand: dto.brand?.trim() || null,
      last4,
      expMonth: dto.expMonth ? Math.max(1, Math.min(12, dto.expMonth)) : null,
      expYear: dto.expYear ? dto.expYear : null,
      holderName: dto.holderName?.trim() || null,
      isDefault: !!dto.isDefault,
      metadata: null,
    });
    const saved = await this.paymentMethods.save(pm);
    if (saved.isDefault) await this.setDefaultPaymentMethod(tenantId, saved.id);
    else {
      const existing = await this.paymentMethods.count({ where: { tenantId } });
      if (existing === 1) {
        saved.isDefault = true;
        await this.paymentMethods.save(saved);
      }
    }
    return saved;
  }

  async setDefaultPaymentMethod(tenantId: string, id: string) {
    const pm = await this.paymentMethods.findOne({ where: { id, tenantId } });
    if (!pm) throw new NotFoundException('Payment method not found');
    await this.paymentMethods.update({ tenantId }, { isDefault: false });
    pm.isDefault = true;
    await this.paymentMethods.save(pm);
    return pm;
  }

  async deleteMyPaymentMethod(tenantId: string, id: string) {
    const pm = await this.paymentMethods.findOne({ where: { id, tenantId } });
    if (!pm) throw new NotFoundException('Payment method not found');
    const wasDefault = pm.isDefault;
    await this.paymentMethods.delete({ id, tenantId });
    if (wasDefault) {
      const next = await this.paymentMethods.findOne({
        where: { tenantId },
        order: { createdAt: 'DESC' },
      });
      if (next) {
        next.isDefault = true;
        await this.paymentMethods.save(next);
      }
    }
    return { ok: true };
  }

  // ============================================================
  // TENANT-SIDE WEBHOOKS
  // ============================================================
  webhookEventTypes(): string[] {
    return [...WEBHOOK_EVENT_TYPES];
  }

  async listMyWebhookEndpoints(tenantId: string) {
    const rows = await this.webhookEndpoints.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => ({ ...r, secret: this.maskSecret(r.secret) }));
  }

  async createMyWebhookEndpoint(
    tenantId: string,
    dto: { url: string; events?: string[]; description?: string },
  ) {
    if (!dto.url || !/^https?:\/\//i.test(dto.url))
      throw new BadRequestException('A valid http(s) URL is required');
    const events = (dto.events || []).filter(
      (e) => e === '*' || (WEBHOOK_EVENT_TYPES as readonly string[]).includes(e),
    );
    if (!events.length) events.push('*');
    const secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;
    const ep = this.webhookEndpoints.create({
      tenantId,
      url: dto.url.trim(),
      secret,
      events,
      description: dto.description?.trim() || null,
      enabled: true,
      consecutiveFailures: 0,
    });
    const saved = await this.webhookEndpoints.save(ep);
    // Return the secret ONCE in cleartext so the tenant can copy it.
    return { ...saved, secret, secretRevealed: true };
  }

  async updateMyWebhookEndpoint(
    tenantId: string,
    id: string,
    dto: { url?: string; events?: string[]; description?: string | null; enabled?: boolean },
  ) {
    const ep = await this.webhookEndpoints.findOne({ where: { id, tenantId } });
    if (!ep) throw new NotFoundException('Endpoint not found');
    if (dto.url !== undefined) {
      if (!/^https?:\/\//i.test(dto.url))
        throw new BadRequestException('A valid http(s) URL is required');
      ep.url = dto.url.trim();
    }
    if (dto.events !== undefined) {
      const events = dto.events.filter(
        (e) => e === '*' || (WEBHOOK_EVENT_TYPES as readonly string[]).includes(e),
      );
      ep.events = events.length ? events : ['*'];
    }
    if (dto.description !== undefined) ep.description = dto.description?.toString().trim() || null;
    if (dto.enabled !== undefined) {
      ep.enabled = !!dto.enabled;
      if (ep.enabled) {
        ep.consecutiveFailures = 0;
        ep.disabledAt = null;
      } else if (!ep.disabledAt) ep.disabledAt = new Date();
    }
    await this.webhookEndpoints.save(ep);
    return { ...ep, secret: this.maskSecret(ep.secret) };
  }

  async deleteMyWebhookEndpoint(tenantId: string, id: string) {
    const ep = await this.webhookEndpoints.findOne({ where: { id, tenantId } });
    if (!ep) throw new NotFoundException('Endpoint not found');
    await this.webhookEndpoints.remove(ep);
    return { ok: true };
  }

  async rotateMyWebhookSecret(tenantId: string, id: string) {
    const ep = await this.webhookEndpoints.findOne({ where: { id, tenantId } });
    if (!ep) throw new NotFoundException('Endpoint not found');
    const secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;
    ep.secret = secret;
    await this.webhookEndpoints.save(ep);
    return { ...ep, secret, secretRevealed: true };
  }

  async testMyWebhookEndpoint(tenantId: string, id: string) {
    const ep = await this.webhookEndpoints.findOne({ where: { id, tenantId } });
    if (!ep) throw new NotFoundException('Endpoint not found');
    return this.webhooks.sendTestPing(ep);
  }

  async listMyWebhookDeliveries(
    tenantId: string,
    opts: { endpointId?: string; status?: string; limit?: number } = {},
  ) {
    const where: any = { tenantId };
    if (opts.endpointId) where.endpointId = opts.endpointId;
    if (opts.status) where.status = opts.status;
    const rows = await this.webhookDeliveries.find({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(opts.limit || 50, 1), 200),
    });
    return rows;
  }

  async retryMyWebhookDelivery(tenantId: string, id: string) {
    const d = await this.webhookDeliveries.findOne({ where: { id, tenantId } });
    if (!d) throw new NotFoundException();
    if (d.status === 'succeeded') return { ok: true, alreadySucceeded: true };
    d.status = 'pending';
    d.nextAttemptAt = new Date();
    await this.webhookDeliveries.save(d);
    setImmediate(() => this.webhooks.flush().catch(() => {}));
    return { ok: true };
  }

  private maskSecret(s: string): string {
    if (!s) return '';
    if (s.length <= 12) return '***';
    return `${s.slice(0, 8)}…${s.slice(-4)}`;
  }
}
