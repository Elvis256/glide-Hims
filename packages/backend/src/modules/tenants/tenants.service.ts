import {
  Injectable,
  NotFoundException,
  ConflictException,
  OnModuleInit,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from '../../database/entities/tenant.entity';
import { CreateTenantDto, UpdateTenantDto, TenantListQueryDto } from './dto/tenant.dto';
import { LicenseService } from '../licensing/license.service';
import {
  FACILITY_MODES,
  FACILITY_PRESETS,
  FacilityMode,
  getPreset,
} from '../../common/constants/facility-presets.constants';

@Injectable()
export class TenantsService implements OnModuleInit {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private dataSource: DataSource,
    @Inject(forwardRef(() => LicenseService))
    private licenseService: LicenseService,
  ) {}

  /** Ensure slug column exists and backfill slugs for existing tenants */
  async onModuleInit() {
    try {
      // Add slug column if it doesn't exist yet (production has synchronize off)
      await this.dataSource
        .query(
          `
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE
      `,
        )
        .catch(() => {
          /* column may already exist */
        });

      // Backfill slugs using raw SQL to avoid BaseEntity column issues
      const rows: { id: string; name: string }[] = await this.dataSource.query(
        `SELECT id, name FROM tenants WHERE slug IS NULL`,
      );
      for (const row of rows) {
        const baseSlug = TenantsService.generateSlug(row.name);
        const slug = await this.ensureUniqueSlugsRaw(baseSlug, row.id);
        await this.dataSource.query(`UPDATE tenants SET slug = $1 WHERE id = $2`, [slug, row.id]);
        this.logger.log(`Backfilled slug "${slug}" for tenant "${row.name}"`);
      }
    } catch (err) {
      this.logger.error('Slug backfill failed (non-fatal):', err?.message || err);
    }
  }

  /** Raw SQL uniqueness check for backfill (avoids BaseEntity column issues) */
  private async ensureUniqueSlugsRaw(baseSlug: string, excludeId: string): Promise<string> {
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const [existing] = await this.dataSource.query(
        `SELECT id FROM tenants WHERE slug = $1 AND id != $2 LIMIT 1`,
        [slug, excludeId],
      );
      if (!existing) return slug;
      slug = `${baseSlug}-${suffix++}`;
    }
  }

  /**
   * Convert a name into a URL-friendly slug.
   * "Kampala General Hospital" → "kampala-general-hospital"
   */
  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Ensure slug is unique by appending a numeric suffix if needed.
   */
  private async ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const existing = await this.tenantRepository.findOne({ where: { slug } });
      if (!existing || existing.id === excludeId) return slug;
      slug = `${baseSlug}-${suffix++}`;
    }
  }

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const baseSlug = dto.slug || TenantsService.generateSlug(dto.name);
    const slug = await this.ensureUniqueSlug(baseSlug);
    const tenant = this.tenantRepository.create({ ...dto, slug, status: 'active' });
    const saved = await this.tenantRepository.save(tenant);

    // Auto-issue 30-day trial license bound to this tenant.
    // Modules come from the hospital preset (safe default for new orgs).
    try {
      const preset = getPreset('hospital' as any);
      const enabledModules = preset?.enabledModules || [
        'patients',
        'encounters',
        'billing',
        'reports',
      ];
      await this.licenseService.generateLicense({
        organizationName: saved.name,
        email: (dto as any).email || `admin@${saved.slug}.local`,
        licenseType: 'trial',
        maxUsers: 25,
        maxFacilities: 1,
        enabledModules,
        validityDays: 30,
        tenantId: saved.id,
      });
      this.logger.log(`Issued 30-day trial license for tenant ${saved.slug}`);
    } catch (err: any) {
      this.logger.warn(
        `Failed to auto-issue trial license for ${saved.slug}: ${err?.message || err}`,
      );
    }

    return saved;
  }

  async findAll(query?: TenantListQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || query?.perPage || 20;
    const skip = (page - 1) * limit;

    const qb = this.tenantRepository.createQueryBuilder('tenant');

    if (query?.status) {
      qb.andWhere('tenant.status = :status', { status: query.status });
    }

    if (query?.search) {
      qb.andWhere(
        '(tenant.name ILIKE :search OR tenant.slug ILIKE :search OR tenant.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [tenants, total] = await qb
      .orderBy('tenant.name', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: tenants,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Returns all tenants enriched with user count, facility count, setup status, and last activity.
   */
  async findAllWithStats() {
    const rows = await this.dataSource.query(`
      SELECT 
        t.id, t.name, t.slug, t.status, t.description, t.settings,
        t.created_at as "createdAt", t.updated_at as "updatedAt",
        COALESCE(u.user_count, 0)::int AS "userCount",
        COALESCE(f.facility_count, 0)::int AS "facilityCount",
        u.last_login AS "lastActivity",
        CASE 
          WHEN ss.value = 'true' THEN true
          WHEN COALESCE(f.facility_count, 0) > 0 AND COALESCE(u.user_count, 0) > 0 THEN true
          ELSE false
        END AS "isSetupComplete",
        u.admin_username AS "adminUsername",
        u.admin_email AS "adminEmail"
      FROM tenants t
      LEFT JOIN (
        SELECT tenant_id,
          COUNT(*)::int AS user_count,
          MAX(last_login_at) AS last_login,
          (array_agg(username ORDER BY created_at ASC))[1] AS admin_username,
          (array_agg(email ORDER BY created_at ASC))[1] AS admin_email
        FROM users WHERE deleted_at IS NULL
        GROUP BY tenant_id
      ) u ON u.tenant_id = t.id
      LEFT JOIN (
        SELECT tenant_id, COUNT(*)::int AS facility_count
        FROM facilities WHERE deleted_at IS NULL
        GROUP BY tenant_id
      ) f ON f.tenant_id = t.id
      LEFT JOIN system_settings ss ON ss.tenant_id = t.id AND ss.key = 'setup_complete'
      WHERE t.deleted_at IS NULL
      ORDER BY t.name ASC
    `);
    return rows;
  }

  async findAllPublic() {
    return this.tenantRepository.find({
      where: { status: 'active' },
      select: ['id', 'name', 'slug'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async findBySlug(slug: string): Promise<{
    id: string;
    name: string;
    slug: string;
    businessType?: string;
    isSetupComplete: boolean;
  }> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug, status: 'active' },
      select: ['id', 'name', 'slug'],
    });
    if (!tenant) throw new NotFoundException('Organization not found');

    // Check setup status and facility_mode in one query
    const setupCheck = await this.dataSource.query(
      `SELECT 
        EXISTS(SELECT 1 FROM system_settings WHERE tenant_id = $1 AND key = 'setup_complete' AND value = 'true') AS has_flag,
        EXISTS(SELECT 1 FROM facilities WHERE tenant_id = $1) AS has_facility,
        EXISTS(SELECT 1 FROM users WHERE tenant_id = $1 AND deleted_at IS NULL) AS has_user,
        (SELECT value FROM system_settings WHERE tenant_id = $1 AND key = 'facility_mode' LIMIT 1) AS facility_mode`,
      [tenant.id],
    );
    const row = setupCheck[0];
    const isSetupComplete = row.has_flag || (row.has_facility && row.has_user);

    // Derive businessType from facility_mode
    let businessType: string | undefined;
    if (row.facility_mode) {
      const mode =
        typeof row.facility_mode === 'string'
          ? row.facility_mode.replace(/"/g, '')
          : row.facility_mode;
      const modeToBusinessType: Record<string, string> = {
        single_user: 'hospital',
        clinic_opd: 'hospital',
        clinic_full: 'hospital',
        multisite_opd: 'hospital',
        hospital: 'hospital',
        pharmacy_retail: 'pharmacy',
        pharmacy_chain: 'pharmacy',
        pharmacy_wholesale: 'pharmacy',
      };
      businessType = modeToBusinessType[mode] || 'hospital';
    }

    return { id: tenant.id, name: tenant.name, slug: tenant.slug, businessType, isSetupComplete };
  }

  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);
    if (dto.slug && dto.slug !== tenant.slug) {
      const existing = await this.tenantRepository.findOne({ where: { slug: dto.slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException('This slug is already taken');
      }
    }
    Object.assign(tenant, dto);
    return this.tenantRepository.save(tenant);
  }

  async remove(id: string): Promise<void> {
    const tenant = await this.findOne(id);
    await this.tenantRepository.softRemove(tenant);
  }

  /**
   * Returns the catalogue of facility presets so the System Admin UI can render
   * mode-switcher cards without hard-coding the list in two places.
   */
  listFacilityPresets() {
    return FACILITY_PRESETS.map((p) => ({
      mode: p.mode,
      businessType: p.businessType,
      name: p.name,
      description: p.description,
      icon: p.icon,
      facilityType: p.facilityType,
      supportsMultiSite: p.supportsMultiSite,
      singleUserMode: p.singleUserMode,
      enabledModules: p.enabledModules,
      recommendedRoles: p.recommendedRoles,
      notes: p.notes,
    }));
  }

  /**
   * Change a tenant's facility mode (promotion or demotion).
   *
   * Why a dedicated endpoint instead of generic PATCH:
   *  - `tenant.settings` must be merged, not replaced (UpdateTenantDto would
   *    overwrite all keys).
   *  - The mode lives in TWO places that both must stay in sync:
   *      1. tenants.settings.facilityMode (jsonb, used by admin UI)
   *      2. system_settings rows: facility_mode, single_user_mode
   *         (read by AuthService and the mode/module guards)
   *  - When the caller wants the change to actually take effect, we also need
   *    to refresh system_settings.enabled_modules from the new preset, since
   *    that override otherwise wins over the preset.
   *
   * No data is destroyed: hidden modules remain in the database and re-appear
   * on promotion back to a richer mode.
   */
  async changeFacilityMode(
    tenantId: string,
    newMode: string,
    options: { syncEnabledModules?: boolean } = {},
  ): Promise<{
    tenant: Tenant;
    previousMode: string | null;
    newMode: FacilityMode;
    enabledModules: string[];
    enabledModulesSynced: boolean;
    addedModules: string[];
    removedModules: string[];
  }> {
    const validModes = Object.values(FACILITY_MODES) as string[];
    if (!validModes.includes(newMode)) {
      throw new ConflictException(
        `Invalid facility mode "${newMode}". Allowed: ${validModes.join(', ')}`,
      );
    }
    const mode = newMode as FacilityMode;
    const preset = getPreset(mode);
    if (!preset) {
      throw new ConflictException(`No preset defined for mode "${newMode}"`);
    }

    const tenant = await this.findOne(tenantId);
    const previousMode: string | null =
      ((tenant.settings && (tenant.settings as Record<string, unknown>).facilityMode) as string) || null;
    const previousPreset = previousMode ? getPreset(previousMode as FacilityMode) : null;

    const previousModules = new Set(previousPreset?.enabledModules || []);
    const newModules = new Set(preset.enabledModules);
    const addedModules = preset.enabledModules.filter((m) => !previousModules.has(m));
    const removedModules = (previousPreset?.enabledModules || []).filter((m) => !newModules.has(m));

    const syncEnabledModules = options.syncEnabledModules ?? true;

    await this.dataSource.transaction(async (manager) => {
      // 1. Merge facilityMode into tenants.settings (preserve other keys)
      const mergedSettings = { ...(tenant.settings || {}), facilityMode: mode };
      tenant.settings = mergedSettings;
      await manager.save(tenant);

      // 2. Upsert system_settings rows used by AuthService / module.guard
      await this.upsertSystemSetting(
        manager,
        tenantId,
        'facility_mode',
        mode,
        'Deployment mode preset',
      );
      await this.upsertSystemSetting(
        manager,
        tenantId,
        'single_user_mode',
        preset.singleUserMode,
        'Single-user clinic mode',
      );

      // 3. Optionally refresh the enabled_modules override so the change takes
      //    effect immediately. Skipped when the operator explicitly opts out
      //    (e.g. they want their custom module list to keep winning).
      if (syncEnabledModules) {
        await this.upsertSystemSetting(
          manager,
          tenantId,
          'enabled_modules',
          JSON.stringify(preset.enabledModules),
          'Enabled navigation modules for this tenant',
        );
      }
    });

    this.logger.log(
      `Tenant ${tenant.slug || tenant.id} facility mode: ${previousMode || '(none)'} → ${mode}` +
        (syncEnabledModules ? ' (modules synced)' : ' (modules left as-is)'),
    );

    return {
      tenant,
      previousMode,
      newMode: mode,
      enabledModules: preset.enabledModules,
      enabledModulesSynced: syncEnabledModules,
      addedModules,
      removedModules,
    };
  }

  private async upsertSystemSetting(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    key: string,
    value: any,
    description: string,
  ): Promise<void> {
    // Raw SQL keeps this service free of a hard dependency on the
    // SystemSetting entity / SystemSettingsModule.
    const existing: { id: string }[] = await manager.query(
      `SELECT id FROM system_settings WHERE tenant_id = $1 AND key = $2 AND deleted_at IS NULL LIMIT 1`,
      [tenantId, key],
    );
    const jsonValue = JSON.stringify(value);
    if (existing.length > 0) {
      await manager.query(
        `UPDATE system_settings
           SET value = $1::jsonb, description = $2, updated_at = NOW()
         WHERE id = $3`,
        [jsonValue, description, existing[0].id],
      );
    } else {
      await manager.query(
        `INSERT INTO system_settings (key, value, tenant_id, description, created_at, updated_at)
         VALUES ($1, $2::jsonb, $3, $4, NOW(), NOW())`,
        [key, jsonValue, tenantId, description],
      );
    }
  }
}
