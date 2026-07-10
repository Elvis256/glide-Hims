import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { DisposalRecord, ComplianceStatus } from '../../database/entities/disposal.entity';
import { CreateDisposalDto, UpdateDisposalDto, DisposalQueryDto } from './disposal.dto';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class DisposalService {
  constructor(
    @InjectRepository(DisposalRecord)
    private disposalRepository: Repository<DisposalRecord>,
    private inventoryService: InventoryService,
  ) {}

  async create(dto: CreateDisposalDto, userId: string, tenantId?: string): Promise<DisposalRecord> {
    const totalValue = dto.quantity * (dto.unitValue || 0);

    const disposal = this.disposalRepository.create({
      ...dto,
      totalValue,
      disposedById: userId,
      complianceStatus: ComplianceStatus.PENDING_REVIEW,
      ...(tenantId ? { tenantId } : {}),
    });

    const saved = await this.disposalRepository.save(disposal);

    // Deduct from inventory
    try {
      await this.inventoryService.deductStock(
        dto.itemId,
        dto.facilityId,
        dto.quantity,
        'disposal',
        saved.id,
        userId,
      );
    } catch (error) {
      // Rollback disposal record if stock deduction fails
      await this.disposalRepository.softDelete(saved.id);
      throw new BadRequestException(`Failed to deduct stock: ${error.message}`);
    }

    return saved;
  }

  async findAll(query: DisposalQueryDto, tenantId?: string) {
    const where: any = {};

    if (query.facilityId) where.facilityId = query.facilityId;
    if (query.disposalMethod) where.disposalMethod = query.disposalMethod;
    if (query.complianceStatus) where.complianceStatus = query.complianceStatus;
    if (tenantId) where.tenantId = tenantId;

    const page = query.page || 1;
    const limit = query.limit || 20;

    const [data, total] = await this.disposalRepository.findAndCount({
      where,
      relations: ['item', 'facility', 'disposedBy', 'approvedBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByFacility(facilityId: string, tenantId?: string) {
    return this.disposalRepository.find({
      where: { facilityId, ...(tenantId ? { tenantId } : {}) },
      relations: ['item', 'disposedBy', 'approvedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId?: string): Promise<DisposalRecord> {
    const record = await this.disposalRepository.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: ['item', 'facility', 'disposedBy', 'approvedBy'],
    });
    if (!record) throw new NotFoundException('Disposal record not found');
    return record;
  }

  async update(id: string, dto: UpdateDisposalDto, tenantId?: string): Promise<DisposalRecord> {
    const record = await this.findOne(id, tenantId);
    Object.assign(record, dto);
    return this.disposalRepository.save(record);
  }

  async approve(id: string, userId: string, tenantId?: string): Promise<DisposalRecord> {
    const record = await this.findOne(id, tenantId);

    // Require both witnesses for regulatory compliance (dual-witness requirement)
    if (!record.witness) {
      throw new BadRequestException('Disposal must have a witness recorded before approval');
    }
    if (!record.witness2) {
      throw new BadRequestException('Disposal requires a second witness before approval');
    }

    // Require disposal certificate number
    if (!record.certificateNumber) {
      throw new BadRequestException('Disposal certificate number is required before approval');
    }

    // Disposer cannot approve their own disposal (segregation of duties)
    if (record.disposedById === userId) {
      throw new BadRequestException('The person who created the disposal record cannot approve it');
    }

    record.complianceStatus = ComplianceStatus.COMPLIANT;
    record.approvedById = userId;
    return this.disposalRepository.save(record);
  }

  async getStats(facilityId: string, startDate?: Date, endDate?: Date, tenantId?: string) {
    const qb = this.disposalRepository
      .createQueryBuilder('d')
      .select('d.disposalMethod', 'method')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(d.totalValue)', 'totalValue')
      .addSelect('SUM(d.quantity)', 'totalQuantity')
      .where('d.facilityId = :facilityId', { facilityId });

    if (startDate && endDate) {
      qb.andWhere('d.disposalDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    if (tenantId) {
      qb.andWhere('d.tenant_id = :tenantId', { tenantId });
    }

    return qb.groupBy('d.disposalMethod').getRawMany();
  }

  async getSummary(facilityId: string, tenantId?: string) {
    const qb = this.disposalRepository
      .createQueryBuilder('d')
      .select('d.complianceStatus', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(d.totalValue)', 'totalValue')
      .where('d.facilityId = :facilityId', { facilityId });

    if (tenantId) {
      qb.andWhere('d.tenant_id = :tenantId', { tenantId });
    }

    return qb.groupBy('d.complianceStatus').getRawMany();
  }
}
