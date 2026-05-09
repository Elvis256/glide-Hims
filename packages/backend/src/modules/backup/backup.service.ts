import { Injectable, Logger, NotFoundException, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
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
}
