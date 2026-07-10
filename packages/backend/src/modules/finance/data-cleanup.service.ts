import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';

function requireTenant(tenantId?: string): string {
  if (!tenantId) throw new ForbiddenException('Tenant context required');
  return tenantId;
}

@Injectable()
export class DataCleanupService {
  private readonly logger = new Logger('DataCleanupService');

  constructor(
    @InjectRepository(JournalEntryLine)
    private journalEntryLineRepo: Repository<JournalEntryLine>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  async detectOrphanedEntries(
    tenantId: string | undefined,
    dryRun: boolean = true,
  ): Promise<{
    orphanedCount: number;
    orphanIds: string[];
    deletedCount?: number;
  }> {
    const tid = requireTenant(tenantId);
    this.logger.debug(`Detecting orphaned entries (tenant: ${tid}, dryRun: ${dryRun})`);

    const orphaned = await this.journalEntryLineRepo
      .createQueryBuilder('jel')
      .leftJoin('jel.account', 'a')
      .innerJoin('jel.journalEntry', 'je')
      .where('a.id IS NULL')
      .andWhere('je.tenant_id = :tid', { tid })
      .select(['jel.id'])
      .getMany();

    const orphanIds = orphaned.map((e) => e.id!);

    if (!dryRun && orphanIds.length > 0) {
      const result = await this.journalEntryLineRepo.delete({ id: In(orphanIds) });
      this.logger.log(`Deleted ${result.affected} orphaned entries (tenant ${tid})`);
      return {
        orphanedCount: orphanIds.length,
        orphanIds,
        deletedCount: result.affected || 0,
      };
    }

    return { orphanedCount: orphanIds.length, orphanIds };
  }

  async detectDuplicateEntries(
    tenantId: string | undefined,
    dryRun: boolean = true,
  ): Promise<{
    duplicateGroups: number;
    affectedEntries: string[];
  }> {
    const tid = requireTenant(tenantId);
    this.logger.debug(`Detecting duplicate entries (tenant: ${tid}, dryRun: ${dryRun})`);

    const duplicates = await this.journalEntryLineRepo
      .createQueryBuilder('jel')
      .innerJoin('jel.journalEntry', 'je')
      .select('jel.account_id', 'account_id')
      .addSelect('jel.debit', 'debit')
      .addSelect('jel.credit', 'credit')
      .addSelect('jel.description', 'description')
      .addSelect('COUNT(*)', 'cnt')
      .where('je.tenant_id = :tid', { tid })
      .groupBy('jel.account_id, jel.debit, jel.credit, jel.description')
      .having('COUNT(*) > 1')
      .getRawMany();

    const affectedIds: Set<string> = new Set();

    for (const dup of duplicates) {
      const entries = await this.journalEntryLineRepo
        .createQueryBuilder('jel')
        .innerJoin('jel.journalEntry', 'je')
        .where('je.tenant_id = :tid', { tid })
        .andWhere('jel.account_id = :aid', { aid: dup.account_id })
        .andWhere('jel.debit = :debit', { debit: parseFloat(dup.debit) })
        .andWhere('jel.credit = :credit', { credit: parseFloat(dup.credit) })
        .andWhere('jel.description = :desc', { desc: dup.description })
        .orderBy('jel.created_at', 'ASC')
        .getMany();

      // Keep the earliest, mark the rest as duplicates
      entries.slice(1).forEach((e) => affectedIds.add(e.id!));
    }

    if (!dryRun && affectedIds.size > 0) {
      const ids = Array.from(affectedIds);
      const result = await this.journalEntryLineRepo.delete({ id: In(ids) });
      this.logger.log(`Deleted ${result.affected} duplicate entries (tenant ${tid})`);
    }

    return {
      duplicateGroups: duplicates.length,
      affectedEntries: Array.from(affectedIds),
    };
  }

  /**
   * Audit logs are append-only and may NOT be hard-deleted via this service.
   * This method only reports counts older than the retention threshold so an
   * archival/escrow process can take action through an out-of-band tool.
   */
  async reportOldAuditLogs(
    tenantId: string | undefined,
    retentionDays: number = 365,
  ): Promise<{ auditRecordsBeyondRetention: number }> {
    const tid = requireTenant(tenantId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const count = await this.auditLogRepo.count({
      where: { tenantId: tid, createdAt: LessThan(cutoffDate) },
    });

    return { auditRecordsBeyondRetention: count };
  }

  async getCleanupReport(tenantId: string | undefined): Promise<{
    orphanedEntries: number;
    duplicateEntries: number;
    auditLogsBeyondRetention: number;
    totalCleanupOpportunity: number;
    estimatedFreedSpace: string;
  }> {
    const orphaned = await this.detectOrphanedEntries(tenantId, true);
    const duplicates = await this.detectDuplicateEntries(tenantId, true);
    const oldLogs = await this.reportOldAuditLogs(tenantId, 365);

    const total = orphaned.orphanedCount + duplicates.affectedEntries.length;

    return {
      orphanedEntries: orphaned.orphanedCount,
      duplicateEntries: duplicates.affectedEntries.length,
      auditLogsBeyondRetention: oldLogs.auditRecordsBeyondRetention,
      totalCleanupOpportunity: total,
      estimatedFreedSpace: `${(total * 0.0015).toFixed(2)} MB`,
    };
  }

  async executeFullCleanup(
    tenantId: string | undefined,
    dryRun: boolean = true,
  ): Promise<{
    timestamp: Date;
    dryRun: boolean;
    results: {
      orphaned: { orphanedCount: number; deletedCount?: number };
      duplicates: { affectedEntries: string[] };
      auditLogsBeyondRetention: number;
    };
    summary: {
      totalRecordsAffected: number;
      operationsCompleted: number;
    };
  }> {
    this.logger.log(`Starting full cleanup cycle (tenant: ${tenantId}, dryRun: ${dryRun})`);

    const orphaned = await this.detectOrphanedEntries(tenantId, dryRun);
    const duplicates = await this.detectDuplicateEntries(tenantId, dryRun);
    const auditLogs = await this.reportOldAuditLogs(tenantId, 365);

    const totalAffected = (orphaned.deletedCount || 0) + duplicates.affectedEntries.length;

    return {
      timestamp: new Date(),
      dryRun,
      results: {
        orphaned,
        duplicates,
        auditLogsBeyondRetention: auditLogs.auditRecordsBeyondRetention,
      },
      summary: {
        totalRecordsAffected: totalAffected,
        operationsCompleted: 2,
      },
    };
  }
}
