import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(data: {
    userId?: string;
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
    reason?: string;
    requestMethod?: string;
    requestUrl?: string;
    statusCode?: number;
    attemptedIdentifier?: string;
    errorMessage?: string;
  }): Promise<AuditLog> {
    const previousLog = await this.auditLogRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' },
      select: ['hash'],
    });

    const previousHash = previousLog?.hash || undefined;

    // Create a deterministic payload string for hashing
    const payloadString = JSON.stringify({
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      userId: data.userId,
      tenantId: data.tenantId,
      oldValue: data.oldValue || null,
      newValue: data.newValue || null,
    });

    const hash = crypto
      .createHash('sha256')
      .update(payloadString)
      .update(previousHash || 'genesis')
      .digest('hex');

    return this.auditLogRepository.save(
      this.auditLogRepository.create({
        ...data,
        hash,
        previousHash,
      }),
    );
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
      const types = filters.entityType
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (types.length === 1) qb.andWhere('log.entityType = :entityType', { entityType: types[0] });
      else if (types.length > 1)
        qb.andWhere('log.entityType IN (:...entityTypes)', { entityTypes: types });
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

  /**
   * Aggregate audit events that touch a given patient. Looks up:
   *  - rows where entityType='patients' AND entityId = patientId
   *  - rows where new_value->>'patientId' = patientId (clinical mutations
   *    that include patientId in their structured payload — Rx safety
   *    overrides, critical-result alerts, allergies, etc.)
   *  - rows where old_value->>'patientId' = patientId (deletes of patient-
   *    linked rows where the original snapshot had patientId)
   */
  async findForPatient(opts: {
    patientId: string;
    limit?: number;
    action?: string;
    tenantId?: string;
  }) {
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .where(
        '((log.entityType = :patients AND log.entityId = :pid) ' +
          " OR log.new_value->>'patientId' = :pid " +
          " OR log.old_value->>'patientId' = :pid)",
        { patients: 'patients', pid: opts.patientId },
      );
    if (opts.tenantId) {
      qb.andWhere('log.tenantId = :tenantId', { tenantId: opts.tenantId });
    }
    if (opts.action) {
      qb.andWhere('log.action = :action', { action: opts.action });
    }
    qb.orderBy('log.createdAt', 'DESC').limit(limit);
    const data = await qb.getMany();
    return { data, total: data.length, patientId: opts.patientId };
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
