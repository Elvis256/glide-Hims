import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CostCenter } from '../../database/entities/finance-extended.entity';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class CostCenterService {
  constructor(
    @InjectRepository(CostCenter)
    private costCenterRepo: Repository<CostCenter>,
  ) {}

  async create(dto: Partial<CostCenter>, tenantId?: string): Promise<CostCenter> {
    const tid = requireTenantId(tenantId);
    const entity = this.costCenterRepo.create({ ...dto, tenantId: tid });
    return this.costCenterRepo.save(entity);
  }

  async findAll(facilityId?: string, tenantId?: string): Promise<CostCenter[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { tenantId: tid };
    if (facilityId) where.facilityId = facilityId;
    return this.costCenterRepo.find({ where, order: { name: 'ASC' } });
  }

  async findOne(id: string, tenantId?: string): Promise<CostCenter> {
    const tid = requireTenantId(tenantId);
    const cc = await this.costCenterRepo.findOne({
      where: { id, tenantId: tid },
    });
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
