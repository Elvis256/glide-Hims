import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * HR + Admin security hardening — companion to seed.ts changes.
 *
 * 1. Adds `tenant_id` to `password_policies` and backfills from
 *    `facility_id -> facilities.tenant_id`. Without this column, password
 *    policy was a single global pool any tenant admin could mutate / weaken
 *    across the platform.
 *
 * 2. Backfills the new finer-grained payroll permissions
 *    (`payroll.approve`, `payroll.mark_paid`, `payroll.reset`) and grants
 *    them sensibly on already-deployed tenants. Without this, every existing
 *    tenant would lose payroll-approval / mark-paid / reset capability after
 *    deploying the controller change that requires the new codes.
 *
 *    Default grants (idempotent, ON CONFLICT DO NOTHING):
 *    - HR Manager:           payroll.approve, payroll.reset, payroll.mark_paid
 *    - Accountant:           payroll.mark_paid
 *    - Facility Manager:     payroll.approve
 *
 *    SoD note: payroll.process stays as-is (HR creates/runs the calculation),
 *    payroll.approve is the management signoff, payroll.mark_paid is the
 *    finance disbursement, payroll.reset destroys a draft. Granting all
 *    three to HR Manager mirrors a single-person SMB workflow; multi-person
 *    SoD is achieved by stripping mark_paid from HR Manager once Accountant
 *    is staffed.
 */
export class HrAdminSecurityHardening1782900000032 implements MigrationInterface {
  name = 'HrAdminSecurityHardening1782900000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Password policies tenant scoping --------------------------------
    const hasCol = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'password_policies' AND column_name = 'tenant_id'`,
    );
    if (!hasCol.length) {
      await queryRunner.query(`ALTER TABLE "password_policies" ADD COLUMN "tenant_id" uuid NULL`);
      // Backfill tenant_id from facility, where the policy was facility-scoped.
      await queryRunner.query(
        `UPDATE "password_policies" pp
            SET "tenant_id" = f.tenant_id
           FROM "facilities" f
          WHERE pp.facility_id = f.id AND pp.tenant_id IS NULL`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "idx_password_policies_tenant_id"
                 ON "password_policies" ("tenant_id")`,
      );
    }

    // 2. Payroll permissions ---------------------------------------------
    await queryRunner.query(`
      INSERT INTO permissions (id, code, name, module, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'payroll.approve',   'Approve Payroll Run',  'payroll', NOW(), NOW()),
        (gen_random_uuid(), 'payroll.mark_paid', 'Mark Payroll Paid',    'payroll', NOW(), NOW()),
        (gen_random_uuid(), 'payroll.reset',     'Reset Draft Payroll',  'payroll', NOW(), NOW())
      ON CONFLICT (code) DO NOTHING
    `);

    // Grant default mappings across every tenant's seeded copy of these roles.
    const grants: Array<[string, string]> = [
      ['HR Manager', 'payroll.approve'],
      ['HR Manager', 'payroll.reset'],
      ['HR Manager', 'payroll.mark_paid'],
      ['Accountant', 'payroll.mark_paid'],
      ['Facility Manager', 'payroll.approve'],
    ];
    for (const [roleName, permCode] of grants) {
      await queryRunner.query(
        `
        INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
        SELECT gen_random_uuid(), r.id, p.id, NOW(), NOW()
          FROM roles r CROSS JOIN permissions p
         WHERE r.name = $1 AND p.code = $2
        ON CONFLICT (role_id, permission_id) DO NOTHING
        `,
        [roleName, permCode],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert role grants
    const codes = ['payroll.approve', 'payroll.mark_paid', 'payroll.reset'];
    await queryRunner.query(
      `DELETE FROM role_permissions
         WHERE permission_id IN (SELECT id FROM permissions WHERE code = ANY($1))`,
      [codes],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE code = ANY($1)`, [codes]);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_password_policies_tenant_id"`);
    await queryRunner.query(`ALTER TABLE "password_policies" DROP COLUMN IF EXISTS "tenant_id"`);
  }
}
