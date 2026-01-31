import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { SupplierReturn, SupplierReturnItem, ReturnStatus } from '../../database/entities/supplier-return.entity';
import { CreateSupplierReturnDto, UpdateSupplierReturnDto, SupplierReturnQueryDto } from './supplier-returns.dto';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class SupplierReturnsService {
  constructor(
    @InjectRepository(SupplierReturn)
    private returnRepository: Repository<SupplierReturn>,
    @InjectRepository(SupplierReturnItem)
    private returnItemRepository: Repository<SupplierReturnItem>,
    private inventoryService: InventoryService,
  ) {}

  private generateReturnNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RET-${timestamp}-${random}`;
  }

  async create(dto: CreateSupplierReturnDto, userId: string): Promise<SupplierReturn> {
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
    });

    const saved = await this.returnRepository.save(supplierReturn);

    // Create return items
    const items = itemsWithValue.map((item) =>
      this.returnItemRepository.create({
        supplierReturnId: saved.id,
        itemId: item.itemId,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
        quantity: item.quantity,
        unitValue: item.unitValue || 0,
        totalValue: item.totalValue,
        notes: item.notes,
      }),
    );

    await this.returnItemRepository.save(items);

    return this.findOne(saved.id);
  }

  async findAll(query: SupplierReturnQueryDto) {
    const where: FindOptionsWhere<SupplierReturn> = {};

    if (query.facilityId) where.facilityId = query.facilityId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.status) where.status = query.status;
    if (query.reason) where.reason = query.reason;

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

  async findByFacility(facilityId: string) {
    return this.returnRepository.find({
      where: { facilityId },
      relations: ['supplier', 'createdBy', 'items', 'items.item'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<SupplierReturn> {
    const record = await this.returnRepository.findOne({
      where: { id },
      relations: ['supplier', 'facility', 'createdBy', 'items', 'items.item'],
    });
    if (!record) throw new NotFoundException('Supplier return not found');
    return record;
  }

  async update(id: string, dto: UpdateSupplierReturnDto): Promise<SupplierReturn> {
    const record = await this.findOne(id);
    Object.assign(record, dto);
    return this.returnRepository.save(record);
  }

  async updateStatus(id: string, status: ReturnStatus, userId: string): Promise<SupplierReturn> {
    const record = await this.findOne(id);
    const previousStatus = record.status;
    record.status = status;

    // If authorizing, deduct stock
    if (status === ReturnStatus.AUTHORIZED && previousStatus === ReturnStatus.PENDING) {
      for (const item of record.items) {
        try {
          await this.inventoryService.deductStock(
            item.itemId,
            record.facilityId,
            item.quantity,
            'supplier_return',
            id,
            userId,
          );
        } catch (error) {
          throw new BadRequestException(`Failed to deduct stock for item: ${error.message}`);
        }
      }
    }

    return this.returnRepository.save(record);
  }

  async getStats(facilityId: string) {
    const result = await this.returnRepository
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(r.totalValue)', 'totalValue')
      .where('r.facilityId = :facilityId', { facilityId })
      .groupBy('r.status')
      .getRawMany();

    return result;
  }

  async getBySupplier(supplierId: string, facilityId: string) {
    return this.returnRepository.find({
      where: { supplierId, facilityId },
      relations: ['items', 'items.item'],
      order: { createdAt: 'DESC' },
    });
  }

  async getSummary(facilityId: string) {
    const pending = await this.returnRepository.count({
      where: { facilityId, status: ReturnStatus.PENDING },
    });
    const authorized = await this.returnRepository.count({
      where: { facilityId, status: ReturnStatus.AUTHORIZED },
    });
    const completed = await this.returnRepository.count({
      where: { facilityId, status: ReturnStatus.COMPLETED },
    });

    const totalValue = await this.returnRepository
      .createQueryBuilder('r')
      .select('SUM(r.totalValue)', 'total')
      .where('r.facilityId = :facilityId', { facilityId })
      .getRawOne();

    return {
      pending,
      authorized,
      completed,
      totalValue: totalValue?.total || 0,
    };
  }
}
