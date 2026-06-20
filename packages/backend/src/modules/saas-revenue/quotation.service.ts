import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, LessThan, Repository, In } from 'typeorm';
import {
  SaasPriceCatalogItem,
  SaasQuotation,
  SaasQuotationRevision,
  QuotationLineItem,
  QuotationStatus,
} from './quotation.entity';
import { SaasSubscription, SaasPlan } from './saas.entity';
import { Lead } from '../leads/lead.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { License } from '../../database/entities/license.entity';
import { SaasRevenueService, VendorBillingSettings } from './saas-revenue.service';
import { SaasMailerService } from './saas-mailer.service';
import {
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
  CreateQuotationDto,
  UpdateQuotationDto,
  CreateRevisionDto,
  LineItemDto,
} from './quotation.dtos';

@Injectable()
export class QuotationService {
  private readonly logger = new Logger(QuotationService.name);

  constructor(
    @InjectRepository(SaasPriceCatalogItem) private readonly catalog: Repository<SaasPriceCatalogItem>,
    @InjectRepository(SaasQuotation) private readonly quotations: Repository<SaasQuotation>,
    @InjectRepository(SaasQuotationRevision) private readonly revisions: Repository<SaasQuotationRevision>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(SaasPlan) private readonly plans: Repository<SaasPlan>,
    @InjectRepository(SaasSubscription) private readonly subs: Repository<SaasSubscription>,
    @InjectRepository(License) private readonly licenses: Repository<License>,
    private readonly saasRevenue: SaasRevenueService,
    private readonly mailer: SaasMailerService,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  // ==========================================================================
  // Price Catalog CRUD
  // ==========================================================================

  async listCatalogItems() {
    return this.catalog.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async createCatalogItem(dto: CreateCatalogItemDto): Promise<SaasPriceCatalogItem> {
    const item = this.catalog.create({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      category: (dto.category as any) ?? 'module',
      unitPriceMinor: dto.unitPriceMinor,
      currency: dto.currency ?? 'UGX',
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      metadata: dto.metadata ?? null,
    });
    return this.catalog.save(item);
  }

  async updateCatalogItem(id: string, dto: UpdateCatalogItemDto): Promise<SaasPriceCatalogItem> {
    const item = await this.catalog.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Catalog item not found');
    Object.assign(item, dto);
    return this.catalog.save(item);
  }

  async deleteCatalogItem(id: string) {
    const item = await this.catalog.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Catalog item not found');
    await this.catalog.remove(item);
    return { deleted: true };
  }

  // ==========================================================================
  // Quotation CRUD
  // ==========================================================================

  async createQuotation(dto: CreateQuotationDto, createdBy?: string): Promise<SaasQuotation> {
    const quotationNumber = await this.nextQuotationNumber();
    const now = new Date();
    const validUntil = dto.validUntil ? new Date(dto.validUntil) : new Date(now.getTime() + 30 * 86400000);

    const quotation = this.quotations.create({
      quotationNumber,
      leadId: dto.leadId ?? null,
      planId: dto.planId ?? null,
      clientName: dto.clientName,
      clientOrganization: dto.clientOrganization ?? null,
      clientEmail: dto.clientEmail ?? null,
      clientPhone: dto.clientPhone ?? null,
      clientCountry: dto.clientCountry ?? null,
      currency: dto.currency ?? 'UGX',
      fxRateToBase: '1',
      billingInterval: dto.billingInterval ?? 'monthly',
      seats: dto.seats ?? 1,
      includeVat: dto.includeVat ?? true,
      vatRatePercent: String(dto.vatRatePercent ?? 18),
      deductWht: dto.deductWht ?? false,
      whtRatePercent: String(dto.whtRatePercent ?? 6),
      discountPercent: String(dto.discountPercent ?? 0),
      discountFixedMinor: dto.discountFixedMinor ?? 0,
      issueDate: now,
      validUntil,
      status: 'draft' as QuotationStatus,
      currentRevisionNumber: 1,
      createdBy: createdBy ?? null,
    });

    const saved = await this.quotations.save(quotation);

    // Create revision 1
    const lineItems = this.mapLineItems(dto.lineItems);
    const totals = this.computeTotals(lineItems, saved);
    const rev = this.revisions.create({
      quotationId: saved.id,
      revisionNumber: 1,
      lineItems,
      ...totals,
      createdBy: createdBy ?? null,
    });
    await this.revisions.save(rev);

    this.events.emit('quotation.created', { quotationId: saved.id, leadId: saved.leadId });
    return this.getQuotation(saved.id);
  }

  async getQuotation(id: string): Promise<SaasQuotation> {
    const q = await this.quotations.findOne({
      where: { id },
      relations: ['revisions'],
    });
    if (!q) throw new NotFoundException('Quotation not found');
    return q;
  }

  async listQuotations(filters: { status?: string; leadId?: string; subscriptionIds?: string[] } = {}) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.leadId) where.leadId = filters.leadId;
    if (filters.subscriptionIds) {
      where.subscriptionId = In(filters.subscriptionIds);
    }
    const [items, total] = await this.quotations.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return { items, total };
  }

  async listQuotationsForTenant(tenantId: string) {
    const activeSubs = await this.subs.find({ where: { tenantId } });
    const subscriptionIds = activeSubs.map((s) => s.id);
    if (subscriptionIds.length === 0) {
      return { items: [], total: 0 };
    }
    return this.listQuotations({ subscriptionIds });
  }

  async updateQuotation(id: string, dto: UpdateQuotationDto, actorId?: string): Promise<SaasQuotation> {
    const q = await this.getQuotation(id);
    if (q.status !== 'draft') throw new BadRequestException('Can only update draft quotations');

    // Update quotation-level fields
    if (dto.leadId !== undefined) q.leadId = dto.leadId ?? null;
    if (dto.planId !== undefined) q.planId = dto.planId ?? null;
    if (dto.clientName !== undefined) q.clientName = dto.clientName;
    if (dto.clientOrganization !== undefined) q.clientOrganization = dto.clientOrganization ?? null;
    if (dto.clientEmail !== undefined) q.clientEmail = dto.clientEmail ?? null;
    if (dto.clientPhone !== undefined) q.clientPhone = dto.clientPhone ?? null;
    if (dto.clientCountry !== undefined) q.clientCountry = dto.clientCountry ?? null;
    if (dto.currency !== undefined) q.currency = dto.currency;
    if (dto.billingInterval !== undefined) q.billingInterval = dto.billingInterval;
    if (dto.seats !== undefined) q.seats = dto.seats;
    if (dto.includeVat !== undefined) q.includeVat = dto.includeVat;
    if (dto.vatRatePercent !== undefined) q.vatRatePercent = String(dto.vatRatePercent);
    if (dto.deductWht !== undefined) q.deductWht = dto.deductWht;
    if (dto.whtRatePercent !== undefined) q.whtRatePercent = String(dto.whtRatePercent);
    if (dto.discountPercent !== undefined) q.discountPercent = String(dto.discountPercent);
    if (dto.discountFixedMinor !== undefined) q.discountFixedMinor = dto.discountFixedMinor;
    if (dto.validUntil !== undefined) q.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (dto.notes !== undefined) q.notes = dto.notes ?? null;
    if (dto.internalNotes !== undefined) q.internalNotes = dto.internalNotes ?? null;

    await this.quotations.save(q);

    // If lineItems provided, update the current revision
    if (dto.lineItems) {
      const lineItems = this.mapLineItems(dto.lineItems);
      const totals = this.computeTotals(lineItems, q);
      const rev = await this.revisions.findOne({
        where: { quotationId: q.id, revisionNumber: q.currentRevisionNumber },
      });
      if (rev) {
        rev.lineItems = lineItems;
        Object.assign(rev, totals);
        rev.createdBy = actorId ?? rev.createdBy;
        await this.revisions.save(rev);
      }
    }

    return this.getQuotation(id);
  }

  async deleteQuotation(id: string) {
    const q = await this.getQuotation(id);
    if (q.status !== 'draft') throw new BadRequestException('Can only delete draft quotations');
    await this.revisions.delete({ quotationId: id });
    await this.quotations.remove(q);
    return { deleted: true };
  }

  // ==========================================================================
  // Create from Lead
  // ==========================================================================

  async createQuotationFromLead(leadId: string, createdBy?: string): Promise<SaasQuotation> {
    const lead = await this.leads.findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    return this.createQuotation(
      {
        leadId: lead.id,
        clientName: lead.fullName,
        clientOrganization: lead.organization,
        clientEmail: lead.email,
        clientPhone: lead.phone ?? undefined,
        clientCountry: lead.country ?? undefined,
        lineItems: [],
      },
      createdBy,
    );
  }

  // ==========================================================================
  // Revisions
  // ==========================================================================

  async createRevision(quotationId: string, dto: CreateRevisionDto, createdBy?: string): Promise<SaasQuotationRevision> {
    const q = await this.getQuotation(quotationId);
    if (q.status !== 'draft' && q.status !== 'sent') {
      throw new BadRequestException('Cannot create revision for quotation in status: ' + q.status);
    }

    const newRevNum = q.currentRevisionNumber + 1;
    const lineItems = this.mapLineItems(dto.lineItems);
    const totals = this.computeTotals(lineItems, q);

    const rev = this.revisions.create({
      quotationId: q.id,
      revisionNumber: newRevNum,
      lineItems,
      ...totals,
      changeNotes: dto.changeNotes ?? null,
      createdBy: createdBy ?? null,
    });
    await this.revisions.save(rev);

    q.currentRevisionNumber = newRevNum;
    if (q.status === 'sent') q.status = 'draft';
    await this.quotations.save(q);

    this.events.emit('quotation.revised', { quotationId: q.id, revisionNumber: newRevNum });
    return rev;
  }

  async getRevision(quotationId: string, revisionNumber: number): Promise<SaasQuotationRevision> {
    const rev = await this.revisions.findOne({
      where: { quotationId, revisionNumber },
    });
    if (!rev) throw new NotFoundException('Revision not found');
    return rev;
  }

  async listRevisions(quotationId: string): Promise<SaasQuotationRevision[]> {
    return this.revisions.find({
      where: { quotationId },
      order: { revisionNumber: 'DESC' },
    });
  }

  async diffRevisions(quotationId: string, revA: number, revB: number) {
    const [a, b] = await Promise.all([
      this.getRevision(quotationId, revA),
      this.getRevision(quotationId, revB),
    ]);
    return { revA: a, revB: b };
  }

  // ==========================================================================
  // Status Transitions
  // ==========================================================================

  async sendQuotation(id: string): Promise<SaasQuotation> {
    const q = await this.getQuotation(id);
    if (q.status !== 'draft') throw new BadRequestException('Can only send draft quotations');

    q.status = 'sent';
    q.sentAt = new Date();
    await this.quotations.save(q);

    // Send email to client
    if (q.clientEmail) {
      const rev = await this.getRevision(q.id, q.currentRevisionNumber);
      const zeroDecimal = new Set(['UGX','KES','TZS','RWF','JPY','KRW','VND','CLP','PYG']);
      const fmtMoney = (n: number) => `${q.currency} ${(n / (zeroDecimal.has(q.currency) ? 1 : 100)).toLocaleString()}`;
      const subject = `Quotation ${q.quotationNumber} — ${fmtMoney(rev.totalMinor)}`;
      const body = `<p>Dear ${this.esc(q.clientName)},</p>
<p>Please find your quotation below:</p>
<ul>
  <li><b>Quotation #:</b> ${this.esc(q.quotationNumber)}</li>
  <li><b>Total:</b> ${fmtMoney(rev.totalMinor)}</li>
  <li><b>Valid until:</b> ${q.validUntil ? new Date(q.validUntil).toLocaleDateString() : 'N/A'}</li>
</ul>
<p>Thank you for choosing Glide HIMS.</p>`;
      const html = this.wrapEmail('Quotation', body);
      await (this.mailer as any).send(q.clientEmail, subject, html, { templateKey: 'other' });
    }

    this.events.emit('quotation.sent', { quotationId: q.id, clientEmail: q.clientEmail });
    return q;
  }

  async acceptQuotation(id: string): Promise<SaasQuotation> {
    const q = await this.getQuotation(id);
    if (q.status !== 'sent' && q.status !== 'draft') {
      throw new BadRequestException('Can only accept sent or draft quotations');
    }

    const rev = await this.getRevision(q.id, q.currentRevisionNumber);

    // Execute the auto-provision transaction
    return this.dataSource.transaction(async (manager) => {
      // 1. Update quotation status
      q.status = 'accepted';
      q.acceptedAt = new Date();

      // 2. Update lead status → 'won' if linked
      if (q.leadId) {
        await manager.update(Lead, q.leadId, { status: 'won' });
      }

      // 3. Find or create Tenant
      let tenant: Tenant | null = null;
      if (q.clientOrganization) {
        tenant = await manager.findOne(Tenant, {
          where: { name: q.clientOrganization },
        });
      }
      if (!tenant) {
        const slug = (q.clientOrganization || q.clientName)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 50);
        tenant = manager.create(Tenant, {
          name: q.clientOrganization || q.clientName,
          slug: slug + '-' + Date.now().toString(36),
          isActive: true,
        });
        tenant = await manager.save(Tenant, tenant);
      }

      // 4. Find or use default plan
      let plan: SaasPlan | null = null;
      if (q.planId) {
        plan = await manager.findOne(SaasPlan, { where: { id: q.planId } });
      }
      if (!plan) {
        plan = await manager.findOne(SaasPlan, { where: { isActive: true }, order: { sortOrder: 'ASC' } });
      }
      if (!plan) throw new BadRequestException('No SaaS plan available for subscription');

      // 5. Create SaasSubscription
      const now = new Date();
      const interval = (q.billingInterval || 'monthly') as any;
      const periodEnd = new Date(now);
      if (interval === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);
      const sub = manager.create(SaasSubscription, {
        tenantId: tenant.id,
        planId: plan.id,
        status: 'active',
        billingInterval: interval,
        currency: q.currency,
        unitPriceMinor: rev.totalMinor,
        seats: q.seats,
        startDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextRenewalAt: periodEnd,
        autoRenew: true,
        billingEmail: q.clientEmail,
        billingName: q.clientName,
        notes: `Auto-provisioned from quotation ${q.quotationNumber}`,
      });
      const savedSub = await manager.save(SaasSubscription, sub);

      // 6. Align License
      const existingLicense = await manager.findOne(License, { where: { tenantId: tenant.id } });
      if (existingLicense) {
        existingLicense.status = 'active';
        existingLicense.maxUsers = plan.maxUsers ?? existingLicense.maxUsers;
        existingLicense.expiresAt = periodEnd;
        await manager.save(License, existingLicense);
      } else {
        const license = manager.create(License, {
          tenantId: tenant.id,
          licenseType: (plan.tier === 'enterprise' ? 'enterprise' : plan.tier === 'professional' ? 'professional' : 'standard') as any,
          status: 'active',
          maxUsers: plan.maxUsers ?? 50,
          enabledModules: plan.enabledModules ?? [],
          expiresAt: periodEnd,
        });
        await manager.save(License, license);
      }

      // 7. Link back
      q.subscriptionId = savedSub.id;
      await manager.save(SaasQuotation, q);

      return q;
    }).then(async (savedQ) => {
      // After commit: emit events
      this.events.emit('quotation.accepted', {
        quotationId: savedQ.id,
        subscriptionId: savedQ.subscriptionId,
      });
      this.events.emit('subscription.created', { subscriptionId: savedQ.subscriptionId });

      return this.getQuotation(savedQ.id);
    });
  }

  async rejectQuotation(id: string, reason?: string): Promise<SaasQuotation> {
    const q = await this.getQuotation(id);
    if (q.status !== 'sent' && q.status !== 'draft') {
      throw new BadRequestException('Can only reject sent or draft quotations');
    }

    q.status = 'rejected';
    q.rejectedAt = new Date();
    if (reason) q.internalNotes = (q.internalNotes ? q.internalNotes + '\n' : '') + `Rejection reason: ${reason}`;
    await this.quotations.save(q);

    this.events.emit('quotation.rejected', { quotationId: q.id, reason });
    return q;
  }

  async expireQuotation(id: string): Promise<SaasQuotation> {
    const q = await this.getQuotation(id);
    q.status = 'expired';
    await this.quotations.save(q);
    this.events.emit('quotation.expired', { quotationId: q.id });
    return q;
  }

  // ==========================================================================
  // Cron: Expire overdue quotations daily
  // ==========================================================================

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cronExpireOverdueQuotations() {
    const now = new Date();
    const overdue = await this.quotations.find({
      where: {
        status: 'sent' as QuotationStatus,
        validUntil: LessThan(now),
      },
    });
    for (const q of overdue) {
      q.status = 'expired';
      await this.quotations.save(q);
      this.events.emit('quotation.expired', { quotationId: q.id });
      this.logger.log(`Expired quotation ${q.quotationNumber}`);
    }
    if (overdue.length > 0) {
      this.logger.log(`Expired ${overdue.length} overdue quotation(s)`);
    }
  }

  // ==========================================================================
  // Render HTML (print-ready)
  // ==========================================================================

  async renderQuotationHtml(id: string): Promise<string> {
    const q = await this.getQuotation(id);
    const rev = await this.getRevision(q.id, q.currentRevisionNumber);
    let vendor: VendorBillingSettings;
    try { vendor = await this.saasRevenue.getVendorBilling(); }
    catch { vendor = { legalName: 'Glide HIMS' }; }

    const zeroDecimal = new Set(['UGX','KES','TZS','RWF','JPY','KRW','VND','CLP','PYG']);
    const fmt = (n: number) => `${q.currency} ${(n / (zeroDecimal.has(q.currency) ? 1 : 100)).toLocaleString()}`;
    const fmtD = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
    const esc = this.esc;
    const lines = rev.lineItems || [];
    const vendorAddr = [vendor.addressLine1, vendor.addressLine2, [vendor.city, vendor.country].filter(Boolean).join(', ')].filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join('');

    return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<title>Quotation ${esc(q.quotationNumber)}</title>
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
  .b-draft{background:#dbeafe;color:#1e3a8a} .b-sent{background:#fef3c7;color:#92400e} .b-accepted{background:#d1fae5;color:#065f46}
  .b-rejected{background:#fee2e2;color:#991b1b} .b-expired{background:#e5e7eb;color:#374151} .b-superseded{background:#e0e7ff;color:#3730a3}
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
    </div>
    <div class="col" style="text-align:right">
      <h1>QUOTATION</h1>
      <div class="muted"># ${esc(q.quotationNumber)}</div>
      <div class="muted">Revision ${q.currentRevisionNumber}</div>
      <div style="margin-top:8px"><span class="badge b-${esc(q.status)}">${esc(q.status)}</span></div>
      <div class="muted" style="margin-top:12px">Issued: ${fmtD(q.issueDate)}</div>
      <div class="muted">Valid until: ${fmtD(q.validUntil)}</div>
      ${q.sentAt ? `<div class="muted">Sent: ${fmtD(q.sentAt)}</div>` : ''}
      ${q.acceptedAt ? `<div class="muted">Accepted: ${fmtD(q.acceptedAt)}</div>` : ''}
    </div>
  </div>

  <div class="grid">
    <div class="col">
      <h2>Client</h2>
      <div style="font-weight:600">${esc(q.clientName)}</div>
      ${q.clientOrganization ? `<div>${esc(q.clientOrganization)}</div>` : ''}
      ${q.clientEmail ? `<div class="muted">${esc(q.clientEmail)}</div>` : ''}
      ${q.clientPhone ? `<div class="muted">${esc(q.clientPhone)}</div>` : ''}
      ${q.clientCountry ? `<div class="muted">${esc(q.clientCountry)}</div>` : ''}
    </div>
    <div class="col">
      <h2>Terms</h2>
      <div>Billing: ${esc(q.billingInterval)}</div>
      <div>Seats: ${q.seats}</div>
      <div>Currency: ${esc(q.currency)}</div>
    </div>
  </div>

  <table>
    <thead><tr><th>Description</th><th>Category</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Amount</th></tr></thead>
    <tbody>
      ${lines.map((l) => `<tr><td>${esc(l.description)}</td><td>${esc(l.category)}</td><td class="right">${l.quantity}</td><td class="right">${fmt(l.unitPriceMinor)}</td><td class="right">${fmt(l.amountMinor)}</td></tr>`).join('')}
    </tbody>
  </table>

  <table class="totals">
    <tr><td class="right" style="width:80%">Subtotal</td><td class="right">${fmt(rev.subtotalMinor)}</td></tr>
    ${rev.discountMinor > 0 ? `<tr><td class="right">Discount</td><td class="right">-${fmt(rev.discountMinor)}</td></tr>` : ''}
    ${rev.taxMinor > 0 ? `<tr><td class="right">VAT (${esc(q.vatRatePercent)}%)</td><td class="right">${fmt(rev.taxMinor)}</td></tr>` : ''}
    <tr class="grand"><td class="right">Total</td><td class="right">${fmt(rev.totalMinor)}</td></tr>
  </table>

  ${q.notes ? `<div style="margin-top:32px"><h2>Notes</h2><div class="muted">${esc(q.notes)}</div></div>` : ''}

  <div class="footer">
    <p>This quotation is valid until ${fmtD(q.validUntil)}. Prices are in ${esc(q.currency)}.</p>
    ${vendor.invoiceFooter ? `<p>${esc(vendor.invoiceFooter)}</p>` : ''}
    <p>${esc(vendor.legalName)} &middot; ${new Date().getFullYear()}</p>
  </div>
</div>
</body></html>`;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private mapLineItems(dtos: LineItemDto[]): QuotationLineItem[] {
    return (dtos || []).map((d) => ({
      catalogItemId: d.catalogItemId ?? null,
      moduleId: d.moduleId ?? null,
      description: d.description,
      quantity: d.quantity,
      unitPriceMinor: d.unitPriceMinor,
      amountMinor: d.quantity * d.unitPriceMinor,
      category: (d.category as any) ?? 'module',
    }));
  }

  private computeTotals(lineItems: QuotationLineItem[], q: SaasQuotation) {
    const subtotalMinor = lineItems.reduce((sum, l) => sum + l.amountMinor, 0);

    const discountPct = parseFloat(q.discountPercent as any) || 0;
    const discountFixed = q.discountFixedMinor || 0;
    const discountMinor = Math.round(subtotalMinor * discountPct / 100) + discountFixed;

    const afterDiscount = subtotalMinor - discountMinor;

    let taxMinor = 0;
    if (q.includeVat) {
      const vatRate = parseFloat(q.vatRatePercent as any) || 0;
      taxMinor = Math.round(afterDiscount * vatRate / 100);
    }

    let whtMinor = 0;
    if (q.deductWht) {
      const whtRate = parseFloat(q.whtRatePercent as any) || 0;
      whtMinor = Math.round(afterDiscount * whtRate / 100);
    }

    const totalMinor = afterDiscount + taxMinor - whtMinor;

    return { subtotalMinor, discountMinor, taxMinor, totalMinor };
  }

  private async nextQuotationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `QUO-${year}-`;
    const last = await this.quotations
      .createQueryBuilder('q')
      .where('q.quotationNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('q.quotationNumber', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
      const parts = last.quotationNumber.split('-');
      seq = (parseInt(parts[2], 10) || 0) + 1;
    }
    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  private esc(s: any): string {
    return String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
    );
  }

  private wrapEmail(title: string, body: string) {
    return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f5f7fa;padding:20px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 12px;color:#111;">${title}</h2>
        <div style="color:#374151;line-height:1.55;font-size:14px;">${body}</div>
        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
        <div style="font-size:12px;color:#6b7280;">Glide-HIMS Billing · ${new Date().getFullYear()}</div>
      </div></body></html>`;
  }
}
