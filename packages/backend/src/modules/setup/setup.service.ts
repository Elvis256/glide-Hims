import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tenant } from '../../database/entities/tenant.entity';
import { Facility } from '../../database/entities/facility.entity';
import { User } from '../../database/entities/user.entity';
import { Role } from '../../database/entities/role.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { SystemSetting } from '../../database/entities/system-setting.entity';
import { Permission } from '../../database/entities/permission.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { Department } from '../../database/entities/department.entity';
import { InitializeSetupDto, RegisterTenantDto, InitializeTenantSetupDto } from './dto/setup.dto';
import { TenantsService } from '../tenants/tenants.service';
import {
  FACILITY_PRESETS,
  FACILITY_MODES,
  getPreset,
  type FacilityMode,
} from '../../common/constants/facility-presets.constants';

// Default permissions for the system
const DEFAULT_PERMISSIONS = [
  // Dashboard
  { code: 'dashboard.read', name: 'View Dashboard', module: 'dashboard' },

  // Users & Access
  { code: 'users.read', name: 'View Users', module: 'users' },
  { code: 'users.create', name: 'Create Users', module: 'users' },
  { code: 'users.update', name: 'Update Users', module: 'users' },
  { code: 'users.delete', name: 'Delete Users', module: 'users' },
  { code: 'roles.read', name: 'View Roles', module: 'roles' },
  { code: 'roles.create', name: 'Create Roles', module: 'roles' },
  { code: 'roles.update', name: 'Update Roles', module: 'roles' },
  { code: 'roles.delete', name: 'Delete Roles', module: 'roles' },

  // Patients
  { code: 'patients.read', name: 'View Patients', module: 'patients' },
  { code: 'patients.create', name: 'Register Patients', module: 'patients' },
  { code: 'patients.update', name: 'Update Patients', module: 'patients' },
  { code: 'patients.delete', name: 'Delete Patients', module: 'patients' },

  // Encounters
  { code: 'encounters.read', name: 'View Encounters', module: 'encounters' },
  { code: 'encounters.create', name: 'Create Encounters', module: 'encounters' },
  { code: 'encounters.update', name: 'Update Encounters', module: 'encounters' },
  { code: 'encounters.delete', name: 'Delete Encounters', module: 'encounters' },

  // Vitals
  { code: 'vitals.read', name: 'View Vitals', module: 'vitals' },
  { code: 'vitals.create', name: 'Record Vitals', module: 'vitals' },
  { code: 'vitals.update', name: 'Update Vitals', module: 'vitals' },

  // Clinical Notes
  { code: 'clinical-notes.read', name: 'View Clinical Notes', module: 'clinical_notes' },
  { code: 'clinical-notes.create', name: 'Create Clinical Notes', module: 'clinical_notes' },
  { code: 'clinical-notes.update', name: 'Update Clinical Notes', module: 'clinical_notes' },

  // Orders
  { code: 'orders.read', name: 'View Orders', module: 'orders' },
  { code: 'orders.create', name: 'Create Orders', module: 'orders' },
  { code: 'orders.update', name: 'Update Orders', module: 'orders' },
  { code: 'orders.delete', name: 'Cancel Orders', module: 'orders' },

  // Lab
  { code: 'lab.read', name: 'View Lab', module: 'lab' },
  { code: 'lab.create', name: 'Create Lab Orders', module: 'lab' },
  { code: 'lab.update', name: 'Update Lab Results', module: 'lab' },
  { code: 'lab.delete', name: 'Cancel Lab Orders', module: 'lab' },

  // Radiology
  { code: 'radiology.read', name: 'View Radiology', module: 'radiology' },
  { code: 'radiology.create', name: 'Create Radiology Orders', module: 'radiology' },
  { code: 'radiology.update', name: 'Update Radiology Results', module: 'radiology' },
  { code: 'radiology.delete', name: 'Cancel Radiology Orders', module: 'radiology' },

  // Pharmacy
  { code: 'pharmacy.read', name: 'View Pharmacy', module: 'pharmacy' },
  { code: 'pharmacy.create', name: 'Create Prescriptions', module: 'pharmacy' },
  { code: 'pharmacy.update', name: 'Dispense Medications', module: 'pharmacy' },
  { code: 'pharmacy.delete', name: 'Cancel Prescriptions', module: 'pharmacy' },

  // Billing
  { code: 'billing.read', name: 'View Billing', module: 'billing' },
  { code: 'billing.create', name: 'Create Invoices', module: 'billing' },
  { code: 'billing.update', name: 'Update Invoices', module: 'billing' },
  { code: 'billing.delete', name: 'Void Invoices', module: 'billing' },
  { code: 'billing.collect_payment', name: 'Collect Payments', module: 'billing' },
  { code: 'billing.refund', name: 'Process Refunds', module: 'billing' },

  // Insurance
  { code: 'insurance.read', name: 'View Insurance', module: 'insurance' },
  { code: 'insurance.create', name: 'Add Insurance Policies', module: 'insurance' },
  { code: 'insurance.update', name: 'Update Insurance', module: 'insurance' },
  { code: 'insurance.verify', name: 'Verify Coverage', module: 'insurance' },
  { code: 'insurance.claims', name: 'Manage Claims', module: 'insurance' },

  // Inventory/Stores
  { code: 'inventory.read', name: 'View Inventory', module: 'inventory' },
  { code: 'inventory.create', name: 'Add Stock', module: 'inventory' },
  { code: 'inventory.update', name: 'Update Stock', module: 'inventory' },
  { code: 'inventory.delete', name: 'Remove Stock', module: 'inventory' },
  { code: 'inventory.transfer', name: 'Transfer Stock', module: 'inventory' },
  { code: 'inventory.adjust', name: 'Adjust Stock', module: 'inventory' },

  // IPD/Wards
  { code: 'ipd.read', name: 'View IPD', module: 'ipd' },
  { code: 'ipd.create', name: 'Admit Patients', module: 'ipd' },
  { code: 'ipd.update', name: 'Update Admissions', module: 'ipd' },
  { code: 'ipd.discharge', name: 'Discharge Patients', module: 'ipd' },
  { code: 'ipd.transfer', name: 'Transfer Patients', module: 'ipd' },

  // Emergency
  { code: 'emergency.read', name: 'View Emergency', module: 'emergency' },
  { code: 'emergency.create', name: 'Register Emergency', module: 'emergency' },
  { code: 'emergency.update', name: 'Update Emergency', module: 'emergency' },
  { code: 'emergency.triage', name: 'Triage Patients', module: 'emergency' },

  // Theatre/Surgery
  { code: 'theatre.read', name: 'View Theatre', module: 'theatre' },
  { code: 'theatre.create', name: 'Schedule Surgery', module: 'theatre' },
  { code: 'theatre.update', name: 'Update Surgery', module: 'theatre' },

  // Maternity
  { code: 'maternity.read', name: 'View Maternity', module: 'maternity' },
  { code: 'maternity.create', name: 'Register ANC', module: 'maternity' },
  { code: 'maternity.update', name: 'Update Maternity', module: 'maternity' },

  // HR
  { code: 'hr.read', name: 'View HR', module: 'hr' },
  { code: 'hr.create', name: 'Add Employees', module: 'hr' },
  { code: 'hr.update', name: 'Update Employees', module: 'hr' },
  { code: 'hr.delete', name: 'Remove Employees', module: 'hr' },
  { code: 'hr.payroll', name: 'Manage Payroll', module: 'hr' },
  { code: 'hr.leave', name: 'Manage Leave', module: 'hr' },

  // Reports
  { code: 'reports.read', name: 'View Reports', module: 'reports' },
  { code: 'reports.export', name: 'Export Reports', module: 'reports' },

  // Settings/Admin
  { code: 'settings.read', name: 'View Settings', module: 'settings' },
  { code: 'settings.update', name: 'Update Settings', module: 'settings' },
  { code: 'facilities.read', name: 'View Facilities', module: 'facilities' },
  { code: 'facilities.create', name: 'Create Facilities', module: 'facilities' },
  { code: 'facilities.update', name: 'Update Facilities', module: 'facilities' },
  { code: 'facilities.delete', name: 'Delete Facilities', module: 'facilities' },

  // Services & Pricing
  { code: 'services.read', name: 'View Services', module: 'services' },
  { code: 'services.create', name: 'Create Services', module: 'services' },
  { code: 'services.update', name: 'Update Services', module: 'services' },
  { code: 'services.delete', name: 'Delete Services', module: 'services' },

  // Appointments/Queue
  { code: 'appointments.read', name: 'View Appointments', module: 'appointments' },
  { code: 'appointments.create', name: 'Book Appointments', module: 'appointments' },
  { code: 'appointments.update', name: 'Update Appointments', module: 'appointments' },
  { code: 'appointments.delete', name: 'Cancel Appointments', module: 'appointments' },
  { code: 'queue.read', name: 'View Queue', module: 'queue' },
  { code: 'queue.manage', name: 'Manage Queue', module: 'queue' },
];

// Default roles with their permissions
const DEFAULT_ROLES = [
  {
    name: 'Doctor',
    description: 'Medical doctors and consultants',
    permissions: [
      'dashboard.read',
      'patients.read',
      'patients.update',
      'encounters.read',
      'encounters.create',
      'encounters.update',
      'vitals.read',
      'clinical-notes.read',
      'clinical-notes.create',
      'clinical-notes.update',
      'orders.read',
      'orders.create',
      'lab.read',
      'lab.create',
      'radiology.read',
      'radiology.create',
      'pharmacy.read',
      'pharmacy.create',
      'ipd.read',
      'ipd.create',
      'ipd.update',
      'ipd.discharge',
      'reports.read',
      'appointments.read',
      'queue.read',
    ],
  },
  {
    name: 'Nurse',
    description: 'Nursing staff',
    permissions: [
      'dashboard.read',
      'patients.read',
      'patients.update',
      'encounters.read',
      'encounters.update',
      'vitals.read',
      'vitals.create',
      'vitals.update',
      'clinical-notes.read',
      'clinical-notes.create',
      'orders.read',
      'lab.read',
      'pharmacy.read',
      'ipd.read',
      'ipd.update',
      'emergency.read',
      'emergency.triage',
      'queue.read',
      'queue.manage',
    ],
  },
  {
    name: 'Receptionist',
    description: 'Front desk and registration staff',
    permissions: [
      'dashboard.read',
      'patients.read',
      'patients.create',
      'patients.update',
      'encounters.read',
      'encounters.create',
      'appointments.read',
      'appointments.create',
      'appointments.update',
      'appointments.delete',
      'queue.read',
      'queue.manage',
      'billing.read',
      'insurance.read',
      'insurance.verify',
    ],
  },
  {
    name: 'Lab Technician',
    description: 'Laboratory staff',
    permissions: [
      'dashboard.read',
      'patients.read',
      'orders.read',
      'lab.read',
      'lab.create',
      'lab.update',
      'reports.read',
    ],
  },
  {
    name: 'Pharmacist',
    description: 'Pharmacy staff',
    permissions: [
      'dashboard.read',
      'patients.read',
      'orders.read',
      'pharmacy.read',
      'pharmacy.update',
      'inventory.read',
      'inventory.update',
      'billing.read',
      'billing.create',
      'billing.collect_payment',
      'reports.read',
    ],
  },
  {
    name: 'Cashier',
    description: 'Billing and payment collection staff',
    permissions: [
      'dashboard.read',
      'patients.read',
      'billing.read',
      'billing.create',
      'billing.update',
      'billing.collect_payment',
      'insurance.read',
      'insurance.verify',
      'reports.read',
    ],
  },
  {
    name: 'Radiologist',
    description: 'Radiology/Imaging staff',
    permissions: [
      'dashboard.read',
      'patients.read',
      'orders.read',
      'radiology.read',
      'radiology.create',
      'radiology.update',
      'reports.read',
    ],
  },
  {
    name: 'Store Keeper',
    description: 'Inventory and stores management',
    permissions: [
      'dashboard.read',
      'inventory.read',
      'inventory.create',
      'inventory.update',
      'inventory.transfer',
      'inventory.adjust',
      'reports.read',
    ],
  },
  {
    name: 'HR Manager',
    description: 'Human resources management',
    permissions: [
      'dashboard.read',
      'users.read',
      'hr.read',
      'hr.create',
      'hr.update',
      'hr.delete',
      'hr.payroll',
      'hr.leave',
      'reports.read',
      'reports.export',
    ],
  },
  {
    name: 'Administrator',
    description: 'System administrator with full access to settings',
    permissions: [
      'dashboard.read',
      'users.read',
      'users.create',
      'users.update',
      'users.delete',
      'roles.read',
      'roles.create',
      'roles.update',
      'roles.delete',
      'settings.read',
      'settings.update',
      'facilities.read',
      'facilities.create',
      'facilities.update',
      'facilities.delete',
      'services.read',
      'services.create',
      'services.update',
      'services.delete',
      'reports.read',
      'reports.export',
    ],
  },
];

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
    @InjectRepository(Facility)
    private facilityRepo: Repository<Facility>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
    @InjectRepository(SystemSetting)
    private settingRepo: Repository<SystemSetting>,
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {}

  /**
   * Check if initial setup has been completed
   */
  async getSetupStatus(): Promise<{
    isSetupComplete: boolean;
    deploymentMode: string;
    organizationName?: string;
    facilityName?: string;
    tenantSlug?: string;
    tenantCount?: number;
  }> {
    const deploymentMode = this.configService.get<string>('DEPLOYMENT_MODE', 'on-premise');

    try {
      const tenantCount = await this.tenantRepo.count({ where: { status: 'active' } });

      // Check if any tenant exists
      const tenant = await this.tenantRepo.findOne({
        where: { status: 'active' },
        order: { createdAt: 'ASC' },
      });

      if (!tenant) {
        return { isSetupComplete: false, deploymentMode, tenantCount: 0 };
      }

      // Check if setup_complete setting exists
      let setupSetting = null;
      try {
        setupSetting = await this.settingRepo.findOne({
          where: { key: 'setup_complete', tenantId: tenant.id },
        });
      } catch (e) {
        // Table might not exist yet
        return { isSetupComplete: false, deploymentMode, tenantCount };
      }

      // Get main facility
      const facility = await this.facilityRepo.findOne({
        where: { tenantId: tenant.id, status: 'active' },
        order: { createdAt: 'ASC' },
      });

      return {
        isSetupComplete: setupSetting?.value === true,
        deploymentMode,
        organizationName: tenant.name,
        facilityName: facility?.name,
        tenantSlug: tenant.slug,
        tenantCount,
      };
    } catch (error) {
      // If tables don't exist yet, setup is not complete
      this.logger.log('Error checking setup status: ' + error.message);
      return { isSetupComplete: false, deploymentMode, tenantCount: 0 };
    }
  }

  /**
   * Initialize the system with organization, facility, and admin user
   */
  async initializeSetup(dto: InitializeSetupDto): Promise<{
    success: boolean;
    message: string;
    tenantId: string;
    facilityId: string;
    userId: string;
  }> {
    // Check if setup already completed
    const status = await this.getSetupStatus();
    if (status.isSetupComplete) {
      throw new BadRequestException(
        'Setup has already been completed. This action is not allowed.',
      );
    }

    // No global username/email check — uniqueness is per-tenant.
    // Initial setup creates a new tenant so there cannot be duplicates within it.

    // Run in transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Organization (Tenant)
      const slug = dto.organization.slug || TenantsService.generateSlug(dto.organization.name);
      // Ensure slug uniqueness using raw SQL (tenants table lacks tenant_id column)
      let finalSlug = slug;
      let suffix = 1;
      while (
        (await queryRunner.query(`SELECT id FROM tenants WHERE slug = $1 LIMIT 1`, [finalSlug]))
          .length > 0
      ) {
        finalSlug = `${slug}-${suffix++}`;
      }
      const tenant = queryRunner.manager.create(Tenant, {
        name: dto.organization.name,
        slug: finalSlug,
        status: 'active',
        description: dto.organization.type || 'Hospital',
        settings: {
          country: dto.organization.country,
          logoUrl: dto.organization.logoUrl,
          currency: dto.settings?.currency || 'UGX',
          timezone: dto.settings?.timezone || 'Africa/Kampala',
          dateFormat: dto.settings?.dateFormat || 'DD/MM/YYYY',
          facilityMode: dto.settings?.facilityMode || FACILITY_MODES.HOSPITAL,
          enabledModules: this.resolveEnabledModules(dto),
        },
      });
      await queryRunner.manager.save(tenant);

      // 2. Create Main Facility
      const facilityMode = dto.settings?.facilityMode as FacilityMode | undefined;
      const preset = facilityMode ? getPreset(facilityMode) : null;
      const facility = queryRunner.manager.create(Facility, {
        tenantId: tenant.id,
        name: dto.facility.name,
        type: dto.facility.type || preset?.facilityType || 'hospital',
        location: dto.facility.location,
        status: 'active',
        contact: {
          phone: dto.facility.phone,
          email: dto.facility.email,
        },
        settings: {
          isMainFacility: true,
          facilityMode: dto.settings?.facilityMode || FACILITY_MODES.HOSPITAL,
          supportsMultiSite: preset?.supportsMultiSite ?? true,
          singleUserMode: preset?.singleUserMode ?? false,
        },
      });
      await queryRunner.manager.save(facility);

      // 3. Load or create default permissions
      this.logger.log('Loading permissions...');
      const permissionMap = new Map<string, Permission>();
      for (const perm of DEFAULT_PERMISSIONS) {
        // Check if permission already exists
        let permission = await queryRunner.manager.findOne(Permission, {
          where: { code: perm.code },
        });

        // Create only if it doesn't exist
        if (!permission) {
          permission = queryRunner.manager.create(Permission, perm);
          await queryRunner.manager.save(permission);
        }
        permissionMap.set(perm.code, permission);
      }
      this.logger.log(`Loaded ${permissionMap.size} permissions`);

      // 4. Load or create Super Admin role with ALL permissions
      let superAdminRole = await queryRunner.manager.findOne(Role, {
        where: { name: 'Super Admin' },
      });

      if (!superAdminRole) {
        superAdminRole = queryRunner.manager.create(Role, {
          name: 'Super Admin',
          description: 'Full system access - all permissions',
        });
        await queryRunner.manager.save(superAdminRole);

        // Assign all permissions to Super Admin
        for (const [code, permission] of permissionMap) {
          const rolePermission = queryRunner.manager.create(RolePermission, {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          });
          await queryRunner.manager.save(rolePermission);
        }
        this.logger.log('Super Admin role created with all permissions');
      } else {
        this.logger.log('Super Admin role already exists');
      }

      // 5. Load or create default roles with their permissions
      this.logger.log('Loading default roles...');
      for (const roleData of DEFAULT_ROLES) {
        let role = await queryRunner.manager.findOne(Role, {
          where: { name: roleData.name },
        });

        if (!role) {
          role = queryRunner.manager.create(Role, {
            name: roleData.name,
            description: roleData.description,
          });
          await queryRunner.manager.save(role);

          // Assign permissions to role
          for (const permCode of roleData.permissions) {
            const permission = permissionMap.get(permCode);
            if (permission) {
              const rolePermission = queryRunner.manager.create(RolePermission, {
                roleId: role.id,
                permissionId: permission.id,
              });
              await queryRunner.manager.save(rolePermission);
            }
          }
        }
      }
      this.logger.log(`Created ${DEFAULT_ROLES.length} default roles`);

      // 5a. For single-user mode, create a special "Clinic Staff" role with all core permissions
      const isSingleUser =
        (dto.settings?.facilityMode as FacilityMode) === FACILITY_MODES.SINGLE_USER;
      if (isSingleUser) {
        const clinicStaffPermissions = [...permissionMap.keys()].filter((code) => {
          const [mod] = code.split('.');
          return !['roles', 'facilities', 'settings', 'hr'].includes(mod);
        });
        let clinicStaffRole = await queryRunner.manager.findOne(Role, {
          where: { name: 'Clinic Staff' },
        });
        if (!clinicStaffRole) {
          clinicStaffRole = queryRunner.manager.create(Role, {
            name: 'Clinic Staff',
            description: 'Single-user clinic role with all core clinical and billing permissions',
          });
          await queryRunner.manager.save(clinicStaffRole);
          for (const permCode of clinicStaffPermissions) {
            const permission = permissionMap.get(permCode);
            if (permission) {
              const rp = queryRunner.manager.create(RolePermission, {
                roleId: clinicStaffRole.id,
                permissionId: permission.id,
              });
              await queryRunner.manager.save(rp);
            }
          }
        }
        this.logger.log('Clinic Staff role created for single-user mode');
      }

      // 6. Create Admin User
      const passwordHash = await bcrypt.hash(dto.admin.password, 10);
      const user = queryRunner.manager.create(User, {
        username: dto.admin.username,
        email: dto.admin.email,
        passwordHash,
        fullName: dto.admin.fullName,
        phone: dto.admin.phone,
        status: 'active',
        mustChangePassword: false,
        tenantId: tenant.id,
      });
      await queryRunner.manager.save(user);

      // 7. Assign Super Admin role to user
      const userRole = queryRunner.manager.create(UserRole, {
        userId: user.id,
        roleId: superAdminRole.id,
        facilityId: facility.id,
      });
      await queryRunner.manager.save(userRole);

      // 8. Create system settings
      const facilityModeValue = dto.settings?.facilityMode || FACILITY_MODES.HOSPITAL;
      const resolvedModules = this.resolveEnabledModules(dto);
      const settings = [
        {
          key: 'setup_complete',
          value: true,
          tenantId: tenant.id,
          description: 'Initial setup completed',
        },
        {
          key: 'setup_date',
          value: new Date().toISOString(),
          tenantId: tenant.id,
          description: 'Setup completion date',
        },
        {
          key: 'default_facility_id',
          value: facility.id,
          tenantId: tenant.id,
          description: 'Default facility ID',
        },
        {
          key: 'facility_mode',
          value: facilityModeValue,
          tenantId: tenant.id,
          description: 'Deployment mode preset',
        },
        {
          key: 'single_user_mode',
          value: isSingleUser,
          tenantId: tenant.id,
          description: 'Single-user clinic mode',
        },
        {
          key: 'enabled_modules',
          value: JSON.stringify(resolvedModules),
          tenantId: tenant.id,
          description: 'Enabled navigation modules for this tenant',
        },
        {
          key: 'workflow_mode',
          value: dto.settings?.workflowMode || 'simple',
          tenantId: tenant.id,
          description: 'Workflow mode: "simple" (single shared queue) or "departmental" (per-department queues)',
        },
      ];

      for (const setting of settings) {
        // Idempotent — re-running setup must not violate UNIQUE(key, tenant_id).
        const existing = await queryRunner.manager.findOne(SystemSetting, {
          where: { key: setting.key, tenantId: setting.tenantId },
        });
        if (existing) {
          existing.value = setting.value;
          if (setting.description) existing.description = setting.description;
          await queryRunner.manager.save(existing);
        } else {
          await queryRunner.manager.save(queryRunner.manager.create(SystemSetting, setting));
        }
      }

      // Auto-seed a default "General" department so OPD/queue pages
      // are usable on day one. Departmental tenants can rename/extend it.
      await this.seedDefaultDepartment(queryRunner.manager, facility.id, tenant.id);

      await queryRunner.commitTransaction();

      this.logger.log(
        `System initialized successfully - Org: ${tenant.name}, Facility: ${facility.name}, Admin: ${user.username}`,
      );

      return {
        success: true,
        message: 'System setup completed successfully',
        tenantId: tenant.id,
        facilityId: facility.id,
        userId: user.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to initialize system: ${error.message}`, error.stack);
      throw new BadRequestException(`Setup failed: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get system settings for a tenant
   */
  async getSettings(tenantId: string): Promise<Record<string, any>> {
    const settings = await this.settingRepo.find({
      where: { tenantId },
    });

    return settings.reduce(
      (acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      },
      {} as Record<string, any>,
    );
  }

  /**
   * Return all available facility deployment mode presets
   */
  getPresets() {
    return FACILITY_PRESETS;
  }

  /**
   * Resolve the enabled modules for setup.
   * If the caller supplied explicit modules, use those.
   * Otherwise fall back to the preset's module list.
   * If no preset is specified either, use sensible hospital defaults.
   */
  private resolveEnabledModules(dto: InitializeSetupDto): string[] {
    if (dto.settings?.enabledModules?.length) {
      return dto.settings.enabledModules;
    }
    const mode = dto.settings?.facilityMode as FacilityMode | undefined;
    if (mode) {
      const preset = getPreset(mode);
      if (preset) return preset.enabledModules;
    }
    return [
      'patients',
      'encounters',
      'lab',
      'pharmacy',
      'radiology',
      'billing',
      'inventory',
      'hr',
      'reports',
    ];
  }

  /**
   * Seed a default "General" department on a newly created facility.
   *
   * Why: pages like /opd/token require a department to be selected before a
   * token can be issued. Without seeding, a freshly created tenant cannot use
   * the queue at all and sees "No departments configured". This helper
   * guarantees there's always at least one usable department.
   *
   * - In **simple** workflow mode this department stays hidden in the UI but
   *   provides the FK target every encounter/queue record needs.
   * - In **departmental** mode, admins can rename it and add siblings.
   *
   * Department codes are unique scoped by tenant, so we suffix with the first
   * 8 chars of the facility id to avoid collisions on multi-facility tenants.
   */
  private async seedDefaultDepartment(
    manager: import('typeorm').EntityManager,
    facilityId: string,
    tenantId: string,
  ): Promise<void> {
    try {
      const codeSuffix = facilityId.replace(/-/g, '').slice(0, 8).toUpperCase();
      const code = `GEN-${codeSuffix}`;
      const existing = await manager.findOne(Department, {
        where: { code, ...(tenantId ? { tenantId } : {}) } as any,
      });
      if (existing) return;
      const dept = manager.create(Department, {
        facilityId,
        tenantId,
        name: 'General',
        code,
        description: 'Default general department (auto-created)',
        status: 'active',
      } as any);
      await manager.save(dept);
    } catch (err) {
      // Non-fatal: tenant setup should not roll back if seeding fails for
      // an exotic reason. Log and continue.
      this.logger.warn(`Failed to seed default department for facility ${facilityId}: ${err.message}`);
    }
  }

  /**
   * Register a new tenant (organization) with facility and admin user.
   * Unlike initializeSetup, this can be called after the system is already set up.
   */
  async registerTenant(dto: RegisterTenantDto): Promise<{
    success: boolean;
    message: string;
    tenantId: string;
    facilityId: string;
    userId: string;
  }> {
    // Check if organization name is already taken
    const existingTenant = await this.tenantRepo.findOne({
      where: { name: dto.organization.name },
    });
    if (existingTenant) {
      throw new BadRequestException('An organization with this name already exists');
    }

    // No global username/email check — uniqueness is per-tenant.
    // Since this creates a brand-new tenant, there cannot be duplicates within it.

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Tenant
      const regSlug = dto.organization.slug || TenantsService.generateSlug(dto.organization.name);
      let regFinalSlug = regSlug;
      let regSuffix = 1;
      while (
        (await queryRunner.query(`SELECT id FROM tenants WHERE slug = $1 LIMIT 1`, [regFinalSlug]))
          .length > 0
      ) {
        regFinalSlug = `${regSlug}-${regSuffix++}`;
      }
      const tenant = queryRunner.manager.create(Tenant, {
        name: dto.organization.name,
        slug: regFinalSlug,
        status: 'active',
        description: dto.organization.type || 'Hospital',
        settings: {
          country: dto.organization.country,
          logoUrl: dto.organization.logoUrl,
          currency: dto.settings?.currency || 'UGX',
          timezone: dto.settings?.timezone || 'Africa/Kampala',
          dateFormat: dto.settings?.dateFormat || 'DD/MM/YYYY',
          facilityMode: dto.settings?.facilityMode || FACILITY_MODES.HOSPITAL,
          enabledModules: this.resolveEnabledModules(dto),
        },
      });
      await queryRunner.manager.save(tenant);

      // 2. Create Main Facility
      const facilityMode = dto.settings?.facilityMode as FacilityMode | undefined;
      const preset = facilityMode ? getPreset(facilityMode) : null;
      const facility = queryRunner.manager.create(Facility, {
        tenantId: tenant.id,
        name: dto.facility.name,
        type: dto.facility.type || preset?.facilityType || 'hospital',
        location: dto.facility.location,
        status: 'active',
        contact: {
          phone: dto.facility.phone,
          email: dto.facility.email,
        },
        settings: {
          isMainFacility: true,
          facilityMode: dto.settings?.facilityMode || FACILITY_MODES.HOSPITAL,
          supportsMultiSite: preset?.supportsMultiSite ?? true,
          singleUserMode: preset?.singleUserMode ?? false,
        },
      });
      await queryRunner.manager.save(facility);

      // 3. Ensure permissions exist (reuse global permissions)
      const permissionMap = new Map<string, Permission>();
      for (const perm of DEFAULT_PERMISSIONS) {
        let permission = await queryRunner.manager.findOne(Permission, {
          where: { code: perm.code },
        });
        if (!permission) {
          permission = queryRunner.manager.create(Permission, perm);
          await queryRunner.manager.save(permission);
        }
        permissionMap.set(perm.code, permission);
      }

      // 4. Ensure Super Admin role exists
      let superAdminRole = await queryRunner.manager.findOne(Role, {
        where: { name: 'Super Admin' },
      });
      if (!superAdminRole) {
        superAdminRole = queryRunner.manager.create(Role, {
          name: 'Super Admin',
          description: 'Full system access - all permissions',
        });
        await queryRunner.manager.save(superAdminRole);
        for (const [, permission] of permissionMap) {
          const rp = queryRunner.manager.create(RolePermission, {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          });
          await queryRunner.manager.save(rp);
        }
      }

      // 5. Ensure default roles exist
      for (const roleData of DEFAULT_ROLES) {
        let role = await queryRunner.manager.findOne(Role, {
          where: { name: roleData.name },
        });
        if (!role) {
          role = queryRunner.manager.create(Role, {
            name: roleData.name,
            description: roleData.description,
          });
          await queryRunner.manager.save(role);
          for (const permCode of roleData.permissions) {
            const permission = permissionMap.get(permCode);
            if (permission) {
              const rp = queryRunner.manager.create(RolePermission, {
                roleId: role.id,
                permissionId: permission.id,
              });
              await queryRunner.manager.save(rp);
            }
          }
        }
      }

      // 6. Create Admin User scoped to this tenant
      const passwordHash = await bcrypt.hash(dto.admin.password, 10);
      const user = queryRunner.manager.create(User, {
        username: dto.admin.username,
        email: dto.admin.email,
        passwordHash,
        fullName: dto.admin.fullName,
        phone: dto.admin.phone,
        status: 'active',
        tenantId: tenant.id,
        facilityId: facility.id,
        mustChangePassword: false,
      });
      await queryRunner.manager.save(user);

      // 7. Assign Super Admin role
      const userRole = queryRunner.manager.create(UserRole, {
        userId: user.id,
        roleId: superAdminRole.id,
        facilityId: facility.id,
      });
      await queryRunner.manager.save(userRole);

      // 8. Create tenant-scoped system settings
      const isSingleUser =
        (dto.settings?.facilityMode as FacilityMode) === FACILITY_MODES.SINGLE_USER;
      const resolvedModules = this.resolveEnabledModules(dto);
      const settings = [
        {
          key: 'setup_complete',
          value: true,
          tenantId: tenant.id,
          description: 'Tenant setup completed',
        },
        {
          key: 'setup_date',
          value: new Date().toISOString(),
          tenantId: tenant.id,
          description: 'Setup completion date',
        },
        {
          key: 'default_facility_id',
          value: facility.id,
          tenantId: tenant.id,
          description: 'Default facility ID',
        },
        {
          key: 'facility_mode',
          value: dto.settings?.facilityMode || FACILITY_MODES.HOSPITAL,
          tenantId: tenant.id,
          description: 'Deployment mode preset',
        },
        {
          key: 'single_user_mode',
          value: isSingleUser,
          tenantId: tenant.id,
          description: 'Single-user clinic mode',
        },
        {
          key: 'enabled_modules',
          value: JSON.stringify(resolvedModules),
          tenantId: tenant.id,
          description: 'Enabled navigation modules for this tenant',
        },
        {
          key: 'workflow_mode',
          value: dto.settings?.workflowMode || 'simple',
          tenantId: tenant.id,
          description: 'Workflow mode: "simple" (single shared queue) or "departmental" (per-department queues)',
        },
      ];
      for (const setting of settings) {
        // Idempotent — re-running setup must not violate UNIQUE(key, tenant_id).
        const existing = await queryRunner.manager.findOne(SystemSetting, {
          where: { key: setting.key, tenantId: setting.tenantId },
        });
        if (existing) {
          existing.value = setting.value;
          if (setting.description) existing.description = setting.description;
          await queryRunner.manager.save(existing);
        } else {
          await queryRunner.manager.save(queryRunner.manager.create(SystemSetting, setting));
        }
      }

      // Auto-seed a default "General" department for OPD/queue usability.
      await this.seedDefaultDepartment(queryRunner.manager, facility.id, tenant.id);

      await queryRunner.commitTransaction();

      this.logger.log(
        `New tenant registered - Org: ${tenant.name}, Facility: ${facility.name}, Admin: ${user.username}`,
      );

      return {
        success: true,
        message: 'Organization registered successfully',
        tenantId: tenant.id,
        facilityId: facility.id,
        userId: user.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Tenant registration failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Registration failed: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Initialize setup for an existing tenant (created by system admin).
   * Creates facility, permissions, roles, admin user, and marks setup complete.
   */
  async initializeTenantSetup(
    slug: string,
    dto: InitializeTenantSetupDto,
  ): Promise<{
    success: boolean;
    message: string;
    tenantId: string;
    facilityId: string;
    userId: string;
  }> {
    // Find the tenant by slug
    const tenant = await this.tenantRepo.findOne({ where: { slug, status: 'active' } });
    if (!tenant) {
      throw new BadRequestException('Organization not found or inactive');
    }

    // Check if setup already completed
    const existing = await this.dataSource.query(
      `SELECT value FROM system_settings WHERE tenant_id = $1 AND key = 'setup_complete' LIMIT 1`,
      [tenant.id],
    );
    if (existing.length > 0 && existing[0].value === true) {
      throw new BadRequestException('Setup has already been completed for this organization.');
    }

    // Check username uniqueness within this tenant
    const existingUser = await this.dataSource.query(
      `SELECT id FROM users WHERE username = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [dto.admin.username, tenant.id],
    );
    if (existingUser.length > 0) {
      throw new BadRequestException(
        `Username "${dto.admin.username}" already exists in this organization`,
      );
    }

    // Check email uniqueness within this tenant
    const existingEmail = await this.dataSource.query(
      `SELECT id FROM users WHERE email = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [dto.admin.email, tenant.id],
    );
    if (existingEmail.length > 0) {
      throw new BadRequestException(
        `Email "${dto.admin.email}" is already in use in this organization`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock the tenant row to prevent concurrent initialization
      const lockedTenant = await queryRunner.manager.findOne(Tenant, {
        where: { id: tenant.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedTenant) {
        throw new NotFoundException('Tenant not found');
      }

      // Double-check setup status inside the transaction (race condition guard)
      const setupCheck = await queryRunner.query(
        `SELECT value FROM system_settings WHERE tenant_id = $1 AND key = 'setup_complete' LIMIT 1`,
        [tenant.id],
      );
      if (setupCheck.length > 0 && setupCheck[0].value === true) {
        throw new ConflictException('Tenant already initialized');
      }

      // Check for existing facility (another race condition guard)
      const existingFacility = await queryRunner.manager.findOne(Facility, {
        where: { tenantId: tenant.id },
      });
      if (existingFacility) {
        throw new ConflictException('Tenant already initialized');
      }

      // 1. Create Main Facility
      const facilityMode = dto.settings?.facilityMode as FacilityMode | undefined;
      const preset = facilityMode ? getPreset(facilityMode) : null;
      const facility = queryRunner.manager.create(Facility, {
        tenantId: tenant.id,
        name: dto.facility.name,
        type: dto.facility.type || preset?.facilityType || 'hospital',
        location: dto.facility.location,
        status: 'active',
        contact: {
          phone: dto.facility.phone,
          email: dto.facility.email,
        },
        settings: {
          isMainFacility: true,
          facilityMode: dto.settings?.facilityMode || FACILITY_MODES.HOSPITAL,
          supportsMultiSite: preset?.supportsMultiSite ?? true,
          singleUserMode: preset?.singleUserMode ?? false,
        },
      });
      await queryRunner.manager.save(facility);

      // 2. Load or create permissions
      const permissionMap = new Map<string, Permission>();
      for (const perm of DEFAULT_PERMISSIONS) {
        let permission = await queryRunner.manager.findOne(Permission, {
          where: { code: perm.code },
        });
        if (!permission) {
          permission = queryRunner.manager.create(Permission, perm);
          await queryRunner.manager.save(permission);
        }
        permissionMap.set(perm.code, permission);
      }

      // 3. Load or create Super Admin role
      let superAdminRole = await queryRunner.manager.findOne(Role, {
        where: { name: 'Super Admin' },
      });
      if (!superAdminRole) {
        superAdminRole = queryRunner.manager.create(Role, {
          name: 'Super Admin',
          description: 'Full system access - all permissions',
        });
        await queryRunner.manager.save(superAdminRole);
        for (const [, permission] of permissionMap) {
          const rp = queryRunner.manager.create(RolePermission, {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          });
          await queryRunner.manager.save(rp);
        }
      }

      // 4. Load or create default roles
      for (const roleData of DEFAULT_ROLES) {
        let role = await queryRunner.manager.findOne(Role, { where: { name: roleData.name } });
        if (!role) {
          role = queryRunner.manager.create(Role, {
            name: roleData.name,
            description: roleData.description,
          });
          await queryRunner.manager.save(role);
          for (const permCode of roleData.permissions) {
            const permission = permissionMap.get(permCode);
            if (permission) {
              const rp = queryRunner.manager.create(RolePermission, {
                roleId: role.id,
                permissionId: permission.id,
              });
              await queryRunner.manager.save(rp);
            }
          }
        }
      }

      // 5. Create Admin User
      const passwordHash = await bcrypt.hash(dto.admin.password, 10);
      const user = queryRunner.manager.create(User, {
        username: dto.admin.username,
        email: dto.admin.email,
        passwordHash,
        fullName: dto.admin.fullName,
        phone: dto.admin.phone,
        status: 'active',
        mustChangePassword: false,
        tenantId: tenant.id,
      });
      await queryRunner.manager.save(user);

      // 6. Assign Super Admin role
      const userRole = queryRunner.manager.create(UserRole, {
        userId: user.id,
        roleId: superAdminRole.id,
        facilityId: facility.id,
      });
      await queryRunner.manager.save(userRole);

      // 7. Create system settings
      const isSingleUser =
        (dto.settings?.facilityMode as FacilityMode) === FACILITY_MODES.SINGLE_USER;
      const resolvedModules = this.resolveEnabledModules(dto as unknown as InitializeSetupDto);
      const settings = [
        {
          key: 'setup_complete',
          value: true,
          tenantId: tenant.id,
          description: 'Initial setup completed',
        },
        {
          key: 'setup_date',
          value: new Date().toISOString(),
          tenantId: tenant.id,
          description: 'Setup completion date',
        },
        {
          key: 'default_facility_id',
          value: facility.id,
          tenantId: tenant.id,
          description: 'Default facility ID',
        },
        {
          key: 'facility_mode',
          value: dto.settings?.facilityMode || FACILITY_MODES.HOSPITAL,
          tenantId: tenant.id,
          description: 'Deployment mode preset',
        },
        {
          key: 'single_user_mode',
          value: isSingleUser,
          tenantId: tenant.id,
          description: 'Single-user clinic mode',
        },
        {
          key: 'enabled_modules',
          value: JSON.stringify(resolvedModules),
          tenantId: tenant.id,
          description: 'Enabled navigation modules for this tenant',
        },
        {
          key: 'workflow_mode',
          value: dto.settings?.workflowMode || 'simple',
          tenantId: tenant.id,
          description: 'Workflow mode: "simple" (single shared queue) or "departmental" (per-department queues)',
        },
      ];
      for (const setting of settings) {
        // Idempotent — re-running setup must not violate UNIQUE(key, tenant_id).
        const existing = await queryRunner.manager.findOne(SystemSetting, {
          where: { key: setting.key, tenantId: setting.tenantId },
        });
        if (existing) {
          existing.value = setting.value;
          if (setting.description) existing.description = setting.description;
          await queryRunner.manager.save(existing);
        } else {
          await queryRunner.manager.save(queryRunner.manager.create(SystemSetting, setting));
        }
      }

      // Auto-seed a default "General" department for OPD/queue usability.
      await this.seedDefaultDepartment(queryRunner.manager, facility.id, tenant.id);

      // Update tenant settings
      await queryRunner.query(`UPDATE tenants SET settings = settings || $1::jsonb WHERE id = $2`, [
        JSON.stringify({
          currency: dto.settings?.currency || 'UGX',
          timezone: dto.settings?.timezone || 'Africa/Kampala',
          dateFormat: dto.settings?.dateFormat || 'DD/MM/YYYY',
          facilityMode: dto.settings?.facilityMode || FACILITY_MODES.HOSPITAL,
        }),
        tenant.id,
      ]);

      await queryRunner.commitTransaction();
      this.logger.log(
        `Tenant setup completed - Org: ${tenant.name}, Facility: ${dto.facility.name}, Admin: ${dto.admin.username}`,
      );

      return {
        success: true,
        message: 'Organization setup completed successfully',
        tenantId: tenant.id,
        facilityId: facility.id,
        userId: user.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Tenant setup failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Setup failed: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }
}
