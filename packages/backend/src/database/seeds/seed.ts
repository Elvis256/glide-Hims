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

// Default permissions for Phase 0
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
