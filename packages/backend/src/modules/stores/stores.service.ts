import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Store, StockTransfer, StockTransferItem, TransferStatus } from '../../database/entities/store.entity';
import { Item, StockBalance, StockLedger } from '../../database/entities/inventory.entity';
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
  async searchItems(query?: string, isDrug?: boolean, limit = 50) {
    const qb = this.itemRepo.createQueryBuilder('item')
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
    
    return qb
      .orderBy('item.name', 'ASC')
      .take(limit)
      .getMany();
  }

  async getItem(id: string) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  // Stores
  async createStore(dto: CreateStoreDto) {
    return this.storeRepo.save(this.storeRepo.create(dto));
  }

  async findAllStores(facilityId?: string, type?: string) {
    const query = this.storeRepo.createQueryBuilder('s').where('s.isActive = true');
    if (facilityId) query.andWhere('s.facilityId = :facilityId', { facilityId });
    if (type) query.andWhere('s.type = :type', { type });
    return query.orderBy('s.name', 'ASC').getMany();
  }

  async findStore(id: string) {
    const store = await this.storeRepo.findOne({ where: { id } });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async updateStore(id: string, dto: UpdateStoreDto) {
    const store = await this.findStore(id);
    Object.assign(store, dto);
    return this.storeRepo.save(store);
  }

  // Transfers
  async createTransfer(dto: CreateTransferDto, userId: string) {
    const transferNumber = `TRF-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    const transfer = this.transferRepo.create({
      transferNumber,
      fromStoreId: dto.fromStoreId,
      toStoreId: dto.toStoreId,
      reason: dto.reason,
      status: TransferStatus.REQUESTED,
      requestedById: userId,
    });
    const saved = await this.transferRepo.save(transfer);

    for (const item of dto.items) {
      await this.transferItemRepo.save(this.transferItemRepo.create({
        transferId: saved.id,
        ...item,
      }));
    }
    return this.findTransfer(saved.id);
  }

  async findAllTransfers(storeId?: string, status?: TransferStatus, limit = 50) {
    const query = this.transferRepo.createQueryBuilder('t')
      .leftJoinAndSelect('t.fromStore', 'fs')
      .leftJoinAndSelect('t.toStore', 'ts');
    if (storeId) query.andWhere('(t.fromStoreId = :storeId OR t.toStoreId = :storeId)', { storeId });
    if (status) query.andWhere('t.status = :status', { status });
    return query.orderBy('t.createdAt', 'DESC').take(limit).getMany();
  }

  async findTransfer(id: string) {
    const transfer = await this.transferRepo.findOne({
      where: { id },
      relations: ['fromStore', 'toStore', 'requestedBy'],
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    const items = await this.transferItemRepo.find({ where: { transferId: id } });
    return { ...transfer, items };
  }

  async approveTransfer(id: string, dto: ApproveTransferDto, userId: string) {
    const transfer = await this.findTransfer(id);
    if (transfer.status !== TransferStatus.REQUESTED) {
      throw new BadRequestException('Transfer is not in requested status');
    }

    for (const item of dto.items) {
      await this.transferItemRepo.update(
        { transferId: id, itemId: item.itemId },
        { quantityApproved: item.quantityApproved, quantityDispatched: item.quantityApproved },
      );
    }

    transfer.status = TransferStatus.IN_TRANSIT;
    transfer.approvedById = userId;
    transfer.approvedAt = new Date();
    transfer.dispatchedAt = new Date();
    await this.transferRepo.save(transfer);
    return this.findTransfer(id);
  }

  async receiveTransfer(id: string, dto: ReceiveTransferDto, userId: string) {
    const transfer = await this.findTransfer(id);
    if (transfer.status !== TransferStatus.IN_TRANSIT) {
      throw new BadRequestException('Transfer is not in transit');
    }

    for (const item of dto.items) {
      await this.transferItemRepo.update(
        { transferId: id, itemId: item.itemId },
        { quantityReceived: item.quantityReceived, notes: item.notes },
      );
    }

    transfer.status = TransferStatus.RECEIVED;
    transfer.receivedById = userId;
    transfer.receivedAt = new Date();
    await this.transferRepo.save(transfer);

    // TODO: Update actual inventory stock levels
    return this.findTransfer(id);
  }

  async cancelTransfer(id: string) {
    const transfer = await this.findTransfer(id);
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
  }) {
    const { category, lowStock, search, page = 1, limit = 50 } = params;

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

    const [items, total] = await qb
      .orderBy('item.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Get stock balances for these items
    const itemIds = items.map(i => i.id);
    let stockMap = new Map<string, StockBalance>();
    
    if (itemIds.length > 0) {
      const balances = await this.stockBalanceRepo.createQueryBuilder('sb')
        .where('sb.itemId IN (:...itemIds)', { itemIds })
        .getMany();
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
  }, userId: string, facilityId: string) {
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');

    // Get or create stock balance
    let balance = await this.stockBalanceRepo.findOne({ 
      where: { itemId, facilityId } 
    });

    if (!balance) {
      balance = this.stockBalanceRepo.create({
        itemId,
        facilityId,
        totalQuantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
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
    });
    await this.stockLedgerRepo.save(ledger);

    return { 
      success: true, 
      newBalance,
      movement: ledger,
    };
  }

  // Get stock movements for an item
  async getStockMovements(itemId: string, limit = 50) {
    return this.stockLedgerRepo.find({
      where: { itemId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['createdBy'],
    });
  }

  async getInventoryItem(id: string) {
    const item = await this.itemRepo.findOne({
      where: { id },
      relations: ['itemCategory', 'brand', 'formulation'],
    });
    if (!item) throw new NotFoundException('Item not found');

    const balance = await this.stockBalanceRepo.findOne({ where: { itemId: id } });

    return {
      ...item,
      currentStock: balance?.totalQuantity || 0,
      availableStock: balance?.availableQuantity || 0,
    };
  }

  async getLowStockItems() {
    // Get items where current stock is at or below reorder level
    const items = await this.itemRepo.createQueryBuilder('item')
      .leftJoin(StockBalance, 'sb', 'sb.itemId = item.id')
      .where('item.status = :status', { status: 'active' })
      .andWhere('item.isDrug = :isDrug', { isDrug: true })
      .andWhere('(sb.totalQuantity IS NULL OR sb.totalQuantity <= item.reorderLevel)')
      .orderBy('item.name', 'ASC')
      .getMany();

    return items;
  }
}
