import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { requireTenantId } from '../../common/utils/tenant.util';
import { StockTransfer, TransferStatus } from '../../database/entities/stock-transfer.entity';
import { StockTransferItem } from '../../database/entities/stock-transfer-item.entity';
import { StockLedger, StockBalance, MovementType } from '../../database/entities/inventory.entity';
import { BatchStockBalance } from '../../database/entities/batch-stock.entity';
import {
  CreateStockTransferDto,
  ApproveStockTransferDto,
  ReceiveStockTransferDto,
  CancelStockTransferDto,
  RejectStockTransferDto,
} from './dto/stock-transfer.dto';

@Injectable()
export class StockTransferService {
  constructor(
    @InjectRepository(StockTransfer)
    private transferRepository: Repository<StockTransfer>,
    @InjectRepository(StockTransferItem)
    private transferItemRepository: Repository<StockTransferItem>,
    private dataSource: DataSource,
  ) {}

  // ============ CREATE ============

  async create(
    dto: CreateStockTransferDto,
    userId: string,
    tenantId?: string,
  ): Promise<StockTransfer> {
    const sameFacility = dto.fromFacilityId === dto.toFacilityId;
    if (sameFacility) {
      // Intra-facility transfer (store-to-store) requires distinct stores
      if (!dto.fromStoreId || !dto.toStoreId) {
        throw new BadRequestException(
          'Intra-facility transfers require both fromStoreId and toStoreId',
        );
      }
      if (dto.fromStoreId === dto.toStoreId) {
        throw new BadRequestException('Source and destination store cannot be the same');
      }
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }

    const transferNumber = await this.generateTransferNumber(tenantId);

    const transfer = this.transferRepository.create({
      transferNumber,
      fromFacilityId: dto.fromFacilityId,
      toFacilityId: dto.toFacilityId,
      fromStoreId: dto.fromStoreId,
      toStoreId: dto.toStoreId,
      reason: dto.reason,
      notes: dto.notes,
      requestedById: userId,
      status: TransferStatus.REQUESTED,
      tenantId: requireTenantId(tenantId),
      items: dto.items.map((item) => ({
        itemId: item.itemId,
        batchNumber: item.batchNumber,
        expiryDate: new Date(item.expiryDate),
        requestedQuantity: item.requestedQuantity,
        unitCost: item.unitCost,
        notes: item.notes,
        tenantId: requireTenantId(tenantId),
      })),
    });

    return this.transferRepository.save(transfer);
  }

  // ============ FIND ALL ============

  async findAll(
    tenantId?: string,
    facilityId?: string,
    filters?: {
      status?: TransferStatus;
      direction?: 'incoming' | 'outgoing';
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: StockTransfer[]; total: number; page: number; limit: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    const qb = this.transferRepository
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.fromFacility', 'fromFacility')
      .leftJoinAndSelect('transfer.toFacility', 'toFacility')
      .leftJoinAndSelect('transfer.requestedBy', 'requestedBy')
      .leftJoinAndSelect('transfer.items', 'items')
      .leftJoinAndSelect('items.item', 'item');

    const tid = requireTenantId(tenantId);
    qb.andWhere('transfer.tenantId = :tenantId', { tenantId: tid });

    if (facilityId) {
      if (filters?.direction === 'incoming') {
        qb.andWhere('transfer.toFacilityId = :facilityId', { facilityId });
      } else if (filters?.direction === 'outgoing') {
        qb.andWhere('transfer.fromFacilityId = :facilityId', { facilityId });
      } else {
        qb.andWhere(
          '(transfer.fromFacilityId = :facilityId OR transfer.toFacilityId = :facilityId)',
          { facilityId },
        );
      }
    }

    if (filters?.status) {
      qb.andWhere('transfer.status = :status', { status: filters.status });
    }

    qb.orderBy('transfer.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  // ============ FIND ONE ============

  async findOne(id: string, tenantId?: string): Promise<StockTransfer> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;

    const transfer = await this.transferRepository.findOne({
      where,
      relations: [
        'fromFacility',
        'toFacility',
        'requestedBy',
        'approvedBy',
        'receivedBy',
        'items',
        'items.item',
      ],
    });

    if (!transfer) {
      throw new NotFoundException(`Stock transfer ${id} not found`);
    }

    return transfer;
  }

  // ============ APPROVE ============

  async approve(
    id: string,
    userId: string,
    tenantId?: string,
    dto?: ApproveStockTransferDto,
  ): Promise<StockTransfer> {
    const transfer = await this.findOne(id, tenantId);

    if (transfer.status !== TransferStatus.REQUESTED) {
      throw new BadRequestException(`Cannot approve transfer in "${transfer.status}" status`);
    }

    // Apply approved quantities from DTO or default to requested quantities
    for (const item of transfer.items) {
      if (dto?.items) {
        const approvedItem = dto.items.find(
          (a) => a.itemId === item.itemId && a.batchNumber === item.batchNumber,
        );
        item.approvedQuantity = approvedItem
          ? approvedItem.approvedQuantity
          : item.requestedQuantity;
      } else {
        item.approvedQuantity = item.requestedQuantity;
      }
    }

    transfer.status = TransferStatus.APPROVED;
    transfer.approvedById = userId;
    transfer.approvedAt = new Date();

    if (dto?.notes) {
      transfer.notes = transfer.notes
        ? `${transfer.notes}\nApproval note: ${dto.notes}`
        : `Approval note: ${dto.notes}`;
    }

    await this.transferItemRepository.save(transfer.items);
    return this.transferRepository.save(transfer);
  }

  // ============ REJECT ============

  async reject(
    id: string,
    userId: string,
    tenantId?: string,
    dto?: RejectStockTransferDto,
  ): Promise<StockTransfer> {
    const transfer = await this.findOne(id, tenantId);

    if (transfer.status !== TransferStatus.REQUESTED) {
      throw new BadRequestException(`Cannot reject transfer in "${transfer.status}" status`);
    }

    transfer.status = TransferStatus.REJECTED;
    transfer.approvedById = userId;
    transfer.approvedAt = new Date();
    transfer.rejectionReason = dto?.reason || null;

    return this.transferRepository.save(transfer);
  }

  // ============ SHIP ============

  async ship(id: string, userId: string, tenantId?: string): Promise<StockTransfer> {
    const transfer = await this.findOne(id, tenantId);

    if (transfer.status !== TransferStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot ship transfer in "${transfer.status}" status. Must be approved first.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Deduct stock from source facility at ship time (reserve / remove from available)
      for (const transferItem of transfer.items) {
        const quantity = transferItem.approvedQuantity ?? transferItem.requestedQuantity;
        if (quantity <= 0) continue;

        // Update batch stock (source) — pessimistic lock prevents concurrent ship double-deduction
        const sourceBatch = await manager.findOne(BatchStockBalance, {
          where: {
            itemId: transferItem.itemId,
            facilityId: transfer.fromFacilityId,
            batchNumber: transferItem.batchNumber,
            tenantId: requireTenantId(tenantId),
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (sourceBatch) {
          if (Number(sourceBatch.quantity) < quantity) {
            throw new BadRequestException(
              `Insufficient batch stock for item ${transferItem.itemId} batch ${transferItem.batchNumber}. Available: ${sourceBatch.quantity}, Required: ${quantity}`,
            );
          }
          sourceBatch.quantity = Number(sourceBatch.quantity) - quantity;
          await manager.save(BatchStockBalance, sourceBatch);
        }

        // Update stock balance (source) with pessimistic lock
        const fromBalance = await manager.findOne(StockBalance, {
          where: {
            itemId: transferItem.itemId,
            facilityId: transfer.fromFacilityId,
            tenantId: requireTenantId(tenantId),
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (fromBalance) {
          if (Number(fromBalance.availableQuantity) < quantity) {
            throw new BadRequestException(
              `Insufficient available stock for item ${transferItem.itemId}. Available: ${fromBalance.availableQuantity}, Required: ${quantity}`,
            );
          }
          const newTotal = Number(fromBalance.totalQuantity) - quantity;
          fromBalance.totalQuantity = newTotal;
          fromBalance.availableQuantity = newTotal - Number(fromBalance.reservedQuantity);
          fromBalance.lastMovementAt = new Date();
          await manager.save(StockBalance, fromBalance);

          // Create stock ledger entry (transfer_out at ship time)
          const ledgerEntry = manager.create(StockLedger, {
            itemId: transferItem.itemId,
            facilityId: transfer.fromFacilityId,
            storeId: transfer.fromStoreId,
            quantity: -quantity,
            balanceAfter: newTotal,
            movementType: MovementType.TRANSFER_OUT,
            batchNumber: transferItem.batchNumber,
            expiryDate: transferItem.expiryDate,
            unitCost: transferItem.unitCost,
            referenceType: 'stock_transfer',
            referenceId: transfer.id,
            notes:
              transfer.fromFacilityId === transfer.toFacilityId
                ? `Transfer ${transfer.transferNumber} (intra-facility) from store ${transfer.fromStoreId} to ${transfer.toStoreId}`
                : `Transfer ${transfer.transferNumber} shipped to ${transfer.toFacilityId}`,
            createdById: userId,
            tenantId: requireTenantId(tenantId),
          });
          await manager.save(StockLedger, ledgerEntry);
        }
      }

      transfer.status = TransferStatus.IN_TRANSIT;
      transfer.shippedAt = new Date();

      return manager.save(StockTransfer, transfer);
    });
  }

  // ============ RECEIVE ============

  async receive(
    id: string,
    userId: string,
    tenantId?: string,
    dto?: ReceiveStockTransferDto,
  ): Promise<StockTransfer> {
    const transfer = await this.findOne(id, tenantId);

    if (transfer.status !== TransferStatus.IN_TRANSIT) {
      throw new BadRequestException(
        `Cannot receive transfer in "${transfer.status}" status. Must be in transit.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Apply received quantities
      for (const item of transfer.items) {
        if (dto?.items) {
          const receivedItem = dto.items.find(
            (r) => r.itemId === item.itemId && r.batchNumber === item.batchNumber,
          );
          item.receivedQuantity = receivedItem
            ? receivedItem.receivedQuantity
            : (item.approvedQuantity ?? item.requestedQuantity);
        } else {
          item.receivedQuantity = item.approvedQuantity ?? item.requestedQuantity;
        }
      }

      await manager.save(StockTransferItem, transfer.items);

      // Process each item: add to destination facility stock
      // Source deduction already happened at ship time
      for (const transferItem of transfer.items) {
        if (transferItem.receivedQuantity <= 0) continue;

        const quantity = transferItem.receivedQuantity;

        // === ADD to destination facility ===

        // Update or create batch_stock_balances (destination) — pessimistic lock prevents lost updates
        let destBatch = await manager.findOne(BatchStockBalance, {
          where: {
            itemId: transferItem.itemId,
            facilityId: transfer.toFacilityId,
            batchNumber: transferItem.batchNumber,
            tenantId: requireTenantId(tenantId),
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (destBatch) {
          destBatch.quantity = Number(destBatch.quantity) + quantity;
          await manager.save(BatchStockBalance, destBatch);
        } else {
          destBatch = manager.create(BatchStockBalance, {
            itemId: transferItem.itemId,
            facilityId: transfer.toFacilityId,
            batchNumber: transferItem.batchNumber,
            expiryDate: transferItem.expiryDate,
            quantity,
            reservedQuantity: 0,
            status: 'active',
            tenantId: requireTenantId(tenantId),
          });
          await manager.save(BatchStockBalance, destBatch);
        }

        // Update stock_balances (destination) — pessimistic lock prevents lost updates
        let toBalance = await manager.findOne(StockBalance, {
          where: {
            itemId: transferItem.itemId,
            facilityId: transfer.toFacilityId,
            tenantId: requireTenantId(tenantId),
          },
          lock: { mode: 'pessimistic_write' },
        });
        const toNewTotal = (toBalance?.totalQuantity || 0) + quantity;

        if (toBalance) {
          toBalance.totalQuantity = toNewTotal;
          toBalance.availableQuantity = toNewTotal - toBalance.reservedQuantity;
          toBalance.lastMovementAt = new Date();
        } else {
          toBalance = manager.create(StockBalance, {
            itemId: transferItem.itemId,
            facilityId: transfer.toFacilityId,
            totalQuantity: toNewTotal,
            reservedQuantity: 0,
            availableQuantity: toNewTotal,
            lastMovementAt: new Date(),
            tenantId: requireTenantId(tenantId),
          });
        }
        await manager.save(StockBalance, toBalance);

        // Create stock_ledger entry (transfer_in)
        const toLedger = manager.create(StockLedger, {
          itemId: transferItem.itemId,
          facilityId: transfer.toFacilityId,
          storeId: transfer.toStoreId,
          quantity,
          balanceAfter: toNewTotal,
          movementType: MovementType.TRANSFER_IN,
          batchNumber: transferItem.batchNumber,
          expiryDate: transferItem.expiryDate,
          unitCost: transferItem.unitCost,
          referenceType: 'stock_transfer',
          referenceId: transfer.id,
          notes:
            transfer.fromFacilityId === transfer.toFacilityId
              ? `Transfer ${transfer.transferNumber} (intra-facility) received in store ${transfer.toStoreId}`
              : `Transfer ${transfer.transferNumber} from ${transfer.fromFacilityId}`,
          createdById: userId,
          tenantId: requireTenantId(tenantId),
        });
        await manager.save(StockLedger, toLedger);

        // Handle discrepancy: if received < shipped, return difference to source
        const shippedQuantity = transferItem.approvedQuantity ?? transferItem.requestedQuantity;
        const discrepancy = shippedQuantity - quantity;
        if (discrepancy > 0) {
          // Return undelivered quantity back to source
          const fromBalance = await manager.findOne(StockBalance, {
            where: {
              itemId: transferItem.itemId,
              facilityId: transfer.fromFacilityId,
              tenantId: requireTenantId(tenantId),
            },
            lock: { mode: 'pessimistic_write' },
          });

          if (fromBalance) {
            fromBalance.totalQuantity = Number(fromBalance.totalQuantity) + discrepancy;
            fromBalance.availableQuantity = Number(fromBalance.availableQuantity) + discrepancy;
            fromBalance.lastMovementAt = new Date();
            await manager.save(StockBalance, fromBalance);
          }
        }
      }

      // Update transfer status
      transfer.status = TransferStatus.RECEIVED;
      transfer.receivedById = userId;
      transfer.receivedAt = new Date();

      if (dto?.notes) {
        transfer.notes = transfer.notes
          ? `${transfer.notes}\nReceiving note: ${dto.notes}`
          : `Receiving note: ${dto.notes}`;
      }

      return manager.save(StockTransfer, transfer);
    });
  }

  // ============ CANCEL ============

  async cancel(
    id: string,
    userId: string,
    tenantId?: string,
    dto?: CancelStockTransferDto,
  ): Promise<StockTransfer> {
    const transfer = await this.findOne(id, tenantId);

    if (
      transfer.status !== TransferStatus.REQUESTED &&
      transfer.status !== TransferStatus.APPROVED &&
      transfer.status !== TransferStatus.IN_TRANSIT
    ) {
      throw new BadRequestException(
        `Cannot cancel transfer in "${transfer.status}" status. Only requested, approved, or in-transit transfers can be cancelled.`,
      );
    }

    // Wrap everything in a transaction so stock restoration + status update are atomic.
    // If in-transit, restore stock to source since it was deducted at ship time.
    return this.dataSource.transaction(async (manager) => {
      // Re-fetch with pessimistic lock inside transaction
      const lockedTransfer = await manager.findOne(StockTransfer, {
        where: { id, tenantId: requireTenantId(tenantId) },
        lock: { mode: 'pessimistic_write' },
        relations: ['items'],
      });
      if (!lockedTransfer) throw new NotFoundException(`Stock transfer ${id} not found`);

      // Re-check status under lock
      if (
        lockedTransfer.status !== TransferStatus.REQUESTED &&
        lockedTransfer.status !== TransferStatus.APPROVED &&
        lockedTransfer.status !== TransferStatus.IN_TRANSIT
      ) {
        throw new BadRequestException(
          `Cannot cancel transfer in "${lockedTransfer.status}" status.`,
        );
      }

      if (lockedTransfer.status === TransferStatus.IN_TRANSIT) {
        for (const transferItem of lockedTransfer.items) {
          const quantity = transferItem.approvedQuantity ?? transferItem.requestedQuantity;
          if (quantity <= 0) continue;

          // Restore batch stock
          const sourceBatch = await manager.findOne(BatchStockBalance, {
            where: {
              itemId: transferItem.itemId,
              facilityId: lockedTransfer.fromFacilityId,
              batchNumber: transferItem.batchNumber,
              tenantId: requireTenantId(tenantId),
            },
            lock: { mode: 'pessimistic_write' },
          });
          if (sourceBatch) {
            sourceBatch.quantity = Number(sourceBatch.quantity) + quantity;
            await manager.save(BatchStockBalance, sourceBatch);
          }

          // Restore stock balance
          const fromBalance = await manager.findOne(StockBalance, {
            where: {
              itemId: transferItem.itemId,
              facilityId: lockedTransfer.fromFacilityId,
              tenantId: requireTenantId(tenantId),
            },
            lock: { mode: 'pessimistic_write' },
          });
          if (fromBalance) {
            fromBalance.totalQuantity = Number(fromBalance.totalQuantity) + quantity;
            fromBalance.availableQuantity = Number(fromBalance.availableQuantity) + quantity;
            fromBalance.lastMovementAt = new Date();
            await manager.save(StockBalance, fromBalance);

            // Reversal ledger entry
            const reversalLedger = manager.create(StockLedger, {
              itemId: transferItem.itemId,
              facilityId: lockedTransfer.fromFacilityId,
              quantity,
              balanceAfter: Number(fromBalance.totalQuantity),
              movementType: MovementType.TRANSFER_IN,
              batchNumber: transferItem.batchNumber,
              expiryDate: transferItem.expiryDate,
              unitCost: transferItem.unitCost,
              referenceType: 'stock_transfer',
              referenceId: lockedTransfer.id,
              notes: `Transfer ${lockedTransfer.transferNumber} cancelled - stock restored`,
              createdById: userId,
              tenantId: requireTenantId(tenantId),
            });
            await manager.save(StockLedger, reversalLedger);
          }
        }
      }

      lockedTransfer.status = TransferStatus.CANCELLED;
      lockedTransfer.cancellationReason = dto?.reason || null;

      return manager.save(StockTransfer, lockedTransfer);
    });
  }

  // ============ DASHBOARD ============

  async getDashboard(
    tenantId?: string,
    facilityId?: string,
  ): Promise<{
    pendingRequests: number;
    awaitingApproval: number;
    inTransit: number;
    completedThisMonth: number;
    rejectedThisMonth: number;
    cancelledThisMonth: number;
  }> {
    const tid = requireTenantId(tenantId);
    const qb = this.transferRepository.createQueryBuilder('transfer');

    qb.andWhere('transfer.tenantId = :tenantId', { tenantId: tid });

    if (facilityId) {
      qb.andWhere(
        '(transfer.fromFacilityId = :facilityId OR transfer.toFacilityId = :facilityId)',
        { facilityId },
      );
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      pendingRequests,
      awaitingApproval,
      inTransit,
      completedThisMonth,
      rejectedThisMonth,
      cancelledThisMonth,
    ] = await Promise.all([
      qb.clone().andWhere('transfer.status = :s', { s: TransferStatus.REQUESTED }).getCount(),
      qb.clone().andWhere('transfer.status = :s', { s: TransferStatus.APPROVED }).getCount(),
      qb.clone().andWhere('transfer.status = :s', { s: TransferStatus.IN_TRANSIT }).getCount(),
      qb
        .clone()
        .andWhere('transfer.status = :s', { s: TransferStatus.RECEIVED })
        .andWhere('transfer.receivedAt >= :startOfMonth', { startOfMonth })
        .getCount(),
      qb
        .clone()
        .andWhere('transfer.status = :s', { s: TransferStatus.REJECTED })
        .andWhere('transfer.updatedAt >= :startOfMonth', { startOfMonth })
        .getCount(),
      qb
        .clone()
        .andWhere('transfer.status = :s', { s: TransferStatus.CANCELLED })
        .andWhere('transfer.updatedAt >= :startOfMonth', { startOfMonth })
        .getCount(),
    ]);

    return {
      pendingRequests,
      awaitingApproval,
      inTransit,
      completedThisMonth,
      rejectedThisMonth,
      cancelledThisMonth,
    };
  }

  // ============ HELPERS ============

  private async generateTransferNumber(tenantId?: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `TRF-${yearMonth}-`;

    const lastTransfer = await this.transferRepository
      .createQueryBuilder('transfer')
      .where('transfer.transferNumber LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere(tenantId ? 'transfer.tenantId = :tenantId' : '1=1', { tenantId })
      .orderBy('transfer.transferNumber', 'DESC')
      .getOne();

    let nextNumber = 1;
    if (lastTransfer) {
      const lastNum = parseInt(lastTransfer.transferNumber.replace(prefix, ''), 10);
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  }
}
