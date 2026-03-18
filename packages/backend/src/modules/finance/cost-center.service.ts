import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CostCenter } from '../../database/entities/finance-extended.entity';

@Injectable()
export class CostCenterService {
  constructor(
    @InjectRepository(CostCenter)
    private costCenterRepo: Repository<CostCenter>,
  ) {}

  async create(dto: Partial<CostCenter>, tenantId?: string): Promise<CostCenter> {
    const entity = this.costCenterRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) });
    return this.costCenterRepo.save(entity);
  }

  async findAll(facilityId?: string, tenantId?: string): Promise<CostCenter[]> {
    const where: any = {};
    if (facilityId) where.facilityId = facilityId;
    if (tenantId) where.tenantId = tenantId;
    return this.costCenterRepo.find({ where, order: { name: 'ASC' } });
  }

  async findOne(id: string, tenantId?: string): Promise<CostCenter> {
    const cc = await this.costCenterRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!cc) throw new NotFoundException('Cost center not found');
    return cc;
  }

  async update(id: string, dto: Partial<CostCenter>, tenantId?: string): Promise<CostCenter> {
    const cc = await this.findOne(id, tenantId);
    Object.assign(cc, dto);
    return this.costCenterRepo.save(cc);
  }

  async deactivate(id: string, tenantId?: string): Promise<CostCenter> {
    const cc = await this.findOne(id, tenantId);
    cc.isActive = false;
    return this.costCenterRepo.save(cc);
  }
}
