import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, DataSource, LessThanOrEqual } from 'typeorm';
import { PharmacySale, PharmacySaleItem, SaleStatus, SaleType } from '../../database/entities/pharmacy-sale.entity';
import { Item, StockLedger, StockBalance, MovementType, ExpiryAlert, ExpiryAlertStatus } from '../../database/entities/inventory.entity';
import { BatchStockBalance } from '../../database/entities/batch-stock.entity';
import { Prescription, PrescriptionStatus } from '../../database/entities/prescription.entity';
import { CreatePharmacySaleDto, CompleteSaleDto, AllocateFEFODto, ReceiveBatchDto } from './pharmacy.dto';
import { FinanceService } from '../finance/finance.service';

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
    private dataSource: DataSource,
  ) {}

  async getQueueStats(facilityId?: string, tenantId?: string): Promise<{ pending: number; dispensed: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count pending prescriptions
    const pendingQuery = this.prescriptionRepo
      .createQueryBuilder('p')
      .where('p.status IN (:...statuses)', { 
        statuses: [PrescriptionStatus.PENDING, PrescriptionStatus.PARTIALLY_DISPENSED] 
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
    const saleNumber = `POS-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Prevent duplicate dispensing of the same prescription
    if (dto.prescriptionId) {
      const existingSale = await this.saleRepo.findOne({
        where: { prescriptionId: dto.prescriptionId, status: SaleStatus.COMPLETED },
      });
      if (existingSale) {
        throw new BadRequestException(
          `Prescription ${dto.prescriptionId} has already been dispensed (Sale: ${existingSale.saleNumber})`,
        );
      }
    }

    // Validate all items have positive quantities and prices
    for (const item of dto.items) {
      if (item.quantity <= 0) {
        throw new BadRequestException(`Item "${item.itemName || item.itemCode}" must have quantity > 0`);
      }
      if (item.unitPrice < 0) {
        throw new BadRequestException(`Item "${item.itemName || item.itemCode}" cannot have a negative unit price`);
      }
      const discount = item.discountPercent || 0;
      if (discount < 0 || discount > 100) {
        throw new BadRequestException(`Discount for "${item.itemName || item.itemCode}" must be between 0 and 100%`);
      }
    }

    let subtotal = 0;
    for (const item of dto.items) {
      const discount = item.discountPercent || 0;
      const amount = item.quantity * item.unitPrice * (1 - discount / 100);
      subtotal += amount;
    }
    
    const discountAmount = dto.discountAmount || 0;
    const totalAmount = subtotal - discountAmount;

    const sale = this.saleRepo.create({
      saleNumber,
      storeId: dto.storeId,
      saleType: dto.saleType || SaleType.OTC,
      patientId: dto.patientId,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      prescriptionId: dto.prescriptionId,
      paymentMethod: dto.paymentMethod || 'cash',
      transactionReference: dto.transactionReference,
      subtotal,
      discountAmount,
      totalAmount,
      notes: dto.notes,
      status: SaleStatus.PENDING,
      soldById: userId,
      ...(tenantId ? { tenantId } : {}),
    });
    const saved = await this.saleRepo.save(sale);

    // Validate items are active and not prescription-only for OTC sales
    for (const item of dto.items) {
      if (item.itemId) {
        const drug = await this.inventoryRepo.findOne({ where: { id: item.itemId, ...(tenantId ? { tenantId } : {}) } });
        if (drug && drug.status !== 'active') {
          throw new BadRequestException(
            `${item.itemName || drug.name} is ${drug.status} and cannot be sold`
          );
        }
        if ((dto.saleType || SaleType.OTC) === SaleType.OTC && !dto.prescriptionId) {
          if (drug && (drug as any).requiresPrescription) {
            throw new BadRequestException(
              `${item.itemName || drug.name} requires a prescription and cannot be sold over-the-counter without one`
            );
          }
        }
      }
    }

    for (const item of dto.items) {
      const discount = item.discountPercent || 0;
      const amount = item.quantity * item.unitPrice * (1 - discount / 100);
      const saleItem = this.saleItemRepo.create({
        saleId: saved.id,
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        batchNumber: item.batchNumber || undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: discount,
        amount,
        instructions: item.instructions,
        ...(tenantId ? { tenantId } : {}),
      });
      if (item.expiryDate) {
        saleItem.expiryDate = new Date(item.expiryDate);
      }
      await this.saleItemRepo.save(saleItem);
    }

    return this.findSale(saved.id, tenantId);
  }

  async findAllSales(storeId?: string, status?: SaleStatus, date?: string, limit = 50, tenantId?: string) {
    const query = this.saleRepo.createQueryBuilder('s')
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
      const stockMap = new Map(allStockBalances.map(sb => [sb.itemId, sb]));

      // Lock batch stock balances upfront for items with batch numbers
      const batchItems = sale.items.filter((i: any) => i.batchNumber);
      const batchStockMap = new Map<string, BatchStockBalance>();
      if (batchItems.length > 0) {
        const batchQuery = batchStockRepo.createQueryBuilder('bs')
          .setLock('pessimistic_write')
          .where('bs.facilityId = :facilityId', { facilityId })
          .orderBy('bs.itemId', 'ASC')
          .addOrderBy('bs.batchNumber', 'ASC');
        if (tenantId) {
          batchQuery.andWhere('bs.tenantId = :tenantId', { tenantId });
        }
        const orConditions = batchItems.map((_: any, idx: number) =>
          `(bs.itemId = :bItemId${idx} AND bs.batchNumber = :bBatch${idx})`
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

        // Block dispensing of expired stock (DTO-provided expiry)
        if (item.expiryDate && new Date(item.expiryDate) < new Date()) {
          throw new BadRequestException(
            `Item ${inventoryItem.name} batch ${item.batchNumber || 'N/A'} is expired. Expired stock cannot be sold.`
          );
        }

        // Also validate expiry from database batch records, not just DTO
        if (item.batchNumber) {
          const batchRecord = batchStockMap.get(`${item.itemId}:${item.batchNumber}`);
          if (batchRecord && new Date(batchRecord.expiryDate) < new Date()) {
            throw new BadRequestException(
              `Item ${inventoryItem.name} batch ${item.batchNumber} is expired according to database records. Expired stock cannot be sold.`
            );
          }
        }

        const stockBalance = stockMap.get(item.itemId);
        const availableQty = stockBalance?.availableQuantity || 0;

        if (availableQty < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${inventoryItem.name}. Available: ${availableQty}, Requested: ${item.quantity}`
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
            const batchAvailable = Number(batchBalance.quantity) - Number(batchBalance.reservedQuantity);
            if (batchAvailable < item.quantity) {
              throw new BadRequestException(
                `Insufficient batch stock for ${inventoryItem.name} batch ${item.batchNumber}. Available: ${batchAvailable}, Requested: ${item.quantity}`
              );
            }
            batchBalance.quantity = Number(batchBalance.quantity) - item.quantity;
            await batchStockRepo.save(batchBalance);
          }
        }

        // Stock ledger entry in same transaction as balance updates
        await stockLedgerRepo.save(stockLedgerRepo.create({
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
        }));
      }

      // Sale status update in same transaction as stock updates
      sale.amountPaid = dto.amountPaid;
      sale.paymentMethod = dto.paymentMethod || sale.paymentMethod;
      if (dto.transactionReference) {
        sale.transactionReference = dto.transactionReference;
      }
      sale.status = SaleStatus.COMPLETED;
      await manager.getRepository(PharmacySale).save(sale);
    });

    // Auto-post GL entry: DR Cash/Bank, CR Pharmacy Revenue
    const facilityIdForGL = sale.store?.facilityId;
    if (facilityIdForGL) {
      this.financeService.autoPostPharmacySaleJournal({
        facilityId: facilityIdForGL,
        saleNumber: sale.saleNumber,
        totalAmount: Number(sale.totalAmount) || 0,
        paymentMethod: dto.paymentMethod || sale.paymentMethod || 'cash',
        userId,
      }, tenantId).catch(err => this.logger.warn(`GL auto-post failed for sale ${sale.saleNumber}: ${err.message}`));
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

    const qb = this.saleRepo.createQueryBuilder('s')
      .leftJoin('s.store', 'store')
      .select([
        'COUNT(*) as "totalSales"',
        'COALESCE(SUM(s.totalAmount), 0) as "totalRevenue"',
        'COALESCE(SUM(s.discountAmount), 0) as "totalDiscounts"',
        "COALESCE(SUM(CASE WHEN s.paymentMethod = 'cash' THEN s.amountPaid ELSE 0 END), 0) as \"cashTotal\"",
        "COALESCE(SUM(CASE WHEN s.paymentMethod = 'mobile_money' THEN s.amountPaid ELSE 0 END), 0) as \"mobileTotal\"",
        "COALESCE(SUM(CASE WHEN s.paymentMethod = 'card' THEN s.amountPaid ELSE 0 END), 0) as \"cardTotal\"",
        "COALESCE(SUM(CASE WHEN s.paymentMethod = 'insurance' THEN s.amountPaid ELSE 0 END), 0) as \"insuranceTotal\"",
        "COALESCE(SUM(CASE WHEN s.saleType = 'prescription' THEN s.totalAmount ELSE 0 END), 0) as \"prescriptionRevenue\"",
        "COALESCE(SUM(CASE WHEN s.saleType = 'otc' THEN s.totalAmount ELSE 0 END), 0) as \"otcRevenue\"",
        "COALESCE(SUM(CASE WHEN s.saleType = 'wholesale' THEN s.totalAmount ELSE 0 END), 0) as \"wholesaleRevenue\"",
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
    const qb = this.saleItemRepo.createQueryBuilder('si')
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
    const summaryQb = qb.clone()
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
    const itemProfitQb = qb.clone()
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
    const dailyQb = qb.clone()
      .select([
        "TO_CHAR(s.created_at, 'YYYY-MM-DD') as \"date\"",
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
      itemProfits: itemProfits.map(ip => ({
        itemId: ip.itemId,
        itemName: ip.itemName,
        quantitySold: Number(ip.quantitySold),
        avgCost: Number(Number(ip.avgCost).toFixed(2)),
        avgSellPrice: Number(Number(ip.avgSellPrice).toFixed(2)),
        revenue: Number(ip.revenue),
        cogs: Number(ip.cogs),
        profit: Number(ip.profit),
        margin: Number(ip.revenue) > 0 ? Number(((Number(ip.profit) / Number(ip.revenue)) * 100).toFixed(2)) : 0,
      })),
      dailyTrend: dailyTrend.map(d => ({
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
    const allocations: { batchId: string; batchNumber: string; expiryDate: Date; allocatedQuantity: number }[] = [];

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
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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

  async quarantineItem(itemId: string, batchNumber: string | undefined, tenantId: string, facilityId: string, userId: string, notes?: string) {
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
}
