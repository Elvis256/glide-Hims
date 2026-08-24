import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import {
  EfrisDocument,
  EfrisConfig,
  EfrisDocumentStatus,
  EfrisDocumentType,
  EfrisEnvironment,
} from '../../database/entities/pos-compliance.entity';
import { PharmacySale } from '../../database/entities/pharmacy-sale.entity';
import { UpsertEfrisConfigDto } from './efris.dto';

export interface EnqueueDocumentInput {
  saleId: string;
  documentType?: EfrisDocumentType;
  originalDocumentId?: string;
  payload: any;
  tenantId: string;
}

@Injectable()
export class EfrisService {
  private readonly logger = new Logger(EfrisService.name);

  constructor(
    @InjectRepository(EfrisDocument) private docRepo: Repository<EfrisDocument>,
    @InjectRepository(EfrisConfig) private configRepo: Repository<EfrisConfig>,
  ) {}

  async getConfig(tenantId: string): Promise<(EfrisConfig & { apiKeyConfigured: boolean }) | null> {
    const cfg = await this.configRepo.findOne({ where: { tenantId } });
    if (!cfg) return null;
    // The key itself is @Exclude()d from the response, so the page has no way
    // to tell "no key set" from "key set but hidden". Say so explicitly.
    return Object.assign(cfg, { apiKeyConfigured: !!cfg.apiKeyEncrypted });
  }

  async upsertConfig(dto: UpsertEfrisConfigDto, tenantId: string): Promise<EfrisConfig> {
    let cfg = await this.configRepo.findOne({ where: { tenantId } });
    // Only apply what was actually sent. class-transformer materialises absent
    // optional properties as undefined, and a blind Object.assign would then
    // write that over stored values — which matters most for the credential,
    // since the page can no longer read it back to re-send it. Saving the form
    // without retyping the key must not erase the key.
    const provided = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined && v !== ''),
    );
    if (cfg) {
      Object.assign(cfg, provided);
    } else {
      cfg = this.configRepo.create({ ...(provided as Partial<EfrisConfig>), tenantId });
    }
    return this.configRepo.save(cfg);
  }

  /**
   * Enqueue an EFRIS document for async submission. Must be called inside the
   * same DB transaction as the underlying business event (e.g. completeSale)
   * so that the outbox row is committed atomically.
   *
   * Idempotency: (tenantId, idempotencyKey) is uniquely constrained. Caller
   * may pass a deterministic key (e.g. `sale:<id>:invoice`) so retries from
   * the upstream caller don't duplicate fiscal documents.
   */
  async enqueueDocument(
    manager: EntityManager,
    input: EnqueueDocumentInput,
    idempotencyKey?: string,
  ): Promise<EfrisDocument> {
    const cfg = await manager.findOne(EfrisConfig, { where: { tenantId: input.tenantId } });
    const repo = manager.getRepository(EfrisDocument);
    const key =
      idempotencyKey || `sale:${input.saleId}:${input.documentType || EfrisDocumentType.INVOICE}`;

    const existing = await repo.findOne({
      where: { tenantId: input.tenantId, idempotencyKey: key },
    });
    if (existing) return existing;

    const doc = repo.create({
      saleId: input.saleId,
      documentType: input.documentType || EfrisDocumentType.INVOICE,
      originalDocumentId: input.originalDocumentId,
      status: EfrisDocumentStatus.PENDING_SUBMISSION,
      idempotencyKey: key,
      requestPayload: input.payload,
      taxpayerTin: cfg?.taxpayerTin,
      deviceSerial: cfg?.deviceSerial,
      environment: cfg?.environment || EfrisEnvironment.SANDBOX,
      tenantId: input.tenantId,
    });
    return repo.save(doc);
  }

  async listDocuments(tenantId: string, status?: EfrisDocumentStatus, limit = 100) {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.docRepo.find({ where, order: { createdAt: 'DESC' }, take: limit });
  }

  async getDocument(id: string, tenantId: string) {
    const doc = await this.docRepo.findOne({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('EFRIS document not found');
    return doc;
  }

  async retryDocument(id: string, tenantId: string) {
    const doc = await this.getDocument(id, tenantId);
    if (
      doc.status !== EfrisDocumentStatus.REJECTED &&
      doc.status !== EfrisDocumentStatus.FAILED_REQUIRES_ATTENTION
    ) {
      throw new BadRequestException(
        `Cannot retry document in status ${doc.status}. Only rejected or failed documents may be retried.`,
      );
    }
    doc.status = EfrisDocumentStatus.PENDING_SUBMISSION;
    doc.nextRetryAt = new Date();
    return this.docRepo.save(doc);
  }

  /**
   * Build a normalized EFRIS payload from a PharmacySale + items. This is
   * the "snapshot" persisted on the outbox row. The actual submission to URA
   * happens later in the worker; that worker may transform this normalized
   * payload into URA's exact wire format.
   */
  buildInvoicePayload(sale: PharmacySale, items: any[], cfg: EfrisConfig | null): any {
    return {
      schemaVersion: 1,
      saleNumber: sale.saleNumber,
      saleId: sale.id,
      saleChannel: sale.saleChannel,
      taxPricingMode: sale.taxPricingMode,
      currency: 'UGX',
      issuedAt: new Date().toISOString(),
      taxpayer: cfg
        ? { tin: cfg.taxpayerTin, name: cfg.taxpayerName, deviceSerial: cfg.deviceSerial }
        : null,
      buyer: {
        name: sale.customerName || null,
        phone: sale.customerPhone || null,
        patientId: sale.patientId || null,
      },
      totals: {
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discountAmount),
        tax: Number(sale.taxAmount),
        total: Number(sale.totalAmount),
      },
      payment: {
        method: sale.paymentMethod,
        reference: sale.transactionReference,
        amountPaid: Number(sale.amountPaid),
      },
      lines: items.map((it: any) => ({
        itemCode: it.itemCode,
        itemName: it.itemName,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        discountPercent: Number(it.discountPercent || 0),
        netAmount: Number(it.netAmount),
        taxAmount: Number(it.taxAmount),
        grossAmount: Number(it.grossAmount),
        taxRate: Number(it.taxRate),
        taxTreatment: it.taxTreatment,
        taxCode: it.taxCode,
      })),
    };
  }
}
