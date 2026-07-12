import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { FinanceAuditLog } from '../../database/entities/finance-extended.entity';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class FinanceAuditService {
  private readonly logger = new Logger(FinanceAuditService.name);

  constructor(
    @InjectRepository(FinanceAuditLog)
    private auditRepo: Repository<FinanceAuditLog>,
  ) {}

  async log(
    dto: {
      action: string;
      entityType: string;
      entityId: string;
      userId: string;
      facilityId?: string;
      oldValues?: any;
      newValues?: any;
      ipAddress?: string;
    },
    tenantId?: string,
  ): Promise<FinanceAuditLog> {
    const tid = requireTenantId(tenantId);
    const entry = this.auditRepo.create({
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId,
      userId: dto.userId,
      facilityId: dto.facilityId,
      oldValue: dto.oldValues,
      newValue: dto.newValues,
      ipAddress: dto.ipAddress,
      tenantId: tid,
    });
    return this.auditRepo.save(entry);
  }

  async findAll(
    filters: {
      entityType?: string;
      entityId?: string;
      userId?: string;
      facilityId?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
    tenantId?: string,
  ): Promise<{ data: FinanceAuditLog[]; total: number }> {
    const tid = requireTenantId(tenantId);
    const where: any = { tenantId: tid };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.facilityId) where.facilityId = filters.facilityId;

    if (filters.startDate && filters.endDate) {
      where.createdAt = Between(filters.startDate, filters.endDate);
    } else if (filters.startDate) {
      where.createdAt = MoreThanOrEqual(filters.startDate);
    } else if (filters.endDate) {
      where.createdAt = LessThanOrEqual(filters.endDate);
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;

    const [data, total] = await this.auditRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }
}
