import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { JournalEntry } from '../../database/entities/journal-entry.entity';

interface CompliancePolicy {
  name: string;
  retentionDays: number;
  archiveAfterDays: number;
  description: string;
}

/**
 * AuditComplianceService
 *
 * IMPORTANT: the audit_logs table currently has no `tenant_id` column. To
 * keep this service tenant-safe we only count audit log rows whose
 * `entity_id` corresponds to a journal_entry belonging to the caller's
 * tenant. A platform-wide audit_logs.tenant_id column is tracked as a
 * follow-up (Sprint-3); when it ships, the JE-join logic below can be
 * replaced with a direct WHERE.
 */
@Injectable()
export class AuditComplianceService {
  private readonly logger = new Logger(AuditComplianceService.name);

  private readonly defaultPolicies: Record<string, CompliancePolicy> = {
    STANDARD: {
      name: 'Standard Retention',
      retentionDays: 365,
      archiveAfterDays: 90,
      description: 'Archive after 90 days, delete after 365 days',
    },
    REGULATORY: {
      name: 'Regulatory Compliance',
      retentionDays: 2555,
      archiveAfterDays: 180,
      description: 'Archive after 6 months, retain for 7 years (HIPAA/SOX)',
    },
    FINANCIAL: {
      name: 'Financial Records',
      retentionDays: 1825,
      archiveAfterDays: 90,
      description: 'Archive after 90 days, retain for 5 years',
    },
  };

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepo: Repository<JournalEntry>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private requireTenant(tenantId: string | undefined | null): string {
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return tenantId;
  }

  /**
   * Build a tenant-scoped query against audit_logs by joining through
   * journal_entries on entity_id. Only journal-entry-related audit rows
   * are returned.
   */
  private tenantScopedAuditQB(tenantId: string) {
    return this.auditLogRepo
      .createQueryBuilder('al')
      .innerJoin(
        JournalEntry,
        'je',
        'je.id::text = al.entity_id::text AND je.tenant_id = :tid',
        { tid: tenantId },
      )
      .where("al.entity_type IN ('journal_entry', 'JournalEntry')");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  getCompliancePolicies(): Record<string, CompliancePolicy> {
    return this.defaultPolicies;
  }

  async checkComplianceStatus(
    policyName: string = 'STANDARD',
    tenantId: string,
  ): Promise<{
    policyName: string;
    status: string;
    auditRecordsCount: number;
    recordsOverdue: number;
    percentCompliance: number;
    details: {
      retentionDays: number;
      archiveAfterDays: number;
      lastAuditDate?: Date;
      nextReviewDate: Date;
    };
  }> {
    const tid = this.requireTenant(tenantId);
    const policy = this.defaultPolicies[policyName];
    if (!policy) {
      throw new BadRequestException(`Unknown policy: ${policyName}`);
    }

    const totalRecords = await this.tenantScopedAuditQB(tid).getCount();

    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - policy.archiveAfterDays);

    const overdueRecords = await this.tenantScopedAuditQB(tid)
      .andWhere('al.created_at < :archiveDate', { archiveDate })
      .getCount();

    const percentCompliance =
      totalRecords === 0
        ? 100
        : Math.round(((totalRecords - overdueRecords) / totalRecords) * 100);

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 30);

    return {
      policyName,
      status: percentCompliance >= 95 ? 'COMPLIANT' : 'NON_COMPLIANT',
      auditRecordsCount: totalRecords,
      recordsOverdue: overdueRecords,
      percentCompliance,
      details: {
        retentionDays: policy.retentionDays,
        archiveAfterDays: policy.archiveAfterDays,
        lastAuditDate: new Date(),
        nextReviewDate: nextReview,
      },
    };
  }

  async generateComplianceAudit(
    periodDays: number = 90,
    tenantId: string,
  ): Promise<{
    periodDays: number;
    totalRecords: number;
    recordsByAction: Record<string, number>;
    recordsByUser: Record<string, number>;
    criticalOperations: Array<{
      id: string;
      action: string;
      userId: string;
      timestamp: Date;
      details: any;
    }>;
    complianceScore: number;
  }> {
    const tid = this.requireTenant(tenantId);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const records: AuditLog[] = await this.tenantScopedAuditQB(tid)
      .andWhere('al.created_at > :startDate', { startDate })
      .orderBy('al.created_at', 'DESC')
      .select('al')
      .getMany();

    const byAction: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const critical: any[] = [];

    for (const record of records) {
      const action = record.action || 'UNKNOWN';
      byAction[action] = (byAction[action] || 0) + 1;

      const userId = record.userId || 'SYSTEM';
      byUser[userId] = (byUser[userId] || 0) + 1;

      if (
        ['DELETE', 'UPDATE', 'MODIFY', 'CHANGE_APPROVAL'].includes(action)
      ) {
        critical.push({
          id: record.id,
          action,
          userId,
          timestamp: record.createdAt,
          details: {
            action: record.action,
            oldValue: record.oldValue,
            newValue: record.newValue,
            reason: record.reason,
          },
        });
      }
    }

    const criticalCountRatio =
      critical.length > 0 ? Math.min(critical.length / 100, 1) : 0;
    const complianceScore = Math.round((1 - criticalCountRatio) * 100);

    return {
      periodDays,
      totalRecords: records.length,
      recordsByAction: byAction,
      recordsByUser: byUser,
      criticalOperations: critical.slice(0, 20),
      complianceScore,
    };
  }

  /**
   * Archive (REPORT-ONLY) inactive audit records.
   *
   * Audit logs are append-only; this method MUST never delete rows.
   * It returns the candidate count and an estimated archive size so the
   * UI can display compliance progress, but performs no destructive work.
   * Any actual archiving must be done by an offline ETL job that ships
   * data into cold storage, never by an HTTP request.
   */
  async archiveInactiveRecords(
    archiveDate: Date,
    _dryRun: boolean = true,
    tenantId?: string,
  ): Promise<{
    recordsToArchive: number;
    estimatedSize: string;
    note: string;
  }> {
    const tid = this.requireTenant(tenantId);
    const candidateCount = await this.tenantScopedAuditQB(tid)
      .andWhere('al.created_at < :archiveDate', { archiveDate })
      .getCount();

    return {
      recordsToArchive: candidateCount,
      estimatedSize: `${(candidateCount * 0.0008).toFixed(2)} MB`,
      note:
        'Audit logs are append-only. This endpoint reports candidates only; ' +
        'no rows have been deleted. Use the offline archive job for cold-storage transfer.',
    };
  }

  async generateComplianceReport(
    includePeriodDays: number = 90,
    tenantId: string,
  ): Promise<{
    reportDate: Date;
    reportPeriod: number;
    policyCoverage: Array<{
      policyName: string;
      status: string;
      percentCompliance: number;
    }>;
    auditTrail: {
      totalRecords: number;
      criticalOperations: number;
      complianceScore: number;
    };
    recommendations: string[];
  }> {
    const tid = this.requireTenant(tenantId);
    const policyStatus: Array<{
      policyName: string;
      status: string;
      percentCompliance: number;
    }> = [];

    for (const policyName of Object.keys(this.defaultPolicies)) {
      const status = await this.checkComplianceStatus(policyName, tid);
      policyStatus.push({
        policyName: status.policyName,
        status: status.status,
        percentCompliance: status.percentCompliance,
      });
    }

    const auditTrail = await this.generateComplianceAudit(
      includePeriodDays,
      tid,
    );

    const recommendations: string[] = [];
    if (auditTrail.complianceScore < 80) {
      recommendations.push(
        'Review and increase controls for critical operations',
      );
    }
    if (auditTrail.criticalOperations.length > 50) {
      recommendations.push('Investigate high volume of critical operations');
    }
    policyStatus.forEach((ps) => {
      if (ps.status === 'NON_COMPLIANT') {
        recommendations.push(`${ps.policyName} policy is not compliant`);
      }
    });
    if (recommendations.length === 0) {
      recommendations.push('System is fully compliant with all policies');
    }

    return {
      reportDate: new Date(),
      reportPeriod: includePeriodDays,
      policyCoverage: policyStatus,
      auditTrail: {
        totalRecords: auditTrail.totalRecords,
        criticalOperations: auditTrail.criticalOperations.length,
        complianceScore: auditTrail.complianceScore,
      },
      recommendations,
    };
  }

  async verifyAuditIntegrity(tenantId: string): Promise<{
    isValid: boolean;
    totalRecords: number;
    gapsDetected: number;
    lastVerificationDate: Date;
    nextVerificationDate: Date;
  }> {
    const tid = this.requireTenant(tenantId);

    const totalRecords = await this.tenantScopedAuditQB(tid).getCount();

    const records: AuditLog[] = await this.tenantScopedAuditQB(tid)
      .orderBy('al.created_at', 'DESC')
      .limit(1000)
      .select('al')
      .getMany();

    let gaps = 0;
    for (let i = 0; i < records.length - 1; i++) {
      const ts1 = records[i].createdAt?.getTime();
      const ts2 = records[i + 1].createdAt?.getTime();
      if (!ts1 || !ts2) continue;
      const diffHours = (ts1 - ts2) / (1000 * 60 * 60);
      if (diffHours > 1 && records[i].userId === records[i + 1].userId) {
        gaps++;
      }
    }

    const nextVerification = new Date();
    nextVerification.setDate(nextVerification.getDate() + 7);

    return {
      isValid: gaps === 0,
      totalRecords,
      gapsDetected: gaps,
      lastVerificationDate: new Date(),
      nextVerificationDate: nextVerification,
    };
  }

  // Reserved imports kept tree-shake-friendly for older callers.
  // (MoreThan/LessThan no longer used directly but retained for back-compat
  // with any external imports.)
  static readonly _typeormGuards = { MoreThan, LessThan };
}
