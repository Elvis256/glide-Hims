import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, DataSource, IsNull } from 'typeorm';
import { SystemSetting } from '../../database/entities/system-setting.entity';

@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
    private readonly dataSource: DataSource,
  ) {}

  async getAll(tenantId?: string): Promise<SystemSetting[]> {
    return this.settingRepo.find({
      where: tenantId ? { tenantId } : {},
      order: { key: 'ASC' },
    });
  }

  async getByKey(key: string, tenantId?: string): Promise<SystemSetting> {
    const where: any = { key };
    if (tenantId) where.tenantId = tenantId;

    const setting = await this.settingRepo.findOne({ where });
    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }
    return setting;
  }

  async upsert(
    key: string,
    value: any,
    tenantId?: string,
    description?: string,
  ): Promise<SystemSetting> {
    const where: any = { key };
    if (tenantId) where.tenantId = tenantId;

    let setting = await this.settingRepo.findOne({ where });

    if (setting) {
      setting.value = value;
      if (description !== undefined) setting.description = description;
    } else {
      setting = this.settingRepo.create({ key, value, tenantId, description });
    }

    return this.settingRepo.save(setting);
  }

  async delete(key: string, tenantId?: string): Promise<void> {
    const setting = await this.getByKey(key, tenantId);
    await this.settingRepo.softRemove(setting);
  }

  async getByPrefix(prefix: string, tenantId?: string): Promise<SystemSetting[]> {
    const where: any = { key: Like(`${prefix}%`) };
    if (tenantId) where.tenantId = tenantId;

    return this.settingRepo.find({
      where,
      order: { key: 'ASC' },
    });
  }

  /** Platform-level settings (tenant_id IS NULL, key starts with platform.) */
  async getPlatformSettings(): Promise<SystemSetting[]> {
    return this.settingRepo.find({
      where: { key: Like('platform.%'), tenantId: IsNull() },
      order: { key: 'ASC' },
    });
  }

  /** Aggregate stats for the platform overview page */
  async getPlatformOverview() {
    const [stats] = await this.dataSource.query(`
      SELECT
        (SELECT COUNT(*) FROM tenants WHERE deleted_at IS NULL) AS "totalTenants",
        (SELECT COUNT(*) FROM tenants WHERE deleted_at IS NULL AND status = 'active') AS "activeTenants",
        (SELECT COUNT(*) FROM tenants WHERE deleted_at IS NULL AND status != 'active') AS "inactiveTenants",
        (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND is_system_admin = false) AS "totalUsers",
        (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND is_system_admin = true) AS "systemAdmins",
        (SELECT COUNT(*) FROM facilities WHERE deleted_at IS NULL) AS "totalFacilities",
        (SELECT COUNT(*) FROM patients WHERE deleted_at IS NULL) AS "totalPatients",
        (SELECT COUNT(*) FROM encounters WHERE deleted_at IS NULL) AS "totalEncounters",
        (SELECT COUNT(*) FROM encounters WHERE deleted_at IS NULL AND created_at >= CURRENT_DATE) AS "todayEncounters",
        (SELECT pg_size_pretty(pg_database_size(current_database()))) AS "databaseSize"
    `);
    return {
      ...stats,
      totalTenants: Number(stats.totalTenants),
      activeTenants: Number(stats.activeTenants),
      inactiveTenants: Number(stats.inactiveTenants),
      totalUsers: Number(stats.totalUsers),
      systemAdmins: Number(stats.systemAdmins),
      totalFacilities: Number(stats.totalFacilities),
      totalPatients: Number(stats.totalPatients),
      totalEncounters: Number(stats.totalEncounters),
      todayEncounters: Number(stats.todayEncounters),
    };
  }
}
