import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Backup } from '../../database/entities/backup.entity';
import { BackupSchedule } from '../../database/entities/backup-schedule.entity';
import { DrDrill } from '../../database/entities/dr-drill.entity';

const BACKUP_TABLES = [
  'users',
  'patients',
  'encounters',
  'invoices',
  'inventory_items',
  'audit_logs',
  'services',
  'roles',
];

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupsDir: string;

  constructor(
    @InjectRepository(Backup)
    private readonly backupRepository: Repository<Backup>,
    @InjectRepository(BackupSchedule)
    private readonly scheduleRepository: Repository<BackupSchedule>,
    @InjectRepository(DrDrill)
    private readonly drDrillRepository: Repository<DrDrill>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.backupsDir = path.resolve(__dirname, '..', '..', '..', 'backups');
  }

  async createBackup(tenantId: string, userId: string): Promise<Backup> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}.json`;
    const tenantDir = path.join(this.backupsDir, tenantId);
    const filePath = path.join(tenantDir, filename);

    const backup = this.backupRepository.create({
      tenantId,
      filename,
      filePath,
      status: 'in_progress',
      createdBy: userId,
    });
    await this.backupRepository.save(backup);

    try {
      const data: Record<string, any[]> = {};

      for (const table of BACKUP_TABLES) {
        try {
          if (table === 'audit_logs') {
            // Limit audit logs to last 1000 entries
            const rows = await this.dataSource.query(
              `SELECT * FROM "audit_logs" WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1000`,
              [tenantId],
            );
            data[table] = rows;
          } else {
            const rows = await this.dataSource.query(
              `SELECT * FROM "${table}" WHERE tenant_id = $1`,
              [tenantId],
            );
            data[table] = rows;
          }
        } catch (err) {
          // Table may not exist — skip gracefully
          this.logger.warn(`Skipping table "${table}": ${err.message}`);
          data[table] = [];
        }
      }

      fs.mkdirSync(tenantDir, { recursive: true });
      const json = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, json, 'utf-8');

      const stats = fs.statSync(filePath);
      backup.sizeBytes = stats.size;
      backup.status = 'completed';
      await this.backupRepository.save(backup);

      this.logger.log(`Backup completed: ${filename} (${stats.size} bytes) for tenant ${tenantId}`);
    } catch (err) {
      backup.status = 'failed';
      backup.notes = err.message;
      await this.backupRepository.save(backup);
      this.logger.error(`Backup failed for tenant ${tenantId}: ${err.message}`);
      throw err;
    }

    return backup;
  }

  async listBackups(tenantId: string): Promise<Backup[]> {
    return this.backupRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async downloadBackup(id: string, tenantId: string): Promise<Backup> {
    const backup = await this.backupRepository.findOne({
      where: { id, tenantId },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    // F-09: prevent path-traversal / arbitrary-file-read via tampered file_path.
    // Resolve and confirm the stored path is contained within backupsDir/<tenantId>/.
    const expectedRoot = path.resolve(this.backupsDir, tenantId);
    const resolved = path.resolve(backup.filePath);
    if (!resolved.startsWith(expectedRoot + path.sep) && resolved !== expectedRoot) {
      this.logger.warn(
        `Refusing to serve backup ${id}: filePath ${backup.filePath} escapes ${expectedRoot}`,
      );
      throw new ForbiddenException('Invalid backup path');
    }

    return backup;
  }

  async deleteBackup(id: string, tenantId: string): Promise<void> {
    const backup = await this.backupRepository.findOne({
      where: { id, tenantId },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    if (fs.existsSync(backup.filePath)) {
      fs.unlinkSync(backup.filePath);
    }

    await this.backupRepository.remove(backup);
  }

  async restoreBackup(
    backupId: string,
    tenantId: string,
    userId: string,
  ): Promise<{ success: boolean; tables: string[]; errors: string[] }> {
    const backup = await this.backupRepository.findOne({
      where: { id: backupId, tenantId },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    if (!fs.existsSync(backup.filePath)) {
      throw new NotFoundException('Backup file not found on disk');
    }

    const raw = fs.readFileSync(backup.filePath, 'utf-8');
    let data: Record<string, any[]>;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new BadRequestException('Backup file contains invalid JSON');
    }

    const restoredTables: string[] = [];
    const errors: string[] = [];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const table of Object.keys(data)) {
        const rows = data[table];
        if (!Array.isArray(rows) || rows.length === 0) {
          continue;
        }

        try {
          // Delete existing tenant data for this table
          await queryRunner.query(
            `DELETE FROM "${table}" WHERE tenant_id = $1`,
            [tenantId],
          );

          // Re-insert rows from backup
          for (const row of rows) {
            const columns = Object.keys(row);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const quotedColumns = columns.map((c) => `"${c}"`).join(', ');
            const values = columns.map((c) => row[c]);

            await queryRunner.query(
              `INSERT INTO "${table}" (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
              values,
            );
          }

          restoredTables.push(table);
        } catch (err) {
          errors.push(`Table "${table}": ${err.message}`);
        }
      }

      if (errors.length > 0 && restoredTables.length === 0) {
        // All tables failed - rollback
        await queryRunner.rollbackTransaction();
        this.logger.error(`Restore failed completely for backup ${backupId}: ${errors.join('; ')}`);
        return { success: false, tables: [], errors };
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Restore completed for backup ${backupId} by user ${userId}: ${restoredTables.length} tables restored`,
      );

      return { success: true, tables: restoredTables, errors };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Restore failed for backup ${backupId}: ${err.message}`);
      return { success: false, tables: [], errors: [err.message] };
    } finally {
      await queryRunner.release();
    }
  }

  async importSnapshot(opts: {
    tenantId: string;
    deploymentId?: string;
    file: Express.Multer.File;
    uploadedBy?: string;
    notes?: string;
  }): Promise<Backup> {
    const { tenantId, deploymentId, file, uploadedBy, notes } = opts;
    if (!file) throw new NotFoundException('No snapshot file provided');

    const tenantDir = path.join(this.backupsDir, tenantId);
    fs.mkdirSync(tenantDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeOriginal = (file.originalname || 'snapshot').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `imported-${timestamp}-${safeOriginal}`;
    const filePath = path.join(tenantDir, filename);

    fs.writeFileSync(filePath, file.buffer);
    const stats = fs.statSync(filePath);

    const annotated = [
      notes?.trim(),
      deploymentId ? `deploymentId=${deploymentId}` : null,
      'source=imported',
    ]
      .filter(Boolean)
      .join(' | ');

    const backup = this.backupRepository.create({
      tenantId,
      filename,
      filePath,
      sizeBytes: stats.size,
      status: 'completed',
      createdBy: uploadedBy,
      notes: annotated,
    });

    await this.backupRepository.save(backup);
    this.logger.log(`Imported snapshot ${filename} (${stats.size} bytes) for tenant ${tenantId}`);
    return backup;
  }

  async listSnapshotsForTenant(tenantId: string): Promise<Backup[]> {
    return this.backupRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Backup | null> {
    return this.backupRepository.findOne({ where: { id } });
  }

  /**
   * Compute restore instructions for an imported snapshot. We do NOT auto-restore
   * on the central server (that would mutate a tenant DB without operator review);
   * instead we surface a download URL, file checksum, and copy-paste commands the
   * on-prem operator runs locally to restore into the tenant box.
   */
  async getRestoreInstructions(snapshotId: string, downloadBaseUrl: string): Promise<{
    snapshotId: string;
    filename: string;
    sizeBytes: number;
    sha256: string;
    downloadUrl: string;
    detectedFormat: 'sql' | 'pg_custom' | 'tar' | 'json' | 'unknown';
    commands: { label: string; command: string }[];
    warnings: string[];
  }> {
    const backup = await this.findById(snapshotId);
    if (!backup) throw new NotFoundException('Snapshot not found');
    if (!fs.existsSync(backup.filePath)) throw new NotFoundException('Snapshot file missing on disk');

    const buf = fs.readFileSync(backup.filePath);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

    const lower = backup.filename.toLowerCase();
    let detectedFormat: 'sql' | 'pg_custom' | 'tar' | 'json' | 'unknown' = 'unknown';
    if (lower.endsWith('.sql')) detectedFormat = 'sql';
    else if (lower.endsWith('.dump') || lower.endsWith('.pgdump')) detectedFormat = 'pg_custom';
    else if (lower.endsWith('.tar') || lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) detectedFormat = 'tar';
    else if (lower.endsWith('.json')) detectedFormat = 'json';

    const downloadUrl = `${downloadBaseUrl.replace(/\/+$/, '')}/api/v1/deployments/snapshots/${snapshotId}/download`;
    const warnings = [
      'Stop the tenant application before restoring to avoid concurrent writes.',
      'Take a fresh snapshot of the current state before overwriting.',
      'Verify the SHA-256 checksum after download with: shasum -a 256 ' + backup.filename,
    ];

    const commands: { label: string; command: string }[] = [
      {
        label: 'Download (authenticated)',
        command: `curl -L -o ${backup.filename} -H "Cookie: $GLIDE_AUTH_COOKIE" "${downloadUrl}"`,
      },
      { label: 'Verify checksum', command: `echo "${sha256}  ${backup.filename}" | shasum -a 256 -c` },
    ];

    if (detectedFormat === 'sql') {
      commands.push({
        label: 'Restore (PostgreSQL plain SQL)',
        command: `psql -h <db-host> -U <db-user> -d <tenant-db> -f ${backup.filename}`,
      });
    } else if (detectedFormat === 'pg_custom') {
      commands.push({
        label: 'Restore (pg_restore custom format)',
        command: `pg_restore --clean --if-exists -h <db-host> -U <db-user> -d <tenant-db> ${backup.filename}`,
      });
    } else if (detectedFormat === 'tar') {
      commands.push({
        label: 'Extract archive',
        command: `tar -xzvf ${backup.filename} -C ./snapshot-extracted`,
      });
      commands.push({
        label: 'Restore extracted SQL (adjust filename)',
        command: `psql -h <db-host> -U <db-user> -d <tenant-db> -f ./snapshot-extracted/dump.sql`,
      });
    } else if (detectedFormat === 'json') {
      commands.push({
        label: 'Restore (Glide-HIMS JSON snapshot)',
        command: `node ./scripts/restore-json-snapshot.js --tenant=<tenant-id> --file=${backup.filename}`,
      });
    } else {
      warnings.push('Unrecognised file extension — confirm the snapshot format manually before restoring.');
    }

    this.logger.log(`Restore instructions issued for snapshot ${snapshotId} (${backup.filename})`);
    return {
      snapshotId,
      filename: backup.filename,
      sizeBytes: backup.sizeBytes,
      sha256,
      downloadUrl,
      detectedFormat,
      commands,
      warnings,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Backup Schedule Management
  // ───────────────────────────────────────────────────────────────────────────

  async createSchedule(
    dto: {
      frequency: string;
      timeOfDay: string;
      dayOfWeek?: number | null;
      dayOfMonth?: number | null;
      retentionDays?: number;
      enabled?: boolean;
    },
    tenantId: string,
  ): Promise<BackupSchedule> {
    const schedule = this.scheduleRepository.create({
      tenantId,
      frequency: dto.frequency,
      timeOfDay: dto.timeOfDay,
      dayOfWeek: dto.dayOfWeek ?? null,
      dayOfMonth: dto.dayOfMonth ?? null,
      retentionDays: dto.retentionDays ?? 30,
      enabled: dto.enabled ?? true,
      nextRunAt: null,
    });

    schedule.nextRunAt = this.calculateNextRun(schedule);
    return this.scheduleRepository.save(schedule);
  }

  async updateSchedule(
    id: string,
    dto: Partial<{
      frequency: string;
      timeOfDay: string;
      dayOfWeek: number | null;
      dayOfMonth: number | null;
      retentionDays: number;
      enabled: boolean;
    }>,
    tenantId: string,
  ): Promise<BackupSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, tenantId },
    });

    if (!schedule) {
      throw new NotFoundException('Backup schedule not found');
    }

    Object.assign(schedule, dto);
    schedule.nextRunAt = this.calculateNextRun(schedule);
    return this.scheduleRepository.save(schedule);
  }

  async deleteSchedule(id: string, tenantId: string): Promise<void> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, tenantId },
    });

    if (!schedule) {
      throw new NotFoundException('Backup schedule not found');
    }

    await this.scheduleRepository.remove(schedule);
  }

  async listSchedules(tenantId: string): Promise<BackupSchedule[]> {
    return this.scheduleRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Runs every hour to check which backup schedules need to run.
   * Compares nextRunAt with current time and triggers backups accordingly.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runScheduledBackups(): Promise<void> {
    const now = new Date();

    try {
      const dueSchedules = await this.scheduleRepository
        .createQueryBuilder('s')
        .where('s.enabled = :enabled', { enabled: true })
        .andWhere('s.next_run_at IS NOT NULL')
        .andWhere('s.next_run_at <= :now', { now })
        .getMany();

      for (const schedule of dueSchedules) {
        try {
          this.logger.log(
            `Running scheduled backup for tenant ${schedule.tenantId} (schedule ${schedule.id})`,
          );

          await this.createBackup(schedule.tenantId!, 'system-scheduler');

          schedule.lastRunAt = now;
          schedule.lastRunStatus = 'success';
          schedule.nextRunAt = this.calculateNextRun(schedule);
          await this.scheduleRepository.save(schedule);

          this.logger.log(
            `Scheduled backup succeeded for tenant ${schedule.tenantId}, next run at ${schedule.nextRunAt}`,
          );
        } catch (err) {
          schedule.lastRunAt = now;
          schedule.lastRunStatus = 'failed';
          schedule.nextRunAt = this.calculateNextRun(schedule);
          await this.scheduleRepository.save(schedule);

          this.logger.error(
            `Scheduled backup failed for tenant ${schedule.tenantId}: ${err.message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`Error in runScheduledBackups cron: ${err.message}`);
    }
  }

  /**
   * Calculate the next run time based on the schedule's frequency, timeOfDay,
   * dayOfWeek, and dayOfMonth settings.
   */
  calculateNextRun(schedule: BackupSchedule): Date {
    const now = new Date();
    const [hours, minutes] = (schedule.timeOfDay || '02:00').split(':').map(Number);

    let next = new Date(now);
    next.setSeconds(0, 0);
    next.setHours(hours, minutes);

    switch (schedule.frequency) {
      case 'daily': {
        // If today's run time has passed, schedule for tomorrow
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        break;
      }

      case 'weekly': {
        const targetDay = schedule.dayOfWeek ?? 0; // default Sunday
        const currentDay = next.getDay();
        let daysUntilTarget = targetDay - currentDay;
        if (daysUntilTarget < 0 || (daysUntilTarget === 0 && next <= now)) {
          daysUntilTarget += 7;
        }
        next.setDate(next.getDate() + daysUntilTarget);
        break;
      }

      case 'monthly': {
        const targetDate = schedule.dayOfMonth ?? 1; // default 1st
        next.setDate(targetDate);
        // If this month's run date has passed, move to next month
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
          next.setDate(targetDate);
        }
        break;
      }

      default: {
        // Fallback: run tomorrow at the specified time
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        break;
      }
    }

    return next;
  }

  /**
   * Runs daily at 4 AM to purge expired backups based on retention policies.
   */
  @Cron('0 4 * * *')
  async purgeExpiredBackups(): Promise<void> {
    try {
      const schedules = await this.scheduleRepository.find({
        where: { enabled: true },
      });

      // Build a map of tenantId -> minimum retention days
      const retentionByTenant = new Map<string, number>();
      for (const schedule of schedules) {
        if (!schedule.tenantId) continue;
        const current = retentionByTenant.get(schedule.tenantId) ?? Infinity;
        retentionByTenant.set(
          schedule.tenantId,
          Math.min(current, schedule.retentionDays),
        );
      }

      let totalPurged = 0;

      for (const [tenantId, retentionDays] of retentionByTenant.entries()) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const expiredBackups = await this.backupRepository.find({
          where: {
            tenantId,
            createdAt: LessThan(cutoffDate),
          },
        });

        for (const backup of expiredBackups) {
          try {
            if (fs.existsSync(backup.filePath)) {
              fs.unlinkSync(backup.filePath);
            }
            await this.backupRepository.remove(backup);
            totalPurged++;
          } catch (err) {
            this.logger.error(
              `Failed to purge backup ${backup.id} for tenant ${tenantId}: ${err.message}`,
            );
          }
        }
      }

      if (totalPurged > 0) {
        this.logger.log(`Purged ${totalPurged} expired backups`);
      }
    } catch (err) {
      this.logger.error(`Error in purgeExpiredBackups cron: ${err.message}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DR Drill Management
  // ───────────────────────────────────────────────────────────────────────────

  async createDrDrill(
    dto: {
      drillType: string;
      scheduledAt: Date | string;
      backupId?: string;
      notes?: string;
      conductedBy?: string;
    },
    tenantId: string,
  ): Promise<DrDrill> {
    const drill = this.drDrillRepository.create({
      tenantId,
      drillType: dto.drillType,
      status: 'scheduled',
      scheduledAt: new Date(dto.scheduledAt),
      backupId: dto.backupId ?? null,
      notes: dto.notes ?? null,
      conductedBy: dto.conductedBy ?? null,
    });

    return this.drDrillRepository.save(drill);
  }

  async listDrDrills(tenantId: string): Promise<DrDrill[]> {
    return this.drDrillRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateDrDrill(
    id: string,
    dto: Partial<{
      status: string;
      startedAt: Date | string;
      completedAt: Date | string;
      restoreDurationMinutes: number;
      notes: string;
      conductedBy: string;
      result: { success: boolean; errors: string[]; warnings: string[] };
    }>,
  ): Promise<DrDrill> {
    const drill = await this.drDrillRepository.findOne({ where: { id } });

    if (!drill) {
      throw new NotFoundException('DR drill not found');
    }

    if (dto.startedAt) dto.startedAt = new Date(dto.startedAt);
    if (dto.completedAt) dto.completedAt = new Date(dto.completedAt);

    Object.assign(drill, dto);
    return this.drDrillRepository.save(drill);
  }
}
