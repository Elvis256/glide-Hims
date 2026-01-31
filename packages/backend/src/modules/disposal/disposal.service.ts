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

  async create(dto: CreateDisposalDto, userId: string): Promise<DisposalRecord> {
    const totalValue = dto.quantity * (dto.unitValue || 0);

    const disposal = this.disposalRepository.create({
      ...dto,
      totalValue,
      disposedById: userId,
      complianceStatus: ComplianceStatus.PENDING_REVIEW,
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
      await this.disposalRepository.delete(saved.id);
      throw new BadRequestException(`Failed to deduct stock: ${error.message}`);
    }

    return saved;
  }

  async findAll(query: DisposalQueryDto) {
    const where: FindOptionsWhere<DisposalRecord> = {};

    if (query.facilityId) where.facilityId = query.facilityId;
    if (query.disposalMethod) where.disposalMethod = query.disposalMethod;
    if (query.complianceStatus) where.complianceStatus = query.complianceStatus;

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

  async findByFacility(facilityId: string) {
    return this.disposalRepository.find({
      where: { facilityId },
      relations: ['item', 'disposedBy', 'approvedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<DisposalRecord> {
    const record = await this.disposalRepository.findOne({
      where: { id },
      relations: ['item', 'facility', 'disposedBy', 'approvedBy'],
    });
    if (!record) throw new NotFoundException('Disposal record not found');
    return record;
  }

  async update(id: string, dto: UpdateDisposalDto): Promise<DisposalRecord> {
    const record = await this.findOne(id);
    Object.assign(record, dto);
    return this.disposalRepository.save(record);
  }

  async approve(id: string, userId: string): Promise<DisposalRecord> {
    const record = await this.findOne(id);
    record.complianceStatus = ComplianceStatus.COMPLIANT;
    record.approvedById = userId;
    return this.disposalRepository.save(record);
  }

  async getStats(facilityId: string, startDate?: Date, endDate?: Date) {
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

    return qb.groupBy('d.disposalMethod').getRawMany();
  }

  async getSummary(facilityId: string) {
    const result = await this.disposalRepository
      .createQueryBuilder('d')
      .select('d.complianceStatus', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(d.totalValue)', 'totalValue')
      .where('d.facilityId = :facilityId', { facilityId })
      .groupBy('d.complianceStatus')
      .getRawMany();

    return result;
  }
}
