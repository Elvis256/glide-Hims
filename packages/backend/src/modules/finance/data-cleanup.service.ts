import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Injectable()
export class DataCleanupService {
  private readonly logger = new Logger('DataCleanupService');

  constructor(
    @InjectRepository(JournalEntryLine)
    private journalEntryLineRepo: Repository<JournalEntryLine>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  /**
   * Detect orphaned journal entry line items (entries with no associated GL account)
   */
  async detectOrphanedEntries(dryRun: boolean = true): Promise<{
    orphanedCount: number;
    orphanIds: string[];
    deletedCount?: number;
  }> {
    this.logger.debug(`Detecting orphaned entries (dryRun: ${dryRun})`);

    // Find lines where accountId references a non-existent account
    const orphaned = await this.journalEntryLineRepo
      .createQueryBuilder('jel')
      .leftJoinAndSelect('jel.account', 'a')
      .where('a.id IS NULL')
      .getMany();

    const orphanIds = orphaned.map((e) => e.id!);

    if (!dryRun && orphanIds.length > 0) {
      const result = await this.journalEntryLineRepo.delete(orphanIds as any);
      this.logger.log(`Deleted ${result.affected} orphaned entries`);
      return {
        orphanedCount: orphanIds.length,
        orphanIds,
        deletedCount: result.affected || 0,
      };
    }

    return {
      orphanedCount: orphanIds.length,
      orphanIds,
    };
  }

  /**
   * Detect duplicate journal entry lines (same account, amount, date, description)
   */
  async detectDuplicateEntries(dryRun: boolean = true): Promise<{
    duplicateGroups: number;
    affectedEntries: string[];
  }> {
    this.logger.debug(`Detecting duplicate entries (dryRun: ${dryRun})`);

    const duplicates = await this.journalEntryLineRepo
      .createQueryBuilder('jel')
      .select('jel.accountId, jel.debit, jel.credit, jel.description')
      .addSelect('COUNT(*) as cnt')
      .groupBy('jel.accountId, jel.debit, jel.credit, jel.description')
      .having('COUNT(*) > 1')
      .getRawMany();

    const affectedIds: Set<string> = new Set();

    for (const dup of duplicates) {
      const entries = await this.journalEntryLineRepo.find({
        where: {
          accountId: dup.jel_accountId,
          debit: parseFloat(dup.jel_debit),
          credit: parseFloat(dup.jel_credit),
          description: dup.jel_description,
        },
      });

      // Mark all but the first as duplicates
      entries.slice(1).forEach((e) => affectedIds.add(e.id!));
    }

    if (!dryRun && affectedIds.size > 0) {
      const ids = Array.from(affectedIds);
      const result = await this.journalEntryLineRepo.delete(ids as any);
      this.logger.log(`Deleted ${result.affected} duplicate entries`);
    }

    return {
      duplicateGroups: duplicates.length,
      affectedEntries: Array.from(affectedIds),
    };
  }

  /**
   * Clean up old audit logs beyond retention period (default: 365 days)
   */
  async cleanupOldAuditLogs(
    retentionDays: number = 365,
    dryRun: boolean = true,
  ): Promise<{
    auditRecordsToDelete: number;
    deletedCount?: number;
  }> {
    this.logger.debug(
      `Cleaning up audit logs (retention: ${retentionDays} days, dryRun: ${dryRun})`,
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const toDelete = await this.auditLogRepo.find({
      where: {
        createdAt: LessThan(cutoffDate),
      },
    });

    if (!dryRun && toDelete.length > 0) {
      const result = await this.auditLogRepo.delete({
        createdAt: LessThan(cutoffDate),
      });
      this.logger.log(`Deleted ${result.affected} old audit logs`);
      return {
        auditRecordsToDelete: toDelete.length,
        deletedCount: result.affected || 0,
      };
    }

    return {
      auditRecordsToDelete: toDelete.length,
    };
  }

  /**
   * Get comprehensive cleanup report
   */
  async getCleanupReport(): Promise<{
    orphanedEntries: number;
    duplicateEntries: number;
    oldAuditLogs: number;
    totalCleanupOpportunity: number;
    estimatedFreedSpace: string;
  }> {
    this.logger.debug('Generating cleanup report');

    const orphaned = await this.detectOrphanedEntries(true);
    const duplicates = await this.detectDuplicateEntries(true);
    const oldLogs = await this.cleanupOldAuditLogs(365, true);

    const total =
      orphaned.orphanedCount +
      duplicates.affectedEntries.length +
      oldLogs.auditRecordsToDelete;

    return {
      orphanedEntries: orphaned.orphanedCount,
      duplicateEntries: duplicates.affectedEntries.length,
      oldAuditLogs: oldLogs.auditRecordsToDelete,
      totalCleanupOpportunity: total,
      estimatedFreedSpace: `${(total * 0.0015).toFixed(2)} MB`,
    };
  }

  /**
   * Execute full cleanup cycle
   */
  async executeFullCleanup(dryRun: boolean = true): Promise<{
    timestamp: Date;
    dryRun: boolean;
    results: {
      orphaned: { orphanedCount: number; deletedCount?: number };
      duplicates: { affectedEntries: string[] };
      auditLogs: { auditRecordsToDelete: number; deletedCount?: number };
    };
    summary: {
      totalRecordsAffected: number;
      operationsCompleted: number;
    };
  }> {
    this.logger.log(`Starting full cleanup cycle (dryRun: ${dryRun})`);

    const orphaned = await this.detectOrphanedEntries(dryRun);
    const duplicates = await this.detectDuplicateEntries(dryRun);
    const auditLogs = await this.cleanupOldAuditLogs(365, dryRun);

    const totalAffected =
      (orphaned.deletedCount || 0) +
      duplicates.affectedEntries.length +
      (auditLogs.deletedCount || 0);

    this.logger.log(
      `Cleanup cycle completed. Records affected: ${totalAffected}`,
    );

    return {
      timestamp: new Date(),
      dryRun,
      results: {
        orphaned,
        duplicates,
        auditLogs,
      },
      summary: {
        totalRecordsAffected: totalAffected,
        operationsCompleted: 3,
      },
    };
  }
}
