import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';

/**
 * AuditService: Log all state changes for compliance, auditing, and debugging
 * Tracks user actions, changes, and metadata for procurement workflows
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  /**
   * Log an action on an entity
   * Used for PR/PO submit, approve, reject operations
   */
  async logAction(params: {
    action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'CREATE' | 'UPDATE' | 'DELETE';
    entityType: 'PURCHASE_REQUEST' | 'PURCHASE_ORDER' | 'GOODS_RECEIPT';
    entityId: string;
    userId: string;
    tenantId?: string;
    changes?: {
      field: string;
      oldValue?: any;
      newValue?: any;
    }[];
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      approvalLevel?: number;
      requiredRole?: string;
      actualRole?: string;
      amount?: number;
      comments?: string;
    };
  }): Promise<AuditLog | null> {
    try {
      const { action, entityType, entityId, userId, tenantId, changes, metadata } = params;

      // Build change summary
      const oldValue = changes?.reduce((acc, c) => ({ ...acc, [c.field]: c.oldValue }), {});
      const newValue = changes?.reduce((acc, c) => ({ ...acc, [c.field]: c.newValue }), {});

      const auditLog = this.auditRepo.create({
        userId,
        tenantId,
        action,
        entityType,
        entityId,
        oldValue: Object.keys(oldValue || {}).length > 0 ? oldValue : undefined,
        newValue: Object.keys(newValue || {}).length > 0 ? newValue : undefined,
        reason: metadata?.comments,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });

      const saved = await this.auditRepo.save(auditLog);
      this.logger.debug(`Audit logged: ${action} on ${entityType}/${entityId} by user ${userId}`);
      return saved;
    } catch (error) {
      this.logger.error(`Failed to log audit: ${error.message}`, error.stack);
      // Don't throw - audit failure shouldn't block operations
      return null;
    }
  }

  /**
   * Log PR submission
   */
  async logPRSubmit(params: {
    prId: string;
    requestNumber: string;
    totalEstimated: number;
    userId: string;
    tenantId?: string;
    metadata?: any;
  }): Promise<void> {
    await this.logAction({
      action: 'SUBMIT',
      entityType: 'PURCHASE_REQUEST',
      entityId: params.prId,
      userId: params.userId,
      tenantId: params.tenantId,
      changes: [
        { field: 'status', oldValue: 'DRAFT', newValue: 'PENDING_APPROVAL' },
        { field: 'submittedAt', newValue: new Date() },
      ],
      metadata: {
        ...params.metadata,
        comments: `PR submitted: ${params.requestNumber}, Amount: $${params.totalEstimated}`,
      },
    });
  }

  /**
   * Log PR approval
   */
  async logPRApprove(params: {
    prId: string;
    requestNumber: string;
    approvalLevel: number;
    requiredRole: string;
    actualRole: string;
    userId: string;
    tenantId?: string;
    comments?: string;
    amount?: number;
    metadata?: any;
  }): Promise<void> {
    await this.logAction({
      action: 'APPROVE',
      entityType: 'PURCHASE_REQUEST',
      entityId: params.prId,
      userId: params.userId,
      tenantId: params.tenantId,
      changes: [
        {
          field: 'approvalChain',
          oldValue: `Level ${params.approvalLevel - 1}`,
          newValue: `Level ${params.approvalLevel}`,
        },
      ],
      metadata: {
        ...params.metadata,
        approvalLevel: params.approvalLevel,
        requiredRole: params.requiredRole,
        actualRole: params.actualRole,
        comments: params.comments,
        amount: params.amount,
      },
    });
  }

  /**
   * Log PR rejection
   */
  async logPRReject(params: {
    prId: string;
    requestNumber: string;
    rejectedById: string;
    rejectionReason: string;
    tenantId?: string;
    metadata?: any;
  }): Promise<void> {
    await this.logAction({
      action: 'REJECT',
      entityType: 'PURCHASE_REQUEST',
      entityId: params.prId,
      userId: params.rejectedById,
      tenantId: params.tenantId,
      changes: [
        { field: 'status', oldValue: 'PENDING_APPROVAL', newValue: 'REJECTED' },
        { field: 'rejectedAt', newValue: new Date() },
        { field: 'rejectionReason', newValue: params.rejectionReason },
      ],
      metadata: {
        ...params.metadata,
        comments: `PR rejected: ${params.rejectionReason}`,
      },
    });
  }

  /**
   * Log PO creation
   */
  async logPOCreate(params: {
    poId: string;
    poNumber: string;
    totalAmount: number;
    userId: string;
    tenantId?: string;
    source?: 'FROM_PR' | 'DIRECT_PO';
    metadata?: any;
  }): Promise<void> {
    await this.logAction({
      action: 'CREATE',
      entityType: 'PURCHASE_ORDER',
      entityId: params.poId,
      userId: params.userId,
      tenantId: params.tenantId,
      changes: [
        { field: 'status', newValue: 'DRAFT' },
        { field: 'totalAmount', newValue: params.totalAmount },
      ],
      metadata: {
        ...params.metadata,
        comments: `PO created: ${params.poNumber} (${params.source || 'DIRECT'}), Amount: $${params.totalAmount}`,
      },
    });
  }

  /**
   * Log PO approval
   */
  async logPOApprove(params: {
    poId: string;
    poNumber: string;
    approvalLevel: number;
    requiredRole: string;
    actualRole: string;
    userId: string;
    tenantId?: string;
    comments?: string;
    amount?: number;
    metadata?: any;
  }): Promise<void> {
    await this.logAction({
      action: 'APPROVE',
      entityType: 'PURCHASE_ORDER',
      entityId: params.poId,
      userId: params.userId,
      tenantId: params.tenantId,
      changes: [
        {
          field: 'approvalChain',
          oldValue: `Level ${params.approvalLevel - 1}`,
          newValue: `Level ${params.approvalLevel}`,
        },
      ],
      metadata: {
        ...params.metadata,
        approvalLevel: params.approvalLevel,
        requiredRole: params.requiredRole,
        actualRole: params.actualRole,
        comments: params.comments,
        amount: params.amount,
      },
    });
  }

  /**
   * Get audit logs for an entity
   */
  async getEntityAuditLog(
    entityType: string,
    entityId: string,
    tenantId?: string,
  ): Promise<AuditLog[]> {
    const query = this.auditRepo
      .createQueryBuilder('log')
      .where('log.entityType = :entityType', { entityType })
      .andWhere('log.entityId = :entityId', { entityId })
      .orderBy('log.createdAt', 'DESC');

    // Always scope by tenantId to prevent cross-tenant audit log access
    if (tenantId) {
      query.andWhere('log.tenantId = :tenantId', { tenantId });
    } else {
      this.logger.warn('getEntityAuditLog called without tenantId — results not tenant-scoped');
    }

    return query.getMany();
  }

  /**
   * Get audit logs by user
   */
  async getUserAuditLog(userId: string, tenantId?: string, limit = 100): Promise<AuditLog[]> {
    const query = this.auditRepo
      .createQueryBuilder('log')
      .where('log.userId = :userId', { userId })
      .orderBy('log.createdAt', 'DESC')
      .limit(limit);

    if (tenantId) {
      query.andWhere('log.tenantId = :tenantId', { tenantId });
    } else {
      this.logger.warn('getUserAuditLog called without tenantId — results not tenant-scoped');
    }

    return query.getMany();
  }

  /**
   * Get audit logs by action
   */
  async getAuditLogsByAction(
    action: string,
    entityType: string,
    tenantId?: string,
    limit = 100,
  ): Promise<AuditLog[]> {
    const query = this.auditRepo
      .createQueryBuilder('log')
      .where('log.action = :action', { action })
      .andWhere('log.entityType = :entityType', { entityType })
      .orderBy('log.createdAt', 'DESC')
      .limit(limit);

    if (tenantId) {
      query.andWhere('log.tenantId = :tenantId', { tenantId });
    } else {
      this.logger.warn('getAuditLogsByAction called without tenantId — results not tenant-scoped');
    }

    return query.getMany();
  }
}
