import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike, FindOptionsWhere, DataSource } from 'typeorm';
import {
  Item,
  StockLedger,
  StockBalance,
  MovementType,
} from '../../database/entities/inventory.entity';
import {
  CreateItemDto,
  UpdateItemDto,
  StockReceiveDto,
  StockAdjustmentDto,
  StockTransferDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    @InjectRepository(StockLedger)
    private stockLedgerRepository: Repository<StockLedger>,
    @InjectRepository(StockBalance)
    private stockBalanceRepository: Repository<StockBalance>,
    private dataSource: DataSource,
  ) {}

  // ============ ITEM MANAGEMENT ============

  async createItem(dto: CreateItemDto, tenantId?: string): Promise<Item> {
    const code = dto.code?.trim() || (await this.generateItemCode(dto.isDrug, tenantId));

    const existing = await this.itemRepository.findOne({
      where: { code, ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) {
      throw new BadRequestException(`Item with code ${code} already exists`);
    }

    const item = this.itemRepository.create({ ...dto, code, ...(tenantId ? { tenantId } : {}) });
    return this.itemRepository.save(item);
  }

  private async generateItemCode(isDrug?: boolean, tenantId?: string): Promise<string> {
    const prefix = isDrug ? 'DRG' : 'ITM';
    const qb = this.itemRepository
      .createQueryBuilder('item')
      .select('item.code', 'code')
      .where('item.code LIKE :codePrefix', { codePrefix: `${prefix}-%` })
      .orderBy('item.code', 'DESC')
      .limit(1);
    if (tenantId) {
      qb.andWhere('item.tenant_id = :tenantId', { tenantId });
    }
    const last = await qb.getRawOne();
    let nextNum = 1;
    if (last?.code) {
      const match = last.code.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    return `${prefix}-${String(nextNum).padStart(5, '0')}`;
  }

  async findAllItems(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    isDrug?: boolean;
    status?: string;
    tenantId?: string;
  }) {
    const { page = 1, limit = 20, search, category, isDrug, status, tenantId } = params;

    // Build base filter conditions
    const baseWhere: FindOptionsWhere<Item> = {};
    if (tenantId) {
      (baseWhere as any).tenantId = tenantId;
    }
    if (category) {
      baseWhere.category = category;
    }
    if (isDrug !== undefined) {
      baseWhere.isDrug = isDrug;
    }
    if (status) {
      baseWhere.status = status as any;
    }

    // If search term, create OR conditions for name/code/genericName
    let where: FindOptionsWhere<Item> | FindOptionsWhere<Item>[];
    if (search) {
      where = [
        { ...baseWhere, name: ILike(`%${search}%`) },
        { ...baseWhere, code: ILike(`%${search}%`) },
        { ...baseWhere, genericName: ILike(`%${search}%`) },
      ];
    } else {
      where = baseWhere;
    }

    const [data, total] = await this.itemRepository.findAndCount({
      where,
      relations: [
        'itemCategory',
        'subcategory',
        'brand',
        'itemUnit',
        'formulation',
        'storageCondition',
      ],
      skip: (page - 1) * limit,
      take: limit,
      order: { name: 'ASC' },
    });

    return { data, total, page, limit };
  }

  async findItemById(id: string, tenantId?: string): Promise<Item> {
    const item = await this.itemRepository.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: [
        'itemCategory',
        'subcategory',
        'brand',
        'itemUnit',
        'formulation',
        'storageCondition',
      ],
    });
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    return item;
  }

  async updateItem(id: string, dto: UpdateItemDto, tenantId?: string): Promise<Item> {
    const item = await this.findItemById(id, tenantId);
    Object.assign(item, dto);
    return this.itemRepository.save(item);
  }

  async deleteItem(id: string, tenantId?: string): Promise<void> {
    const item = await this.findItemById(id, tenantId);
    await this.itemRepository.softRemove(item);
  }

  // ============ STOCK MANAGEMENT ============

  async getStockBalance(
    itemId: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<StockBalance | null> {
    return this.stockBalanceRepository.findOne({
      where: { itemId, facilityId, ...(tenantId ? { tenantId } : {}) },
      relations: ['item'],
    });
  }

  async getStockBalances(params: {
    facilityId: string;
    page?: number;
    limit?: number;
    search?: string;
    lowStock?: boolean;
    tenantId?: string;
  }) {
    const { facilityId, page = 1, limit = 20, search, lowStock, tenantId } = params;

    const query = this.stockBalanceRepository
      .createQueryBuilder('sb')
      .leftJoinAndSelect('sb.item', 'item')
      .where('sb.facilityId = :facilityId', { facilityId });

    if (tenantId) {
      query.andWhere('sb.tenant_id = :tenantId', { tenantId });
    }

    if (search) {
      query.andWhere('(item.name ILIKE :search OR item.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (lowStock) {
      query.andWhere('sb.availableQuantity <= item.reorderLevel');
    }

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('item.name', 'ASC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async receiveStock(
    dto: StockReceiveDto,
    userId: string,
    tenantId?: string,
  ): Promise<StockLedger> {
    const item = await this.findItemById(dto.itemId, tenantId);

    return this.dataSource.transaction(async (manager) => {
      // Get current balance with pessimistic lock
      let balance = await manager.findOne(StockBalance, {
        where: {
          itemId: dto.itemId,
          facilityId: dto.facilityId,
          ...(tenantId ? { tenantId } : {}),
        },
        lock: { mode: 'pessimistic_write' },
      });
      const previousBalance = balance?.totalQuantity || 0;
      const newBalance = previousBalance + dto.quantity;

      // Create ledger entry
      const ledger = manager.create(StockLedger, {
        itemId: dto.itemId,
        facilityId: dto.facilityId,
        quantity: dto.quantity,
        balanceAfter: newBalance,
        movementType: MovementType.PURCHASE,
        batchNumber: dto.batchNumber,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        unitCost: dto.unitCost || item.unitCost,
        referenceType: 'stock_receive',
        notes: dto.notes,
        createdById: userId,
        ...(tenantId ? { tenantId } : {}),
      });

      await manager.save(StockLedger, ledger);

      // Update or create balance
      if (balance) {
        balance.totalQuantity = newBalance;
        balance.availableQuantity = newBalance - balance.reservedQuantity;
        balance.lastMovementAt = new Date();
      } else {
        balance = manager.create(StockBalance, {
          itemId: dto.itemId,
          facilityId: dto.facilityId,
          totalQuantity: newBalance,
          reservedQuantity: 0,
          availableQuantity: newBalance,
          lastMovementAt: new Date(),
          ...(tenantId ? { tenantId } : {}),
        });
      }
      await manager.save(StockBalance, balance);

      return ledger;
    });
  }

  async adjustStock(
    dto: StockAdjustmentDto,
    userId: string,
    tenantId?: string,
  ): Promise<StockLedger> {
    const item = await this.findItemById(dto.itemId, tenantId);

    // Controlled substance protection: require detailed reason for scheduled drugs
    if (item.isDrug) {
      const classification = await this.dataSource.query(
        `SELECT schedule FROM drug_classifications WHERE item_id = $1 AND deleted_at IS NULL AND tenant_id = $2 LIMIT 1`,
        [item.id, tenantId],
      );
      if (classification?.length > 0) {
        const schedule = classification[0].schedule;
        if (['schedule_1', 'schedule_2', 'schedule_3'].includes(schedule)) {
          if (!dto.reason || dto.reason.trim().length < 10) {
            throw new BadRequestException(
              `Controlled substance (${schedule}): stock adjustments require a detailed reason (min 10 characters). Provide reason for audit trail.`,
            );
          }
        }
      }
    }

    return this.dataSource.transaction(async (manager) => {
      // Pessimistic lock to prevent concurrent adjustment conflicts
      let balance = await manager.findOne(StockBalance, {
        where: {
          itemId: dto.itemId,
          facilityId: dto.facilityId,
          ...(tenantId ? { tenantId } : {}),
        },
        lock: { mode: 'pessimistic_write' },
      });
      const previousBalance = balance?.totalQuantity || 0;
      const difference = dto.newQuantity - previousBalance;

      // Create ledger entry
      const ledger = manager.create(StockLedger, {
        itemId: dto.itemId,
        facilityId: dto.facilityId,
        quantity: difference,
        balanceAfter: dto.newQuantity,
        movementType: MovementType.ADJUSTMENT,
        referenceType: 'stock_adjustment',
        notes: `Adjustment: ${dto.reason}. ${dto.notes || ''}`,
        createdById: userId,
        ...(tenantId ? { tenantId } : {}),
      });

      await manager.save(StockLedger, ledger);

      // Update or create balance
      if (balance) {
        balance.totalQuantity = dto.newQuantity;
        balance.availableQuantity = dto.newQuantity - balance.reservedQuantity;
        balance.lastMovementAt = new Date();
      } else {
        balance = manager.create(StockBalance, {
          itemId: dto.itemId,
          facilityId: dto.facilityId,
          totalQuantity: dto.newQuantity,
          reservedQuantity: 0,
          availableQuantity: dto.newQuantity,
          lastMovementAt: new Date(),
          ...(tenantId ? { tenantId } : {}),
        });
      }
      await manager.save(StockBalance, balance);

      return ledger;
    });
  }

  async transferStock(
    dto: StockTransferDto,
    userId: string,
    tenantId?: string,
  ): Promise<{ from: StockLedger; to: StockLedger }> {
    return this.dataSource.transaction(async (manager) => {
      // Check source has enough stock — with pessimistic lock
      const fromBalance = await manager.findOne(StockBalance, {
        where: {
          itemId: dto.itemId,
          facilityId: dto.fromFacilityId,
          ...(tenantId ? { tenantId } : {}),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!fromBalance || fromBalance.availableQuantity < dto.quantity) {
        throw new BadRequestException('Insufficient stock for transfer');
      }

      // Deduct from source
      const fromLedger = manager.create(StockLedger, {
        itemId: dto.itemId,
        facilityId: dto.fromFacilityId,
        quantity: -dto.quantity,
        balanceAfter: fromBalance.totalQuantity - dto.quantity,
        movementType: MovementType.TRANSFER_OUT,
        batchNumber: dto.batchNumber,
        referenceType: 'stock_transfer',
        referenceId: dto.toFacilityId,
        notes: dto.notes,
        createdById: userId,
        ...(tenantId ? { tenantId } : {}),
      });
      await manager.save(StockLedger, fromLedger);

      fromBalance.totalQuantity -= dto.quantity;
      fromBalance.availableQuantity -= dto.quantity;
      fromBalance.lastMovementAt = new Date();
      await manager.save(StockBalance, fromBalance);

      // Add to destination — with pessimistic lock
      let toBalance = await manager.findOne(StockBalance, {
        where: {
          itemId: dto.itemId,
          facilityId: dto.toFacilityId,
          ...(tenantId ? { tenantId } : {}),
        },
        lock: { mode: 'pessimistic_write' },
      });
      const toNewBalance = (toBalance?.totalQuantity || 0) + dto.quantity;

      const toLedger = manager.create(StockLedger, {
        itemId: dto.itemId,
        facilityId: dto.toFacilityId,
        quantity: dto.quantity,
        balanceAfter: toNewBalance,
        movementType: MovementType.TRANSFER_IN,
        batchNumber: dto.batchNumber,
        referenceType: 'stock_transfer',
        referenceId: dto.fromFacilityId,
        notes: dto.notes,
        createdById: userId,
        ...(tenantId ? { tenantId } : {}),
      });
      await manager.save(StockLedger, toLedger);

      if (toBalance) {
        toBalance.totalQuantity = toNewBalance;
        toBalance.availableQuantity = toNewBalance - toBalance.reservedQuantity;
        toBalance.lastMovementAt = new Date();
      } else {
        toBalance = manager.create(StockBalance, {
          itemId: dto.itemId,
          facilityId: dto.toFacilityId,
          totalQuantity: toNewBalance,
          reservedQuantity: 0,
          availableQuantity: toNewBalance,
          lastMovementAt: new Date(),
          ...(tenantId ? { tenantId } : {}),
        });
      }
      await manager.save(StockBalance, toBalance);

      return { from: fromLedger, to: toLedger };
    });
  }

  // ============ REPORTS ============

  async getStockMovements(params: {
    facilityId: string;
    itemId?: string;
    startDate?: string;
    endDate?: string;
    movementType?: MovementType;
    page?: number;
    limit?: number;
    tenantId?: string;
  }) {
    const {
      facilityId,
      itemId,
      startDate,
      endDate,
      movementType,
      page = 1,
      limit = 50,
      tenantId,
    } = params;

    const query = this.stockLedgerRepository
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.item', 'item')
      .leftJoinAndSelect('sl.createdBy', 'user')
      .where('sl.facilityId = :facilityId', { facilityId });

    if (tenantId) {
      query.andWhere('sl.tenant_id = :tenantId', { tenantId });
    }

    if (itemId) {
      query.andWhere('sl.itemId = :itemId', { itemId });
    }
    if (startDate) {
      query.andWhere('sl.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('sl.createdAt <= :endDate', { endDate });
    }
    if (movementType) {
      query.andWhere('sl.movementType = :movementType', { movementType });
    }

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('sl.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async getLowStockItems(facilityId: string, tenantId?: string) {
    const qb = this.stockBalanceRepository
      .createQueryBuilder('sb')
      .leftJoinAndSelect('sb.item', 'item')
      .where('sb.facilityId = :facilityId', { facilityId })
      .andWhere('sb.availableQuantity <= item.reorderLevel');
    if (tenantId) {
      qb.andWhere('sb.tenant_id = :tenantId', { tenantId });
    }
    return qb.orderBy('sb.availableQuantity', 'ASC').getMany();
  }

  async getExpiringItems(facilityId: string, daysAhead: number = 90, tenantId?: string) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysAhead);

    const qb = this.stockLedgerRepository
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.item', 'item')
      .where('sl.facilityId = :facilityId', { facilityId })
      .andWhere('sl.expiryDate IS NOT NULL')
      .andWhere('sl.expiryDate <= :expiryDate', { expiryDate })
      .andWhere('sl.quantity > 0');
    if (tenantId) qb.andWhere('sl.tenant_id = :tenantId', { tenantId });
    return qb.orderBy('sl.expiryDate', 'ASC').getMany();
  }

  async getExpiredItems(facilityId: string, tenantId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const qb2 = this.stockLedgerRepository
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.item', 'item')
      .where('sl.facilityId = :facilityId', { facilityId })
      .andWhere('sl.expiryDate IS NOT NULL')
      .andWhere('sl.expiryDate < :today', { today })
      .andWhere('sl.quantity > 0');
    if (tenantId) qb2.andWhere('sl.tenant_id = :tenantId', { tenantId });
    return qb2.orderBy('sl.expiryDate', 'ASC').getMany();
  }

  // Method for dispensing (called by pharmacy)
  async deductStock(
    itemId: string,
    facilityId: string,
    quantity: number,
    referenceType: string,
    referenceId: string,
    userId: string,
    tenantId?: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Pessimistic lock prevents concurrent deduction race conditions
      const balance = await manager.findOne(StockBalance, {
        where: { itemId, facilityId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!balance || balance.availableQuantity < quantity) {
        throw new BadRequestException('Insufficient stock');
      }

      const newBalance = balance.totalQuantity - quantity;

      await manager.save(
        StockLedger,
        manager.create(StockLedger, {
          itemId,
          facilityId,
          quantity: -quantity,
          balanceAfter: newBalance,
          movementType: MovementType.SALE,
          referenceType,
          referenceId,
          createdById: userId,
          ...(tenantId ? { tenantId } : {}),
        }),
      );

      balance.totalQuantity = newBalance;
      balance.availableQuantity = newBalance - balance.reservedQuantity;
      balance.lastMovementAt = new Date();
      await manager.save(StockBalance, balance);
    });
  }

  async getConsumptionReport(
    tenantId?: string,
    period: string = 'month',
    department?: string,
    category?: string,
  ) {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const daysDiff = Math.max(
      1,
      Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)),
    );

    // Query outgoing stock movements (consumption)
    const qb = this.stockLedgerRepository
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.item', 'item')
      .leftJoinAndSelect('sl.store', 'store')
      .where('sl.movementType IN (:...types)', {
        types: ['sale', 'adjustment', 'expired', 'damaged', 'transfer_out'],
      })
      .andWhere('sl.createdAt >= :startDate', { startDate })
      .andWhere('sl.quantity < 0');

    if (tenantId) {
      qb.andWhere('sl.tenant_id = :tenantId', { tenantId });
    }

    if (category && category !== 'all') {
      qb.andWhere('item.category = :category', { category });
    }

    const movements = await qb.getMany();

    // Aggregate by item
    const itemMap = new Map<
      string,
      {
        name: string;
        category: string;
        totalQuantity: number;
        totalValue: number;
      }
    >();

    let totalConsumption = 0;
    let totalValue = 0;

    for (const m of movements) {
      const qty = Math.abs(m.quantity);
      const value = qty * (m.unitCost || 0);
      totalConsumption += qty;
      totalValue += value;

      const itemName = m.item?.name || 'Unknown';
      const itemCategory = m.item?.category || 'Uncategorized';
      const key = m.itemId;

      if (itemMap.has(key)) {
        const existing = itemMap.get(key)!;
        existing.totalQuantity += qty;
        existing.totalValue += value;
      } else {
        itemMap.set(key, {
          name: itemName,
          category: itemCategory,
          totalQuantity: qty,
          totalValue: value,
        });
      }
    }

    const topConsumedItems = Array.from(itemMap.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 20)
      .map((item) => ({
        ...item,
        avgDailyConsumption: parseFloat((item.totalQuantity / daysDiff).toFixed(2)),
        trend: 'stable',
      }));

    // Department consumption (derived from store name if available)
    const departmentMap = new Map<string, number>();
    for (const m of movements) {
      const dept = (m as any).store?.name || 'General';
      departmentMap.set(dept, (departmentMap.get(dept) || 0) + Math.abs(m.quantity));
    }

    const departmentConsumption = Array.from(departmentMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Monthly trend for last 12 months
    const monthlyTrend: { month: string; quantity: number; value: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthName = monthStart.toLocaleString('default', { month: 'short', year: '2-digit' });

      let monthQty = 0;
      let monthVal = 0;
      for (const m of movements) {
        const mDate = new Date(m.createdAt);
        if (mDate >= monthStart && mDate <= monthEnd) {
          monthQty += Math.abs(m.quantity);
          monthVal += Math.abs(m.quantity) * (m.unitCost || 0);
        }
      }

      monthlyTrend.push({ month: monthName, quantity: monthQty, value: monthVal });
    }

    // Consumption trend (daily for last 30 days)
    const consumptionTrend: { date: string; value: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = d.toISOString().split('T')[0];
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

      let dayQty = 0;
      for (const m of movements) {
        const mDate = new Date(m.createdAt);
        if (mDate >= dayStart && mDate <= dayEnd) {
          dayQty += Math.abs(m.quantity);
        }
      }
      consumptionTrend.push({ date: dayStr, value: dayQty });
    }

    return {
      totalConsumption,
      totalValue: parseFloat(totalValue.toFixed(2)),
      avgDailyConsumption: parseFloat((totalConsumption / daysDiff).toFixed(2)),
      avgDailyValue: parseFloat((totalValue / daysDiff).toFixed(2)),
      topConsumedItems,
      departmentConsumption,
      monthlyTrend,
      consumptionTrend,
    };
  }

  /**
   * Batch recall: find all dispensation records for a given batch number
   * Returns affected patients and dispensation details for traceability
   */
  async recallBatch(batchNumber: string, facilityId?: string, tenantId?: string) {
    const qb = this.stockLedgerRepository
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.item', 'item')
      .where('sl.batchNumber = :batchNumber', { batchNumber })
      .andWhere('sl.quantity < 0'); // Only outgoing movements (dispensing, sales)

    if (facilityId) {
      qb.andWhere('sl.facilityId = :facilityId', { facilityId });
    }
    if (tenantId) {
      qb.andWhere('sl.tenant_id = :tenantId', { tenantId });
    }

    const movements = await qb.orderBy('sl.createdAt', 'DESC').getMany();

    // Group by reference to find affected patients/prescriptions
    const affectedRecords = movements.map((m) => ({
      itemId: m.itemId,
      itemName: m.item?.name,
      quantity: Math.abs(m.quantity),
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      dispensedAt: m.createdAt,
      dispensedBy: m.createdById,
      facilityId: m.facilityId,
    }));

    // Get current stock of this batch
    const remainingStock = await this.stockLedgerRepository
      .createQueryBuilder('sl')
      .select('SUM(sl.quantity)', 'remaining')
      .where('sl.batchNumber = :batchNumber', { batchNumber })
      .andWhere(
        facilityId ? 'sl.facilityId = :facilityId' : '1=1',
        facilityId ? { facilityId } : {},
      )
      .getRawOne();

    return {
      batchNumber,
      totalDispensed: affectedRecords.reduce((sum, r) => sum + r.quantity, 0),
      remainingStock: Number(remainingStock?.remaining || 0),
      affectedRecordCount: affectedRecords.length,
      affectedRecords,
    };
  }
}
