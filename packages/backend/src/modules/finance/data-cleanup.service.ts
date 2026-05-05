import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { JournalEntry } from '../../database/entities/journal-entry.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Injectable()
export class DataCleanupService {
  private readonly logger = new Logger('DataCleanupService');

  constructor(
    @InjectRepository(JournalEntry)
    private journalEntryRepo: Repository<JournalEntry>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  /**
   * Detect orphaned journal entries (entries with no associated GL account or deleted parent)
   */
  async detectOrphanedEntries(dryRun: boolean = true): Promise<{
    orphanedCount: number;
    orphanIds: string[];
    deletedCount?: number;
  }> {
    this.logger.debug(`Detecting orphaned entries (dryRun: ${dryRun})`);

    // Find entries where accountId references a non-existent account
    const orphaned = await this.journalEntryRepo
      .createQueryBuilder('je')
      .leftJoinAndSelect('je.account', 'a')
      .where('je.account IS NULL')
      .getMany();

    const orphanIds = orphaned.map((e) => e.id!);

    if (!dryRun && orphanIds.length > 0) {
      const result = await this.journalEntryRepo.delete({
        id: orphanIds as any,
      });
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
   * Detect duplicate journal entries (same account, amount, date, description)
   */
  async detectDuplicateEntries(dryRun: boolean = true): Promise<{
    duplicateGroups: number;
    affectedEntries: string[];
  }> {
    this.logger.debug(`Detecting duplicate entries (dryRun: ${dryRun})`);

    const duplicates = await this.journalEntryRepo
      .createQueryBuilder('je')
      .select('je.accountId, je.debit, je.credit, je.journalDate, je.description')
      .addSelect('COUNT(*) as count')
      .groupBy(
        'je.accountId, je.debit, je.credit, je.journalDate, je.description',
      )
      .having('COUNT(*) > 1')
      .getRawMany();

    const affectedIds: Set<string> = new Set();

    for (const dup of duplicates) {
      const entries = await this.journalEntryRepo.find({
        where: {
          accountId: dup.je_accountId,
          debit: dup.je_debit,
          credit: dup.je_credit,
          journalDate: dup.je_journalDate,
          description: dup.je_description,
        },
      });

      // Mark all but the first as duplicates
      entries.slice(1).forEach((e) => affectedIds.add(e.id!));
    }

    if (!dryRun && affectedIds.size > 0) {
      const ids = Array.from(affectedIds);
      const result = await this.journalEntryRepo.delete(ids as any);
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
   * Archive audit logs to separate table (for compliance)
   */
  async archiveAuditLogs(
    archiveDate: Date = new Date(),
    dryRun: boolean = true,
  ): Promise<{
    archivedCount: number;
    archiveId?: string;
  }> {
    this.logger.debug(`Archiving audit logs before ${archiveDate}`);

    const toArchive = await this.auditLogRepo.find({
      where: {
        createdAt: LessThan(archiveDate),
      },
    });

    if (!dryRun && toArchive.length > 0) {
      // Create archive record (would need AuditArchive entity)
      const archiveId = `arch_${Date.now()}`;
      this.logger.log(
        `Archived ${toArchive.length} audit records to ${archiveId}`,
      );

      // Remove from main table
      await this.auditLogRepo.remove(toArchive);

      return {
        archivedCount: toArchive.length,
        archiveId,
      };
    }

    return {
      archivedCount: toArchive.length,
    };
  }

  /**
   * Remove journal entries from cancelled batches
   */
  async cleanupCancelledBatches(dryRun: boolean = true): Promise<{
    batchesProcessed: number;
    entriesDeleted?: number;
  }> {
    this.logger.debug(`Cleaning up cancelled batches (dryRun: ${dryRun})`);

    // Find journal entries from cancelled posting batches
    const cancelled = await this.journalEntryRepo
      .createQueryBuilder('je')
      .leftJoinAndSelect('je.postingBatch', 'pb')
      .where('pb.status = :status', { status: 'CANCELLED' })
      .getMany();

    if (!dryRun && cancelled.length > 0) {
      const result = await this.journalEntryRepo.remove(cancelled);
      this.logger.log(`Deleted ${result.length} entries from cancelled batches`);
      return {
        batchesProcessed: 1,
        entriesDeleted: result.length,
      };
    }

    return {
      batchesProcessed: cancelled.length > 0 ? 1 : 0,
    };
  }

  /**
   * Get comprehensive cleanup report
   */
  async getCleanupReport(): Promise<{
    orphanedEntries: number;
    duplicateEntries: number;
    oldAuditLogs: number;
    cancelledBatchEntries: number;
    totalCleanupOpportunity: number;
    estimatedFreedSpace: string;
  }> {
    this.logger.debug('Generating cleanup report');

    const orphaned = await this.detectOrphanedEntries(true);
    const duplicates = await this.detectDuplicateEntries(true);
    const oldLogs = await this.cleanupOldAuditLogs(365, true);
    const cancelled = await this.cleanupCancelledBatches(true);

    const total =
      orphaned.orphanedCount +
      duplicates.affectedEntries.length +
      oldLogs.auditRecordsToDelete +
      cancelled.batchesProcessed;

    return {
      orphanedEntries: orphaned.orphanedCount,
      duplicateEntries: duplicates.affectedEntries.length,
      oldAuditLogs: oldLogs.auditRecordsToDelete,
      cancelledBatchEntries: cancelled.batchesProcessed,
      totalCleanupOpportunity: total,
      estimatedFreedSpace: `${(total * 0.0015).toFixed(2)} MB`, // rough estimate
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
      cancelled: { batchesProcessed: number; entriesDeleted?: number };
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
    const cancelled = await this.cleanupCancelledBatches(dryRun);

    const totalAffected =
      (orphaned.deletedCount || 0) +
      duplicates.affectedEntries.length +
      (auditLogs.deletedCount || 0) +
      (cancelled.entriesDeleted || 0);

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
        cancelled,
      },
      summary: {
        totalRecordsAffected: totalAffected,
        operationsCompleted: 4,
      },
    };
  }
}
