import { Injectable, Logger, NotFoundException, NotImplementedException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Backup } from '../../database/entities/backup.entity';

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

  async restoreBackup(id: string, tenantId: string): Promise<void> {
    throw new NotImplementedException('Restore functionality coming soon');
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
}
