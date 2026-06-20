import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LessThan, Repository } from 'typeorm';
import { SaasContract, ContractStatus } from './contract.entity';
import { SaasQuotation, SaasQuotationRevision } from './quotation.entity';
import { SaasRevenueService } from './saas-revenue.service';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    @InjectRepository(SaasContract) private readonly contracts: Repository<SaasContract>,
    @InjectRepository(SaasQuotation) private readonly quotations: Repository<SaasQuotation>,
    @InjectRepository(SaasQuotationRevision) private readonly revisions: Repository<SaasQuotationRevision>,
    private readonly saasRevenue: SaasRevenueService,
    private readonly events: EventEmitter2,
  ) {}

  async listContracts(filters: { status?: string } = {}) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    const [items, total] = await this.contracts.findAndCount({ where, order: { createdAt: 'DESC' }, take: 200 });
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

  async createContractFromQuotation(quotationId: string, createdBy?: string): Promise<SaasContract> {
    const q = await this.quotations.findOne({ where: { id: quotationId } });
    if (!q) throw new NotFoundException('Quotation not found');

    const rev = await this.revisions.findOne({
      where: { quotationId: q.id, revisionNumber: q.currentRevisionNumber },
    });

    const now = new Date();
    return this.createContract({
      quotationId: q.id,
      subscriptionId: q.subscriptionId,
      clientName: q.clientName,
      clientOrganization: q.clientOrganization,
      startDate: now,
      endDate: new Date(now.getTime() + 365 * 86400000),
      totalValueMinor: rev?.totalMinor ?? 0,
      currency: q.currency,
    }, createdBy);
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
    try { vendor = await this.saasRevenue.getVendorBilling(); } catch { vendor = { legalName: 'Glide HIMS' }; }
    const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
    const fmtD = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
    const zeroDecimal = new Set(['UGX','KES','TZS','RWF','JPY','KRW','VND','CLP','PYG']);
    const fmt = (n: number) => `${c.currency} ${(n / (zeroDecimal.has(c.currency) ? 1 : 100)).toLocaleString()}`;

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
      where: { status: 'active' as ContractStatus, autoRenew: true, endDate: LessThan(noticeCutoff) },
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
