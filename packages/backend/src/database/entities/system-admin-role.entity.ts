import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Granular roles for system administrators.
 * Instead of all system admins having identical full access,
 * this allows scoped permissions like viewer, tenant_manager, etc.
 */
@Entity('system_admin_roles')
export class SystemAdminRole extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({ type: 'jsonb', default: [] })
  permissions: string[];

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_built_in' })
  isBuiltIn: boolean;
}

/**
 * Maps system admin users to system admin roles.
 */
@Entity('system_admin_role_assignments')
export class SystemAdminRoleAssignment extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'system_admin_role_id' })
  systemAdminRoleId: string;

  @Column({ type: 'uuid', nullable: true, name: 'scoped_tenant_id' })
  scopedTenantId?: string;
}

/**
 * All available system-level permissions.
 */
export const SYSTEM_PERMISSIONS = {
  // Platform management
  'platform.view': 'View platform dashboard and metrics',
  'platform.settings.manage': 'Manage platform settings',
  'platform.maintenance': 'Enable/disable maintenance mode',

  // Tenant management
  'tenants.view': 'View tenant list and details',
  'tenants.create': 'Create new tenants',
  'tenants.update': 'Update tenant settings',
  'tenants.suspend': 'Suspend/activate tenants',
  'tenants.delete': 'Delete tenants',

  // License management
  'licenses.view': 'View licenses',
  'licenses.create': 'Issue new licenses',
  'licenses.update': 'Modify licenses (extend, edit)',
  'licenses.revoke': 'Revoke/suspend licenses',

  // User management
  'system_users.view': 'View system admin accounts',
  'system_users.create': 'Create system admin accounts',
  'system_users.update': 'Update system admin accounts',
  'system_users.delete': 'Delete system admin accounts',

  // Deployment management
  'deployments.view': 'View deployments',
  'deployments.manage': 'Create/update deployments',
  'deployments.rollouts': 'Manage rollouts',

  // Billing & revenue
  'billing.view': 'View SaaS billing and revenue',
  'billing.manage': 'Manage invoices, subscriptions, pricing',

  // Security & compliance
  'security.view': 'View security settings and blocks',
  'security.manage': 'Manage security settings, unblock IPs',
  'audit.view': 'View audit logs',
  'compliance.view': 'View compliance evidence',
  'compliance.manage': 'Manage compliance evidence and reports',

  // Support
  'support.view': 'View support requests',
  'support.manage': 'Manage support access grants',

  // System health
  'health.view': 'View system health metrics',
  'health.manage': 'Manage alert rules',

  // Backups
  'backups.view': 'View backups',
  'backups.manage': 'Create/restore/delete backups',
} as const;

/** Built-in role definitions */
export const BUILT_IN_SYSTEM_ROLES = [
  {
    name: 'Platform Administrator',
    description: 'Full access to all platform features',
    permissions: Object.keys(SYSTEM_PERMISSIONS),
    isBuiltIn: true,
  },
  {
    name: 'Platform Viewer',
    description: 'Read-only access to platform data',
    permissions: [
      'platform.view', 'tenants.view', 'licenses.view', 'system_users.view',
      'deployments.view', 'billing.view', 'security.view', 'audit.view',
      'compliance.view', 'support.view', 'health.view', 'backups.view',
    ],
    isBuiltIn: true,
  },
  {
    name: 'Tenant Manager',
    description: 'Manage tenants and their licenses',
    permissions: [
      'platform.view', 'tenants.view', 'tenants.create', 'tenants.update',
      'tenants.suspend', 'licenses.view', 'licenses.create', 'licenses.update',
      'deployments.view', 'deployments.manage', 'support.view', 'support.manage',
    ],
    isBuiltIn: true,
  },
  {
    name: 'Billing Manager',
    description: 'Manage SaaS billing and revenue',
    permissions: [
      'platform.view', 'tenants.view', 'licenses.view', 'licenses.update',
      'billing.view', 'billing.manage',
    ],
    isBuiltIn: true,
  },
  {
    name: 'Security Officer',
    description: 'Manage security, compliance, and audit',
    permissions: [
      'platform.view', 'security.view', 'security.manage', 'audit.view',
      'compliance.view', 'compliance.manage', 'health.view', 'health.manage',
      'backups.view', 'backups.manage',
    ],
    isBuiltIn: true,
  },
  {
    name: 'Support Engineer',
    description: 'View and support tenant operations',
    permissions: [
      'platform.view', 'tenants.view', 'licenses.view', 'deployments.view',
      'support.view', 'support.manage', 'health.view', 'audit.view',
    ],
    isBuiltIn: true,
  },
];
