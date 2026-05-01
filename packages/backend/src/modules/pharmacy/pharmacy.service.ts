import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, DataSource, LessThanOrEqual, EntityManager } from 'typeorm';
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
import { Prescription, PrescriptionStatus } from '../../database/entities/prescription.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import {
  DrugClassification,
  DrugSchedule,
} from '../../database/entities/drug-classification.entity';
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
import { EfrisDocumentType } from '../../database/entities/pos-compliance.entity';
import { ReceiptReprint, RetailCustomer } from '../../database/entities/pos-retail.entity';

// Uganda standard VAT rate. Future: move to tenant tax_rates table (Phase B).
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

  constructor(
    @Inject(forwardRef(() => FinanceService))
    private financeService: FinanceService,
    @InjectRepository(PharmacySale) private saleRepo: Repository<PharmacySale>,
    @InjectRepository(PharmacySaleItem) private saleItemRepo: Repository<PharmacySaleItem>,
    @InjectRepository(Item) private inventoryRepo: Repository<Item>,
    @InjectRepository(StockLedger) private movementRepo: Repository<StockLedger>,
    @InjectRepository(StockBalance) private stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(Prescription) private prescriptionRepo: Repository<Prescription>,
    @InjectRepository(BatchStockBalance) private batchStockRepo: Repository<BatchStockBalance>,
    @InjectRepository(ExpiryAlert) private expiryAlertRepo: Repository<ExpiryAlert>,
    @InjectRepository(AuditLog) private auditLogRepo: Repository<AuditLog>,
    @InjectRepository(DrugClassification)
    private drugClassRepo: Repository<DrugClassification>,
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
        throw new BadRequestException(
          'Retail POS sales require both posShiftId and posRegisterId',
        );
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
          await this.posShiftGuard.assertOpenShift(
            manager,
            dto.posShiftId!,
            tenantId!,
            userId,
          );
          await this.posShiftGuard.assertActiveRegister(
            manager,
            dto.posRegisterId!,
            tenantId!,
          );
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
          subtotal: Number(subtotalNet.toFixed(2)),
          discountAmount,
          taxAmount: Number(totalTax.toFixed(2)),
          totalAmount,
          notes: dto.notes,
          status: SaleStatus.PENDING,
          soldById: userId,
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
      .then((id) => this.findSale(id, tenantId));
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
      (sale as any).patient = patient;
    }
    if (!sale) throw new NotFoundException('Sale not found');
    const itemWhere: any = { saleId: id };
    if (tenantId) itemWhere.tenantId = tenantId;
    const items = await this.saleItemRepo.find({ where: itemWhere });
    return { ...sale, items };
  }

  async completeSale(id: string, dto: CompleteSaleDto, userId: string, tenantId?: string) {
    const sale = await this.findSale(id, tenantId);
    if (sale.status !== SaleStatus.PENDING) {
      throw new BadRequestException('Sale is not pending');
    }

    if (dto.amountPaid < Number(sale.totalAmount)) {
      throw new BadRequestException('Insufficient payment amount');
    }

    // Get facility ID from the sale's store
    const facilityId = sale.store?.facilityId;
    if (!facilityId) {
      throw new BadRequestException('Sale store does not have a facility assigned');
    }

    // Validate and deduct stock within a single transaction for full consistency
    await this.dataSource.transaction(async (manager) => {
      const inventoryRepo = manager.getRepository(Item);
      const stockBalanceRepo = manager.getRepository(StockBalance);
      const stockLedgerRepo = manager.getRepository(StockLedger);
      const batchStockRepo = manager.getRepository(BatchStockBalance);

      // FEFO auto-allocation: for any sale item without an explicit batchNumber,
      // pick the earliest-expiring batch that has enough available stock.
      // Manual batch selections are respected but expired batches are still rejected below.
      for (const item of sale.items as any[]) {
        if (item.batchNumber) continue;
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
          await this.saleItemRepo.update(
            { id: item.id },
            { batchNumber: chosen.batchNumber, expiryDate: chosen.expiryDate },
          );
        }
        // If no candidates, fall through; later validation will surface the stock issue.
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
          // National Drug Authority record-keeping rules.
          const buyer = dto.controlledSubstanceBuyer;
          if (!sale.prescriptionId && (!buyer || !buyer.buyerName || !buyer.buyerIdNumber)) {
            throw new BadRequestException(
              `Dispensing controlled substance "${inventoryItem.name}" without a prescription requires buyer name and ID number.`,
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
                prescriptionReference:
                  (item as any).prescriptionReference || sale.prescriptionId || null,
              },
              tenantId,
            }),
          );

          // Typed structured log for the controlled substance register.
          const ctrlLogRepo = manager.getRepository(ControlledSubstanceLog);
          await ctrlLogRepo.save(
            ctrlLogRepo.create({
              pharmacySaleItemId: (item as any).id,
              prescriptionItemId: (item as any).prescriptionItemId || null,
              drugScheduleAtSale: schedule,
              quantityDispensed: item.quantity,
              isOtcPermitted: !sale.prescriptionId,
              buyerName: buyer?.buyerName || sale.customerName || null,
              buyerIdType: buyer?.buyerIdType || null,
              buyerIdNumber: buyer?.buyerIdNumber || null,
              buyerPhone: buyer?.buyerPhone || sale.customerPhone || null,
              prescriberName: buyer?.prescriberName || null,
              prescriberLicense: buyer?.prescriberLicense || null,
              pharmacistId: userId,
              dispensedAt: new Date(),
              ...(tenantId ? { tenantId } : {}),
            } as any),
          );

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
        if (item.expiryDate && new Date(item.expiryDate) < new Date()) {
          throw new BadRequestException(
            `Item ${inventoryItem.name} batch ${item.batchNumber || 'N/A'} is expired. Expired stock cannot be sold.`,
          );
        }

        // Also validate expiry from database batch records, not just DTO
        if (item.batchNumber) {
          const batchRecord = batchStockMap.get(`${item.itemId}:${item.batchNumber}`);
          if (batchRecord && new Date(batchRecord.expiryDate) < new Date()) {
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
        const splits = (dto.paymentSplits && dto.paymentSplits.length > 0)
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
        if (
          cfg?.isEnabled &&
          cfg?.submitOnCompletion &&
          sale.saleChannel !== SaleChannel.LEGACY
        ) {
          const payload = this.efrisService.buildInvoicePayload(sale, sale.items as any[], cfg);
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
    });

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

    // B8: upsert retail customer record (fire-and-forget)
    if (sale.customerPhone && tenantId) {
      this.retailCustomerRepo.findOne({ where: { phone: sale.customerPhone, tenantId } })
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

  async cancelSale(id: string, tenantId?: string) {
    const sale = await this.findSale(id, tenantId);
    if (sale.status === SaleStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed sale');
    }
    sale.status = SaleStatus.CANCELLED;
    return this.saleRepo.save(sale);
  }

  async getDailySummary(storeId?: string, date?: string, facilityId?: string, tenantId?: string) {
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

  async receiveBatch(dto: ReceiveBatchDto, tenantId?: string) {
    const { itemId, facilityId, batchNumber, expiryDate, quantity, storeId } = dto;

    // Validate item exists
    const itemWhere: any = { id: itemId };
    if (tenantId) itemWhere.tenantId = tenantId;
    const item = await this.inventoryRepo.findOne({ where: itemWhere });
    if (!item) {
      throw new NotFoundException('Item not found');
    }

    // Check if batch already exists for this item+facility
    const existingWhere: any = { itemId, facilityId, batchNumber };
    if (tenantId) existingWhere.tenantId = tenantId;
    if (storeId) existingWhere.storeId = storeId;
    const existing = await this.batchStockRepo.findOne({ where: existingWhere });

    if (existing) {
      existing.quantity = Number(existing.quantity) + quantity;
      // Reactivate if previously expired/quarantined and receiving new stock
      if (existing.status === 'expired') {
        // Only update expiry if the new date is later than the existing one
        const newExpiry = new Date(expiryDate);
        if (newExpiry > existing.expiryDate) {
          existing.expiryDate = newExpiry;
        }
        existing.status = 'active';
      }
      return this.batchStockRepo.save(existing);
    }

    const batch = this.batchStockRepo.create({
      itemId,
      facilityId,
      storeId: storeId || undefined,
      batchNumber,
      expiryDate: new Date(expiryDate),
      quantity,
      reservedQuantity: 0,
      status: 'active',
      ...(tenantId ? { tenantId } : {}),
    });

    return this.batchStockRepo.save(batch);
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
    // Check for existing active alert for same item+batch
    const where: any = { itemId, facilityId, tenantId, status: ExpiryAlertStatus.NEAR_EXPIRY };
    if (batchNumber) where.batchNumber = batchNumber;

    let alert = await this.expiryAlertRepo.findOne({ where });

    if (alert) {
      alert.status = ExpiryAlertStatus.QUARANTINED;
      alert.actionTaken = 'quarantined';
      alert.actionDate = new Date();
      alert.actionBy = userId;
      if (notes) alert.notes = notes;
      return this.expiryAlertRepo.save(alert);
    }

    // Create new expiry alert in quarantined state
    const item = await this.inventoryRepo.findOne({ where: { id: itemId, tenantId } });
    if (!item) throw new NotFoundException('Item not found');

    // Get quantity from stock ledger
    const stockQuery = this.movementRepo
      .createQueryBuilder('sl')
      .select('SUM(sl.quantity)', 'totalQty')
      .where('sl.itemId = :itemId', { itemId })
      .andWhere('sl.facilityId = :facilityId', { facilityId })
      .andWhere('sl.tenantId = :tenantId', { tenantId });
    if (batchNumber) stockQuery.andWhere('sl.batchNumber = :batchNumber', { batchNumber });
    const stockResult = await stockQuery.getRawOne();

    alert = this.expiryAlertRepo.create({
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

    return this.expiryAlertRepo.save(alert);
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
    const where: any = {
      itemId,
      facilityId,
      tenantId,
      status: ExpiryAlertStatus.QUARANTINED,
    };
    if (batchNumber) where.batchNumber = batchNumber;

    const alert = await this.expiryAlertRepo.findOne({ where });
    if (!alert) throw new NotFoundException('No quarantined alert found for this item');

    alert.status = action === 'dispose' ? ExpiryAlertStatus.DISPOSED : ExpiryAlertStatus.RETURNED;
    alert.actionTaken = action;
    alert.actionDate = new Date();
    alert.actionBy = userId;
    if (notes) alert.notes = notes;

    return this.expiryAlertRepo.save(alert);
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
      const existing = await this.reprintRepo.findOne({ where: { saleId, ...(tenantId ? { tenantId } : {}) } });
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
    query: { from?: string; to?: string; cashierId?: string; saleNumber?: string },
  ) {
    const qb = this.saleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.soldBy', 'user')
      .leftJoinAndSelect('s.store', 'store')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.status = :status', { status: SaleStatus.COMPLETED })
      .orderBy('s.created_at', 'DESC')
      .take(200);

    if (query.from) qb.andWhere('s.created_at >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('s.created_at <= :to', { to: new Date(query.to) });
    if (query.cashierId) qb.andWhere('s.sold_by_id = :cashierId', { cashierId: query.cashierId });
    if (query.saleNumber) qb.andWhere('s.sale_number ILIKE :sn', { sn: `%${query.saleNumber}%` });

    const sales = await qb.getMany();

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

    return sales.map((s) => ({ ...s, reprintCount: reprintMap.get(s.id) || 0 }));
  }
}
