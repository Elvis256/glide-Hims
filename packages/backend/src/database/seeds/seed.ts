import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tenant } from '../entities/tenant.entity';
import { Facility } from '../entities/facility.entity';
import { Department } from '../entities/department.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../entities/user-role.entity';
import { Patient } from '../entities/patient.entity';
import { AuditLog } from '../entities/audit-log.entity';

// Default permissions for all modules
const defaultPermissions = [
  // User Management
  { code: 'users.create', name: 'Create Users', module: 'users' },
  { code: 'users.read', name: 'View Users', module: 'users' },
  { code: 'users.update', name: 'Update Users', module: 'users' },
  { code: 'users.delete', name: 'Delete Users', module: 'users' },

  // Role Management
  { code: 'roles.create', name: 'Create Roles', module: 'roles' },
  { code: 'roles.read', name: 'View Roles', module: 'roles' },
  { code: 'roles.update', name: 'Update Roles', module: 'roles' },
  { code: 'roles.delete', name: 'Delete Roles', module: 'roles' },

  // Facility Management
  { code: 'facilities.create', name: 'Create Facilities', module: 'facilities' },
  { code: 'facilities.read', name: 'View Facilities', module: 'facilities' },
  { code: 'facilities.update', name: 'Update Facilities', module: 'facilities' },
  { code: 'facilities.delete', name: 'Delete Facilities', module: 'facilities' },

  // Tenant Management
  { code: 'tenants.create', name: 'Create Tenants', module: 'tenants' },
  { code: 'tenants.read', name: 'View Tenants', module: 'tenants' },
  { code: 'tenants.update', name: 'Update Tenants', module: 'tenants' },
  { code: 'tenants.delete', name: 'Delete Tenants', module: 'tenants' },

  // Patient Management
  { code: 'patients.create', name: 'Register Patients', module: 'patients' },
  { code: 'patients.read', name: 'View Patients', module: 'patients' },
  { code: 'patients.update', name: 'Update Patients', module: 'patients' },
  { code: 'patients.delete', name: 'Delete Patients', module: 'patients' },

  // Audit Logs
  { code: 'audit.read', name: 'View Audit Logs', module: 'audit' },
  { code: 'audit.export', name: 'Export Audit Logs', module: 'audit' },

  // Billing
  { code: 'billing.read', name: 'View Billing', module: 'billing' },
  { code: 'billing.create', name: 'Create Bills', module: 'billing' },
  { code: 'billing.update', name: 'Update Bills', module: 'billing' },
  { code: 'billing.delete', name: 'Delete Bills', module: 'billing' },

  // Pharmacy
  { code: 'pharmacy.read', name: 'View Pharmacy', module: 'pharmacy' },
  { code: 'pharmacy.create', name: 'Create Prescriptions', module: 'pharmacy' },
  { code: 'pharmacy.update', name: 'Dispense Medications', module: 'pharmacy' },
  { code: 'pharmacy.delete', name: 'Delete Pharmacy Records', module: 'pharmacy' },

  // Laboratory
  { code: 'lab.read', name: 'View Lab Tests', module: 'lab' },
  { code: 'lab.create', name: 'Order Lab Tests', module: 'lab' },
  { code: 'lab.update', name: 'Enter Lab Results', module: 'lab' },
  { code: 'lab.delete', name: 'Delete Lab Records', module: 'lab' },

  // Inventory
  { code: 'inventory.read', name: 'View Inventory', module: 'inventory' },
  { code: 'inventory.create', name: 'Add Inventory', module: 'inventory' },
  { code: 'inventory.update', name: 'Update Inventory', module: 'inventory' },
  { code: 'inventory.delete', name: 'Delete Inventory', module: 'inventory' },

  // Stores
  { code: 'stores.read', name: 'View Stores', module: 'stores' },
  { code: 'stores.create', name: 'Create Store Items', module: 'stores' },
  { code: 'stores.update', name: 'Update Store Items', module: 'stores' },
  { code: 'stores.delete', name: 'Delete Store Items', module: 'stores' },

  // IPD (Inpatient)
  { code: 'ipd.read', name: 'View IPD', module: 'ipd' },
  { code: 'ipd.create', name: 'Admit Patients', module: 'ipd' },
  { code: 'ipd.update', name: 'Update IPD Records', module: 'ipd' },
  { code: 'ipd.delete', name: 'Delete IPD Records', module: 'ipd' },

  // HR
  { code: 'hr.read', name: 'View HR Dashboard', module: 'hr' },
  { code: 'hr.create', name: 'Create HR Records', module: 'hr' },
  { code: 'hr.update', name: 'Update HR Records', module: 'hr' },
  { code: 'hr.delete', name: 'Delete HR Records', module: 'hr' },

  // Employees
  { code: 'employees.read', name: 'View Employees', module: 'employees' },
  { code: 'employees.create', name: 'Create Employees', module: 'employees' },
  { code: 'employees.update', name: 'Update Employees', module: 'employees' },
  { code: 'employees.delete', name: 'Delete Employees', module: 'employees' },

  // Attendance
  { code: 'attendance.read', name: 'View Attendance', module: 'attendance' },
  { code: 'attendance.create', name: 'Record Attendance', module: 'attendance' },
  { code: 'attendance.update', name: 'Update Attendance', module: 'attendance' },

  // Leave
  { code: 'leave.read', name: 'View Leave', module: 'leave' },
  { code: 'leave.create', name: 'Apply Leave', module: 'leave' },
  { code: 'leave.update', name: 'Manage Leave', module: 'leave' },

  // Payroll
  { code: 'payroll.read', name: 'View Payroll', module: 'payroll' },
  { code: 'payroll.create', name: 'Create Payroll', module: 'payroll' },
  { code: 'payroll.update', name: 'Process Payroll', module: 'payroll' },

  // Emergency
  { code: 'emergency.read', name: 'View Emergency', module: 'emergency' },
  { code: 'emergency.create', name: 'Register Emergency', module: 'emergency' },
  { code: 'emergency.update', name: 'Update Emergency', module: 'emergency' },

  // Surgery
  { code: 'surgery.read', name: 'View Surgery', module: 'surgery' },
  { code: 'surgery.create', name: 'Schedule Surgery', module: 'surgery' },
  { code: 'surgery.update', name: 'Update Surgery', module: 'surgery' },
  { code: 'surgery.delete', name: 'Cancel Surgery', module: 'surgery' },

  // Radiology
  { code: 'radiology.read', name: 'View Radiology', module: 'radiology' },
  { code: 'radiology.create', name: 'Order Radiology', module: 'radiology' },
  { code: 'radiology.update', name: 'Update Radiology', module: 'radiology' },
  { code: 'radiology.delete', name: 'Delete Radiology', module: 'radiology' },

  // Maternity
  { code: 'maternity.read', name: 'View Maternity', module: 'maternity' },
  { code: 'maternity.create', name: 'Register Maternity', module: 'maternity' },
  { code: 'maternity.update', name: 'Update Maternity', module: 'maternity' },

  // Encounters
  { code: 'encounters.read', name: 'View Encounters', module: 'encounters' },
  { code: 'encounters.create', name: 'Create Encounters', module: 'encounters' },
  { code: 'encounters.update', name: 'Update Encounters', module: 'encounters' },
  { code: 'encounters.delete', name: 'Delete Encounters', module: 'encounters' },

  // Prescriptions
  { code: 'prescriptions.read', name: 'View Prescriptions', module: 'prescriptions' },
  { code: 'prescriptions.create', name: 'Create Prescriptions', module: 'prescriptions' },
  { code: 'prescriptions.update', name: 'Update Prescriptions', module: 'prescriptions' },

  // Clinical Notes
  { code: 'clinical-notes.read', name: 'View Clinical Notes', module: 'clinical-notes' },
  { code: 'clinical-notes.create', name: 'Create Clinical Notes', module: 'clinical-notes' },
  { code: 'clinical-notes.update', name: 'Update Clinical Notes', module: 'clinical-notes' },
  { code: 'clinical-notes.delete', name: 'Delete Clinical Notes', module: 'clinical-notes' },

  // Vitals
  { code: 'vitals.read', name: 'View Vitals', module: 'vitals' },
  { code: 'vitals.create', name: 'Record Vitals', module: 'vitals' },
  { code: 'vitals.update', name: 'Update Vitals', module: 'vitals' },
  { code: 'vitals.delete', name: 'Delete Vitals', module: 'vitals' },

  // Orders
  { code: 'orders.read', name: 'View Orders', module: 'orders' },
  { code: 'orders.create', name: 'Create Orders', module: 'orders' },
  { code: 'orders.update', name: 'Update Orders', module: 'orders' },

  // Procurement
  { code: 'procurement.read', name: 'View Procurement', module: 'procurement' },
  { code: 'procurement.create', name: 'Create Procurement', module: 'procurement' },
  { code: 'procurement.update', name: 'Update Procurement', module: 'procurement' },
  { code: 'procurement.approve', name: 'Approve Procurement', module: 'procurement' },

  // Diagnoses
  { code: 'diagnoses.read', name: 'View Diagnoses', module: 'diagnoses' },
  { code: 'diagnoses.create', name: 'Create Diagnoses', module: 'diagnoses' },
  { code: 'diagnoses.update', name: 'Update Diagnoses', module: 'diagnoses' },
  { code: 'diagnoses.delete', name: 'Delete Diagnoses', module: 'diagnoses' },

  // Services
  { code: 'services.read', name: 'View Services', module: 'services' },
  { code: 'services.create', name: 'Create Services', module: 'services' },
  { code: 'services.update', name: 'Update Services', module: 'services' },

  // Providers
  { code: 'providers.read', name: 'View Providers', module: 'providers' },
  { code: 'providers.create', name: 'Create Providers', module: 'providers' },
  { code: 'providers.update', name: 'Update Providers', module: 'providers' },
  { code: 'providers.delete', name: 'Delete Providers', module: 'providers' },

  // Appointments
  { code: 'appointments.read', name: 'View Appointments', module: 'appointments' },
  { code: 'appointments.create', name: 'Book Appointments', module: 'appointments' },
  { code: 'appointments.update', name: 'Manage Appointments', module: 'appointments' },
  { code: 'appointments.delete', name: 'Cancel Appointments', module: 'appointments' },

  // Insurance
  { code: 'insurance.read', name: 'View Insurance', module: 'insurance' },
  { code: 'insurance.create', name: 'Create Insurance', module: 'insurance' },
  { code: 'insurance.update', name: 'Update Insurance', module: 'insurance' },
  { code: 'insurance.delete', name: 'Delete Insurance', module: 'insurance' },

  // Finance
  { code: 'finance.read', name: 'View Finance', module: 'finance' },
  { code: 'finance.create', name: 'Create Finance', module: 'finance' },
  { code: 'finance.update', name: 'Update Finance', module: 'finance' },

  // Analytics
  { code: 'analytics.read', name: 'View Analytics', module: 'analytics' },

  // Suppliers
  { code: 'suppliers.read', name: 'View Suppliers', module: 'suppliers' },
  { code: 'suppliers.create', name: 'Create Suppliers', module: 'suppliers' },
  { code: 'suppliers.update', name: 'Update Suppliers', module: 'suppliers' },
  { code: 'suppliers.delete', name: 'Delete Suppliers', module: 'suppliers' },

  // Sync
  { code: 'sync.read', name: 'View Sync', module: 'sync' },
  { code: 'sync.create', name: 'Create Sync', module: 'sync' },
  { code: 'sync.update', name: 'Update Sync', module: 'sync' },

  // Membership
  { code: 'membership.read', name: 'View Membership', module: 'membership' },
  { code: 'membership.create', name: 'Create Membership', module: 'membership' },
  { code: 'membership.update', name: 'Update Membership', module: 'membership' },

  // MDM
  { code: 'mdm.read', name: 'View MDM', module: 'mdm' },
  { code: 'mdm.create', name: 'Create MDM', module: 'mdm' },
  { code: 'mdm.update', name: 'Update MDM', module: 'mdm' },
  { code: 'mdm.approve', name: 'Approve MDM', module: 'mdm' },
];

// Default roles
const defaultRoles = [
  { name: 'Super Admin', description: 'Full system access', isSystemRole: true },
  { name: 'Admin', description: 'Administrative access', isSystemRole: true },
  { name: 'Doctor', description: 'Clinical staff - Doctor', isSystemRole: true },
  { name: 'Nurse', description: 'Clinical staff - Nurse', isSystemRole: true },
  { name: 'Receptionist', description: 'Front desk staff', isSystemRole: true },
  { name: 'Lab Technician', description: 'Laboratory staff', isSystemRole: true },
  { name: 'Pharmacist', description: 'Pharmacy staff', isSystemRole: true },
  { name: 'Cashier', description: 'Billing and payments', isSystemRole: true },
  { name: 'Store Keeper', description: 'Inventory management', isSystemRole: true },
];

export async function seed(dataSource: DataSource) {
  console.log('🌱 Starting database seed...\n');

  const permissionRepo = dataSource.getRepository(Permission);
  const roleRepo = dataSource.getRepository(Role);
  const rolePermissionRepo = dataSource.getRepository(RolePermission);
  const userRepo = dataSource.getRepository(User);
  const userRoleRepo = dataSource.getRepository(UserRole);
  const tenantRepo = dataSource.getRepository(Tenant);
  const facilityRepo = dataSource.getRepository(Facility);

  // 1. Create Permissions
  console.log('📝 Creating permissions...');
  const permissions: Permission[] = [];
  for (const p of defaultPermissions) {
    let permission = await permissionRepo.findOne({ where: { code: p.code } });
    if (!permission) {
      permission = await permissionRepo.save(permissionRepo.create(p));
      console.log(`  ✓ Created permission: ${p.code}`);
    }
    permissions.push(permission);
  }

  // 2. Create Roles
  console.log('\n👥 Creating roles...');
  const roles: Record<string, Role> = {};
  for (const r of defaultRoles) {
    let role = await roleRepo.findOne({ where: { name: r.name } });
    if (!role) {
      role = await roleRepo.save(roleRepo.create(r));
      console.log(`  ✓ Created role: ${r.name}`);
    }
    roles[r.name] = role;
  }

  // 3. Assign all permissions to Super Admin
  console.log('\n🔐 Assigning permissions to Super Admin...');
  const superAdmin = roles['Super Admin'];
  for (const permission of permissions) {
    const exists = await rolePermissionRepo.findOne({
      where: { roleId: superAdmin.id, permissionId: permission.id },
    });
    if (!exists) {
      await rolePermissionRepo.save(
        rolePermissionRepo.create({
          roleId: superAdmin.id,
          permissionId: permission.id,
        }),
      );
    }
  }
  console.log(`  ✓ Super Admin has ${permissions.length} permissions`);

  // 4. Assign permissions to Admin (all except tenant management)
  console.log('\n🔐 Assigning permissions to Admin...');
  const adminRole = roles['Admin'];
  const adminPermissions = permissions.filter((p) => !p.code.startsWith('tenants.'));
  for (const permission of adminPermissions) {
    const exists = await rolePermissionRepo.findOne({
      where: { roleId: adminRole.id, permissionId: permission.id },
    });
    if (!exists) {
      await rolePermissionRepo.save(
        rolePermissionRepo.create({
          roleId: adminRole.id,
          permissionId: permission.id,
        }),
      );
    }
  }
  console.log(`  ✓ Admin has ${adminPermissions.length} permissions`);

  // 5. Create Default Tenant
  console.log('\n🏢 Creating default tenant...');
  let defaultTenant = await tenantRepo.findOne({ where: { name: 'Default Tenant' } });
  if (!defaultTenant) {
    defaultTenant = await tenantRepo.save(
      tenantRepo.create({
        name: 'Default Tenant',
        status: 'active',
        description: 'Default tenant for development',
      }),
    );
    console.log('  ✓ Created default tenant');
  }

  // 6. Create Default Facility
  console.log('\n🏥 Creating default facility...');
  let defaultFacility = await facilityRepo.findOne({ where: { name: 'Main Hospital' } });
  if (!defaultFacility) {
    defaultFacility = await facilityRepo.save(
      facilityRepo.create({
        tenantId: defaultTenant.id,
        name: 'Main Hospital',
        type: 'hospital',
        status: 'active',
        location: 'Kampala, Uganda',
        contact: {
          phone: '+256700000000',
          email: 'info@mainhospital.ug',
        },
      }),
    );
    console.log('  ✓ Created default facility: Main Hospital');
  }

  // 7. Create Admin User
  console.log('\n👤 Creating admin user...');
  let adminUser = await userRepo.findOne({ where: { username: 'admin' } });
  if (!adminUser) {
    const passwordHash = await bcrypt.hash('Admin@123', 12);
    adminUser = await userRepo.save(
      userRepo.create({
        username: 'admin',
        passwordHash,
        fullName: 'System Administrator',
        email: 'admin@glide-hims.local',
        phone: '+256700000000',
        status: 'active',
      }),
    );
    console.log('  ✓ Created admin user');
    console.log('    Username: admin');
    console.log('    Password: Admin@123');
  }

  // 8. Assign Super Admin role to admin user
  console.log('\n🔑 Assigning Super Admin role to admin user...');
  let adminUserRole = await userRoleRepo.findOne({
    where: { userId: adminUser.id, roleId: superAdmin.id },
  });
  if (!adminUserRole) {
    await userRoleRepo.save(
      userRoleRepo.create({
        userId: adminUser.id,
        roleId: superAdmin.id,
        facilityId: defaultFacility.id,
      }),
    );
    console.log('  ✓ Admin user has Super Admin role');
  }

  console.log('\n✅ Database seed completed successfully!\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Default Admin Credentials:');
  console.log('  Username: admin');
  console.log('  Password: Admin@123');
  console.log('═══════════════════════════════════════════════════\n');
}

// Run seed if executed directly
async function runSeed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'glide_hims',
    password: process.env.DB_PASSWORD || 'glide_hims_dev',
    database: process.env.DB_NAME || 'glide_hims_dev',
    entities: [
      Tenant,
      Facility,
      Department,
      Role,
      Permission,
      RolePermission,
      User,
      UserRole,
      Patient,
      AuditLog,
    ],
    synchronize: false,
  });

  await dataSource.initialize();
  await seed(dataSource);
  await dataSource.destroy();
}

runSeed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
