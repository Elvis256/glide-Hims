import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { InsuranceClaim, ClaimStatus } from '../../database/entities/insurance-claim.entity';
import { ClaimItem } from '../../database/entities/claim-item.entity';
import {
  InsuranceProvider,
  ClaimSubmissionMethod,
} from '../../database/entities/insurance-provider.entity';

/**
 * Generates artefacts insurers can ingest: CSV batch (NHIS-style portal upload),
 * PDF claim form (printable for manual submission), and pushes the claim to the
 * provider's REST endpoint when one is configured.
 *
 * Adding a country/insurer-specific format? Subclass / branch on
 * `provider.metadata.format` (e.g. 'nhis-ug', 'nhif-ke', 'jubilee-v2').
 */
@Injectable()
export class ClaimExportService {
  private readonly logger = new Logger(ClaimExportService.name);

  constructor(
    @InjectRepository(InsuranceClaim) private readonly claimRepo: Repository<InsuranceClaim>,
    @InjectRepository(ClaimItem) private readonly itemRepo: Repository<ClaimItem>,
    @InjectRepository(InsuranceProvider)
    private readonly providerRepo: Repository<InsuranceProvider>,
  ) {}

  /**
   * Build a CSV batch for one provider over a date range. Suitable for upload to
   * NHIS/NHIF-style portals. Columns chosen to satisfy Uganda NHIS template; insurers
   * with different schemas should set provider.metadata.csvColumns to override.
   */
  async exportBatchCsv(
    providerId: string,
    dateFrom: string,
    dateTo: string,
    tenantId?: string,
  ): Promise<{ filename: string; csv: string; count: number }> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('dateFrom and dateTo must be ISO dates (YYYY-MM-DD)');
    }
    if (to < from) {
      throw new BadRequestException('dateTo must be on or after dateFrom');
    }
    const MAX_RANGE_DAYS = 366;
    const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000);
    if (days > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Date range exceeds ${MAX_RANGE_DAYS} days`);
    }
    const provider = await this.providerRepo.findOne({
      where: { id: providerId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const claims = await this.claimRepo.find({
      where: {
        providerId,
        ...(tenantId ? { tenantId } : {}),
        serviceDate: Between(from, to),
      },
      relations: ['patient', 'policy', 'items', 'encounter'],
      order: { serviceDate: 'ASC' },
    });

    const eligible = claims.filter((c) =>
      [ClaimStatus.DRAFT, ClaimStatus.SUBMITTED, ClaimStatus.ACKNOWLEDGED].includes(c.status),
    );

    const header = [
      'provider_code',
      'claim_number',
      'member_number',
      'patient_name',
      'patient_dob',
      'gender',
      'service_date',
      'admission_date',
      'discharge_date',
      'claim_type',
      'primary_diagnosis_icd10',
      'secondary_diagnoses',
      'item_type',
      'service_code',
      'description',
      'quantity',
      'unit_price',
      'line_total',
      'currency',
    ];
    const rows: string[][] = [];
    for (const claim of eligible) {
      const items = claim.items?.length
        ? claim.items
        : await this.itemRepo.find({ where: { claimId: claim.id } });
      for (const item of items) {
        rows.push([
          provider.code || '',
          claim.claimNumber,
          claim.policy?.memberNumber || '',
          claim.patient?.fullName || '',
          claim.patient?.dateOfBirth ? this.toDate(claim.patient.dateOfBirth) : '',
          claim.patient?.gender || '',
          this.toDate(claim.serviceDate),
          claim.admissionDate ? this.toDate(claim.admissionDate) : '',
          claim.dischargeDate ? this.toDate(claim.dischargeDate) : '',
          claim.claimType,
          claim.diagnosisCode || claim.primaryDiagnosis || '',
          (claim.secondaryDiagnoses || []).join('|'),
          item.itemType,
          item.serviceCode || '',
          item.description,
          String(item.quantity),
          this.money(item.unitPrice),
          this.money(item.claimedAmount),
          'UGX',
        ]);
      }
    }

    const csv = [header, ...rows].map((r) => r.map(this.csvEscape).join(',')).join('\n');
    if (rows.length > ClaimExportService.MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `Export exceeds ${ClaimExportService.MAX_EXPORT_ROWS} rows; narrow the date range.`,
      );
    }
    const filename = `claims_${provider.code || provider.id.slice(0, 8)}_${dateFrom}_${dateTo}.csv`;
    return { filename, csv, count: eligible.length };
  }

  /**
   * Streams a single-claim PDF form. Returns the assembled buffer so the
   * controller can set headers and send it.
   */
  async generateClaimPdf(
    claimId: string,
    tenantId?: string,
  ): Promise<{ filename: string; pdf: Buffer }> {
    const claim = await this.claimRepo.findOne({
      where: { id: claimId, ...(tenantId ? { tenantId } : {}) },
      relations: ['provider', 'policy', 'patient', 'items', 'encounter', 'facility'],
    });
    if (!claim) throw new NotFoundException('Claim not found');

    // Lazy-import pdfkit so non-PDF endpoints don't pay startup cost.
    const PDFDocumentMod = await import('pdfkit');
    const PDFDocument = PDFDocumentMod.default || PDFDocumentMod;
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done: Promise<Buffer> = new Promise((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text('INSURANCE CLAIM FORM', { align: 'center' });
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(claim.facility?.name || '', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(8)
      .fillColor('#666')
      .text(
        `Claim #: ${claim.claimNumber}    Status: ${claim.status.toUpperCase()}    Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
        { align: 'center' },
      );
    doc.moveDown(1).fillColor('black');

    // Provider + Patient
    const top = doc.y;
    doc.fontSize(9).font('Helvetica-Bold').text('INSURER', 40, top);
    doc.font('Helvetica').text(claim.provider?.name || '', 40, top + 12);
    doc.text(`Code: ${claim.provider?.code || ''}`, 40, top + 24);
    doc.text(`Member #: ${claim.policy?.memberNumber || ''}`, 40, top + 36);
    doc.text(`Policy #: ${claim.policy?.policyNumber || ''}`, 40, top + 48);

    doc.font('Helvetica-Bold').text('PATIENT', 320, top);
    doc.font('Helvetica').text(claim.patient?.fullName || '', 320, top + 12);
    doc.text(`MRN: ${claim.patient?.mrn || ''}`, 320, top + 24);
    doc.text(
      `DOB: ${claim.patient?.dateOfBirth ? this.toDate(claim.patient.dateOfBirth) : ''}    Sex: ${claim.patient?.gender || ''}`,
      320,
      top + 36,
    );
    doc.text(`Phone: ${claim.patient?.phone || ''}`, 320, top + 48);

    doc.y = top + 70;
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.5).strokeColor('black');

    // Encounter
    doc.font('Helvetica-Bold').text('ENCOUNTER', 40, doc.y);
    doc.font('Helvetica');
    doc.text(`Service Date: ${this.toDate(claim.serviceDate)}    Type: ${claim.claimType}`);
    if (claim.admissionDate) {
      doc.text(
        `Admitted: ${this.toDate(claim.admissionDate)}    Discharged: ${
          claim.dischargeDate ? this.toDate(claim.dischargeDate) : '—'
        }`,
      );
    }
    doc.text(`Primary Dx: ${claim.diagnosisCode || ''} ${claim.primaryDiagnosis || ''}`.trim());
    if (claim.secondaryDiagnoses?.length) {
      doc.text(`Secondary: ${claim.secondaryDiagnoses.join(', ')}`);
    }
    doc.moveDown(0.5);

    // Items table
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.3).strokeColor('black');
    const cols = [
      { x: 40, w: 60, label: 'Type' },
      { x: 100, w: 70, label: 'Code' },
      { x: 170, w: 220, label: 'Description' },
      { x: 390, w: 30, label: 'Qty' },
      { x: 420, w: 65, label: 'Unit', align: 'right' as const },
      { x: 485, w: 70, label: 'Total', align: 'right' as const },
    ];
    doc.font('Helvetica-Bold').fontSize(9);
    cols.forEach((c) =>
      doc.text(c.label, c.x, doc.y, {
        width: c.w,
        align: c.align || 'left',
        continued: false,
      }),
    );
    doc.moveDown(0.2);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#999').stroke();
    doc.moveDown(0.2).strokeColor('black').font('Helvetica');

    const items = claim.items?.length
      ? claim.items
      : await this.itemRepo.find({ where: { claimId: claim.id } });
    for (const it of items) {
      const y = doc.y;
      doc.text(it.itemType, cols[0].x, y, { width: cols[0].w });
      doc.text(it.serviceCode || '—', cols[1].x, y, { width: cols[1].w });
      doc.text(it.description, cols[2].x, y, { width: cols[2].w });
      doc.text(String(it.quantity), cols[3].x, y, { width: cols[3].w });
      doc.text(this.money(it.unitPrice), cols[4].x, y, { width: cols[4].w, align: 'right' });
      doc.text(this.money(it.claimedAmount), cols[5].x, y, { width: cols[5].w, align: 'right' });
      doc.moveDown(0.3);
    }

    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.4).strokeColor('black').font('Helvetica-Bold');
    doc.text(`Total Claimed: UGX ${this.money(claim.totalClaimed)}`, { align: 'right' });
    if (Number(claim.totalApproved)) {
      doc.text(`Total Approved: UGX ${this.money(claim.totalApproved)}`, { align: 'right' });
    }

    // Signatures
    doc.moveDown(2).font('Helvetica').fontSize(9);
    const sigY = doc.y;
    doc.text('___________________________', 40, sigY);
    doc.text('Provider Signature & Stamp', 40, sigY + 12);
    doc.text('___________________________', 320, sigY);
    doc.text('Patient / Member Signature', 320, sigY + 12);

    doc.end();
    const pdf = await done;
    return { filename: `claim_${claim.claimNumber}.pdf`, pdf };
  }

  /**
   * If the provider has an apiEndpoint and electronic submission method, POST the
   * normalised claim payload. Returns ack + status. Caller is responsible for
   * updating claim.status / claim.metadata based on the result.
   */
  async submitElectronically(
    claim: InsuranceClaim,
    provider: InsuranceProvider,
  ): Promise<{ transmitted: boolean; ack?: any; error?: string }> {
    if (provider.claimSubmissionMethod !== ClaimSubmissionMethod.ELECTRONIC) {
      return { transmitted: false };
    }
    if (!provider.apiEndpoint) {
      return { transmitted: false, error: 'Provider has electronic method but no apiEndpoint' };
    }

    const payload = {
      claimNumber: claim.claimNumber,
      providerCode: provider.code,
      memberNumber: claim.policy?.memberNumber,
      patient: {
        name: claim.patient?.fullName,
        dob: claim.patient?.dateOfBirth ? this.toDate(claim.patient.dateOfBirth) : null,
        gender: claim.patient?.gender,
        mrn: claim.patient?.mrn,
      },
      claimType: claim.claimType,
      serviceDate: this.toDate(claim.serviceDate),
      admissionDate: claim.admissionDate ? this.toDate(claim.admissionDate) : null,
      dischargeDate: claim.dischargeDate ? this.toDate(claim.dischargeDate) : null,
      primaryDiagnosis: claim.primaryDiagnosis,
      diagnosisCode: claim.diagnosisCode,
      secondaryDiagnoses: claim.secondaryDiagnoses || [],
      items: (claim.items || []).map((i: any) => ({
        type: i.itemType,
        serviceCode: i.serviceCode,
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        amount: Number(i.claimedAmount),
        serviceDate: this.toDate(i.serviceDate),
      })),
      totalClaimed: Number(claim.totalClaimed),
      currency: 'UGX',
    };

    try {
      const res = await fetch(provider.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const ack = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.logger.warn(`Claim ${claim.claimNumber} electronic submit failed: ${res.status}`);
        return { transmitted: false, ack, error: `HTTP ${res.status}` };
      }
      return { transmitted: true, ack };
    } catch (err: any) {
      this.logger.error(`Claim ${claim.claimNumber} transmit error: ${err.message}`);
      return { transmitted: false, error: err.message };
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private static readonly MAX_EXPORT_ROWS = 50_000;
  private static readonly FORMULA_LEADERS = /^[=+\-@\t\r]/;

  private csvEscape = (v: string): string => {
    let s = String(v ?? '');
    if (s.length && ClaimExportService.FORMULA_LEADERS.test(s)) {
      s = `'${s}`;
    }
    if (/[,"\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  private money(v: number | string | null | undefined): string {
    return Number(v || 0).toFixed(2);
  }

  private toDate(d: Date | string): string {
    return new Date(d).toISOString().slice(0, 10);
  }
}
