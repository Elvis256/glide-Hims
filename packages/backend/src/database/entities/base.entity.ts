import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Column,
  Index,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // tenant_id is NOT NULL at the DB level on every business table
  // (enforced by EnforceTenantIdNotNull1777500000000 migration).
  // It remains nullable here in the TypeScript model because a small set of
  // platform tables that also extend BaseEntity legitimately store NULL —
  // namely the system-admin/RBAC catalog: users, roles, permissions,
  // role_permissions, user_roles, sessions, refresh_tokens, login_history,
  // password_history, mfa_methods, mfa_challenges, audit_logs,
  // system_settings, support_access_grants, and the tenants table itself.
  // TenantSubscriber auto-populates tenantId on insert from the request
  // context for everything else.
  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  @Index()
  tenantId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
