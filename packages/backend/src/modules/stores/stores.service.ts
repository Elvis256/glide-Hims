import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store, StockTransfer, StockTransferItem, TransferStatus } from '../../database/entities/store.entity';
import { CreateStoreDto, UpdateStoreDto, CreateTransferDto, ApproveTransferDto, ReceiveTransferDto } from './stores.dto';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store) private storeRepo: Repository<Store>,
    @InjectRepository(StockTransfer) private transferRepo: Repository<StockTransfer>,
    @InjectRepository(StockTransferItem) private transferItemRepo: Repository<StockTransferItem>,
  ) {}

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
}
