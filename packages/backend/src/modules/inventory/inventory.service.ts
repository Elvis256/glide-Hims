import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, DataSource } from 'typeorm';
import { Item, StockLedger, StockBalance, MovementType } from '../../database/entities/inventory.entity';
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
    const existing = await this.itemRepository.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new BadRequestException(`Item with code ${dto.code} already exists`);
    }

    const item = this.itemRepository.create({ ...dto, ...(tenantId ? { tenantId } : {}) });
    return this.itemRepository.save(item);
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

    const where: FindOptionsWhere<Item> = {};

    if (tenantId) {
      (where as any).tenantId = tenantId;
    }
    if (search) {
      // Search by name or code
      where.name = Like(`%${search}%`);
    }
    if (category) {
      where.category = category;
    }
    if (isDrug !== undefined) {
      where.isDrug = isDrug;
    }
    if (status) {
      where.status = status;
    }

    const [data, total] = await this.itemRepository.findAndCount({
      where,
      relations: ['itemCategory', 'subcategory', 'brand', 'itemUnit', 'formulation', 'storageCondition'],
      skip: (page - 1) * limit,
      take: limit,
      order: { name: 'ASC' },
    });

    return { data, total, page, limit };
  }

  async findItemById(id: string, tenantId?: string): Promise<Item> {
    const item = await this.itemRepository.findOne({ 
      where: { id , ...(tenantId ? { tenantId } : {}) },
      relations: ['itemCategory', 'subcategory', 'brand', 'itemUnit', 'formulation', 'storageCondition'],
    });
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    return item;
  }

  async updateItem(id: string, dto: UpdateItemDto, tenantId?: string): Promise<Item> {
    const item = await this.findItemById(id);
    Object.assign(item, dto);
    return this.itemRepository.save(item);
  }

  async deleteItem(id: string, tenantId?: string): Promise<void> {
    const item = await this.findItemById(id);
    await this.itemRepository.softRemove(item);
  }

  // ============ STOCK MANAGEMENT ============

  async getStockBalance(itemId: string, facilityId: string, tenantId?: string): Promise<StockBalance | null> {
    return this.stockBalanceRepository.findOne({
      where: { itemId, facilityId , ...(tenantId ? { tenantId } : {}) },
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
      query.andWhere('item.tenant_id = :tenantId', { tenantId });
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

  async receiveStock(dto: StockReceiveDto, userId: string, tenantId?: string): Promise<StockLedger> {
    const item = await this.findItemById(dto.itemId);

    return this.dataSource.transaction(async (manager) => {
      // Get current balance
      let balance = await manager.findOne(StockBalance, {
        where: { itemId: dto.itemId, facilityId: dto.facilityId },
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
        });
      }
      await manager.save(StockBalance, balance);

      return ledger;
    });
  }

  async adjustStock(dto: StockAdjustmentDto, userId: string, tenantId?: string): Promise<StockLedger> {
    const item = await this.findItemById(dto.itemId);

    return this.dataSource.transaction(async (manager) => {
      let balance = await manager.findOne(StockBalance, {
        where: { itemId: dto.itemId, facilityId: dto.facilityId },
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
        });
      }
      await manager.save(StockBalance, balance);

      return ledger;
    });
  }

  async transferStock(dto: StockTransferDto, userId: string, tenantId?: string): Promise<{ from: StockLedger; to: StockLedger }> {
    return this.dataSource.transaction(async (manager) => {
      // Check source has enough stock
      const fromBalance = await manager.findOne(StockBalance, {
        where: { itemId: dto.itemId, facilityId: dto.fromFacilityId },
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
      });
      await manager.save(StockLedger, fromLedger);

      fromBalance.totalQuantity -= dto.quantity;
      fromBalance.availableQuantity -= dto.quantity;
      fromBalance.lastMovementAt = new Date();
      await manager.save(StockBalance, fromBalance);

      // Add to destination
      let toBalance = await manager.findOne(StockBalance, {
        where: { itemId: dto.itemId, facilityId: dto.toFacilityId },
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
    const { facilityId, itemId, startDate, endDate, movementType, page = 1, limit = 50, tenantId } = params;

    const query = this.stockLedgerRepository
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.item', 'item')
      .leftJoinAndSelect('sl.createdBy', 'user')
      .where('sl.facilityId = :facilityId', { facilityId });

    if (tenantId) {
      query.andWhere('item.tenant_id = :tenantId', { tenantId });
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
    return this.stockBalanceRepository
      .createQueryBuilder('sb')
      .leftJoinAndSelect('sb.item', 'item')
      .where('sb.facilityId = :facilityId', { facilityId })
      .andWhere('sb.availableQuantity <= item.reorderLevel')
      .orderBy('sb.availableQuantity', 'ASC')
      .getMany();
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
  
    tenantId?: string): Promise<void> {
    const balance = await this.getStockBalance(itemId, facilityId);
    if (!balance || balance.availableQuantity < quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    const newBalance = balance.totalQuantity - quantity;

    const ledger = this.stockLedgerRepository.create({
      itemId,
      facilityId,
      quantity: -quantity,
      balanceAfter: newBalance,
      movementType: MovementType.SALE,
      referenceType,
      referenceId,
      createdById: userId,
    });
    await this.stockLedgerRepository.save(ledger);

    balance.totalQuantity = newBalance;
    balance.availableQuantity = newBalance - balance.reservedQuantity;
    balance.lastMovementAt = new Date();
    await this.stockBalanceRepository.save(balance);
  }
}
