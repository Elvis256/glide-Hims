import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
import { InitializeSetupDto } from './dto/setup.dto';

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
  { code: 'clinical_notes.read', name: 'View Clinical Notes', module: 'clinical_notes' },
  { code: 'clinical_notes.create', name: 'Create Clinical Notes', module: 'clinical_notes' },
  { code: 'clinical_notes.update', name: 'Update Clinical Notes', module: 'clinical_notes' },
  
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
      'dashboard.read', 'patients.read', 'patients.update',
      'encounters.read', 'encounters.create', 'encounters.update',
      'vitals.read', 'clinical_notes.read', 'clinical_notes.create', 'clinical_notes.update',
      'orders.read', 'orders.create', 'lab.read', 'lab.create',
      'radiology.read', 'radiology.create', 'pharmacy.read', 'pharmacy.create',
      'ipd.read', 'ipd.create', 'ipd.update', 'ipd.discharge',
      'reports.read', 'appointments.read', 'queue.read'
    ]
  },
  {
    name: 'Nurse',
    description: 'Nursing staff',
    permissions: [
      'dashboard.read', 'patients.read', 'patients.update',
      'encounters.read', 'encounters.update',
      'vitals.read', 'vitals.create', 'vitals.update',
      'clinical_notes.read', 'clinical_notes.create',
      'orders.read', 'lab.read', 'pharmacy.read',
      'ipd.read', 'ipd.update', 'emergency.read', 'emergency.triage',
      'queue.read', 'queue.manage'
    ]
  },
  {
    name: 'Receptionist',
    description: 'Front desk and registration staff',
    permissions: [
      'dashboard.read', 'patients.read', 'patients.create', 'patients.update',
      'encounters.read', 'encounters.create',
      'appointments.read', 'appointments.create', 'appointments.update', 'appointments.delete',
      'queue.read', 'queue.manage', 'billing.read',
      'insurance.read', 'insurance.verify'
    ]
  },
  {
    name: 'Lab Technician',
    description: 'Laboratory staff',
    permissions: [
      'dashboard.read', 'patients.read',
      'orders.read', 'lab.read', 'lab.create', 'lab.update',
      'reports.read'
    ]
  },
  {
    name: 'Pharmacist',
    description: 'Pharmacy staff',
    permissions: [
      'dashboard.read', 'patients.read',
      'orders.read', 'pharmacy.read', 'pharmacy.update',
      'inventory.read', 'inventory.update',
      'billing.read', 'billing.create', 'billing.collect_payment',
      'reports.read'
    ]
  },
  {
    name: 'Cashier',
    description: 'Billing and payment collection staff',
    permissions: [
      'dashboard.read', 'patients.read',
      'billing.read', 'billing.create', 'billing.update', 'billing.collect_payment',
      'insurance.read', 'insurance.verify',
      'reports.read'
    ]
  },
  {
    name: 'Radiologist',
    description: 'Radiology/Imaging staff',
    permissions: [
      'dashboard.read', 'patients.read',
      'orders.read', 'radiology.read', 'radiology.create', 'radiology.update',
      'reports.read'
    ]
  },
  {
    name: 'Store Keeper',
    description: 'Inventory and stores management',
    permissions: [
      'dashboard.read',
      'inventory.read', 'inventory.create', 'inventory.update', 'inventory.transfer', 'inventory.adjust',
      'reports.read'
    ]
  },
  {
    name: 'HR Manager',
    description: 'Human resources management',
    permissions: [
      'dashboard.read', 'users.read',
      'hr.read', 'hr.create', 'hr.update', 'hr.delete', 'hr.payroll', 'hr.leave',
      'reports.read', 'reports.export'
    ]
  },
  {
    name: 'Administrator',
    description: 'System administrator with full access to settings',
    permissions: [
      'dashboard.read',
      'users.read', 'users.create', 'users.update', 'users.delete',
      'roles.read', 'roles.create', 'roles.update', 'roles.delete',
      'settings.read', 'settings.update',
      'facilities.read', 'facilities.create', 'facilities.update', 'facilities.delete',
      'services.read', 'services.create', 'services.update', 'services.delete',
      'reports.read', 'reports.export'
    ]
  },
];

@Injectable()
export class SetupService {
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
  ) {}

  /**
   * Check if initial setup has been completed
   */
  async getSetupStatus(): Promise<{ 
    isSetupComplete: boolean; 
    organizationName?: string;
    facilityName?: string;
  }> {
    try {
      // Check if any tenant exists
      const tenant = await this.tenantRepo.findOne({ 
        where: { status: 'active' },
        order: { createdAt: 'ASC' }
      });
      
      if (!tenant) {
        return { isSetupComplete: false };
      }

      // Check if setup_complete setting exists
      let setupSetting = null;
      try {
        setupSetting = await this.settingRepo.findOne({
          where: { key: 'setup_complete', tenantId: tenant.id }
        });
      } catch (e) {
        // Table might not exist yet
        return { isSetupComplete: false };
      }

      // Get main facility
      const facility = await this.facilityRepo.findOne({
        where: { tenantId: tenant.id, status: 'active' },
        order: { createdAt: 'ASC' }
      });

      return {
        isSetupComplete: setupSetting?.value === true,
        organizationName: tenant.name,
        facilityName: facility?.name,
      };
    } catch (error) {
      // If tables don't exist yet, setup is not complete
      console.log('[SetupService] Error checking setup status:', error.message);
      return { isSetupComplete: false };
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
      throw new BadRequestException('Setup has already been completed. This action is not allowed.');
    }

    // Check if username or email already exists
    const existingUser = await this.userRepo.findOne({
      where: [
        { username: dto.admin.username },
        { email: dto.admin.email }
      ]
    });
    if (existingUser) {
      throw new BadRequestException('A user with this username or email already exists');
    }

    // Run in transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Organization (Tenant)
      const tenant = queryRunner.manager.create(Tenant, {
        name: dto.organization.name,
        status: 'active',
        description: dto.organization.type || 'Hospital',
        settings: {
          country: dto.organization.country,
          logoUrl: dto.organization.logoUrl,
          currency: dto.settings?.currency || 'UGX',
          timezone: dto.settings?.timezone || 'Africa/Kampala',
          dateFormat: dto.settings?.dateFormat || 'DD/MM/YYYY',
          enabledModules: dto.settings?.enabledModules || [
            'patients', 'encounters', 'lab', 'pharmacy', 'radiology', 
            'billing', 'inventory', 'hr', 'reports'
          ],
        },
      });
      await queryRunner.manager.save(tenant);

      // 2. Create Main Facility
      const facility = queryRunner.manager.create(Facility, {
        tenantId: tenant.id,
        name: dto.facility.name,
        type: dto.facility.type || 'hospital',
        location: dto.facility.location,
        status: 'active',
        contact: {
          phone: dto.facility.phone,
          email: dto.facility.email,
        },
        settings: {
          isMainFacility: true,
        },
      });
      await queryRunner.manager.save(facility);

      // 3. Create all default permissions
      console.log('[SETUP] Creating default permissions...');
      const permissionMap = new Map<string, Permission>();
      for (const perm of DEFAULT_PERMISSIONS) {
        const permission = queryRunner.manager.create(Permission, perm);
        await queryRunner.manager.save(permission);
        permissionMap.set(perm.code, permission);
      }
      console.log(`[SETUP] Created ${permissionMap.size} permissions`);

      // 4. Create Super Admin role with ALL permissions
      let superAdminRole = queryRunner.manager.create(Role, {
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
      console.log('[SETUP] Super Admin role created with all permissions');

      // 5. Create default roles with their permissions
      console.log('[SETUP] Creating default roles...');
      for (const roleData of DEFAULT_ROLES) {
        const role = queryRunner.manager.create(Role, {
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
      console.log(`[SETUP] Created ${DEFAULT_ROLES.length} default roles`);

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
      const settings = [
        { key: 'setup_complete', value: true, tenantId: tenant.id, description: 'Initial setup completed' },
        { key: 'setup_date', value: new Date().toISOString(), tenantId: tenant.id, description: 'Setup completion date' },
        { key: 'default_facility_id', value: facility.id, tenantId: tenant.id, description: 'Default facility ID' },
      ];

      for (const setting of settings) {
        const settingEntity = queryRunner.manager.create(SystemSetting, setting);
        await queryRunner.manager.save(settingEntity);
      }

      await queryRunner.commitTransaction();

      console.log(`[SETUP] System initialized successfully - Org: ${tenant.name}, Facility: ${facility.name}, Admin: ${user.username}`);

      return {
        success: true,
        message: 'System setup completed successfully',
        tenantId: tenant.id,
        facilityId: facility.id,
        userId: user.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('[SETUP] Failed to initialize system:', error.message, error.stack);
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
      where: { tenantId }
    });
    
    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);
  }
}
