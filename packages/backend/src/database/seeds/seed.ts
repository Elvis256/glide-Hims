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

  // Queue Management
  { code: 'queue.read', name: 'View Queue', module: 'queue' },
  { code: 'queue.create', name: 'Issue Tokens', module: 'queue' },
  { code: 'queue.update', name: 'Manage Queue', module: 'queue' },
  { code: 'queue.delete', name: 'Cancel Queue Entries', module: 'queue' },

  // Doctor On-Duty
  { code: 'doctor-duty.read', name: 'View Doctors On Duty', module: 'doctor-duty' },
  { code: 'doctor-duty.create', name: 'Mark Doctor On Duty', module: 'doctor-duty' },
  { code: 'doctor-duty.update', name: 'Update Doctor Duty', module: 'doctor-duty' },

  // Schedules
  { code: 'schedules.read', name: 'View Schedules', module: 'schedules' },
  { code: 'schedules.create', name: 'Create Schedules', module: 'schedules' },
  { code: 'schedules.update', name: 'Update Schedules', module: 'schedules' },
  { code: 'schedules.delete', name: 'Delete Schedules', module: 'schedules' },

  // Discharge
  { code: 'discharge.read', name: 'View Discharge Summaries', module: 'discharge' },
  { code: 'discharge.create', name: 'Create Discharge Summary', module: 'discharge' },
  { code: 'discharge.update', name: 'Update Discharge Summary', module: 'discharge' },

  // Disposal
  { code: 'disposal.read', name: 'View Disposal Records', module: 'disposal' },
  { code: 'disposal.create', name: 'Create Disposal', module: 'disposal' },
  { code: 'disposal.update', name: 'Update Disposal', module: 'disposal' },
  { code: 'disposal.approve', name: 'Approve Disposal', module: 'disposal' },

  // Assets
  { code: 'assets.read', name: 'View Assets', module: 'assets' },
  { code: 'assets.create', name: 'Create Assets', module: 'assets' },
  { code: 'assets.update', name: 'Update Assets', module: 'assets' },
  { code: 'assets.delete', name: 'Delete Assets', module: 'assets' },

  // Chronic Care
  { code: 'chronic.read', name: 'View Chronic Care', module: 'chronic' },
  { code: 'chronic.create', name: 'Create Chronic Care', module: 'chronic' },
  { code: 'chronic.update', name: 'Update Chronic Care', module: 'chronic' },

  // Notifications
  { code: 'notifications.read', name: 'View Notifications', module: 'notifications' },
  { code: 'notifications.create', name: 'Create Notifications', module: 'notifications' },
  { code: 'notifications.update', name: 'Update Notifications', module: 'notifications' },
  { code: 'notifications.delete', name: 'Delete Notifications', module: 'notifications' },

  // Follow-ups
  { code: 'followups.read', name: 'View Follow-ups', module: 'followups' },
  { code: 'followups.create', name: 'Create Follow-ups', module: 'followups' },
  { code: 'followups.update', name: 'Update Follow-ups', module: 'followups' },
  { code: 'followups.delete', name: 'Delete Follow-ups', module: 'followups' },

  // Referrals
  { code: 'referrals.read', name: 'View Referrals', module: 'referrals' },
  { code: 'referrals.create', name: 'Create Referrals', module: 'referrals' },
  { code: 'referrals.update', name: 'Update Referrals', module: 'referrals' },

  // Problems
  { code: 'problems.read', name: 'View Problems', module: 'problems' },
  { code: 'problems.create', name: 'Create Problems', module: 'problems' },
  { code: 'problems.update', name: 'Update Problems', module: 'problems' },
  { code: 'problems.delete', name: 'Delete Problems', module: 'problems' },

  // Treatment Plans
  { code: 'treatment-plans.read', name: 'View Treatment Plans', module: 'treatment-plans' },
  { code: 'treatment-plans.create', name: 'Create Treatment Plans', module: 'treatment-plans' },
  { code: 'treatment-plans.update', name: 'Update Treatment Plans', module: 'treatment-plans' },

  // Nursing
  { code: 'nursing.read', name: 'View Nursing Records', module: 'nursing' },
  { code: 'nursing.create', name: 'Create Nursing Records', module: 'nursing' },
  { code: 'nursing.update', name: 'Update Nursing Records', module: 'nursing' },
  { code: 'triage.read', name: 'View Triage', module: 'nursing' },
  { code: 'triage.update', name: 'Perform Triage', module: 'nursing' },
  { code: 'incidents.read', name: 'View Incidents', module: 'nursing' },
  { code: 'incidents.create', name: 'Create Incidents', module: 'nursing' },
  { code: 'incidents.update', name: 'Update Incidents', module: 'nursing' },

  // Supplier Returns
  { code: 'supplier-returns.read', name: 'View Supplier Returns', module: 'supplier-returns' },
  { code: 'supplier-returns.create', name: 'Create Supplier Returns', module: 'supplier-returns' },
  { code: 'supplier-returns.update', name: 'Update Supplier Returns', module: 'supplier-returns' },

  // Reports
  { code: 'reports.read', name: 'View Reports', module: 'reports' },

  // Admin
  { code: 'admin.read', name: 'View Admin Dashboard', module: 'admin' },

  // Additional Finance
  { code: 'finance.manage', name: 'Manage Finance', module: 'finance' },

  // Additional Leave
  { code: 'leave.approve', name: 'Approve Leave Requests', module: 'leave' },

  // Additional Payroll
  { code: 'payroll.process', name: 'Process Payroll', module: 'payroll' },

  // Additional Services
  { code: 'services.delete', name: 'Delete Services', module: 'services' },

  // Admin Settings
  { code: 'admin.settings.manage', name: 'Manage Admin Settings', module: 'admin' },

  // Finance Sub-permissions (granular)
  { code: 'finance.accounts.read', name: 'View Chart of Accounts', module: 'finance' },
  { code: 'finance.accounts.create', name: 'Create Accounts', module: 'finance' },
  { code: 'finance.accounts.update', name: 'Update Accounts', module: 'finance' },
  { code: 'finance.accounts.delete', name: 'Delete Accounts', module: 'finance' },
  { code: 'finance.journals.read', name: 'View Journal Entries', module: 'finance' },
  { code: 'finance.journals.create', name: 'Create Journal Entries', module: 'finance' },
  { code: 'finance.journals.post', name: 'Post Journal Entries', module: 'finance' },
  { code: 'finance.periods.read', name: 'View Fiscal Periods', module: 'finance' },
  { code: 'finance.periods.create', name: 'Create Fiscal Periods', module: 'finance' },
  { code: 'finance.periods.close', name: 'Close Fiscal Periods', module: 'finance' },
  { code: 'finance.reports.read', name: 'View Financial Reports', module: 'finance' },

  // Insurance Sub-permissions (granular)
  { code: 'insurance.claims.read', name: 'View Insurance Claims', module: 'insurance' },
  { code: 'insurance.claims.create', name: 'Create Insurance Claims', module: 'insurance' },
  { code: 'insurance.claims.update', name: 'Update Insurance Claims', module: 'insurance' },
  { code: 'insurance.claims.process', name: 'Process Insurance Claims', module: 'insurance' },
  { code: 'insurance.policies.read', name: 'View Insurance Policies', module: 'insurance' },
  { code: 'insurance.policies.create', name: 'Create Insurance Policies', module: 'insurance' },
  { code: 'insurance.policies.update', name: 'Update Insurance Policies', module: 'insurance' },
  { code: 'insurance.preauth.read', name: 'View Pre-authorizations', module: 'insurance' },
  { code: 'insurance.preauth.create', name: 'Create Pre-authorizations', module: 'insurance' },
  { code: 'insurance.preauth.update', name: 'Update Pre-authorizations', module: 'insurance' },
  { code: 'insurance.preauth.process', name: 'Process Pre-authorizations', module: 'insurance' },
  { code: 'insurance.providers.read', name: 'View Insurance Providers', module: 'insurance' },
  { code: 'insurance.providers.create', name: 'Create Insurance Providers', module: 'insurance' },
  { code: 'insurance.providers.update', name: 'Update Insurance Providers', module: 'insurance' },
  { code: 'insurance.reports.read', name: 'View Insurance Reports', module: 'insurance' },

  // Radiology Sub-permissions (granular)
  { code: 'radiology.modalities.read', name: 'View Radiology Modalities', module: 'radiology' },
  { code: 'radiology.modalities.create', name: 'Create Radiology Modalities', module: 'radiology' },
  { code: 'radiology.orders.read', name: 'View Radiology Orders', module: 'radiology' },
  { code: 'radiology.orders.create', name: 'Create Radiology Orders', module: 'radiology' },
  { code: 'radiology.orders.update', name: 'Update Radiology Orders', module: 'radiology' },
  { code: 'radiology.results.read', name: 'View Radiology Results', module: 'radiology' },
  { code: 'radiology.results.create', name: 'Create Radiology Results', module: 'radiology' },
  { code: 'radiology.reports.read', name: 'View Radiology Reports', module: 'radiology' },

  // Procurement Sub-permissions
  { code: 'procurement.delete', name: 'Delete Procurement', module: 'procurement' },
];

// Default roles
const defaultRoles = [
  { name: 'Super Admin', description: 'Full system access', isSystemRole: true },
  { name: 'Administrator', description: 'Administrative access', isSystemRole: true },
  { name: 'Doctor', description: 'Clinical staff - Doctor', isSystemRole: true },
  { name: 'Nurse', description: 'Clinical staff - Nurse', isSystemRole: true },
  { name: 'Receptionist', description: 'Front desk staff', isSystemRole: true },
  { name: 'Lab Technician', description: 'Laboratory staff', isSystemRole: true },
  { name: 'Pharmacist', description: 'Pharmacy staff', isSystemRole: true },
  { name: 'Cashier', description: 'Billing and payments', isSystemRole: true },
  { name: 'Store Keeper', description: 'Inventory management', isSystemRole: true },
  { name: 'HR Manager', description: 'Human resources management', isSystemRole: true },
  { name: 'Radiologist', description: 'Radiology staff', isSystemRole: true },
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

  // 4. Assign permissions to Administrator (all except tenant management)
  console.log('\n🔐 Assigning permissions to Administrator...');
  const adminRole = roles['Administrator'];
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
  console.log(`  ✓ Administrator has ${adminPermissions.length} permissions`);

  // 4b. Assign permissions to other roles
  console.log('\n🔐 Assigning permissions to clinical and operational roles...');

  // Role-specific permission mappings
  const rolePermissionMappings: Record<string, string[]> = {
    'Doctor': [
      'facilities.read', 'dashboard.read',
      'patients.read', 'patients.update',
      'encounters.read', 'encounters.create', 'encounters.update',
      'prescriptions.read', 'prescriptions.create', 'prescriptions.update',
      'lab.read', 'lab.create',
      'radiology.read', 'radiology.create',
      'radiology.orders.read', 'radiology.orders.create',
      'radiology.results.read',
      'radiology.reports.read',
      'radiology.modalities.read',
      'pharmacy.read',
      'ipd.read', 'ipd.create', 'ipd.update',
      'surgery.read', 'surgery.create', 'surgery.update',
      'maternity.read', 'maternity.create', 'maternity.update',
      'vitals.read', 'vitals.create',
      'analytics.read',
      'queue.read', 'queue.update',
      'doctor-duty.read', 'doctor-duty.create', 'doctor-duty.update',
      'diagnoses.read', // For ICD-10 search
      'discharge.read', 'discharge.create', 'discharge.update',
      'appointments.read', 'appointments.create', 'appointments.update',
      'schedules.read', 'schedules.create', 'schedules.update',
      'chronic.read', 'chronic.create', 'chronic.update',
      'followups.read', 'followups.create', 'followups.update',
      'referrals.read', 'referrals.create', 'referrals.update',
      'problems.read', 'problems.create', 'problems.update',
      'treatment-plans.read', 'treatment-plans.create', 'treatment-plans.update',
      'clinical-notes.read', 'clinical-notes.create', 'clinical-notes.update',
      'orders.read', 'orders.create', 'orders.update',
      'reports.read',
      'insurance.preauth.read', 'insurance.preauth.create',
      'services.read',
      'providers.read',
      'stores.read',
      'billing.read',
    ],
    'Nurse': [
      'facilities.read', 'dashboard.read',
      'patients.read', 'patients.update',
      'encounters.read', 'encounters.update',
      'vitals.read', 'vitals.create', 'vitals.update',
      'prescriptions.read',
      'lab.read',
      'pharmacy.read',
      'ipd.read', 'ipd.update',
      'maternity.read', 'maternity.update',
      'analytics.read',
      'queue.read', 'queue.update',
      'discharge.read',
      'chronic.read', 'chronic.update',
      'followups.read', 'followups.update',
      'nursing.read', 'nursing.create', 'nursing.update',
      'triage.read', 'triage.update',
      'incidents.read', 'incidents.create', 'incidents.update',
      'problems.read',
      'treatment-plans.read',
      'appointments.read',
    ],
    'Receptionist': [
      'facilities.read', 'dashboard.read',
      'patients.read', 'patients.create', 'patients.update',
      'encounters.read', 'encounters.create',
      'billing.read', 'billing.create',
      'queue.read', 'queue.create', 'queue.update',
      'analytics.read',
      'doctor-duty.read',
      'pharmacy.read',  // Dashboard stats
      'lab.read',       // Dashboard stats
      'appointments.read', 'appointments.create', 'appointments.update',
      'schedules.read',
      'reports.read',
      'insurance.read',
      'insurance.policies.read',
      'insurance.providers.read',
      'insurance.preauth.read', 'insurance.preauth.create',
      'insurance.claims.read',
      'insurance.verify',
      'vitals.read',
      'triage.read',
      'services.read',
    ],
    'Lab Technician': [
      'facilities.read', 'dashboard.read',
      'patients.read',
      'encounters.read',
      'lab.read', 'lab.create', 'lab.update',
      'orders.read', 'orders.create', 'orders.update',
      'queue.read', 'queue.update',
      'providers.read',
      'analytics.read',
      'pharmacy.read',  // Dashboard stats
    ],
    'Pharmacist': [
      'facilities.read', 'dashboard.read',
      'patients.read',
      'encounters.read',
      'prescriptions.read', 'prescriptions.update',
      'pharmacy.read', 'pharmacy.create', 'pharmacy.update',
      'inventory.read', 'inventory.update',
      'orders.read',
      'queue.read', 'queue.update',
      'providers.read',
      'analytics.read',
      'disposal.read', 'disposal.create',
      'supplier-returns.read',
    ],
    'Cashier': [
      'facilities.read', 'dashboard.read',
      'patients.read',
      'encounters.read',
      'billing.read', 'billing.create', 'billing.update',
      'analytics.read',
      'pharmacy.read',  // Dashboard stats
      'lab.read',       // Dashboard stats
      'reports.read',
      'finance.read',
      'finance.accounts.read',
      'finance.journals.read',
      'finance.reports.read',
      'insurance.read',
      'insurance.claims.read', 'insurance.claims.create',
      'insurance.policies.read',
    ],
    'Store Keeper': [
      'facilities.read', 'dashboard.read',
      'inventory.read', 'inventory.create', 'inventory.update',
      'stores.read', 'stores.create', 'stores.update',
      'suppliers.read',
      'analytics.read',
      'disposal.read', 'disposal.create',
      'supplier-returns.read', 'supplier-returns.create',
      'assets.read', 'assets.create', 'assets.update',
      'procurement.read', 'procurement.create', 'procurement.update',
      'reports.read',
    ],
    'HR Manager': [
      // HR Module - Full access
      'hr.read', 'hr.create', 'hr.update', 'hr.delete',
      // Employees - Full access
      'employees.read', 'employees.create', 'employees.update', 'employees.delete',
      // Attendance
      'attendance.read', 'attendance.create', 'attendance.update',
      // Leave Management
      'leave.read', 'leave.create', 'leave.update', 'leave.approve',
      // Payroll
      'payroll.read', 'payroll.create', 'payroll.update', 'payroll.process',
      // Users - Can manage users (create employees as users)
      'users.read', 'users.create', 'users.update',
      // Facilities/Departments - Can view and manage departments
      'facilities.read', 'facilities.create', 'facilities.update',
      // Analytics and Reports
      'analytics.read',
      'reports.read',
      // Providers (for staff directories)
      'providers.read', 'providers.create', 'providers.update',
      // Schedules
      'schedules.read', 'schedules.create', 'schedules.update',
    ],
    'Radiologist': [
      // Radiology - Full access (base + granular)
      'radiology.read', 'radiology.create', 'radiology.update', 'radiology.delete',
      'radiology.modalities.read', 'radiology.modalities.create',
      'radiology.orders.read', 'radiology.orders.update',
      'radiology.results.read', 'radiology.results.create',
      'radiology.reports.read',
      // Patient access
      'patients.read',
      // Encounters
      'encounters.read',
      // Orders
      'orders.read', 'orders.update',
      // Analytics
      'analytics.read',
      // Queue
      'queue.read',
      'reports.read',
    ],
  };

  for (const [roleName, permissionCodes] of Object.entries(rolePermissionMappings)) {
    const role = roles[roleName];
    if (!role) continue;

    let assignedCount = 0;
    for (const code of permissionCodes) {
      const permission = permissions.find(p => p.code === code);
      if (!permission) continue;

      const exists = await rolePermissionRepo.findOne({
        where: { roleId: role.id, permissionId: permission.id },
      });
      if (!exists) {
        await rolePermissionRepo.save(
          rolePermissionRepo.create({
            roleId: role.id,
            permissionId: permission.id,
          }),
        );
        assignedCount++;
      }
    }
    console.log(`  ✓ ${roleName} has ${permissionCodes.length} permissions (${assignedCount} new)`);
  }

  console.log('\n✅ Database seed completed successfully!\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Permissions and Roles created successfully!');
  console.log('  Please complete the setup wizard in the web app');
  console.log('  to create your organization and admin user.');
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
