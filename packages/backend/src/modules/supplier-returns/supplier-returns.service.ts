import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  SupplierReturn,
  SupplierReturnItem,
  ReturnStatus,
} from '../../database/entities/supplier-return.entity';
import {
  CreateSupplierReturnDto,
  UpdateSupplierReturnDto,
  SupplierReturnQueryDto,
} from './supplier-returns.dto';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class SupplierReturnsService {
  constructor(
    @InjectRepository(SupplierReturn)
    private returnRepository: Repository<SupplierReturn>,
    @InjectRepository(SupplierReturnItem)
    private returnItemRepository: Repository<SupplierReturnItem>,
    private inventoryService: InventoryService,
    private dataSource: DataSource,
  ) {}

  private generateReturnNumber(): string {
    // F-13: use a CSPRNG so document numbers cannot be predicted/enumerated.
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomBytes(3).toString('hex').toUpperCase();
    return `RET-${timestamp}-${random}`;
  }

  async create(
    dto: CreateSupplierReturnDto,
    userId: string,
    tenantId?: string,
  ): Promise<SupplierReturn> {
    // Calculate total value
    let totalValue = 0;
    const itemsWithValue = dto.items.map((item) => {
      const itemTotal = item.quantity * (item.unitValue || 0);
      totalValue += itemTotal;
      return { ...item, totalValue: itemTotal };
    });

    const supplierReturn = this.returnRepository.create({
      returnNumber: this.generateReturnNumber(),
      supplierId: dto.supplierId,
      reason: dto.reason,
      notes: dto.notes,
      facilityId: dto.facilityId,
      createdById: userId,
      totalValue,
      expectedCredit: totalValue,
      status: ReturnStatus.PENDING,
      ...(tenantId ? { tenantId } : {}),
    });

    const saved = await this.dataSource.transaction(async (manager) => {
      const returnRepo = manager.getRepository(SupplierReturn);
      const itemRepo = manager.getRepository(SupplierReturnItem);

      const header = (await returnRepo.save(supplierReturn)) as SupplierReturn;
      const items = itemsWithValue.map((item) =>
        itemRepo.create({
          supplierReturnId: header.id,
          itemId: item.itemId,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
          quantity: item.quantity,
          unitValue: item.unitValue || 0,
          totalValue: item.totalValue,
          notes: item.notes,
          ...(tenantId ? { tenantId } : {}),
        }),
      );
      await itemRepo.save(items);
      return header;
    });

    return this.findOne(saved.id, tenantId);
  }

  async findAll(query: SupplierReturnQueryDto, tenantId?: string) {
    const where: FindOptionsWhere<SupplierReturn> = {};

    if (query.facilityId) where.facilityId = query.facilityId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.status) where.status = query.status;
    if (query.reason) where.reason = query.reason;
    if (tenantId) (where as any).tenantId = tenantId;

    const page = query.page || 1;
    const limit = query.limit || 20;

    const [data, total] = await this.returnRepository.findAndCount({
      where,
      relations: ['supplier', 'facility', 'createdBy', 'items', 'items.item'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByFacility(facilityId: string, tenantId?: string) {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;
    return this.returnRepository.find({
      where,
      relations: ['supplier', 'createdBy', 'items', 'items.item'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId?: string): Promise<SupplierReturn> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const record = await this.returnRepository.findOne({
      where,
      relations: ['supplier', 'facility', 'createdBy', 'items', 'items.item'],
    });
    if (!record) throw new NotFoundException('Supplier return not found');
    return record;
  }

  async update(
    id: string,
    dto: UpdateSupplierReturnDto,
    tenantId?: string,
  ): Promise<SupplierReturn> {
    const record = await this.findOne(id, tenantId);
    Object.assign(record, dto);
    return this.returnRepository.save(record);
  }

  async updateStatus(
    id: string,
    status: ReturnStatus,
    userId: string,
    tenantId?: string,
  ): Promise<SupplierReturn> {
    const record = await this.findOne(id, tenantId);
    const previousStatus = record.status;
    record.status = status;

    // If authorizing, deduct stock for every item AND save the new status
    // in a single transaction (audit BUG-006). Previously each deductStock
    // ran its own transaction, so a failure on item N left items 1..N-1
    // deducted while the return stayed PENDING — silently corrupting stock.
    if (status === ReturnStatus.AUTHORIZED && previousStatus === ReturnStatus.PENDING) {
      return this.dataSource.transaction(async (manager) => {
        for (const item of record.items) {
          try {
            await this.inventoryService.deductStockInManager(
              manager,
              item.itemId,
              record.facilityId,
              item.quantity,
              'supplier_return',
              id,
              userId,
              tenantId,
            );
          } catch (error) {
            throw new BadRequestException(`Failed to deduct stock for item: ${error.message}`);
          }
        }
        return manager.getRepository(SupplierReturn).save(record);
      });
    }

    return this.returnRepository.save(record);
  }

  async getStats(facilityId: string, tenantId?: string) {
    const qb = this.returnRepository
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(r.totalValue)', 'totalValue')
      .where('r.facilityId = :facilityId', { facilityId });
    if (tenantId) {
      qb.andWhere('r.tenant_id = :tenantId', { tenantId });
    }
    const result = await qb.groupBy('r.status').getRawMany();

    return result;
  }

  async getBySupplier(supplierId: string, facilityId: string, tenantId?: string) {
    const where: any = { supplierId, facilityId };
    if (tenantId) where.tenantId = tenantId;
    return this.returnRepository.find({
      where,
      relations: ['items', 'items.item'],
      order: { createdAt: 'DESC' },
    });
  }

  async getSummary(facilityId: string, tenantId?: string) {
    const pendingWhere: any = { facilityId, status: ReturnStatus.PENDING };
    const authorizedWhere: any = { facilityId, status: ReturnStatus.AUTHORIZED };
    const completedWhere: any = { facilityId, status: ReturnStatus.COMPLETED };
    if (tenantId) {
      pendingWhere.tenantId = tenantId;
      authorizedWhere.tenantId = tenantId;
      completedWhere.tenantId = tenantId;
    }

    const pending = await this.returnRepository.count({
      where: pendingWhere,
    });
    const authorized = await this.returnRepository.count({
      where: authorizedWhere,
    });
    const completed = await this.returnRepository.count({
      where: completedWhere,
    });

    const qb = this.returnRepository
      .createQueryBuilder('r')
      .select('SUM(r.totalValue)', 'total')
      .where('r.facilityId = :facilityId', { facilityId });
    if (tenantId) {
      qb.andWhere('r.tenant_id = :tenantId', { tenantId });
    }
    const totalValue = await qb.getRawOne();

    return {
      pending,
      authorized,
      completed,
      totalValue: totalValue?.total || 0,
    };
  }
}
