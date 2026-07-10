import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Optional,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  In,
  DataSource,
  LessThanOrEqual,
  EntityManager,
  IsNull,
} from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PharmacySale,
  PharmacySaleItem,
  SaleStatus,
  SaleType,
  SaleChannel,
  TaxPricingMode,
  TaxTreatment,
} from '../../database/entities/pharmacy-sale.entity';
import {
  Item,
  StockLedger,
  StockBalance,
  MovementType,
  ExpiryAlert,
  ExpiryAlertStatus,
} from '../../database/entities/inventory.entity';
import { BatchStockBalance } from '../../database/entities/batch-stock.entity';
import {
  Prescription,
  PrescriptionItem,
  PrescriptionStatus,
  Dispensation,
} from '../../database/entities/prescription.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import {
  DrugClassification,
  DrugInteraction,
  DrugSchedule,
} from '../../database/entities/drug-classification.entity';
import { DrugInteractionOverride } from '../../database/entities/drug-interaction-override.entity';
import { ControlledSubstanceLog } from '../../database/entities/controlled-substance.entity';
import {
  CreatePharmacySaleDto,
  CompleteSaleDto,
  AllocateFEFODto,
  ReceiveBatchDto,
  SaleItemDto,
  ControlledSubstanceBuyerDto,
} from './pharmacy.dto';
import { FinanceService } from '../finance/finance.service';
import { PosShiftGuardService } from '../pos/services/pos-shift-guard.service';
import { EfrisService } from '../efris/efris.service';
import { InventoryService } from '../inventory/inventory.service';
import { EfrisDocumentType } from '../../database/entities/pos-compliance.entity';
import { ReceiptReprint, RetailCustomer } from '../../database/entities/pos-retail.entity';
import { MedicationSafetyService } from '../allergies/medication-safety.service';
import { BillingService } from '../billing/billing.service';
import { Patient } from '../../database/entities/patient.entity';
import { Store } from '../../database/entities/store.entity';

// C4: VAT rate is loaded per-tenant from efris_config, fallback to UG default.
// This is retrieved in getDefaultVatRate() which caches the result.
const UG_STANDARD_VAT_RATE = 18;

// Schedules that trigger controlled-substance logging at retail/POS counter.
const CONTROLLED_SCHEDULES: DrugSchedule[] = [
  DrugSchedule.SCHEDULE_II,
  DrugSchedule.SCHEDULE_III,
  DrugSchedule.SCHEDULE_IV,
  DrugSchedule.SCHEDULE_V,
];

@Injectable()
export class PharmacyService {
  private readonly logger = new Logger(PharmacyService.name);
  private vatRateCache = new Map<string, { rate: number; expiresAt: number }>();

  constructor(
    @Inject(forwardRef(() => FinanceService))
    private financeService: FinanceService,
    @InjectRepository(PharmacySale) private saleRepo: Repository<PharmacySale>,
    @InjectRepository(PharmacySaleItem) private saleItemRepo: Repository<PharmacySaleItem>,
    @InjectRepository(Item) private inventoryRepo: Repository<Item>,
    @InjectRepository(StockLedger) private movementRepo: Repository<StockLedger>,
    @InjectRepository(StockBalance) private stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(Prescription) private prescriptionRepo: Repository<Prescription>,
    @InjectRepository(PrescriptionItem) private prescriptionItemRepo: Repository<PrescriptionItem>,
    @InjectRepository(BatchStockBalance) private batchStockRepo: Repository<BatchStockBalance>,
    @InjectRepository(ExpiryAlert) private expiryAlertRepo: Repository<ExpiryAlert>,
    @InjectRepository(AuditLog) private auditLogRepo: Repository<AuditLog>,
    @InjectRepository(DrugClassification)
    private drugClassRepo: Repository<DrugClassification>,
    @InjectRepository(DrugInteraction)
    private drugInteractionRepo: Repository<DrugInteraction>,
    @InjectRepository(DrugInteractionOverride)
    private ddiOverrideRepo: Repository<DrugInteractionOverride>,
    @InjectRepository(ControlledSubstanceLog)
    private controlledLogRepo: Repository<ControlledSubstanceLog>,
    @InjectRepository(ReceiptReprint)
    private reprintRepo: Repository<ReceiptReprint>,
    @InjectRepository(RetailCustomer)
    private retailCustomerRepo: Repository<RetailCustomer>,
    private dataSource: DataSource,
    private posShiftGuard: PosShiftGuardService,
    private efrisService: EfrisService,
    private eventEmitter: EventEmitter2,
    private inventoryService: InventoryService,
    private medicationSafetyService: MedicationSafetyService,
    @Optional()
    @Inject(forwardRef(() => BillingService))
    private billingService?: BillingService,
  ) {}

  /**
   * Compute per-line tax breakdown given gross/net pricing mode + treatment.
   * - INCLUSIVE: unitPrice already contains VAT → net = gross / (1+r), tax = gross - net
   * - EXCLUSIVE: unitPrice is net → tax = net * r, gross = net + tax
   * - EXEMPT / OUT_OF_SCOPE: rate = 0, no tax
   * - ZERO_RATED: still in VAT scope, but rate = 0
   */
  private computeLineTax(
    item: SaleItemDto,
    pricingMode: TaxPricingMode,
  ): {
    netAmount: number;
    taxAmount: number;
    grossAmount: number;
    taxRate: number;
    taxTreatment: TaxTreatment;
  } {
    const treatment = item.taxTreatment || TaxTreatment.STANDARD;
    const discount = item.discountPercent || 0;
    const lineBase = item.quantity * item.unitPrice * (1 - discount / 100);

    let rate = 0;
    if (treatment === TaxTreatment.STANDARD) {
      rate = item.taxRate ?? UG_STANDARD_VAT_RATE;
    } else if (treatment === TaxTreatment.ZERO_RATED) {
      rate = 0;
    } else {
      rate = 0;
    }

    let net: number, tax: number, gross: number;
    if (rate === 0) {
      net = lineBase;
      tax = 0;
      gross = lineBase;
    } else if (pricingMode === TaxPricingMode.INCLUSIVE) {
      gross = lineBase;
      net = lineBase / (1 + rate / 100);
      tax = gross - net;
    } else {
      net = lineBase;
      tax = lineBase * (rate / 100);
      gross = net + tax;
    }
    return {
      netAmount: Number(net.toFixed(2)),
      taxAmount: Number(tax.toFixed(2)),
      grossAmount: Number(gross.toFixed(2)),
      taxRate: rate,
      taxTreatment: treatment,
    };
  }

  private async generateSaleNumber(manager: EntityManager, tenantId?: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const lockKey = `pharm_sale_num_${dateStr}_${tenantId || 'global'}`;

    // Use advisory lock to prevent concurrent generation collisions
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);

    const lastSale = await manager
      .getRepository(PharmacySale)
      .createQueryBuilder('s')
      .where('s.saleNumber LIKE :prefix', { prefix: `PHARM-${dateStr}-%` })
      .andWhere(tenantId ? 's.tenant_id = :tenantId' : '1=1', { tenantId })
      .orderBy('s.saleNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastSale) {
      const parts = lastSale.saleNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `PHARM-${dateStr}-${sequence.toString().padStart(4, '0')}`;
  }

  async getQueueStats(
    facilityId?: string,
    tenantId?: string,
  ): Promise<{ pending: number; dispensed: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count pending prescriptions
    const pendingQuery = this.prescriptionRepo
      .createQueryBuilder('p')
      .where('p.status IN (:...statuses)', {
        statuses: [PrescriptionStatus.PENDING, PrescriptionStatus.PARTIALLY_DISPENSED],
      });

    if (tenantId) {
      pendingQuery.andWhere('p.tenant_id = :tenantId', { tenantId });
    }

    const pending = await pendingQuery.getCount();

    // Count dispensed today
    const dispensedQuery = this.prescriptionRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: PrescriptionStatus.DISPENSED })
      .andWhere('p.updatedAt >= :today', { today });

    if (tenantId) {
      dispensedQuery.andWhere('p.tenant_id = :tenantId', { tenantId });
    }

    const dispensed = await dispensedQuery.getCount();

    return { pending, dispensed };
  }

  async createSale(dto: CreatePharmacySaleDto, userId: string, tenantId?: string) {
    // D2: Offline idempotency — if clientSaleId provided and a sale with that key exists, return it
    if (dto.clientSaleId) {
      const existing = await this.saleRepo.findOne({
        where: { clientSaleId: dto.clientSaleId, ...(tenantId ? { tenantId } : {}) },
      });
      if (existing) {
        const existingItems = await this.saleItemRepo.find({ where: { saleId: existing.id } });
        return { ...existing, items: existingItems };
      }
    }

    // 1. Initial validation
    for (const item of dto.items) {
      if (item.quantity <= 0) {
        throw new BadRequestException(
          `Item "${item.itemName || item.itemCode}" must have quantity > 0`,
        );
      }
      if (item.unitPrice < 0) {
        throw new BadRequestException(
          `Item "${item.itemName || item.itemCode}" cannot have a negative unit price`,
        );
      }
      const discount = item.discountPercent || 0;
      if (discount < 0 || discount > 100) {
        throw new BadRequestException(
          `Discount for "${item.itemName || item.itemCode}" must be between 0 and 100%`,
        );
      }
    }

    const saleChannel = dto.saleChannel || SaleChannel.INTERNAL_PHARMACY;
    const taxPricingMode = dto.taxPricingMode || TaxPricingMode.INCLUSIVE;

    // POS context: when ringing on the retail counter, both the shift and register
    // must be supplied so X/Z reports can attribute the sale correctly.
    if (saleChannel === SaleChannel.RETAIL_POS) {
      if (!dto.posShiftId || !dto.posRegisterId) {
        throw new BadRequestException('Retail POS sales require both posShiftId and posRegisterId');
      }
    }

    // Compute per-line tax breakdown up-front (frozen on the sale row).
    const lineTaxes = dto.items.map((it) => this.computeLineTax(it, taxPricingMode));

    let subtotalNet = 0;
    let totalTax = 0;
    let subtotalGross = 0;
    for (const lt of lineTaxes) {
      subtotalNet += lt.netAmount;
      totalTax += lt.taxAmount;
      subtotalGross += lt.grossAmount;
    }

    const discountAmount = dto.discountAmount || 0;
    const totalAmount = Number((subtotalGross - discountAmount).toFixed(2));

    return this.dataSource
      .transaction(async (manager) => {
        const saleNumber = await this.generateSaleNumber(manager, tenantId);

        // Prevent duplicate dispensing of the same prescription
        if (dto.prescriptionId) {
          const existingSale = await manager.findOne(PharmacySale, {
            where: {
              prescriptionId: dto.prescriptionId,
              status: SaleStatus.COMPLETED,
              ...(tenantId ? { tenantId } : {}),
            },
          });
          if (existingSale) {
            throw new BadRequestException(
              `Prescription ${dto.prescriptionId} has already been dispensed (Sale: ${existingSale.saleNumber})`,
            );
          }
        }

        // If retail_pos channel, lock & validate the shift right now (cart creation)
        // so we fail fast before assembling line items.
        if (saleChannel === SaleChannel.RETAIL_POS) {
          await this.posShiftGuard.assertOpenShift(manager, dto.posShiftId!, tenantId!, userId);
          await this.posShiftGuard.assertActiveRegister(manager, dto.posRegisterId!, tenantId!);
        }

        const sale = manager.create(PharmacySale, {
          saleNumber,
          storeId: dto.storeId,
          saleType: dto.saleType || SaleType.OTC,
          saleChannel,
          taxPricingMode,
          posShiftId: dto.posShiftId,
          posRegisterId: dto.posRegisterId,
          patientId: dto.patientId,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          prescriptionId: dto.prescriptionId,
          paymentMethod: dto.paymentMethod || 'cash',
          transactionReference: dto.transactionReference,
          encounterId: dto.encounterId || null,
          subtotal: Number(subtotalNet.toFixed(2)),
          discountAmount,
          taxAmount: Number(totalTax.toFixed(2)),
          totalAmount,
          notes: dto.wasOffline
            ? `${dto.notes ? dto.notes + ' | ' : ''}Sale completed offline at ${dto.originalOfflineTimestamp || 'unknown'}, synced at ${new Date().toISOString()}`
            : dto.notes,
          status: SaleStatus.PENDING,
          soldById: userId,
          clientSaleId: dto.clientSaleId,
          clientSequenceNumber: dto.clientSequenceNumber,
          wasOffline: dto.wasOffline,
          originalOfflineTimestamp: dto.originalOfflineTimestamp
            ? new Date(dto.originalOfflineTimestamp)
            : undefined,
          ...(tenantId ? { tenantId } : {}),
        });
        const saved = await manager.save(PharmacySale, sale);

        // Validate items and create sale items with frozen tax breakdown
        for (let i = 0; i < dto.items.length; i++) {
          const item = dto.items[i];
          const lt = lineTaxes[i];

          if (item.itemId) {
            const drug = await manager.findOne(Item, {
              where: { id: item.itemId, ...(tenantId ? { tenantId } : {}) },
            });
            if (drug && drug.status !== 'active') {
              throw new BadRequestException(
                `${item.itemName || drug.name} is ${drug.status} and cannot be sold`,
              );
            }
            if ((dto.saleType || SaleType.OTC) === SaleType.OTC && !dto.prescriptionId) {
              if (drug && drug.requiresPrescription) {
                throw new BadRequestException(
                  `${item.itemName || drug.name} requires a prescription and cannot be sold over-the-counter without one`,
                );
              }
            }
          }

          const saleItem = manager.create(PharmacySaleItem, {
            saleId: saved.id,
            itemId: item.itemId,
            itemCode: item.itemCode,
            itemName: item.itemName,
            batchNumber: item.batchNumber || undefined,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent || 0,
            amount: lt.grossAmount, // legacy field — store gross for backward compat
            netAmount: lt.netAmount,
            taxAmount: lt.taxAmount,
            grossAmount: lt.grossAmount,
            taxRate: lt.taxRate,
            taxTreatment: lt.taxTreatment,
            taxCode: item.taxCode,
            taxExemptionReason: item.taxExemptionReason,
            instructions: item.instructions,
            ...(tenantId ? { tenantId } : {}),
          });
          if (item.expiryDate) {
            saleItem.expiryDate = new Date(item.expiryDate);
          }
          await manager.save(PharmacySaleItem, saleItem);
        }

        return saved.id;
      })
      .catch(async (err: any) => {
        // P0 — offline idempotency: if a concurrent sync inserted the same
        // clientSaleId between our pre-check and our INSERT, Postgres surfaces
        // a unique-violation (23505) on the partial unique index added by
        // migration 1782900000035 (pharmacy_sales_tenant_client_sale_uniq).
        // Treat that as the idempotent path and return the winning row.
        if (dto.clientSaleId && err?.code === '23505') {
          const dup = await this.saleRepo.findOne({
            where: { clientSaleId: dto.clientSaleId, ...(tenantId ? { tenantId } : {}) },
          });
          if (dup) return dup.id;
        }
        throw err;
      })
      .then((id) => this.findSale(id, tenantId));
  }

  /**
   * D2: Lightweight item+price snapshot for offline POS cache.
   * Returns active items with prices/stock updated since `since` timestamp.
   * Controlled substances are flagged `cacheable=false` so they cannot be sold offline.
   */
  async getItemsSyncBundle(tenantId: string | undefined, since?: string, limit = 100, offset = 0) {
    const qb = this.inventoryRepo
      .createQueryBuilder('item')
      .select([
        'item.id',
        'item.name',
        'item.code',
        'item.barcode',
        'item.sellingPrice',
        'item.unit',
        'item.updatedAt',
        'item.isControlled',
      ])
      .where(`item.status = 'active'`)
      .orderBy('item.updatedAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (tenantId) qb.andWhere('item.tenantId = :tenantId', { tenantId });
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        qb.andWhere('item.updatedAt >= :since', { since: sinceDate });
      }
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        sku: i.code,
        barcode: i.barcode,
        sellingPrice: i.sellingPrice,
        unit: i.unit,
        qty: null as number | null,
        lastUpdated: i.updatedAt,
        isControlledSubstance: i.isControlled,
        cacheable: !i.isControlled,
      })),
      total,
      limit,
      offset,
    };
  }

  async findAllSales(
    storeId?: string,
    status?: SaleStatus,
    date?: string,
    limit = 50,
    tenantId?: string,
  ) {
    const query = this.saleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.store', 'st')
      .leftJoin('s.patient', 'p')
      .addSelect(['p.id', 'p.mrn', 'p.fullName']);
    if (tenantId) query.andWhere('s.tenant_id = :tenantId', { tenantId });
    if (storeId) query.andWhere('s.storeId = :storeId', { storeId });
    if (status) query.andWhere('s.status = :status', { status });
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      query.andWhere('s.createdAt BETWEEN :start AND :end', { start, end });
    }
    const takeLimit = limit ? Number(limit) : 50;
    return query.orderBy('s.createdAt', 'DESC').take(takeLimit).getMany();
  }

  async findSale(id: string, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const sale = await this.saleRepo.findOne({
      where,
      relations: ['store', 'soldBy'],
    });
    // Load only non-sensitive patient fields to avoid PHI over-fetching
    if (sale?.patientId) {
      const patient = await this.saleRepo.manager
        .getRepository('Patient')
        .createQueryBuilder('p')
        .select(['p.id', 'p.mrn', 'p.fullName'])
        .where('p.id = :id', { id: sale.patientId })
        .getOne();
      sale.patient = patient as Patient;
    }
    if (!sale) throw new NotFoundException('Sale not found');
    // C3: filter soft-deleted sale items
    const itemWhere: any = { saleId: id, deletedAt: IsNull() };
    if (tenantId) itemWhere.tenantId = tenantId;
    const items = await this.saleItemRepo.find({ where: itemWhere });
    return { ...sale, items };
  }

  async completeSale(id: string, dto: CompleteSaleDto, userId: string, tenantId?: string) {
    // Validate and deduct stock within a single transaction for full consistency.
    // The sale itself is row-locked inside the txn so two concurrent
    // completeSale calls on the same sale id cannot both pass the
    // status==PENDING check and double-deduct stock (P0).
    const txnResult = await this.dataSource.transaction(async (manager) => {
      const sale = await manager.findOne(PharmacySale, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!sale) throw new NotFoundException('Sale not found');

      // Idempotency: a second completion request on an already-completed sale
      // is a no-op (caller gets the already-settled sale back, no stock
      // double-deduct, no second event emit / EFRIS enqueue).
      if (sale.status === SaleStatus.COMPLETED) {
        return { alreadyCompleted: true as const };
      }

      if (sale.status !== SaleStatus.PENDING) {
        throw new BadRequestException('Sale is not pending');
      }

      if (dto.amountPaid < Number(sale.totalAmount)) {
        throw new BadRequestException('Insufficient payment amount');
      }

      // Load items + store separately to avoid Postgres
      // "FOR UPDATE cannot be applied to the nullable side of an outer join".
      sale.items = await manager.find(PharmacySaleItem, {
        where: { saleId: sale.id, deletedAt: IsNull() },
      });
      if (sale.storeId) {
        sale.store = await manager
          .query(
            `SELECT id, facility_id AS "facilityId" FROM pharmacy_stores WHERE id = $1 LIMIT 1`,
            [sale.storeId],
          )
          .then((rows: any[]) => rows?.[0]) as Store;
      }

      // Get facility ID from the sale's store
      const facilityId = sale.store?.facilityId;
      if (!facilityId) {
        throw new BadRequestException('Sale store does not have a facility assigned');
      }

      const inventoryRepo = manager.getRepository(Item);
      const stockBalanceRepo = manager.getRepository(StockBalance);
      const stockLedgerRepo = manager.getRepository(StockLedger);
      const batchStockRepo = manager.getRepository(BatchStockBalance);

      // Medication safety checks (DDI between basket items; allergy checks if patientId present)
      const saleItems = sale.items;
      const drugIds = saleItems.map((i) => i.itemId).filter(Boolean);
      if (drugIds.length > 0) {
        try {
          const safetyResult = await this.medicationSafetyService.runSafetyChecks({
            patientId: sale.patientId || undefined,
            drugIds,
            lines: saleItems.map((i) => ({
              drugId: i.itemId,
              drugName: i.itemName || 'Unknown',
            })),
            tenantId,
          });
          if (safetyResult.blocked) {
            const reasons = safetyResult.blockingAlerts
              .map(
                (a) =>
                  `${a.pairedDrugName || a.drugName || 'Drug'}: ${a.description || a.severity}`,
              )
              .join('; ');
            throw new BadRequestException(
              `Medication safety check failed: ${reasons || 'Blocking alerts detected'}. An override is required to proceed.`,
            );
          }
        } catch (err) {
          // Re-throw BadRequestException (our own blocking throw)
          if (err instanceof BadRequestException) throw err;
          // For OTC sales without patientId, allergy check failures are non-fatal
          // but DDI degradation on multi-drug baskets is still fail-closed
          if (drugIds.length > 1) {
            this.logger.warn(`Medication safety check degraded for sale ${id}: ${err.message}`);
            throw new BadRequestException(
              'Medication safety checks are unavailable and this sale contains multiple drugs. Cannot proceed safely.',
            );
          }
          this.logger.warn(`Medication safety check skipped for sale ${id}: ${err.message}`);
        }
      }

      // FEFO auto-allocation: for any sale item without an explicit batchNumber,
      // pick the earliest-expiring batch that has enough available stock.
      // Manual batch selections are respected but expired batches are still rejected below.
      for (const item of sale.items) {
        if (item.batchNumber) continue;

        // Resolve whether this item demands batch/expiry tracking; we need to
        // know now because failure to pick a batch for such an item must be
        // fatal rather than silently falling through to facility-level balance.
        const inventoryRow = await inventoryRepo.findOne({
          where: { id: item.itemId, ...(tenantId ? { tenantId } : {}) },
        });

        const candidates = await batchStockRepo
          .createQueryBuilder('bs')
          .where('bs.itemId = :itemId', { itemId: item.itemId })
          .andWhere('bs.facilityId = :facilityId', { facilityId })
          .andWhere('(bs.expiryDate IS NULL OR bs.expiryDate >= CURRENT_DATE)')
          .andWhere('(bs.quantity - COALESCE(bs.reservedQuantity, 0)) >= :qty', {
            qty: item.quantity,
          })
          .andWhere(tenantId ? 'bs.tenantId = :tenantId' : '1=1', tenantId ? { tenantId } : {})
          .orderBy('bs.expiryDate', 'ASC', 'NULLS LAST')
          .addOrderBy('bs.createdAt', 'ASC')
          .getMany();
        if (candidates.length > 0) {
          const chosen = candidates[0];
          item.batchNumber = chosen.batchNumber;
          if (chosen.expiryDate) item.expiryDate = chosen.expiryDate;
          // Persist on the saved sale item so the audit/print reflects the batch
          await manager.update(
            PharmacySaleItem,
            { id: item.id },
            { batchNumber: chosen.batchNumber, expiryDate: chosen.expiryDate },
          );
        } else if (inventoryRow?.requiresBatchTracking || inventoryRow?.requiresExpiryTracking) {
          // Fail-closed: items configured to require batch/expiry tracking must
          // not be dispensed against a generic facility balance. Surface a
          // clear error so the user picks/receives a valid batch (P0 fix).
          throw new BadRequestException(
            `"${inventoryRow.name}" requires batch tracking. No non-expired batch with sufficient stock was found at this facility — select a batch explicitly or receive one before dispensing.`,
          );
        }
        // If batch tracking is NOT required and no candidates exist, fall
        // through; later stock-balance validation will surface the issue.
      }

      // Acquire ALL stock balance locks upfront in consistent order to prevent deadlocks
      const itemIds = sale.items.map((i: any) => i.itemId).filter(Boolean);
      let allStockBalances: StockBalance[] = [];
      if (itemIds.length > 0) {
        const stockQuery = stockBalanceRepo
          .createQueryBuilder('sb')
          .setLock('pessimistic_write')
          .where('sb.itemId IN (:...itemIds)', { itemIds })
          .andWhere('sb.facilityId = :facilityId', { facilityId })
          .orderBy('sb.itemId', 'ASC');
        if (tenantId) {
          stockQuery.andWhere('sb.tenantId = :tenantId', { tenantId });
        }
        allStockBalances = await stockQuery.getMany();
      }
      const stockMap = new Map(allStockBalances.map((sb) => [sb.itemId, sb]));

      // Lock batch stock balances upfront for items with batch numbers
      const batchItems = sale.items.filter((i: any) => i.batchNumber);
      const batchStockMap = new Map<string, BatchStockBalance>();
      if (batchItems.length > 0) {
        const batchQuery = batchStockRepo
          .createQueryBuilder('bs')
          .setLock('pessimistic_write')
          .where('bs.facilityId = :facilityId', { facilityId })
          .orderBy('bs.itemId', 'ASC')
          .addOrderBy('bs.batchNumber', 'ASC');
        if (tenantId) {
          batchQuery.andWhere('bs.tenantId = :tenantId', { tenantId });
        }
        const orConditions = batchItems.map(
          (_: any, idx: number) =>
            `(bs.itemId = :bItemId${idx} AND bs.batchNumber = :bBatch${idx})`,
        );
        const params: Record<string, string> = {};
        batchItems.forEach((item: any, idx: number) => {
          params[`bItemId${idx}`] = item.itemId;
          params[`bBatch${idx}`] = item.batchNumber;
        });
        batchQuery.andWhere(`(${orConditions.join(' OR ')})`, params);
        const allBatchBalances = await batchQuery.getMany();
        for (const bs of allBatchBalances) {
          batchStockMap.set(`${bs.itemId}:${bs.batchNumber}`, bs);
        }
      }

      // Normalize to midnight for consistent expiry comparisons regardless of time-of-day
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Validate and deduct stock using pre-locked records
      for (const item of sale.items) {
        const inventoryWhere: any = { id: item.itemId };
        if (tenantId) inventoryWhere.tenantId = tenantId;
        const inventoryItem = await inventoryRepo.findOne({
          where: inventoryWhere,
        });
        if (!inventoryItem) {
          throw new BadRequestException(`Item ${item.itemId} not found in inventory`);
        }

        // Controlled substance handling — uses authoritative drug_classifications.schedule
        // (not the cached items.is_controlled flag) and writes a structured row to
        // controlled_substance_logs for narcotics inspectors / audit.
        const classification = await manager.findOne(DrugClassification, {
          where: { itemId: inventoryItem.id, ...(tenantId ? { tenantId } : {}) },
        });
        // C6: do NOT silently fall back to UNSCHEDULED for items the inventory
        // master flags as controlled. A missing classification row is a data
        // integrity bug — refuse to dispense rather than risk treating a Schedule II
        // narcotic as OTC.
        if (!classification && inventoryItem.isControlled) {
          throw new BadRequestException(
            `Drug classification missing for controlled substance "${inventoryItem.name}" (item ${inventoryItem.id}). Configure DrugClassification before dispensing.`,
          );
        }
        const schedule = classification?.schedule || DrugSchedule.UNSCHEDULED;
        const isControlled = CONTROLLED_SCHEDULES.includes(schedule);

        if (isControlled || inventoryItem.isControlled) {
          // Schedule II is the strictest tier in UG — must always have a prescription.
          // Reject if dispensed via OTC channel without an Rx.
          if (
            schedule === DrugSchedule.SCHEDULE_II &&
            !sale.prescriptionId &&
            sale.saleType !== SaleType.PRESCRIPTION
          ) {
            throw new BadRequestException(
              `${inventoryItem.name} is a Schedule II controlled substance and cannot be dispensed without a prescription.`,
            );
          }

          // For non-prescription dispensing of any controlled substance the buyer
          // identification block is required so the dispensing register satisfies
          // National Drug Authority record-keeping rules. Trim to prevent
          // empty-string bypass (C5).
          const buyer = dto.controlledSubstanceBuyer;
          const buyerName = buyer?.buyerName?.trim();
          const buyerIdNumber = buyer?.buyerIdNumber?.trim();
          if (!sale.prescriptionId && (!buyerName || !buyerIdNumber)) {
            throw new BadRequestException(
              `Dispensing controlled substance "${inventoryItem.name}" without a prescription requires buyer name and ID number.`,
            );
          }

          // C8: zero-price controlled substances are a fraud vector.
          if (Number(item.unitPrice) <= 0) {
            throw new BadRequestException(
              `Controlled substance "${inventoryItem.name}" cannot be dispensed at zero price.`,
            );
          }

          // Generic existing audit log (kept for compatibility with existing dashboards).
          const auditRepo = manager.getRepository(AuditLog);
          await auditRepo.save(
            auditRepo.create({
              action: 'CONTROLLED_SUBSTANCE_DISPENSED',
              entityType: 'PharmacySale',
              entityId: sale.id,
              userId,
              newValue: {
                itemId: inventoryItem.id,
                itemName: inventoryItem.name,
                quantity: item.quantity,
                saleNumber: sale.saleNumber,
                schedule,
                prescriptionReference: sale.prescriptionId || null,
              },
              tenantId,
            }),
          );

          // Typed structured log for the controlled substance register.
          // Compute running balance: stockMap reflects deductions from prior loop
          // iterations, so (current - this item's qty) = balance after this dispense.
          const ctrlStockBal = stockMap.get(item.itemId);
          const ctrlRunningBalance = (ctrlStockBal?.totalQuantity || 0) - item.quantity;

          const ctrlLogRepo = manager.getRepository(ControlledSubstanceLog);
          const ctrlLogEntry: Partial<ControlledSubstanceLog> = {
            pharmacySaleItemId: item.id,
            prescriptionItemId: item.prescriptionItemId || undefined,
            drugSchedule: schedule,
            quantityDispensed: item.quantity,
            runningBalance: ctrlRunningBalance,
            dispensedById: userId,
            facilityId,
            isOtcPermitted: !sale.prescriptionId,
            buyerName: buyer?.buyerName || sale.customerName || undefined,
            buyerIdType: buyer?.buyerIdType || undefined,
            buyerIdNumber: buyer?.buyerIdNumber || undefined,
            buyerPhone: buyer?.buyerPhone || sale.customerPhone || undefined,
            prescriberName: buyer?.prescriberName || undefined,
            prescriberLicense: buyer?.prescriberLicense || undefined,
            pharmacistId: userId,
            witnessId: buyer?.witnessId || undefined,
            witnessName: buyer?.witnessName || undefined,
            ...(tenantId ? { tenantId } : {}),
          };
          await ctrlLogRepo.save(ctrlLogRepo.create(ctrlLogEntry));

          this.logger.warn(
            `CONTROLLED SUBSTANCE DISPENSED: item=${inventoryItem.name}, schedule=${schedule}, qty=${item.quantity}, user=${userId}, sale=${sale.saleNumber}`,
          );
        } else if (inventoryItem.requiresPrescription && sale.saleType === SaleType.OTC) {
          throw new BadRequestException(
            `"${inventoryItem.name}" requires a prescription and cannot be sold as OTC.`,
          );
        }

        // Dose/quantity safety limit
        if (
          inventoryItem.maxDispenseQuantity &&
          item.quantity > inventoryItem.maxDispenseQuantity
        ) {
          throw new BadRequestException(
            `Quantity ${item.quantity} exceeds max dispense limit of ${inventoryItem.maxDispenseQuantity} for "${inventoryItem.name}".`,
          );
        }

        // Block dispensing of expired stock (DTO-provided expiry)
        if (item.expiryDate && new Date(item.expiryDate) < today) {
          throw new BadRequestException(
            `Item ${inventoryItem.name} batch ${item.batchNumber || 'N/A'} is expired. Expired stock cannot be sold.`,
          );
        }

        // Also validate expiry from database batch records, not just DTO
        if (item.batchNumber) {
          const batchRecord = batchStockMap.get(`${item.itemId}:${item.batchNumber}`);
          if (batchRecord && new Date(batchRecord.expiryDate) < today) {
            throw new BadRequestException(
              `Item ${inventoryItem.name} batch ${item.batchNumber} is expired according to database records. Expired stock cannot be sold.`,
            );
          }
        }

        const stockBalance = stockMap.get(item.itemId);
        const availableQty = stockBalance?.availableQuantity || 0;

        if (availableQty < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${inventoryItem.name}. Available: ${availableQty}, Requested: ${item.quantity}`,
          );
        }

        // Deduct from pre-locked stock balance
        const currentBalance = stockBalance?.totalQuantity || 0;
        const newBalance = currentBalance - item.quantity;

        if (stockBalance) {
          stockBalance.totalQuantity = newBalance;
          stockBalance.availableQuantity = (stockBalance.availableQuantity || 0) - item.quantity;
          stockBalance.lastMovementAt = new Date();
          await stockBalanceRepo.save(stockBalance);
        }

        // Deduct from batch stock balance if batch tracking is available
        if (item.batchNumber) {
          const batchBalance = batchStockMap.get(`${item.itemId}:${item.batchNumber}`);
          if (batchBalance) {
            const batchAvailable =
              Number(batchBalance.quantity) - Number(batchBalance.reservedQuantity);
            if (batchAvailable < item.quantity) {
              throw new BadRequestException(
                `Insufficient batch stock for ${inventoryItem.name} batch ${item.batchNumber}. Available: ${batchAvailable}, Requested: ${item.quantity}`,
              );
            }
            batchBalance.quantity = Number(batchBalance.quantity) - item.quantity;
            await batchStockRepo.save(batchBalance);
          }
        }

        // Stock ledger entry in same transaction as balance updates
        await stockLedgerRepo.save(
          stockLedgerRepo.create({
            itemId: item.itemId,
            movementType: MovementType.SALE,
            quantity: -item.quantity,
            balanceAfter: newBalance,
            batchNumber: item.batchNumber,
            referenceType: 'pharmacy_sale',
            referenceId: sale.id,
            notes: `POS Sale: ${sale.saleNumber}`,
            createdById: userId,
            facilityId: facilityId,
            ...(tenantId ? { tenantId } : {}),
          }),
        );
      }

      // Sale status update in same transaction as stock updates
      sale.amountPaid = dto.amountPaid;
      sale.paymentMethod = dto.paymentMethod || sale.paymentMethod;
      if (dto.transactionReference) {
        sale.transactionReference = dto.transactionReference;
      }
      sale.status = SaleStatus.COMPLETED;
      await manager.getRepository(PharmacySale).save(sale);

      // C2: Mark prescription items as dispensed (within same transaction).
      // Each sale item may carry prescriptionItemId linking it to a specific Rx line.
      // Lock the prescription_item row to prevent two concurrent sales from each
      // reading qty=0, both dispensing N, and both writing qty=N (over-dispense).
      if (sale.prescriptionId) {
        const prescRxItems = sale.items.filter((si) => si.prescriptionItemId);
        for (const si of prescRxItems) {
          const rxItem = await manager.findOne(PrescriptionItem, {
            where: { id: si.prescriptionItemId },
            lock: { mode: 'pessimistic_write' },
          });
          if (rxItem) {
            const requested = Number(si.quantity);
            if (rxItem.quantityDispensed + requested > rxItem.quantity) {
              throw new BadRequestException(
                `Dispense exceeds prescribed quantity for item ${rxItem.id}: prescribed=${rxItem.quantity}, already dispensed=${rxItem.quantityDispensed}, requested=${requested}.`,
              );
            }
            rxItem.quantityDispensed = rxItem.quantityDispensed + requested;
            rxItem.isDispensed = rxItem.quantityDispensed >= rxItem.quantity;
            await manager.save(PrescriptionItem, rxItem);
          }
        }
        // Update prescription-level status
        const prescRepo = manager.getRepository(Prescription);
        const prescription = await prescRepo.findOne({
          where: { id: sale.prescriptionId },
          relations: ['items'],
        });
        if (prescription) {
          const allItems = prescription.items;
          const allDone = allItems.every((i) => i.isDispensed);
          const anyDone = allItems.some((i) => i.quantityDispensed > 0);
          if (allDone) {
            prescription.status = PrescriptionStatus.DISPENSED;
            prescription.dispensedAt = new Date();
          } else if (anyDone) {
            prescription.status = PrescriptionStatus.PARTIALLY_DISPENSED;
          }
          await prescRepo.save(prescription);
        }
      }

      // Auto-post GL entry within the same transaction: DR Cash/Bank, CR Pharmacy Revenue
      const facilityIdForGL = sale.store?.facilityId;
      if (facilityIdForGL) {
        try {
          await this.financeService.autoPostPharmacySaleJournal(
            {
              facilityId: facilityIdForGL,
              saleNumber: sale.saleNumber,
              totalAmount: Number(sale.totalAmount) || 0,
              paymentMethod: dto.paymentMethod || sale.paymentMethod || 'cash',
              userId,
            },
            tenantId,
          );
        } catch (err) {
          this.logger.error(
            `GL auto-post failed for sale ${sale.saleNumber}: ${err.message}`,
            err.stack,
          );
        }
      }

      // POS shift recording — for retail-counter sales, record the payment splits
      // against the shift and bump cached totals. This is what X/Z reports read from.
      if (sale.saleChannel === SaleChannel.RETAIL_POS && sale.posShiftId) {
        const splits =
          dto.paymentSplits && dto.paymentSplits.length > 0
            ? dto.paymentSplits
            : [
                {
                  paymentMethod: dto.paymentMethod || sale.paymentMethod || 'cash',
                  amount: Number(sale.totalAmount),
                  transactionReference: dto.transactionReference || sale.transactionReference,
                },
              ];
        // Re-lock the shift inside this tx (assertOpenShift returns the locked row).
        const lockedShift = await this.posShiftGuard.assertOpenShift(
          manager,
          sale.posShiftId,
          tenantId!,
          userId,
        );
        await this.posShiftGuard.recordSale(manager, {
          shift: lockedShift,
          saleId: sale.id,
          tenantId: tenantId!,
          paymentMethod: splits[0].paymentMethod,
          amount: splits[0].amount,
          transactionReference: splits[0].transactionReference,
          splits,
        });
      }

      // EFRIS — enqueue an invoice document into the outbox for the async worker
      // to submit to URA. Skip for legacy sales and when the tenant has not
      // enabled EFRIS submission.
      try {
        const cfg = tenantId ? await this.efrisService.getConfig(tenantId) : null;
        if (cfg?.isEnabled && cfg?.submitOnCompletion && sale.saleChannel !== SaleChannel.LEGACY) {
          const payload = this.efrisService.buildInvoicePayload(sale, sale.items, cfg);
          await this.efrisService.enqueueDocument(
            manager,
            {
              tenantId: tenantId!,
              saleId: sale.id,
              documentType: EfrisDocumentType.INVOICE,
              payload,
            },
            `sale:${sale.id}:invoice`,
          );
        }
      } catch (err) {
        // Never let EFRIS enqueue failure roll back a completed dispense.
        this.logger.error(
          `EFRIS enqueue failed for sale ${sale.saleNumber}: ${err.message}`,
          err.stack,
        );
      }

      return { alreadyCompleted: false as const, sale };
    });

    // Already-completed idempotent return: skip event/retail-upsert/etc.
    if (txnResult.alreadyCompleted) {
      return this.findSale(id, tenantId);
    }
    const sale = txnResult.sale;

    // After-commit: notify async listeners (SMS receipt, analytics, etc.).
    this.eventEmitter.emit('pharmacy.sale.completed', {
      saleId: id,
      tenantId,
      userId,
      channel: sale.saleChannel,
      customerPhone: sale.customerPhone,
      customerName: sale.customerName,
      totalAmount: Number(sale.totalAmount),
    });

    // Revenue integrity: bridge pharmacy sale items to encounter invoice
    if (sale.encounterId && sale.patientId && this.billingService) {
      const saleItems = await this.saleItemRepo.find({ where: { saleId: sale.id } });
      for (const item of saleItems) {
        try {
          await this.billingService.addBillableItem(
            {
              encounterId: sale.encounterId,
              patientId: sale.patientId,
              serviceCode: item.itemCode,
              description: item.itemName,
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice),
              chargeType: 'pharmacy',
              referenceType: 'pharmacy_sale_item',
              referenceId: item.id,
            },
            userId,
            tenantId,
          );
        } catch (err) {
          // Non-blocking: sale is already completed (GL journal posted).
          // addBillableItem is idempotent (referenceType+referenceId dedup).
          this.logger.warn(
            `Failed to bridge pharmacy item ${item.id} to encounter invoice: ${err.message}`,
          );
        }
      }
    }

    // B8: upsert retail customer record (fire-and-forget)
    if (sale.customerPhone && tenantId) {
      this.retailCustomerRepo
        .findOne({ where: { phone: sale.customerPhone, tenantId } })
        .then((customer) => {
          const now = new Date();
          if (customer) {
            customer.totalVisits += 1;
            customer.totalSpend = Number(customer.totalSpend) + Number(sale.totalAmount);
            customer.lastSeenAt = now;
            if (sale.customerName && !customer.name) customer.name = sale.customerName;
            return this.retailCustomerRepo.save(customer);
          } else {
            return this.retailCustomerRepo.save(
              this.retailCustomerRepo.create({
                phone: sale.customerPhone!,
                name: sale.customerName,
                totalVisits: 1,
                totalSpend: Number(sale.totalAmount),
                firstSeenAt: now,
                lastSeenAt: now,
                tenantId,
              }),
            );
          }
        })
        .catch((err) => this.logger.warn(`RetailCustomer upsert failed: ${err.message}`));
    }

    return this.findSale(id, tenantId);
  }

  async cancelSale(id: string, userId: string, reason?: string, tenantId?: string) {
    return this.dataSource.transaction(async (manager) => {
      const saleRepo = manager.getRepository(PharmacySale);
      const sale = await saleRepo.findOne({
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!sale) throw new NotFoundException('Sale not found');

      if (sale.status === SaleStatus.COMPLETED) {
        throw new BadRequestException(
          'Cannot cancel a completed sale. Use refund endpoint for completed sales.',
        );
      }
      if (sale.status === SaleStatus.CANCELLED) {
        return sale; // idempotent
      }

      const oldStatus = sale.status;
      sale.status = SaleStatus.CANCELLED;
      sale.voidedById = userId;
      sale.voidedAt = new Date();
      if (reason) sale.voidReason = reason;
      const saved = await saleRepo.save(sale);

      // H1: audit log on cancellation
      const auditRepo = manager.getRepository(AuditLog);
      await auditRepo
        .save(
          auditRepo.create({
            action: 'SALE_CANCELLED',
            entityType: 'PharmacySale',
            entityId: id,
            userId,
            oldValue: { status: oldStatus },
            newValue: { status: SaleStatus.CANCELLED, reason: reason || null },
            ...(tenantId ? { tenantId } : {}),
          }),
        )
        .catch((err) =>
          this.logger.error(`Audit log failed for sale cancel ${id}: ${err.message}`),
        );

      return saved;
    });
  }

  async getDailySummary(storeId?: string, date?: string, facilityId?: string, tenantId?: string) {
    // H6: Require tenantId to prevent data leak across tenants
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for daily summary queries');
    }

    const parsedDate = date ? new Date(date) : new Date();
    const start = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const qb = this.saleRepo
      .createQueryBuilder('s')
      .leftJoin('s.store', 'store')
      .select([
        'COUNT(*) as "totalSales"',
        'COALESCE(SUM(s.totalAmount), 0) as "totalRevenue"',
        'COALESCE(SUM(s.discountAmount), 0) as "totalDiscounts"',
        'COALESCE(SUM(CASE WHEN s.paymentMethod = \'cash\' THEN s.amountPaid ELSE 0 END), 0) as "cashTotal"',
        'COALESCE(SUM(CASE WHEN s.paymentMethod = \'mobile_money\' THEN s.amountPaid ELSE 0 END), 0) as "mobileTotal"',
        'COALESCE(SUM(CASE WHEN s.paymentMethod = \'card\' THEN s.amountPaid ELSE 0 END), 0) as "cardTotal"',
        'COALESCE(SUM(CASE WHEN s.paymentMethod = \'insurance\' THEN s.amountPaid ELSE 0 END), 0) as "insuranceTotal"',
        'COALESCE(SUM(CASE WHEN s.saleType = \'prescription\' THEN s.totalAmount ELSE 0 END), 0) as "prescriptionRevenue"',
        'COALESCE(SUM(CASE WHEN s.saleType = \'otc\' THEN s.totalAmount ELSE 0 END), 0) as "otcRevenue"',
        'COALESCE(SUM(CASE WHEN s.saleType = \'wholesale\' THEN s.totalAmount ELSE 0 END), 0) as "wholesaleRevenue"',
      ])
      .where('s.status = :status', { status: SaleStatus.COMPLETED })
      .andWhere('s.createdAt BETWEEN :start AND :end', { start, end });

    if (storeId) {
      qb.andWhere('s.storeId = :storeId', { storeId });
    } else if (facilityId) {
      qb.andWhere('store.facilityId = :facilityId', { facilityId });
    }

    if (tenantId) {
      qb.andWhere('s.tenant_id = :tenantId', { tenantId });
    }

    const result = await qb.getRawOne();
    return { ...result, date: start.toISOString().slice(0, 10) };
  }

  async getProfitAnalytics(params: {
    storeId?: string;
    facilityId?: string;
    dateFrom?: string;
    dateTo?: string;
    tenantId?: string;
  }) {
    const { storeId, facilityId, dateFrom, dateTo, tenantId } = params;

    // Base query: join sale items with inventory items to get unit cost
    const qb = this.saleItemRepo
      .createQueryBuilder('si')
      .innerJoin(PharmacySale, 's', 's.id = si.sale_id')
      .innerJoin(Item, 'item', 'item.id = si.item_id::uuid')
      .leftJoin('s.store', 'store')
      .where('s.status = :status', { status: SaleStatus.COMPLETED });

    if (storeId) {
      qb.andWhere('s.store_id = :storeId', { storeId });
    } else if (facilityId) {
      qb.andWhere('store.facility_id = :facilityId', { facilityId });
    }

    if (tenantId) {
      qb.andWhere('s.tenant_id = :tenantId', { tenantId });
    }

    if (dateFrom) {
      qb.andWhere('s.created_at >= :dateFrom', { dateFrom: new Date(dateFrom) });
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setDate(end.getDate() + 1);
      qb.andWhere('s.created_at < :dateTo', { dateTo: end });
    }

    // Summary metrics
    const summaryQb = qb
      .clone()
      .select([
        'COALESCE(SUM(si.quantity * si.unit_price), 0) as "totalRevenue"',
        'COALESCE(SUM(si.quantity * item.unit_cost), 0) as "totalCOGS"',
        'COALESCE(SUM(si.quantity * (si.unit_price - item.unit_cost)), 0) as "totalProfit"',
        'COUNT(DISTINCT s.id) as "totalTransactions"',
      ]);
    const summary = await summaryQb.getRawOne();

    const totalRevenue = Number(summary?.totalRevenue || 0);
    const totalCOGS = Number(summary?.totalCOGS || 0);
    const totalProfit = Number(summary?.totalProfit || 0);
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Per-item profit breakdown (top 20 by profit)
    const itemProfitQb = qb
      .clone()
      .select([
        'si.item_id as "itemId"',
        'si.item_name as "itemName"',
        'SUM(si.quantity) as "quantitySold"',
        'COALESCE(AVG(item.unit_cost), 0) as "avgCost"',
        'COALESCE(AVG(si.unit_price), 0) as "avgSellPrice"',
        'COALESCE(SUM(si.quantity * si.unit_price), 0) as "revenue"',
        'COALESCE(SUM(si.quantity * item.unit_cost), 0) as "cogs"',
        'COALESCE(SUM(si.quantity * (si.unit_price - item.unit_cost)), 0) as "profit"',
      ])
      .groupBy('si.item_id')
      .addGroupBy('si.item_name')
      .orderBy('"profit"', 'DESC')
      .limit(20);
    const itemProfits = await itemProfitQb.getRawMany();

    // Daily profit trend
    const dailyQb = qb
      .clone()
      .select([
        'TO_CHAR(s.created_at, \'YYYY-MM-DD\') as "date"',
        'COALESCE(SUM(si.quantity * si.unit_price), 0) as "revenue"',
        'COALESCE(SUM(si.quantity * item.unit_cost), 0) as "cogs"',
        'COALESCE(SUM(si.quantity * (si.unit_price - item.unit_cost)), 0) as "profit"',
      ])
      .groupBy("TO_CHAR(s.created_at, 'YYYY-MM-DD')")
      .orderBy('"date"', 'ASC');
    const dailyTrend = await dailyQb.getRawMany();

    return {
      summary: {
        totalRevenue,
        totalCOGS,
        totalProfit,
        profitMargin: Number(profitMargin.toFixed(2)),
        totalTransactions: Number(summary?.totalTransactions || 0),
      },
      itemProfits: itemProfits.map((ip) => ({
        itemId: ip.itemId,
        itemName: ip.itemName,
        quantitySold: Number(ip.quantitySold),
        avgCost: Number(Number(ip.avgCost).toFixed(2)),
        avgSellPrice: Number(Number(ip.avgSellPrice).toFixed(2)),
        revenue: Number(ip.revenue),
        cogs: Number(ip.cogs),
        profit: Number(ip.profit),
        margin:
          Number(ip.revenue) > 0
            ? Number(((Number(ip.profit) / Number(ip.revenue)) * 100).toFixed(2))
            : 0,
      })),
      dailyTrend: dailyTrend.map((d) => ({
        date: d.date,
        revenue: Number(d.revenue),
        cogs: Number(d.cogs),
        profit: Number(d.profit),
      })),
    };
  }

  // ── Batch Stock (FEFO) Methods ────────────────────────────────────────

  async getBatchStock(itemId: string, facilityId: string, tenantId?: string) {
    const where: any = {
      itemId,
      facilityId,
      status: In(['active', 'quarantined']),
    };
    if (tenantId) where.tenantId = tenantId;

    const batches = await this.batchStockRepo.find({
      where,
      order: { expiryDate: 'ASC' },
      relations: ['item'],
      take: 500,
    });

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    return batches.map((batch) => {
      const expiryDate = new Date(batch.expiryDate);
      const isExpired = expiryDate < now;
      const isNearExpiry = !isExpired && expiryDate <= thirtyDaysFromNow;
      const availableQuantity = Number(batch.quantity) - Number(batch.reservedQuantity);

      return {
        ...batch,
        quantity: Number(batch.quantity),
        reservedQuantity: Number(batch.reservedQuantity),
        availableQuantity,
        isExpired,
        isNearExpiry,
      };
    });
  }

  async allocateFEFO(dto: AllocateFEFODto, tenantId?: string) {
    const { itemId, facilityId, quantity, storeId } = dto;

    const where: any = {
      itemId,
      facilityId,
      status: 'active',
    };
    if (tenantId) where.tenantId = tenantId;
    if (storeId) where.storeId = storeId;

    // FEFO: earliest expiry first
    const batches = await this.batchStockRepo.find({
      where,
      order: { expiryDate: 'ASC' },
    });

    let remaining = quantity;
    const allocations: {
      batchId: string;
      batchNumber: string;
      expiryDate: Date;
      allocatedQuantity: number;
    }[] = [];

    for (const batch of batches) {
      if (remaining <= 0) break;

      const available = Number(batch.quantity) - Number(batch.reservedQuantity);
      if (available <= 0) continue;

      const toAllocate = Math.min(available, remaining);
      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        allocatedQuantity: toAllocate,
      });
      remaining -= toAllocate;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        `Insufficient batch stock. Requested: ${quantity}, available across batches: ${quantity - remaining}`,
      );
    }

    return {
      itemId,
      facilityId,
      requestedQuantity: quantity,
      allocations,
      totalAllocated: allocations.reduce((sum, a) => sum + a.allocatedQuantity, 0),
    };
  }

  async receiveBatch(dto: ReceiveBatchDto, tenantId?: string, userId?: string) {
    const { itemId, facilityId, batchNumber, expiryDate, quantity, storeId } = dto;

    // P1: validate input BEFORE doing DB lookups so a clearly-bad request
    // (past expiry, zero quantity) fails fast and uniformly regardless of
    // whether the item happens to exist.
    const parsedExpiry = new Date(expiryDate);
    if (Number.isNaN(parsedExpiry.getTime())) {
      throw new BadRequestException('expiryDate is not a valid date');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsedExpiry < today) {
      throw new BadRequestException(
        `Cannot receive stock with a past expiry date (${parsedExpiry.toISOString().slice(0, 10)}). Expired stock requires the remediation workflow.`,
      );
    }
    if (quantity <= 0) {
      throw new BadRequestException('Receive quantity must be positive');
    }

    // Validate item exists
    const itemWhere: any = { id: itemId };
    if (tenantId) itemWhere.tenantId = tenantId;
    const item = await this.inventoryRepo.findOne({ where: itemWhere });
    if (!item) {
      throw new NotFoundException('Item not found');
    }

    // Audit Phase 2.4 — previously this method ONLY wrote batch_stock_balances,
    // bypassing stock_ledger + stock_balances. That caused silent inventory drift
    // because pharmacy receipts weren't visible to inventory low-stock / movement
    // queries. Now we write all three inside one transaction via the canonical
    // InventoryService.applyStockMovement primitive.
    //
    // P1: re-receipt of an expired-batch row is only allowed if the NEW
    // expiry is in the future (already enforced by the guard above); the
    // explicit comparison below preserves the previous reactivation
    // semantics for the in-window case.

    return this.dataSource.transaction(async (manager) => {
      const batchRepo = manager.getRepository(BatchStockBalance);

      const existingWhere: any = { itemId, facilityId, batchNumber };
      if (tenantId) existingWhere.tenantId = tenantId;
      if (storeId) existingWhere.storeId = storeId;
      const existing = await batchRepo.findOne({
        where: existingWhere,
        lock: { mode: 'pessimistic_write' },
      });

      let batch: BatchStockBalance;
      if (existing) {
        existing.quantity = Number(existing.quantity) + quantity;
        if (existing.status === 'expired') {
          // Re-receipt of an expired-batch row is only allowed if the NEW
          // expiry is in the future; the past-date guard above already
          // enforces this, but keep the explicit comparison so the
          // reactivation intent is local & readable.
          if (parsedExpiry > existing.expiryDate) {
            existing.expiryDate = parsedExpiry;
          }
          existing.status = 'active';
        }
        batch = await batchRepo.save(existing);
      } else {
        const created = batchRepo.create({
          itemId,
          facilityId,
          storeId: storeId || undefined,
          batchNumber,
          expiryDate: parsedExpiry,
          quantity,
          reservedQuantity: 0,
          status: 'active',
          ...(tenantId ? { tenantId } : {}),
        });
        batch = await batchRepo.save(created);
      }

      // Mirror into inventory ledger + balance so pharmacy receipts are visible
      // to /inventory/* and /stores/* low-stock and movement reports.
      await this.inventoryService.applyStockMovement(manager, {
        itemId,
        facilityId,
        storeId: storeId || null,
        signedQuantity: quantity,
        movementType: MovementType.PURCHASE,
        batchNumber,
        expiryDate,
        unitCost: Number(item.unitCost) || 0,
        referenceType: 'pharmacy_batch_receive',
        referenceId: batch.id,
        notes: `Pharmacy batch receive: ${batchNumber}`,
        userId,
        tenantId,
      });

      // Audit log for every batch receipt
      const auditRepoGeneric = manager.getRepository(AuditLog);
      await auditRepoGeneric
        .save(
          auditRepoGeneric.create({
            action: 'BATCH_RECEIVED',
            entityType: 'BatchStockBalance',
            entityId: batch.id,
            userId,
            newValue: {
              itemId,
              itemName: item.name,
              batchNumber,
              quantity,
              facilityId,
              expiryDate: parsedExpiry.toISOString().slice(0, 10),
            },
            ...(tenantId ? { tenantId } : {}),
          }),
        )
        .catch((err) =>
          this.logger.error(`Batch receive audit failed for batch ${batch.id}: ${err.message}`),
        );

      // P1: controlled-substance receipt audit. Narcotics inspectors require a
      // chain-of-custody record from receipt → dispense; we already log
      // dispenses to controlled_substance_logs, but until now receipts left no
      // structured trail. Write to the generic audit_logs table (no schema
      // change) keyed by the batch id so reconciliation reports can join.
      if (item.isControlled) {
        const classification = await manager.findOne(DrugClassification, {
          where: { itemId, ...(tenantId ? { tenantId } : {}) },
        });
        const schedule = classification?.schedule || null;
        const auditRepo = manager.getRepository(AuditLog);
        await auditRepo
          .save(
            auditRepo.create({
              action: 'CONTROLLED_SUBSTANCE_RECEIVED',
              entityType: 'BatchStockBalance',
              entityId: batch.id,
              userId,
              newValue: {
                itemId,
                itemCode: item.code,
                itemName: item.name,
                schedule,
                facilityId,
                storeId: storeId || null,
                batchNumber,
                quantity,
                expiryDate: parsedExpiry.toISOString().slice(0, 10),
                unitCost: Number(item.unitCost) || 0,
              },
              ...(tenantId ? { tenantId } : {}),
            }),
          )
          .catch((err) =>
            this.logger.error(
              `Controlled-substance receipt audit failed for batch ${batch.id}: ${err.message}`,
            ),
          );
        this.logger.warn(
          `CONTROLLED SUBSTANCE RECEIVED: item=${item.name}, schedule=${schedule || 'unclassified'}, batch=${batchNumber}, qty=${quantity}, user=${userId}, facility=${facilityId}`,
        );
      }

      return batch;
    });
  }

  // ── Low-Stock Reorder Alerts ──────────────────────────────────────────

  async checkLowStock(tenantId: string, facilityId: string) {
    const results = await this.stockBalanceRepo
      .createQueryBuilder('sb')
      .innerJoinAndSelect('sb.item', 'item')
      .where('item.deletedAt IS NULL')
      .andWhere('item.status = :status', { status: 'active' })
      .andWhere('sb.facilityId = :facilityId', { facilityId })
      .andWhere('sb.totalQuantity <= item.reorderLevel')
      .andWhere('sb.tenantId = :tenantId', { tenantId })
      .orderBy('sb.totalQuantity', 'ASC')
      .getMany();

    return results.map((sb) => ({
      item: {
        id: sb.item.id,
        code: sb.item.code,
        name: sb.item.name,
        genericName: sb.item.genericName,
        unit: sb.item.unit,
        reorderLevel: sb.item.reorderLevel,
        maxStockLevel: sb.item.maxStockLevel,
      },
      currentQuantity: sb.totalQuantity,
      reorderLevel: sb.item.reorderLevel,
      deficit: sb.item.reorderLevel - sb.totalQuantity,
    }));
  }

  // ── Expiry Workflow Methods ───────────────────────────────────────────

  async checkExpiringItems(tenantId: string, facilityId: string, daysThreshold = 90) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const results = await this.movementRepo
      .createQueryBuilder('sl')
      .innerJoinAndSelect('sl.item', 'item')
      .where('item.deletedAt IS NULL')
      .andWhere('item.requiresExpiryTracking = true')
      .andWhere('sl.facilityId = :facilityId', { facilityId })
      .andWhere('sl.tenantId = :tenantId', { tenantId })
      .andWhere('sl.expiryDate IS NOT NULL')
      .andWhere('sl.expiryDate <= :thresholdDate', { thresholdDate })
      .andWhere('sl.expiryDate >= CURRENT_DATE')
      .select([
        'sl.itemId AS "itemId"',
        'item.name AS "itemName"',
        'item.code AS "itemCode"',
        'item.genericName AS "genericName"',
        'sl.batchNumber AS "batchNumber"',
        'sl.expiryDate AS "expiryDate"',
        'SUM(sl.quantity) AS "quantity"',
      ])
      .groupBy('sl.itemId')
      .addGroupBy('item.name')
      .addGroupBy('item.code')
      .addGroupBy('item.genericName')
      .addGroupBy('sl.batchNumber')
      .addGroupBy('sl.expiryDate')
      .having('SUM(sl.quantity) > 0')
      .orderBy('sl.expiryDate', 'ASC')
      .getRawMany();

    const now = new Date();
    return results.map((r) => {
      const expiryDate = new Date(r.expiryDate);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        itemId: r.itemId,
        itemName: r.itemName,
        itemCode: r.itemCode,
        genericName: r.genericName,
        batchNumber: r.batchNumber,
        expiryDate: r.expiryDate,
        quantity: Number(r.quantity),
        daysUntilExpiry,
      };
    });
  }

  async quarantineItem(
    itemId: string,
    batchNumber: string | undefined,
    tenantId: string,
    facilityId: string,
    userId: string,
    notes?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const expiryAlertRepo = manager.getRepository(ExpiryAlert);

      // Check for existing active alert for same item+batch
      const where: any = { itemId, facilityId, tenantId, status: ExpiryAlertStatus.NEAR_EXPIRY };
      if (batchNumber) where.batchNumber = batchNumber;

      let alert = await expiryAlertRepo.findOne({ where });

      if (alert) {
        alert.status = ExpiryAlertStatus.QUARANTINED;
        alert.actionTaken = 'quarantined';
        alert.actionDate = new Date();
        alert.actionBy = userId;
        if (notes) alert.notes = notes;

        const saved = await expiryAlertRepo.save(alert);

        // Mark batch as quarantined within the same transaction
        if (batchNumber) {
          const batchWhere: any = { itemId, facilityId, batchNumber };
          if (tenantId) batchWhere.tenantId = tenantId;
          await manager
            .getRepository(BatchStockBalance)
            .update(batchWhere, { status: 'quarantined' });
        }

        await manager.getRepository(AuditLog).save(
          manager.getRepository(AuditLog).create({
            action: 'BATCH_QUARANTINED',
            entityType: 'ExpiryAlert',
            entityId: saved.id,
            userId,
            newValue: { itemId, batchNumber, facilityId, notes },
            ...(tenantId ? { tenantId } : {}),
          }),
        );

        return saved;
      }

      // Create new expiry alert in quarantined state
      const item = await manager.getRepository(Item).findOne({ where: { id: itemId, tenantId } });
      if (!item) throw new NotFoundException('Item not found');

      // Get quantity from stock ledger
      const stockQuery = manager
        .getRepository(StockLedger)
        .createQueryBuilder('sl')
        .select('SUM(sl.quantity)', 'totalQty')
        .where('sl.itemId = :itemId', { itemId })
        .andWhere('sl.facilityId = :facilityId', { facilityId })
        .andWhere('sl.tenantId = :tenantId', { tenantId });
      if (batchNumber) stockQuery.andWhere('sl.batchNumber = :batchNumber', { batchNumber });
      const stockResult = await stockQuery.getRawOne();

      alert = expiryAlertRepo.create({
        itemId,
        batchNumber: batchNumber || undefined,
        expiryDate: new Date(),
        alertDate: new Date(),
        quantity: Number(stockResult?.totalQty || 0),
        status: ExpiryAlertStatus.QUARANTINED,
        actionTaken: 'quarantined',
        actionDate: new Date(),
        actionBy: userId,
        notes: notes || undefined,
        facilityId,
        tenantId,
      });

      const saved = await expiryAlertRepo.save(alert);

      // Mark batch as quarantined within the same transaction
      if (batchNumber) {
        const batchWhere: any = { itemId, facilityId, batchNumber };
        if (tenantId) batchWhere.tenantId = tenantId;
        await manager
          .getRepository(BatchStockBalance)
          .update(batchWhere, { status: 'quarantined' });
      }

      await manager.getRepository(AuditLog).save(
        manager.getRepository(AuditLog).create({
          action: 'BATCH_QUARANTINED',
          entityType: 'ExpiryAlert',
          entityId: saved.id,
          userId,
          newValue: { itemId, batchNumber, facilityId, notes },
          ...(tenantId ? { tenantId } : {}),
        }),
      );

      return saved;
    });
  }

  async processExpiredItem(
    itemId: string,
    action: 'dispose' | 'return',
    tenantId: string,
    facilityId: string,
    userId: string,
    batchNumber?: string,
    notes?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const expiryAlertRepo = manager.getRepository(ExpiryAlert);

      const where: any = {
        itemId,
        facilityId,
        tenantId,
        status: ExpiryAlertStatus.QUARANTINED,
      };
      if (batchNumber) where.batchNumber = batchNumber;

      const alert = await expiryAlertRepo.findOne({ where });
      if (!alert) throw new NotFoundException('No quarantined alert found for this item');

      const newStatus =
        action === 'dispose' ? ExpiryAlertStatus.DISPOSED : ExpiryAlertStatus.RETURNED;
      alert.status = newStatus;
      alert.actionTaken = action;
      alert.actionDate = new Date();
      alert.actionBy = userId;
      if (notes) alert.notes = notes;

      const saved = await expiryAlertRepo.save(alert);

      // Update batch status to expired (disposed/returned stock is no longer active)
      if (batchNumber) {
        const batchWhere: any = { itemId, facilityId, batchNumber };
        if (tenantId) batchWhere.tenantId = tenantId;
        await manager.getRepository(BatchStockBalance).update(batchWhere, { status: 'expired' });
      }

      await manager.getRepository(AuditLog).save(
        manager.getRepository(AuditLog).create({
          action: 'EXPIRED_ITEM_PROCESSED',
          entityType: 'ExpiryAlert',
          entityId: saved.id,
          userId,
          newValue: { itemId, batchNumber, facilityId, action, notes },
          ...(tenantId ? { tenantId } : {}),
        }),
      );

      return saved;
    });
  }

  async getExpiryReport(tenantId: string, facilityId: string) {
    const qb = this.expiryAlertRepo
      .createQueryBuilder('ea')
      .leftJoinAndSelect('ea.item', 'item')
      .where('ea.tenantId = :tenantId', { tenantId })
      .andWhere('ea.facilityId = :facilityId', { facilityId });

    const allAlerts = await qb.orderBy('ea.createdAt', 'DESC').getMany();

    const nearExpiry = allAlerts.filter((a) => a.status === ExpiryAlertStatus.NEAR_EXPIRY);
    const quarantined = allAlerts.filter((a) => a.status === ExpiryAlertStatus.QUARANTINED);
    const disposed = allAlerts.filter((a) => a.status === ExpiryAlertStatus.DISPOSED);
    const returned = allAlerts.filter((a) => a.status === ExpiryAlertStatus.RETURNED);

    return {
      summary: {
        nearExpiryCount: nearExpiry.length,
        quarantinedCount: quarantined.length,
        disposedCount: disposed.length,
        returnedCount: returned.length,
        totalAlerts: allAlerts.length,
      },
      nearExpiry,
      quarantined,
      disposed,
      returned,
    };
  }

  // ─── B5: Barcode Scan ─────────────────────────────────────────────────────

  async getItemByBarcode(barcode: string, tenantId?: string, facilityId?: string) {
    const item = await this.inventoryRepo
      .createQueryBuilder('i')
      .where('i.barcode = :barcode', { barcode })
      .andWhere(tenantId ? 'i.tenant_id = :tenantId' : '1=1', tenantId ? { tenantId } : {})
      .getOne();

    if (!item) {
      throw new (await import('@nestjs/common').then((m) => m.NotFoundException))(
        `No item found for barcode "${barcode}"`,
      );
    }

    let availableQty = 0;
    if (facilityId) {
      const sb = await this.stockBalanceRepo.findOne({
        where: { itemId: item.id, facilityId, ...(tenantId ? { tenantId } : {}) },
      });
      availableQty = sb ? Number(sb.availableQuantity) : 0;
    }

    return { ...item, availableQty };
  }

  // ─── B6: Receipt Reprint ──────────────────────────────────────────────────

  async getReceipt(
    saleId: string,
    options: { duplicate?: boolean },
    userId: string,
    tenantId?: string,
  ) {
    const sale = await this.findSale(saleId, tenantId);

    let reprintCount = 0;
    if (options.duplicate) {
      const existing = await this.reprintRepo.findOne({
        where: { saleId, ...(tenantId ? { tenantId } : {}) },
      });
      if (existing) {
        existing.reprintCount += 1;
        existing.reprintedAt = new Date();
        existing.reprintedById = userId;
        await this.reprintRepo.save(existing);
        reprintCount = existing.reprintCount;
      } else {
        const reprint = await this.reprintRepo.save(
          this.reprintRepo.create({
            saleId,
            reprintedById: userId,
            reprintCount: 1,
            reprintedAt: new Date(),
            ...(tenantId ? { tenantId } : {}),
          }),
        );
        reprintCount = reprint.reprintCount;
      }
    }

    return { sale, isDuplicate: !!options.duplicate, reprintCount };
  }

  async listReceiptHistory(
    tenantId: string,
    query: {
      from?: string;
      to?: string;
      cashierId?: string;
      saleNumber?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 50, 1), 200);
    const offset = (page - 1) * limit;

    const qb = this.saleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.soldBy', 'user')
      .leftJoinAndSelect('s.store', 'store')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.status = :status', { status: SaleStatus.COMPLETED })
      .orderBy('s.created_at', 'DESC')
      .skip(offset)
      .take(limit);

    if (query.from) qb.andWhere('s.created_at >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('s.created_at <= :to', { to: new Date(query.to) });
    if (query.cashierId) qb.andWhere('s.sold_by_id = :cashierId', { cashierId: query.cashierId });
    if (query.saleNumber) qb.andWhere('s.sale_number ILIKE :sn', { sn: `%${query.saleNumber}%` });

    const [sales, total] = await qb.getManyAndCount();

    const reprintMap = new Map<string, number>();
    if (sales.length > 0) {
      const reprints = await this.reprintRepo
        .createQueryBuilder('rp')
        .where('rp.sale_id IN (:...ids)', { ids: sales.map((s) => s.id) })
        .andWhere(tenantId ? 'rp.tenant_id = :tenantId' : '1=1', { tenantId })
        .getMany();
      for (const rp of reprints) {
        reprintMap.set(rp.saleId, rp.reprintCount);
      }
    }

    return {
      data: sales.map((s) => ({ ...s, reprintCount: reprintMap.get(s.id) || 0 })),
      total,
      page,
      limit,
    };
  }

  // ─── C1: Patient recent purchases ─────────────────────────────────────────

  /**
   * Returns the last N pharmacy sales for a given patient.
   * Used by the POS "link patient" side panel.
   */
  async getPatientRecentPurchases(patientId: string, tenantId: string, limit = 10) {
    const sales = await this.saleRepo.find({
      where: { patientId, tenantId, status: SaleStatus.COMPLETED },
      relations: ['items'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return sales.map((s) => ({
      id: s.id,
      saleNumber: s.saleNumber,
      date: s.createdAt,
      totalAmount: Number(s.totalAmount),
      itemCount: s.items?.length ?? 0,
      channel: s.saleChannel,
      paymentMethod: s.paymentMethod,
    }));
  }

  // ─── C3: Drug interaction check ────────────────────────────────────────────

  /**
   * Checks for drug-drug interactions for the given cart item IDs,
   * and optionally against a patient's recent active medications.
   *
   * Returns shape:
   * { warnings: [{ severity, drug1, drug2, mechanism, recommendation, requireOverride }] }
   */
  async checkInteractions(
    itemIds: string[],
    patientId?: string,
    tenantId?: string,
  ): Promise<{ warnings: InteractionWarning[] }> {
    if (!itemIds || itemIds.length === 0) return { warnings: [] };

    // Resolve item names
    const items = await this.inventoryRepo.findBy({ id: In(itemIds) });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    // Build list of all item IDs to check (cart + patient history)
    const historyItems: Array<{ id: string; name: string; source: 'history' }> = [];

    if (patientId && tenantId) {
      // Get patient's recently dispensed items (last 90 days)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const recentSales = await this.saleRepo.find({
        where: { patientId, tenantId, status: SaleStatus.COMPLETED },
        relations: ['items'],
        order: { createdAt: 'DESC' },
        take: 20,
      });

      const historyItemIds = new Set<string>();
      for (const sale of recentSales) {
        if (sale.createdAt < cutoff) continue;
        for (const si of sale.items ?? []) {
          if (!itemIds.includes(si.itemId) && !historyItemIds.has(si.itemId)) {
            historyItemIds.add(si.itemId);
            historyItems.push({ id: si.itemId, name: si.itemName, source: 'history' });
          }
        }
      }
    }

    const allCheckIds = [...new Set([...itemIds, ...historyItems.map((h) => h.id)])];
    if (allCheckIds.length < 2) return { warnings: [] };

    const warnings: InteractionWarning[] = [];

    // Batch-load all interactions for the drug set in a single query
    // instead of O(N²) per-pair lookups.
    const interactions = await this.drugInteractionRepo
      .createQueryBuilder('di')
      .where('di.drug_a_id IN (:...ids) AND di.drug_b_id IN (:...ids)', { ids: allCheckIds })
      .andWhere('di.is_active = true')
      .getMany();

    // Build a lookup set for fast pair matching
    const interactionMap = new Map<string, (typeof interactions)[0]>();
    for (const ix of interactions) {
      // Normalise key so (a,b) and (b,a) resolve to the same entry
      const k1 = `${ix.drugAId}:${ix.drugBId}`;
      const k2 = `${ix.drugBId}:${ix.drugAId}`;
      if (!interactionMap.has(k1)) interactionMap.set(k1, ix);
      if (!interactionMap.has(k2)) interactionMap.set(k2, ix);
    }

    for (let i = 0; i < allCheckIds.length - 1; i++) {
      for (let j = i + 1; j < allCheckIds.length; j++) {
        const aId = allCheckIds[i];
        const bId = allCheckIds[j];
        const interaction = interactionMap.get(`${aId}:${bId}`);

        if (interaction) {
          const drug1Item = itemMap.get(aId) ?? historyItems.find((h) => h.id === aId);
          const drug2Item = itemMap.get(bId) ?? historyItems.find((h) => h.id === bId);
          const drug2Source = itemIds.includes(bId) ? ('cart' as const) : ('history' as const);

          const severity =
            interaction.severity === 'contraindicated' ? 'severe' : interaction.severity;
          warnings.push({
            severity,
            drug1: { id: aId, name: (drug1Item as any)?.name ?? aId },
            drug2: { id: bId, name: (drug2Item as any)?.name ?? bId, source: drug2Source },
            mechanism: interaction.mechanism ?? interaction.description,
            recommendation: interaction.management ?? 'Review with prescriber',
            requireOverride: severity === 'severe' || interaction.severity === 'contraindicated',
          });
        }
      }
    }

    return { warnings };
  }

  /**
   * Records a drug-interaction override (manager PIN confirmed in frontend).
   */
  async recordInteractionOverride(dto: {
    saleId?: string;
    patientId?: string;
    warnings: InteractionWarning[];
    reason: string;
    overriddenById: string;
    managerApproverId?: string;
    tenantId?: string;
  }) {
    return this.ddiOverrideRepo.save(
      this.ddiOverrideRepo.create({
        saleId: dto.saleId,
        patientId: dto.patientId,
        warnings: dto.warnings as any,
        reason: dto.reason,
        overriddenById: dto.overriddenById,
        managerApproverId: dto.managerApproverId,
        tenantId: dto.tenantId,
      } as any),
    );
  }

  // ─── Controlled Substance Register & Reconciliation ──────────────────────

  /** List controlled substance logs (register) for a facility. */
  async getControlledRegister(opts: {
    facilityId: string;
    tenantId?: string;
    from?: string;
    to?: string;
    schedule?: string;
    limit: number;
    offset: number;
  }) {
    const qb = this.controlledLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.dispensedBy', 'dispensedBy')
      .leftJoinAndSelect('log.witness', 'witness')
      .where('log.facilityId = :facilityId', { facilityId: opts.facilityId });

    if (opts.tenantId) qb.andWhere('log.tenant_id = :tenantId', { tenantId: opts.tenantId });
    if (opts.from) qb.andWhere('log.createdAt >= :from', { from: opts.from });
    if (opts.to) qb.andWhere('log.createdAt <= :to', { to: opts.to });
    if (opts.schedule) qb.andWhere('log.drugSchedule = :schedule', { schedule: opts.schedule });

    const [data, total] = await qb
      .orderBy('log.createdAt', 'DESC')
      .skip(opts.offset)
      .take(opts.limit)
      .getManyAndCount();

    return { data, total, limit: opts.limit, offset: opts.offset };
  }

  /** Compare physical counts against system stock balance for controlled items. */
  async reconcileControlledSubstances(opts: {
    facilityId: string;
    tenantId?: string;
    userId: string;
    counts: { itemId: string; physicalCount: number }[];
    notes?: string;
  }) {
    const itemIds = opts.counts.map((c) => c.itemId);
    if (itemIds.length === 0) throw new BadRequestException('No items provided');

    return this.dataSource.transaction(async (manager) => {
      // Fetch controlled items with their system stock
      const itemQb = manager
        .getRepository(Item)
        .createQueryBuilder('i')
        .where('i.id IN (:...ids)', { ids: itemIds })
        .andWhere('i.isControlled = true');
      if (opts.tenantId) itemQb.andWhere('i.tenant_id = :tenantId', { tenantId: opts.tenantId });
      const items = await itemQb.getMany();

      const itemMap = new Map(items.map((i) => [i.id, i]));

      // Fetch system stock balances for these items at this facility (locked for consistency)
      const balQb = manager
        .getRepository(StockBalance)
        .createQueryBuilder('sb')
        .setLock('pessimistic_read')
        .where('sb.itemId IN (:...ids)', { ids: itemIds })
        .andWhere('sb.facilityId = :facilityId', { facilityId: opts.facilityId });
      if (opts.tenantId) balQb.andWhere('sb.tenant_id = :tenantId', { tenantId: opts.tenantId });
      const balances = await balQb.getMany();
      const balanceMap = new Map(balances.map((b) => [b.itemId, Number(b.totalQuantity)]));

      const variances: {
        itemId: string;
        itemName: string;
        systemBalance: number;
        physicalCount: number;
        variance: number;
        status: 'match' | 'shortage' | 'overage';
      }[] = [];

      for (const count of opts.counts) {
        const item = itemMap.get(count.itemId);
        if (!item) continue; // skip non-controlled or not-found

        const systemBalance = balanceMap.get(count.itemId) || 0;
        const variance = count.physicalCount - systemBalance;
        variances.push({
          itemId: count.itemId,
          itemName: item.name,
          systemBalance,
          physicalCount: count.physicalCount,
          variance,
          status: variance === 0 ? 'match' : variance < 0 ? 'shortage' : 'overage',
        });
      }

      // Log discrepancies to audit
      const discrepancies = variances.filter((v) => v.status !== 'match');
      if (discrepancies.length > 0) {
        const auditRepo = manager.getRepository(AuditLog);
        await auditRepo.save(
          auditRepo.create({
            action: 'CONTROLLED_SUBSTANCE_RECONCILED',
            entityType: 'controlled_substance_reconciliation',
            userId: opts.userId,
            ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
            newValue: {
              facilityId: opts.facilityId,
              notes: opts.notes,
              discrepancies,
              totalItems: variances.length,
              matchCount: variances.length - discrepancies.length,
            },
          }),
        );
        this.logger.warn(
          `Controlled substance reconciliation: ${discrepancies.length} discrepancies found at facility ${opts.facilityId}`,
        );
      }

      return {
        reconciledAt: new Date().toISOString(),
        facilityId: opts.facilityId,
        totalItems: variances.length,
        matches: variances.filter((v) => v.status === 'match').length,
        shortages: variances.filter((v) => v.status === 'shortage').length,
        overages: variances.filter((v) => v.status === 'overage').length,
        items: variances,
      };
    });
  }
}

export interface InteractionWarning {
  severity: string;
  drug1: { id: string; name: string };
  drug2: { id: string; name: string; source: 'cart' | 'history' };
  mechanism: string;
  recommendation: string;
  requireOverride: boolean;
}
