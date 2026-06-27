import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PostgreSQL treats NULL as DISTINCT in composite unique indexes, so
 * the existing unique index on (username, tenant_id) does NOT prevent
 * duplicate system-admin rows (where tenant_id IS NULL).
 *
 * This migration:
 *  1. Soft-deletes duplicate system-admin users (keeps the oldest row).
 *  2. Adds unique partial indexes for username and email
 *     WHERE tenant_id IS NULL AND deleted_at IS NULL.
 */
export class FixSystemAdminUniqueConstraint1782900000047 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Soft-delete duplicate system-admin users, keeping the oldest per (username, email) pair.
    //    Uses UPDATE instead of DELETE to avoid FK constraint violations.
    await queryRunner.query(`
      UPDATE users
      SET deleted_at = NOW(), status = 'deleted'
      WHERE id IN (
        SELECT u.id
        FROM users u
        INNER JOIN (
          SELECT username, email, MIN(created_at) AS keep_created
          FROM users
          WHERE is_system_admin = true AND tenant_id IS NULL AND deleted_at IS NULL
          GROUP BY username, email
          HAVING COUNT(*) > 1
        ) dups ON u.username = dups.username AND u.email = dups.email
        WHERE u.is_system_admin = true
          AND u.tenant_id IS NULL
          AND u.deleted_at IS NULL
          AND u.created_at > dups.keep_created
      )
    `);

    // 2. Add unique partial indexes for system admins (tenant_id IS NULL).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_system_admin
      ON users (username)
      WHERE tenant_id IS NULL AND deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_system_admin
      ON users (email)
      WHERE tenant_id IS NULL AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_email_system_admin`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_username_system_admin`);
  }
}
