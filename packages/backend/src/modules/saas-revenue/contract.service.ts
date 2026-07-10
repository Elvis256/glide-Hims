import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LessThan, Repository } from 'typeorm';
import { SaasContract, ContractStatus } from './contract.entity';
import { SaasQuotation, SaasQuotationRevision } from './quotation.entity';
import { SaasRevenueService } from './saas-revenue.service';

interface ContractFromQuotationOpts {
  tenantId?: string;
  autoActivate?: boolean;
}

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    @InjectRepository(SaasContract) private readonly contracts: Repository<SaasContract>,
    @InjectRepository(SaasQuotation) private readonly quotations: Repository<SaasQuotation>,
    @InjectRepository(SaasQuotationRevision)
    private readonly revisions: Repository<SaasQuotationRevision>,
    private readonly saasRevenue: SaasRevenueService,
    private readonly events: EventEmitter2,
  ) {}

  async listContracts(filters: { status?: string } = {}) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    const [items, total] = await this.contracts.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return { items, total };
  }

  async getContract(id: string): Promise<SaasContract> {
    const c = await this.contracts.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Contract not found');
    return c;
  }

  async createContract(dto: Partial<SaasContract>, createdBy?: string): Promise<SaasContract> {
    const contractNumber = await this.nextContractNumber();
    const contract = this.contracts.create({
      ...dto,
      contractNumber,
      status: 'draft' as ContractStatus,
      createdBy: createdBy ?? null,
    });
    return this.contracts.save(contract);
  }

  async updateContract(id: string, dto: Partial<SaasContract>): Promise<SaasContract> {
    const c = await this.getContract(id);
    if (c.status !== 'draft' && c.status !== 'pending_signature') {
      throw new BadRequestException('Can only update draft or pending contracts');
    }
    Object.assign(c, dto);
    return this.contracts.save(c);
  }

  async createContractFromQuotation(
    quotationId: string,
    createdBy?: string,
    opts: ContractFromQuotationOpts = {},
  ): Promise<SaasContract> {
    const q = await this.quotations.findOne({ where: { id: quotationId } });
    if (!q) throw new NotFoundException('Quotation not found');

    const rev = await this.revisions.findOne({
      where: { quotationId: q.id, revisionNumber: q.currentRevisionNumber },
    });

    const now = new Date();
    const interval = (q.billingInterval || 'monthly') as string;
    const endDate = new Date(now);
    if (interval === 'yearly' || interval === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1); // contracts are annual even if billing is monthly
    }

    // Build terms text from quotation data
    let vendor: any;
    try {
      vendor = await this.saasRevenue.getVendorBilling();
    } catch {
      vendor = { legalName: 'Glide HIMS' };
    }
    const vendorName = vendor.tradingName || vendor.legalName || 'Glide HIMS';

    const lineDescriptions = (rev?.lineItems || [])
      .map(
        (l: any, i: number) =>
          `  ${i + 1}. ${l.description || 'Custom Service'} (Qty: ${l.quantity})`,
      )
      .join('\n');

    const zeroDecimal = new Set(['UGX', 'KES', 'TZS', 'RWF', 'JPY', 'KRW', 'VND', 'CLP', 'PYG']);
    const fmtCurrency = (n: number) =>
      `${q.currency} ${(n / (zeroDecimal.has(q.currency) ? 1 : 100)).toLocaleString()}`;

    const termsText = [
      `SOFTWARE LICENSE & SERVICE AGREEMENT`,
      ``,
      `This agreement ("Contract") is entered into between ${vendorName} ("Provider") and ${q.clientOrganization || q.clientName} ("Client") for the provision of Glide-HIMS Hospital Management Information System software and related services.`,
      ``,
      `1. SCOPE OF SERVICES`,
      `The Provider shall deliver, configure, and maintain the following system modules and services as detailed in Quotation ${q.quotationNumber}:`,
      lineDescriptions,
      ``,
      `2. CONTRACT VALUE & BILLING`,
      `Total Contract Value: ${fmtCurrency(rev?.totalMinor ?? 0)}`,
      `Billing Interval: ${interval === 'yearly' || interval === 'annual' ? 'Annual' : 'Monthly'}`,
      `Licensed User Seats: ${q.seats}`,
      `Currency: ${q.currency}`,
      ``,
      `3. IMPLEMENTATION MILESTONES`,
      `  Phase 1 (50%): Initial Setup & Base System — within 7 days of deposit`,
      `  Phase 2 (30%): Customization & User Training — within 21 days`,
      `  Phase 3 (20%): Go-Live & Support Handover — within 42 days`,
      ``,
      `4. SUPPORT & MAINTENANCE`,
      `The Provider shall provide 90 days of complimentary technical support post-deployment. Thereafter, a Service Level Agreement (SLA) at 15% of the annual software licensing value shall apply, billed quarterly.`,
      ``,
      `5. DATA PROTECTION & CONFIDENTIALITY`,
      `Both parties agree to protect all patient data, financial records, and institutional information exchanged during and after the implementation period. All data handling shall comply with applicable Ugandan data protection laws.`,
      ``,
      `6. TERMINATION`,
      `Either party may terminate this contract with 30 days written notice. In the event of early termination by the Client, any outstanding milestone payments remain due. The Provider shall ensure a reasonable data export period of not less than 14 days.`,
      ``,
      `7. GOVERNING LAW`,
      `This contract shall be governed by and construed in accordance with the laws of the Republic of Uganda.`,
    ].join('\n');

    const contract = await this.createContract(
      {
        quotationId: q.id,
        subscriptionId: q.subscriptionId,
        tenantId: opts.tenantId ?? null,
        clientName: q.clientName,
        clientOrganization: q.clientOrganization,
        startDate: now,
        endDate,
        totalValueMinor: rev?.totalMinor ?? 0,
        currency: q.currency,
        autoRenew: true,
        termsText,
        notes: q.notes || null,
        metadata: {
          quotationNumber: q.quotationNumber,
          billingInterval: interval,
          seats: q.seats,
          deploymentType: q.deploymentType,
          lineItemCount: rev?.lineItems?.length ?? 0,
        },
      },
      createdBy,
    );

    // Auto-activate if requested (e.g. from quotation acceptance flow)
    if (opts.autoActivate) {
      contract.status = 'active';
      await this.contracts.save(contract);
      this.events.emit('contract.activated', { contractId: contract.id });
      this.logger.log(
        `Contract ${contract.contractNumber} auto-activated from quotation ${q.quotationNumber}`,
      );
    }

    return contract;
  }

  async activateContract(id: string): Promise<SaasContract> {
    const c = await this.getContract(id);
    if (c.status !== 'draft' && c.status !== 'pending_signature') {
      throw new BadRequestException('Contract must be draft or pending_signature to activate');
    }
    c.status = 'active';
    const saved = await this.contracts.save(c);
    this.events.emit('contract.activated', { contractId: c.id });
    return saved;
  }

  async terminateContract(id: string): Promise<SaasContract> {
    const c = await this.getContract(id);
    c.status = 'terminated';
    const saved = await this.contracts.save(c);
    this.events.emit('contract.terminated', { contractId: c.id });
    return saved;
  }

  async renderContractHtml(id: string): Promise<string> {
    const c = await this.getContract(id);
    let vendor: any;
    try {
      vendor = await this.saasRevenue.getVendorBilling();
    } catch {
      vendor = { legalName: 'Glide HIMS' };
    }
    const esc = (s: any) =>
      String(s ?? '').replace(
        /[&<>"']/g,
        (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
      );
    const fmtD = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
    const zeroDecimal = new Set(['UGX', 'KES', 'TZS', 'RWF', 'JPY', 'KRW', 'VND', 'CLP', 'PYG']);
    const fmt = (n: number) =>
      `${c.currency} ${(n / (zeroDecimal.has(c.currency) ? 1 : 100)).toLocaleString()}`;

    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Contract ${esc(c.contractNumber)}</title>
<style>*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0;padding:32px;background:#f8fafc}
.sheet{max-width:820px;margin:0 auto;background:#fff;padding:48px;border:1px solid #e2e8f0;border-radius:8px}
h1{margin:0 0 4px;font-size:28px}h2{margin:24px 0 12px;font-size:16px;color:#334155}
.grid{display:flex;justify-content:space-between;gap:32px;margin-bottom:32px}.col{flex:1}.muted{color:#64748b;font-size:13px}
.badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;text-transform:uppercase}
.b-active{background:#d1fae5;color:#065f46}.b-draft{background:#dbeafe;color:#1e3a8a}.b-terminated{background:#e5e7eb;color:#374151}
.footer{margin-top:40px;padding-top:24px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px}
@media print{body{padding:0;background:#fff}.sheet{border:none;padding:24px}.noprint{display:none}}
.noprint{position:fixed;top:16px;right:16px;background:#0f172a;color:#fff;padding:10px 16px;border:none;border-radius:6px;cursor:pointer;font-weight:600}
</style></head><body>
<button class="noprint" onclick="window.print()">Print / Save as PDF</button>
<div class="sheet">
<div class="grid"><div class="col"><h1>${esc(vendor.tradingName || vendor.legalName)}</h1><div class="muted">${esc(vendor.legalName)}</div></div>
<div class="col" style="text-align:right"><h1>CONTRACT</h1><div class="muted"># ${esc(c.contractNumber)}</div>
<div style="margin-top:8px"><span class="badge b-${esc(c.status)}">${esc(c.status)}</span></div></div></div>
<div class="grid"><div class="col"><h2>Client</h2><div style="font-weight:600">${esc(c.clientName)}</div>
${c.clientOrganization ? `<div>${esc(c.clientOrganization)}</div>` : ''}</div>
<div class="col"><h2>Terms</h2><div>Start: ${fmtD(c.startDate)}</div><div>End: ${fmtD(c.endDate)}</div>
<div>Value: ${fmt(c.totalValueMinor)}</div><div>Auto-renew: ${c.autoRenew ? 'Yes' : 'No'}</div></div></div>
${c.termsText ? `<h2>Terms & Conditions</h2><div style="white-space:pre-wrap;font-size:13px;line-height:1.6">${esc(c.termsText)}</div>` : ''}
${c.signatories?.length ? `<h2>Signatories</h2>${c.signatories.map((s) => `<div style="margin-bottom:12px"><div style="font-weight:600">${esc(s.name)}</div><div class="muted">${esc(s.title)} — ${esc(s.email)}</div>${s.signedAt ? `<div class="muted">Signed: ${fmtD(s.signedAt)}</div>` : '<div class="muted" style="color:#b91c1c">Not yet signed</div>'}</div>`).join('')}` : ''}
<div class="footer"><p>${esc(vendor.legalName)} &middot; ${new Date().getFullYear()}</p></div>
</div></body></html>`;
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async cronRenewalReminders() {
    const noticeCutoff = new Date(Date.now() + 30 * 86400000);
    const contracts = await this.contracts.find({
      where: {
        status: 'active' as ContractStatus,
        autoRenew: true,
        endDate: LessThan(noticeCutoff),
      },
    });
    for (const c of contracts) {
      this.events.emit('contract.renewal_reminder', { contractId: c.id });
      this.logger.log(`Renewal reminder for contract ${c.contractNumber}`);
    }
  }

  private async nextContractNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CON-${year}-`;
    const last = await this.contracts
      .createQueryBuilder('c')
      .where('c.contractNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('c.contractNumber', 'DESC')
      .getOne();
    let seq = 1;
    if (last) {
      const parts = last.contractNumber.split('-');
      seq = (parseInt(parts[2], 10) || 0) + 1;
    }
    return `${prefix}${String(seq).padStart(5, '0')}`;
  }
}
