import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Store, StockTransfer, StockTransferItem, TransferStatus } from '../../database/entities/store.entity';
import { Item, StockBalance, StockLedger, MovementType } from '../../database/entities/inventory.entity';
import { CreateStoreDto, UpdateStoreDto, CreateTransferDto, ApproveTransferDto, ReceiveTransferDto } from './stores.dto';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store) private storeRepo: Repository<Store>,
    @InjectRepository(StockTransfer) private transferRepo: Repository<StockTransfer>,
    @InjectRepository(StockTransferItem) private transferItemRepo: Repository<StockTransferItem>,
    @InjectRepository(Item) private itemRepo: Repository<Item>,
    @InjectRepository(StockBalance) private stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(StockLedger) private stockLedgerRepo: Repository<StockLedger>,
  ) {}

  // Items (Drugs)
  async searchItems(query?: string, isDrug?: boolean, limit = 50, storeId?: string, tenantId?: string) {
    const stockJoin = storeId
      ? 'sb.itemId = item.id AND sb.storeId = :storeId'
      : 'sb.itemId = item.id AND sb.storeId IS NULL';
    const qb = this.itemRepo.createQueryBuilder('item')
      .leftJoin(StockBalance, 'sb', stockJoin, storeId ? { storeId } : {})
      .addSelect('COALESCE(sb.availableQuantity, 0)', 'availableStock')
      .where('item.status = :status', { status: 'active' });
    
    if (isDrug !== undefined) {
      qb.andWhere('item.isDrug = :isDrug', { isDrug });
    }
    
    if (query) {
      qb.andWhere(
        '(item.name ILIKE :q OR item.genericName ILIKE :q OR item.code ILIKE :q)',
        { q: `%${query}%` }
      );
    }

    if (tenantId) {
      qb.andWhere('item.tenant_id = :tenantId', { tenantId });
    }

    const rawItems = await qb
      .orderBy('item.name', 'ASC')
      .take(limit)
      .getRawAndEntities();
    
    // Merge stock info into each item
    return rawItems.entities.map((item, i) => ({
      ...item,
      currentStock: Number(rawItems.raw[i]?.availableStock ?? 0),
    }));
  }

  async getItem(id: string, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const item = await this.itemRepo.findOne({ where });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  // Stores
  async createStore(dto: CreateStoreDto, tenantId?: string) {
    return this.storeRepo.save(this.storeRepo.create({
      ...dto,
      ...(tenantId ? { tenantId } : {}),
    }));
  }

  async findAllStores(facilityId?: string, type?: string, tenantId?: string) {
    const query = this.storeRepo.createQueryBuilder('s').where('s.isActive = true');
    if (facilityId) query.andWhere('s.facilityId = :facilityId', { facilityId });
    if (type) query.andWhere('s.type = :type', { type });
    if (tenantId) {
      query.andWhere('s.tenant_id = :tenantId', { tenantId });
    }
    return query.orderBy('s.name', 'ASC').getMany();
  }

  async findStore(id: string, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const store = await this.storeRepo.findOne({ where });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async updateStore(id: string, dto: UpdateStoreDto, tenantId?: string) {
    const store = await this.findStore(id, tenantId);
    Object.assign(store, dto);
    return this.storeRepo.save(store);
  }

  // Transfers
  async createTransfer(dto: CreateTransferDto, userId: string, tenantId?: string) {
    const transferNumber = `TRF-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    const transfer = this.transferRepo.create({
      transferNumber,
      fromStoreId: dto.fromStoreId,
      toStoreId: dto.toStoreId,
      reason: dto.reason,
      status: TransferStatus.REQUESTED,
      requestedById: userId,
      ...(tenantId ? { tenantId } : {}),
    });
    const saved = await this.transferRepo.save(transfer);

    for (const item of dto.items) {
      await this.transferItemRepo.save(this.transferItemRepo.create({
        transferId: saved.id,
        ...item,
      }));
    }
    return this.findTransfer(saved.id, tenantId);
  }

  async findAllTransfers(storeId?: string, status?: TransferStatus, limit = 50, tenantId?: string) {
    const query = this.transferRepo.createQueryBuilder('t')
      .leftJoinAndSelect('t.fromStore', 'fs')
      .leftJoinAndSelect('t.toStore', 'ts');
    if (storeId) query.andWhere('(t.fromStoreId = :storeId OR t.toStoreId = :storeId)', { storeId });
    if (status) query.andWhere('t.status = :status', { status });
    if (tenantId) {
      query.andWhere('t.tenant_id = :tenantId', { tenantId });
    }
    return query.orderBy('t.createdAt', 'DESC').take(limit).getMany();
  }

  async findTransfer(id: string, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const transfer = await this.transferRepo.findOne({
      where,
      relations: ['fromStore', 'toStore', 'requestedBy'],
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    const items = await this.transferItemRepo.find({ where: { transferId: id } });
    return { ...transfer, items };
  }

  async approveTransfer(id: string, dto: ApproveTransferDto, userId: string, tenantId?: string) {
    const transfer = await this.findTransfer(id, tenantId);
    if (transfer.status !== TransferStatus.REQUESTED) {
      throw new BadRequestException('Transfer is not in requested status');
    }

    const fromStore = await this.storeRepo.findOne({ where: { id: transfer.fromStoreId, ...(tenantId ? { tenantId } : {}) } });
    if (!fromStore) throw new NotFoundException('Source store not found');

    for (const item of dto.items) {
      await this.transferItemRepo.update(
        { transferId: id, itemId: item.itemId },
        { quantityApproved: item.quantityApproved, quantityDispatched: item.quantityApproved },
      );

      // Deduct stock from source store
      const qty = item.quantityApproved;
      const balance = await this.getOrCreateStoreBalance(item.itemId, fromStore.facilityId, transfer.fromStoreId, tenantId);
      if (balance.availableQuantity < qty) {
        throw new BadRequestException(`Insufficient stock in source store for item ${item.itemId}. Available: ${balance.availableQuantity}`);
      }
      balance.totalQuantity -= qty;
      balance.availableQuantity -= qty;
      balance.lastMovementAt = new Date();
      await this.stockBalanceRepo.save(balance);

      // Also deduct from facility-level balance
      const facilityBalance = await this.stockBalanceRepo.findOne({
        where: { itemId: item.itemId, facilityId: fromStore.facilityId, storeId: null as any, ...(tenantId ? { tenantId } : {}) },
      });
      if (facilityBalance) {
        facilityBalance.totalQuantity -= qty;
        facilityBalance.availableQuantity -= qty;
        facilityBalance.lastMovementAt = new Date();
        await this.stockBalanceRepo.save(facilityBalance);
      }

      // Get transfer item for unit cost
      const transferItem = transfer.items?.find(ti => ti.itemId === item.itemId);

      // Ledger entry for transfer out
      await this.stockLedgerRepo.save(this.stockLedgerRepo.create({
        itemId: item.itemId,
        facilityId: fromStore.facilityId,
        storeId: transfer.fromStoreId,
        quantity: -qty,
        balanceAfter: balance.totalQuantity,
        movementType: MovementType.TRANSFER_OUT,
        unitCost: Number(transferItem?.unitCost) || 0,
        referenceType: 'stock_transfer',
        referenceId: id,
        notes: `Transfer to ${transfer.toStore?.name || transfer.toStoreId}`,
        createdById: userId,
        ...(tenantId ? { tenantId } : {}),
      }));
    }

    transfer.status = TransferStatus.IN_TRANSIT;
    transfer.approvedById = userId;
    transfer.approvedAt = new Date();
    transfer.dispatchedAt = new Date();
    await this.transferRepo.save(transfer);
    return this.findTransfer(id, tenantId);
  }

  async receiveTransfer(id: string, dto: ReceiveTransferDto, userId: string, tenantId?: string) {
    const transfer = await this.findTransfer(id, tenantId);
    if (transfer.status !== TransferStatus.IN_TRANSIT) {
      throw new BadRequestException('Transfer is not in transit');
    }

    const toStore = await this.storeRepo.findOne({ where: { id: transfer.toStoreId, ...(tenantId ? { tenantId } : {}) } });
    if (!toStore) throw new NotFoundException('Destination store not found');

    for (const item of dto.items) {
      await this.transferItemRepo.update(
        { transferId: id, itemId: item.itemId },
        { quantityReceived: item.quantityReceived, notes: item.notes },
      );

      // Add stock to destination store
      const qty = item.quantityReceived;
      const balance = await this.getOrCreateStoreBalance(item.itemId, toStore.facilityId, transfer.toStoreId, tenantId);
      balance.totalQuantity += qty;
      balance.availableQuantity += qty;
      balance.lastMovementAt = new Date();
      await this.stockBalanceRepo.save(balance);

      // Also add to facility-level balance if cross-facility (same facility = net zero)
      if (toStore.facilityId !== transfer.fromStore?.facilityId) {
        let facilityBalance = await this.stockBalanceRepo.findOne({
          where: { itemId: item.itemId, facilityId: toStore.facilityId, storeId: null as any, ...(tenantId ? { tenantId } : {}) },
        });
        if (!facilityBalance) {
          facilityBalance = this.stockBalanceRepo.create({
            itemId: item.itemId, facilityId: toStore.facilityId,
            totalQuantity: 0, reservedQuantity: 0, availableQuantity: 0,
            ...(tenantId ? { tenantId } : {}),
          });
        }
        facilityBalance.totalQuantity += qty;
        facilityBalance.availableQuantity += qty;
        facilityBalance.lastMovementAt = new Date();
        await this.stockBalanceRepo.save(facilityBalance);
      }

      // Get transfer item for unit cost
      const transferItem = transfer.items?.find(ti => ti.itemId === item.itemId);

      // Ledger entry for transfer in
      await this.stockLedgerRepo.save(this.stockLedgerRepo.create({
        itemId: item.itemId,
        facilityId: toStore.facilityId,
        storeId: transfer.toStoreId,
        quantity: qty,
        balanceAfter: balance.totalQuantity,
        movementType: MovementType.TRANSFER_IN,
        unitCost: Number(transferItem?.unitCost) || 0,
        referenceType: 'stock_transfer',
        referenceId: id,
        notes: `Transfer from ${transfer.fromStore?.name || transfer.fromStoreId}`,
        createdById: userId,
        ...(tenantId ? { tenantId } : {}),
      }));
    }

    transfer.status = TransferStatus.RECEIVED;
    transfer.receivedById = userId;
    transfer.receivedAt = new Date();
    await this.transferRepo.save(transfer);

    return this.findTransfer(id, tenantId);
  }

  async cancelTransfer(id: string, tenantId?: string) {
    const transfer = await this.findTransfer(id, tenantId);
    if (transfer.status === TransferStatus.RECEIVED) {
      throw new BadRequestException('Cannot cancel a received transfer');
    }
    transfer.status = TransferStatus.CANCELLED;
    return this.transferRepo.save(transfer);
  }

  // Inventory methods
  async getInventoryList(params: {
    category?: string;
    lowStock?: boolean;
    search?: string;
    page?: number;
    limit?: number;
    storeId?: string;
  }, tenantId?: string) {
    const { category, lowStock, search, page = 1, limit = 50, storeId } = params;

    const qb = this.itemRepo.createQueryBuilder('item')
      .leftJoinAndSelect('item.itemCategory', 'itemCategory')
      .leftJoinAndSelect('item.brand', 'brand')
      .where('item.status = :status', { status: 'active' });

    // For pharmacy, show drugs
    qb.andWhere('item.isDrug = :isDrug', { isDrug: true });

    if (category) {
      qb.andWhere('(item.category ILIKE :category OR itemCategory.name ILIKE :category)', { category: `%${category}%` });
    }

    if (search) {
      qb.andWhere('(item.name ILIKE :search OR item.genericName ILIKE :search OR item.code ILIKE :search)', { search: `%${search}%` });
    }

    if (lowStock) {
      qb.andWhere('item.reorderLevel > 0'); // Would need stock balance join for actual low stock check
    }

    if (tenantId) {
      qb.andWhere('item.tenant_id = :tenantId', { tenantId });
    }

    const [items, total] = await qb
      .orderBy('item.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Get stock balances for these items (filtered by store if specified)
    const itemIds = items.map(i => i.id);
    let stockMap = new Map<string, StockBalance>();
    
    if (itemIds.length > 0) {
      const balanceQb = this.stockBalanceRepo.createQueryBuilder('sb')
        .where('sb.itemId IN (:...itemIds)', { itemIds });
      if (storeId) {
        balanceQb.andWhere('sb.storeId = :storeId', { storeId });
      } else {
        balanceQb.andWhere('sb.storeId IS NULL');
      }
      const balances = await balanceQb.getMany();
      balances.forEach(b => stockMap.set(b.itemId, b));
    }

    // Transform to inventory response
    const data = items.map(item => {
      const balance = stockMap.get(item.id);
      return {
        id: item.id,
        name: item.name,
        genericName: item.genericName,
        code: item.code,
        category: item.itemCategory?.name || item.category || 'Uncategorized',
        sku: item.code,
        currentStock: balance?.totalQuantity || 0,
        availableStock: balance?.availableQuantity || 0,
        minStock: item.reorderLevel || 0,
        maxStock: item.maxStockLevel || 0,
        unit: item.unit,
        unitCost: Number(item.unitCost) || 0,
        sellingPrice: Number(item.sellingPrice) || 0,
        lastUpdated: balance?.lastMovementAt?.toISOString() || item.updatedAt?.toISOString() || new Date().toISOString(),
        isLowStock: (balance?.totalQuantity || 0) <= (item.reorderLevel || 0),
      };
    });

    // Get batch/expiry info for items with stock
    const itemIdsWithStock = data.filter(d => d.currentStock > 0).map(d => d.id);
    let batchMap = new Map<string, { batchNumber: string; expiryDate: string | null }>();
    
    if (itemIdsWithStock.length > 0) {
      // Get the latest batch info for each item
      const batches = await this.stockLedgerRepo.createQueryBuilder('sl')
        .select(['sl.itemId', 'sl.batchNumber', 'sl.expiryDate'])
        .where('sl.itemId IN (:...itemIds)', { itemIds: itemIdsWithStock })
        .andWhere('sl.quantity > 0')
        .orderBy('sl.createdAt', 'DESC')
        .getMany();
      
      batches.forEach(b => {
        if (!batchMap.has(b.itemId)) {
          // expiryDate may already be a string from the query
          const expiryStr = b.expiryDate 
            ? (typeof b.expiryDate === 'string' ? b.expiryDate : b.expiryDate.toISOString())
            : null;
          batchMap.set(b.itemId, { 
            batchNumber: b.batchNumber, 
            expiryDate: expiryStr 
          });
        }
      });
    }

    // Add batch info to data
    const enrichedData = data.map(item => ({
      ...item,
      batchNumber: batchMap.get(item.id)?.batchNumber || null,
      expiryDate: batchMap.get(item.id)?.expiryDate || null,
    }));

    // Calculate stats
    const lowStockCount = enrichedData.filter(d => d.isLowStock && d.currentStock > 0).length;
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringCount = enrichedData.filter(d => {
      if (!d.expiryDate) return false;
      const expiry = new Date(d.expiryDate);
      return expiry <= thirtyDaysLater && expiry >= today;
    }).length;
    const expiredCount = enrichedData.filter(d => {
      if (!d.expiryDate) return false;
      return new Date(d.expiryDate) < today;
    }).length;
    const totalValue = enrichedData.reduce((sum, d) => sum + (d.currentStock * d.sellingPrice), 0);

    return { 
      data: enrichedData, 
      total, 
      page, 
      limit,
      stats: {
        totalItems: total,
        lowStockCount,
        expiringCount,
        expiredCount,
        totalValue,
      }
    };
  }

  // Stock adjustment
  async adjustStock(itemId: string, dto: {
    quantity: number;
    type: 'in' | 'out' | 'adjustment';
    reason: string;
    batchNumber?: string;
    expiryDate?: string;
    reference?: string;
    storeId?: string;
  }, userId: string, facilityId: string, tenantId?: string) {
    const where: any = { id: itemId };
    if (tenantId) where.tenantId = tenantId;
    const item = await this.itemRepo.findOne({ where });
    if (!item) throw new NotFoundException('Item not found');

    // Get or create stock balance (facility-level or store-level)
    const whereClause: any = { itemId, facilityId };
    if (dto.storeId) {
      whereClause.storeId = dto.storeId;
    } else {
      whereClause.storeId = null as any;
    }
    if (tenantId) whereClause.tenantId = tenantId;
    let balance = await this.stockBalanceRepo.findOne({ where: whereClause });

    if (!balance) {
      balance = this.stockBalanceRepo.create({
        itemId,
        facilityId,
        storeId: dto.storeId || undefined,
        totalQuantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
        ...(tenantId ? { tenantId } : {}),
      });
    }

    // Calculate new balance
    const adjustmentQty = dto.type === 'out' ? -Math.abs(dto.quantity) : Math.abs(dto.quantity);
    const newBalance = balance.totalQuantity + adjustmentQty;

    if (newBalance < 0) {
      throw new BadRequestException('Insufficient stock for this adjustment');
    }

    // Update balance
    balance.totalQuantity = newBalance;
    balance.availableQuantity = newBalance - balance.reservedQuantity;
    balance.lastMovementAt = new Date();
    await this.stockBalanceRepo.save(balance);

    // Create ledger entry
    const movementType = dto.type === 'in' ? 'purchase' : dto.type === 'out' ? 'sale' : 'adjustment';
    const ledger = this.stockLedgerRepo.create({
      itemId,
      facilityId,
      storeId: dto.storeId || undefined,
      batchNumber: dto.batchNumber,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      quantity: adjustmentQty,
      balanceAfter: newBalance,
      movementType: movementType as any,
      unitCost: Number(item.unitCost) || 0,
      referenceType: dto.type,
      referenceId: dto.reference,
      notes: dto.reason,
      createdById: userId,
      ...(tenantId ? { tenantId } : {}),
    });
    await this.stockLedgerRepo.save(ledger);

    return { 
      success: true, 
      newBalance,
      movement: ledger,
    };
  }

  // Get stock movements for an item
  async getStockMovements(itemId: string, limit = 50, tenantId?: string) {
    const where: any = { itemId };
    if (tenantId) where.tenantId = tenantId;
    return this.stockLedgerRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['createdBy'],
    });
  }

  async getInventoryItem(id: string, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const item = await this.itemRepo.findOne({
      where,
      relations: ['itemCategory', 'brand', 'formulation'],
    });
    if (!item) throw new NotFoundException('Item not found');

    const balance = await this.stockBalanceRepo.findOne({ where: { itemId: id, ...(tenantId ? { tenantId } : {}) } });

    return {
      ...item,
      currentStock: balance?.totalQuantity || 0,
      availableStock: balance?.availableQuantity || 0,
    };
  }

  async getLowStockItems(tenantId?: string) {
    // Get items where current stock is at or below reorder level
    const qb = this.itemRepo.createQueryBuilder('item')
      .leftJoin(StockBalance, 'sb', 'sb.itemId = item.id')
      .where('item.status = :status', { status: 'active' })
      .andWhere('item.isDrug = :isDrug', { isDrug: true })
      .andWhere('(sb.totalQuantity IS NULL OR sb.totalQuantity <= item.reorderLevel)');

    if (tenantId) {
      qb.andWhere('item.tenant_id = :tenantId', { tenantId });
    }

    const items = await qb.orderBy('item.name', 'ASC').getMany();

    return items;
  }

  async getExpiringSoon(facilityId?: string, daysAhead = 90, tenantId?: string) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const qb = this.itemRepo.createQueryBuilder('item')
      .leftJoin(StockBalance, 'sb', 'sb.itemId = item.id')
      .leftJoin('item.itemCategory', 'cat')
      .select([
        'item.id', 'item.name', 'item.code', 'item.genericName', 'item.category',
        'item.expiryDate', 'item.batchNumber', 'item.reorderLevel',
        'COALESCE(sb.totalQuantity, 0) as currentStock',
        'COALESCE(sb.availableQuantity, 0) as availableStock',
      ])
      .where('item.expiryDate IS NOT NULL')
      .andWhere('item.expiryDate <= :cutoff', { cutoff })
      .andWhere('COALESCE(sb.totalQuantity, 0) > 0');

    if (facilityId) {
      qb.andWhere('sb.facilityId = :facilityId', { facilityId });
    }

    if (tenantId) {
      qb.andWhere('item.tenant_id = :tenantId', { tenantId });
    }

    const rows = await qb.orderBy('item.expiryDate', 'ASC').getRawMany();

    return rows.map(r => ({
      id: r.item_id,
      name: r.item_name,
      code: r.item_code,
      genericName: r.item_genericName || r.item_generic_name,
      category: r.item_category,
      expiryDate: r.item_expiryDate || r.item_expiry_date,
      batchNumber: r.item_batchNumber || r.item_batch_number,
      currentStock: Number(r.currentStock),
      availableStock: Number(r.availableStock),
      reorderLevel: r.item_reorderLevel || r.item_reorder_level,
      daysUntilExpiry: Math.ceil((new Date(r.item_expiryDate || r.item_expiry_date).getTime() - today.getTime()) / 86400000),
      isExpired: new Date(r.item_expiryDate || r.item_expiry_date) < today,
    }));
  }

  // Helper: get or create a store-level stock balance
  private async getOrCreateStoreBalance(itemId: string, facilityId: string, storeId: string, tenantId?: string): Promise<StockBalance> {
    let balance = await this.stockBalanceRepo.findOne({
      where: { itemId, facilityId, storeId , ...(tenantId ? { tenantId } : {}) },
    });
    if (!balance) {
      balance = this.stockBalanceRepo.create({
        itemId, facilityId, storeId,
        totalQuantity: 0, reservedQuantity: 0, availableQuantity: 0,
        ...(tenantId ? { tenantId } : {}),
      });
    }
    return balance;
  }

  async listMovements(itemId?: string, limit = 50, tenantId?: string) {
    const qb = this.stockLedgerRepo.createQueryBuilder('sl')
      .leftJoinAndSelect('sl.item', 'item')
      .leftJoinAndSelect('sl.store', 'store')
      .orderBy('sl.createdAt', 'DESC')
      .take(limit);

    if (itemId) {
      qb.andWhere('sl.item_id = :itemId', { itemId });
    }
    if (tenantId) {
      qb.andWhere('sl.tenant_id = :tenantId', { tenantId });
    }
    return qb.getMany();
  }

  async transferStock(
    itemId: string,
    dto: { fromStoreId: string; toStoreId: string; quantity: number; reason?: string },
    userId: string,
    tenantId?: string,
  ) {
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');

    const transferDto: CreateTransferDto = {
      fromStoreId: dto.fromStoreId,
      toStoreId: dto.toStoreId,
      reason: dto.reason,
      items: [{
        itemId,
        itemCode: item.code || '',
        itemName: item.name || '',
        quantityRequested: dto.quantity,
      }],
    };
    return this.createTransfer(transferDto, userId, tenantId);
  }

  async getCategorySummary(tenantId?: string) {
    const qb = this.stockBalanceRepo.createQueryBuilder('sb')
      .leftJoinAndSelect('sb.item', 'item')
      .select('item.category', 'category')
      .addSelect('COUNT(DISTINCT sb.item_id)', 'itemCount')
      .addSelect('SUM(sb.totalQuantity)', 'totalQuantity')
      .groupBy('item.category');

    if (tenantId) {
      qb.andWhere('sb.tenant_id = :tenantId', { tenantId });
    }

    return qb.getRawMany();
  }
}
