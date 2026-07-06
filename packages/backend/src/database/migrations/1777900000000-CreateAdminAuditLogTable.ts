import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Create admin_audit_log table for compliance and security auditing
 * Immutable log of all system admin actions
 *
 * Key features:
 * - No UPDATE/DELETE allowed (append-only for compliance)
 * - 5 indexes for common query patterns
 * - JSON columns for old/new values (diffs)
 * - Archival support (7+ year retention)
 * - Soft delete fields for compliance
 */
export class CreateAdminAuditLogTable1777900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'admin_audit_log',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'admin_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'action',
            type: 'enum',
            enum: [
              'create',
              'update',
              'delete',
              'suspend',
              'activate',
              'change_plan',
              'enable_feature',
              'disable_feature',
              'reset_password',
              'force_mfa',
              'disable_mfa',
              'assign_role',
              'revoke_role',
              'export',
              'import',
              'backup',
              'restore',
              'configure',
            ],
            enumName: 'admin_audit_action_enum',
          },
          {
            name: 'entity_type',
            type: 'enum',
            enum: [
              'organization',
              'tenant',
              'user',
              'license',
              'subscription',
              'deployment',
              'system_setting',
              'compliance_evidence',
              'audit_log',
              'system_admin',
            ],
            enumName: 'admin_audit_entity_type_enum',
          },
          {
            name: 'entity_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'entity_label',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'Human-readable name of entity (e.g., org name, user email)',
          },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
            comment: 'What changed and why',
          },
          {
            name: 'old_values',
            type: 'jsonb',
            isNullable: true,
            comment: 'Before state (for UPDATE/DELETE)',
          },
          {
            name: 'new_values',
            type: 'jsonb',
            isNullable: true,
            comment: 'After state (for UPDATE/CREATE)',
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '50',
            isNullable: true,
            comment: 'Admin client IP address',
          },
          {
            name: 'user_agent',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'Admin browser/client user agent',
          },
          {
            name: 'change_reason',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'Why this change was made (ticket #, policy, etc)',
          },
          {
            name: 'system_generated',
            type: 'boolean',
            default: false,
            comment: 'Whether this was auto-logged by system vs. manual admin action',
          },
          {
            name: 'result',
            type: 'varchar',
            length: '50',
            default: "'success'",
            comment: 'success | failure | partial',
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
            comment: 'If result=failure, what went wrong',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'is_archived',
            type: 'boolean',
            default: false,
            comment: '7+ year retention policy',
          },
          {
            name: 'archived_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'archive_location',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'S3 path, cold storage location, etc',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['admin_user_id'],
            referencedTableName: 'user',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            name: 'fk_admin_audit_log_admin_user_id',
          },
          {
            columnNames: ['tenant_id'],
            referencedTableName: 'tenant',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            name: 'fk_admin_audit_log_tenant_id',
          },
        ],
      }),
      true,
    );

    // Create indexes for optimal query performance
    // Most common: recent activity by admin, or activity on specific tenant
    await queryRunner.createIndex(
      'admin_audit_log',
      new TableIndex({
        name: 'idx_admin_audit_admin_time',
        columnNames: ['admin_user_id', 'created_at'],
      }),
    );

    // Filter by tenant and action type (useful for compliance reports)
    await queryRunner.createIndex(
      'admin_audit_log',
      new TableIndex({
        name: 'idx_admin_audit_tenant_action_time',
        columnNames: ['tenant_id', 'action', 'created_at'],
      }),
    );

    // Audit trail for specific entity (all changes to one org, user, etc)
    await queryRunner.createIndex(
      'admin_audit_log',
      new TableIndex({
        name: 'idx_admin_audit_entity_time',
        columnNames: ['entity_type', 'entity_id', 'created_at'],
      }),
    );

    // Global action trends
    await queryRunner.createIndex(
      'admin_audit_log',
      new TableIndex({
        name: 'idx_admin_audit_action_time',
        columnNames: ['action', 'created_at'],
      }),
    );

    // Recent activity (dashboard)
    await queryRunner.createIndex(
      'admin_audit_log',
      new TableIndex({
        name: 'idx_admin_audit_time',
        columnNames: ['created_at'],
      }),
    );

    // Archive queries
    await queryRunner.createIndex(
      'admin_audit_log',
      new TableIndex({
        name: 'idx_admin_audit_is_archived',
        columnNames: ['is_archived', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('admin_audit_log', 'idx_admin_audit_is_archived');
    await queryRunner.dropIndex('admin_audit_log', 'idx_admin_audit_time');
    await queryRunner.dropIndex('admin_audit_log', 'idx_admin_audit_action_time');
    await queryRunner.dropIndex('admin_audit_log', 'idx_admin_audit_entity_time');
    await queryRunner.dropIndex('admin_audit_log', 'idx_admin_audit_tenant_action_time');
    await queryRunner.dropIndex('admin_audit_log', 'idx_admin_audit_admin_time');

    // Drop enums
    await queryRunner.query('DROP TABLE IF EXISTS "admin_audit_log" CASCADE');
    await queryRunner.query('DROP TYPE IF EXISTS "admin_audit_action_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "admin_audit_entity_type_enum"');
  }
}
