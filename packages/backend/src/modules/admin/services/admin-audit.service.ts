import { Injectable, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import * as crypto from 'crypto';
import {
  AdminAuditLog,
  AdminAuditAction,
  AdminAuditEntityType,
} from '../../../database/entities/admin-audit-log.entity';

interface AdminAuditLogInput {
  adminUserId?: string;
  tenantId?: string;
  action: AdminAuditAction;
  entityType: AdminAuditEntityType;
  entityId?: string;
  entityLabel?: string;
  description?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changeReason?: string;
  systemGenerated?: boolean;
  result?: 'success' | 'failure' | 'partial';
  errorMessage?: string;
}

export interface AdminAuditLogQuery {
  adminUserId?: string;
  tenantId?: string;
  action?: AdminAuditAction;
  entityType?: AdminAuditEntityType;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AdminAuditService {
  constructor(
    @InjectRepository(AdminAuditLog)
    private auditLogRepository: Repository<AdminAuditLog>,
    @Optional() @Inject(REQUEST) private request?: Request,
  ) {}

  /**
   * Record an admin action in the audit log
   * Extracts IP address and user agent from request context
   */
  async logAction(input: AdminAuditLogInput): Promise<AdminAuditLog> {
    const auditLog = new AdminAuditLog();
    auditLog.adminUserId = input.adminUserId;
    auditLog.tenantId = input.tenantId;
    auditLog.action = input.action;
    auditLog.entityType = input.entityType;
    auditLog.entityId = input.entityId;
    auditLog.entityLabel = input.entityLabel;
    auditLog.description = input.description;
    auditLog.oldValues = input.oldValues;
    auditLog.newValues = input.newValues;
    auditLog.changeReason = input.changeReason;
    auditLog.systemGenerated = input.systemGenerated ?? false;
    auditLog.result = input.result ?? 'success';
    auditLog.errorMessage = input.errorMessage;

    // Extract IP and user agent from request if available
    if (this.request) {
      auditLog.ipAddress =
        this.request.ip ||
        (this.request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        'unknown';
      auditLog.userAgent = this.request.headers['user-agent'] as string;
    }

    const previousLog = await this.auditLogRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' },
      select: ['hash'],
    });

    auditLog.previousHash = previousLog?.hash || undefined;

    const payloadString = JSON.stringify({
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      userId: auditLog.adminUserId,
      tenantId: auditLog.tenantId,
      oldValue: auditLog.oldValues || null,
      newValue: auditLog.newValues || null,
    });

    auditLog.hash = crypto
      .createHash('sha256')
      .update(payloadString)
      .update(auditLog.previousHash || 'genesis')
      .digest('hex');

    return this.auditLogRepository.save(auditLog);
  }

  /**
   * Log action with automatic entity label lookup
   * Useful for operations that need the entity name
   */
  async logActionWithLabel(
    input: AdminAuditLogInput,
    entityLabel?: string,
  ): Promise<AdminAuditLog> {
    return this.logAction({
      ...input,
      entityLabel: entityLabel || input.entityLabel,
    });
  }

  /**
   * Query audit logs with flexible filtering
   */
  async queryAuditLogs(query: AdminAuditLogQuery): Promise<{
    data: AdminAuditLog[];
    total: number;
  }> {
    let qb = this.auditLogRepository.createQueryBuilder('log');

    if (query.adminUserId) {
      qb = qb.andWhere('log.adminUserId = :adminUserId', {
        adminUserId: query.adminUserId,
      });
    }

    if (query.tenantId) {
      qb = qb.andWhere('log.tenantId = :tenantId', { tenantId: query.tenantId });
    }

    if (query.action) {
      qb = qb.andWhere('log.action = :action', { action: query.action });
    }

    if (query.entityType) {
      qb = qb.andWhere('log.entityType = :entityType', {
        entityType: query.entityType,
      });
    }

    if (query.entityId) {
      qb = qb.andWhere('log.entityId = :entityId', { entityId: query.entityId });
    }

    if (query.startDate && query.endDate) {
      qb = qb.andWhere('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate,
      });
    } else if (query.startDate) {
      qb = qb.andWhere('log.createdAt >= :startDate', {
        startDate: query.startDate,
      });
    } else if (query.endDate) {
      qb = qb.andWhere('log.createdAt <= :endDate', { endDate: query.endDate });
    }

    const total = await qb.getCount();

    qb = qb.orderBy('log.createdAt', 'DESC').addOrderBy('log.id', 'DESC');

    if (query.limit) {
      qb = qb.take(query.limit);
    }

    if (query.offset) {
      qb = qb.skip(query.offset);
    }

    const data = await qb.getMany();

    return { data, total };
  }

  /**
   * Get all logs for a specific entity
   * Useful for audit trail on a single entity
   */
  async getEntityAuditTrail(
    entityType: AdminAuditEntityType,
    entityId: string,
  ): Promise<AdminAuditLog[]> {
    return this.auditLogRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
      take: 1000,
    });
  }

  /**
   * Get all actions by a specific admin
   * Useful for investigating suspicious activity
   */
  async getAdminActivityLog(
    adminUserId: string,
    options?: { startDate?: Date; endDate?: Date; limit?: number },
  ): Promise<AdminAuditLog[]> {
    let qb = this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.adminUserId = :adminUserId', { adminUserId })
      .orderBy('log.createdAt', 'DESC');

    if (options?.startDate) {
      qb = qb.andWhere('log.createdAt >= :startDate', {
        startDate: options.startDate,
      });
    }

    if (options?.endDate) {
      qb = qb.andWhere('log.createdAt <= :endDate', { endDate: options.endDate });
    }

    if (options?.limit) {
      qb = qb.take(options.limit);
    }

    return qb.getMany();
  }

  /**
   * Get all changes to a tenant (for audit by organization admin or SaaS admin)
   */
  async getTenantAuditTrail(tenantId: string, limit = 1000): Promise<AdminAuditLog[]> {
    return this.auditLogRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Search audit logs by description
   * Useful for finding specific change reasons, ticket numbers, etc.
   */
  async searchAuditLogs(
    searchTerm: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: AdminAuditLog[]; total: number }> {
    const query = this.auditLogRepository
      .createQueryBuilder('log')
      .where(
        '(log.description ILIKE :term OR log.changeReason ILIKE :term OR log.entityLabel ILIKE :term)',
        { term: `%${searchTerm}%` },
      )
      .orderBy('log.createdAt', 'DESC');

    const total = await query.getCount();

    if (options?.limit) {
      query.take(options.limit);
    }

    if (options?.offset) {
      query.skip(options.offset);
    }

    const data = await query.getMany();

    return { data, total };
  }

  /**
   * Archive old logs (7+ years)
   * Call periodically to move audit logs to cold storage
   * For now, just marks as archived; real implementation would export to S3/Glacier
   */
  async archiveOldLogs(beforeDate: Date): Promise<number> {
    const result = await this.auditLogRepository.update(
      {
        createdAt: LessThanOrEqual(beforeDate),
        isArchived: false,
      },
      {
        isArchived: true,
        archivedAt: new Date(),
        archiveLocation: `s3://audit-archive/${new Date().getFullYear()}`,
      },
    );

    return result.affected || 0;
  }

  /**
   * Verify audit log integrity
   * For compliance: confirms no logs have been tampered with
   */
  async verifyLogIntegrity(logId: string): Promise<{ valid: boolean; checksum?: string }> {
    const log = await this.auditLogRepository.findOne({ where: { id: logId } });

    if (!log) {
      return { valid: false };
    }

    // Compute SHA256 hash of log fields and verify against stored checksum
    const payloadString = JSON.stringify({
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      userId: log.adminUserId,
      tenantId: log.tenantId,
      oldValue: log.oldValues || null,
      newValue: log.newValues || null,
    });

    const computedHash = crypto
      .createHash('sha256')
      .update(payloadString)
      .update(log.previousHash || 'genesis')
      .digest('hex');

    const isValid = computedHash === log.hash;

    return {
      valid: isValid,
      checksum: log.hash || `${log.id}:${log.createdAt.getTime()}`,
    };
  }

  /**
   * Export audit logs for compliance reporting
   * Returns CSV or JSON format
   */
  async exportAuditLogs(
    query: AdminAuditLogQuery,
    format: 'csv' | 'json' = 'json',
  ): Promise<string> {
    const { data } = await this.queryAuditLogs(query);

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // CSV format
    const headers = [
      'Timestamp',
      'Admin User ID',
      'Tenant ID',
      'Action',
      'Entity Type',
      'Entity ID',
      'Entity Label',
      'Description',
      'IP Address',
      'Result',
      'Change Reason',
    ];

    const rows = data.map((log) => [
      log.createdAt.toISOString(),
      log.adminUserId || '',
      log.tenantId || '',
      log.action,
      log.entityType,
      log.entityId || '',
      log.entityLabel || '',
      log.description || '',
      log.ipAddress || '',
      log.result,
      log.changeReason || '',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    return csv;
  }

  /**
   * Count logs by action type (for dashboard/analytics)
   */
  async getActionStats(tenantId?: string, since?: Date): Promise<Record<AdminAuditAction, number>> {
    let qb = this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.action');

    if (tenantId) {
      qb = qb.where('log.tenantId = :tenantId', { tenantId });
    }

    if (since) {
      qb = qb.andWhere('log.createdAt >= :since', { since });
    }

    const results = await qb.getRawMany();

    const stats: Record<AdminAuditAction, number> = {} as any;
    results.forEach((r) => {
      stats[r.action as AdminAuditAction] = parseInt(r.count);
    });

    return stats;
  }

  /**
   * Get recent suspicious activity patterns
   * (e.g., multiple failed operations, after-hours access)
   */
  async detectAnomalies(hours = 24): Promise<AdminAuditLog[]> {
    const since = new Date(Date.now() - hours * 3600000);

    // Find: multiple failures by same admin, or unusual actions
    return this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.createdAt >= :since', { since })
      .andWhere('(log.result = :result OR log.action IN (:actions))', {
        result: 'failure',
        actions: [
          AdminAuditAction.RESET_PASSWORD,
          AdminAuditAction.FORCE_MFA,
          AdminAuditAction.DISABLE_MFA,
        ],
      })
      .orderBy('log.createdAt', 'DESC')
      .take(100)
      .getMany();
  }
}
