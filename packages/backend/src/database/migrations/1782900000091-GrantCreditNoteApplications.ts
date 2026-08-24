import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The applications table (1782900000090) was created without the runtime
 * role's table grant, so the API user could read nothing and write nothing:
 * the first live apply failed with "permission denied for table
 * supplier_credit_note_applications". Same guarded grant the dr_drills
 * migration uses — a fresh database without the split roles skips it.
 */
export class GrantCreditNoteApplications1782900000091 implements MigrationInterface {
  name = 'GrantCreditNoteApplications1782900000091';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'glide_hims_runtime') THEN
          GRANT SELECT, INSERT, UPDATE, DELETE ON "supplier_credit_note_applications" TO glide_hims_runtime;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'glide_hims_runtime') THEN
          REVOKE SELECT, INSERT, UPDATE, DELETE ON "supplier_credit_note_applications" FROM glide_hims_runtime;
        END IF;
      END
      $$;
    `);
  }
}
