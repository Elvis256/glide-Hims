import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(data: {
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: Record<string, any>;
    newValue?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    tenantId?: string;
    actorType?: string;
    supportAccessTier?: number;
  }): Promise<AuditLog> {
    return this.auditLogRepository.save(this.auditLogRepository.create(data));
  }

  async findByEntity(entityType: string, entityId: string, tenantId?: string) {
    return this.auditLogRepository.find({
      where: { entityType, entityId, ...(tenantId ? { tenantId } : {}) },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
  }

  async findByUser(userId: string, limit = 100, tenantId?: string) {
    return this.auditLogRepository.find({
      where: { userId, ...(tenantId ? { tenantId } : {}) },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findRecent(limit = 100, tenantId?: string) {
    return this.auditLogRepository.find({
      where: { ...(tenantId ? { tenantId } : {}) },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  async findAllPaginated(filters: {
    page: number;
    limit: number;
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    tenantId?: string;
  }) {
    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC');

    if (filters.tenantId) {
      qb.andWhere('log.tenantId = :tenantId', { tenantId: filters.tenantId });
    }
    if (filters.userId) {
      qb.andWhere('log.userId = :userId', { userId: filters.userId });
    }
    if (filters.action) {
      qb.andWhere('log.action = :action', { action: filters.action });
    }
    if (filters.entityType) {
      qb.andWhere('log.entityType = :entityType', { entityType: filters.entityType });
    }
    if (filters.entityId) {
      qb.andWhere('log.entityId = :entityId', { entityId: filters.entityId });
    }
    if (filters.startDate) {
      qb.andWhere('log.createdAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      qb.andWhere('log.createdAt <= :endDate', { endDate: filters.endDate });
    }
    if (filters.search) {
      qb.andWhere(
        '(log.action ILIKE :search OR log.entityType ILIKE :search OR user.username ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const skip = (filters.page - 1) * filters.limit;
    qb.skip(skip).take(filters.limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    };
  }

  async getStats(tenantId?: string) {
    const where = tenantId ? { tenantId } : {};
    const total = await this.auditLogRepository.count({ where });

    const actionQb = this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count');
    if (tenantId) actionQb.where('log.tenantId = :tenantId', { tenantId });
    const actionCounts = await actionQb
      .groupBy('log.action')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    const entityQb = this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.entityType', 'entityType')
      .addSelect('COUNT(*)', 'count');
    if (tenantId) entityQb.where('log.tenantId = :tenantId', { tenantId });
    const entityCounts = await entityQb
      .groupBy('log.entityType')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    const todayQb = this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.createdAt >= CURRENT_DATE');
    if (tenantId) todayQb.andWhere('log.tenantId = :tenantId', { tenantId });
    const todayCount = await todayQb.getCount();

    return { total, todayCount, actionCounts, entityCounts };
  }
}
