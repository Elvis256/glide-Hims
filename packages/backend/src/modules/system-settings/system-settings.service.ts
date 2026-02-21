import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { SystemSetting } from '../../database/entities/system-setting.entity';

@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
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
}
