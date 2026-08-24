import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Role assignments written with a NULL tenant_id.
 *
 * Only UsersService.assignRole — "add another role to an existing user" — set
 * `tenant_id` on the user_roles row. The three paths that actually create most
 * staff (create a user with a role, the CSV bulk import, and HR's create-staff)
 * all left it NULL.
 *
 * Nothing looked broken, because login and PermissionsGuard read user_roles
 * WITHOUT a tenant filter: those users signed in and held their permissions
 * normally. But every tenant-filtered read missed them —
 *   - `getUserRoles()` returned an empty list, so the user's own profile showed
 *     no roles at all;
 *   - `getUserIdsByRole()` returned nobody, and that is how all 17 role-targeted
 *     notification paths choose recipients: partograph WHO alert/action-line
 *     alerts, patient-deterioration (NEWS) escalation, unacknowledged critical
 *     lab results, new prescriptions to the pharmacy, low stock, billing to
 *     cashiers, system health to admins. Every one of them resolved to an empty
 *     recipient list and returned silently.
 *
 * This backfills the tenant from the user the row belongs to. Rows whose user is
 * itself tenant-less (platform system admins) are left alone.
 */
export class BackfillUserRoleTenant1782900000093 implements MigrationInterface {
  name = 'BackfillUserRoleTenant1782900000093';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "user_roles" ur
      SET "tenant_id" = u."tenant_id"
      FROM "users" u
      WHERE u."id" = ur."user_id"
        AND ur."tenant_id" IS NULL
        AND u."tenant_id" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // Irreversible by design: the pre-migration NULLs carried no information,
    // and restoring them would re-break notification delivery.
  }
}
