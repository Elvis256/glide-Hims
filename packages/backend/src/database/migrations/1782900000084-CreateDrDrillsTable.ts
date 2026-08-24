import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create the `dr_drills` table.
 *
 * The DrDrill entity, its repository registration (BackupModule) and the
 * disaster-recovery drill endpoints on BackupController have all shipped, but
 * no migration ever created the table — so every DR drill call failed with
 * `relation "dr_drills" does not exist`. This adds the table the entity has
 * always described.
 *
 * Shape follows the sibling `backups` table: uuid PK, NOT NULL tenant_id, the
 * BaseEntity audit columns, and the standard tenant_isolation RLS policy (see
 * RlsPhase1 for the GUC contract).
 */
export class CreateDrDrillsTable1782900000084 implements MigrationInterface {
  name = 'CreateDrDrillsTable1782900000084';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dr_drills" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP NULL,
        "drill_type" character varying(30) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'scheduled',
        "scheduled_at" TIMESTAMP NOT NULL,
        "started_at" TIMESTAMP NULL,
        "completed_at" TIMESTAMP NULL,
        "backup_id" uuid NULL,
        "restore_duration_minutes" integer NULL,
        "notes" text NULL,
        "conducted_by" uuid NULL,
        "result" jsonb NULL,
        CONSTRAINT "PK_dr_drills" PRIMARY KEY ("id")
      )
    `);

    // BaseEntity declares @Index() on tenantId; listDrDrills filters by tenant
    // and orders by created_at.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dr_drills_tenant_id" ON "dr_drills" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dr_drills_tenant_created" ON "dr_drills" ("tenant_id", "created_at")`,
    );

    await queryRunner.query(`ALTER TABLE "dr_drills" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "dr_drills"`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "dr_drills"
      USING (
        current_setting('app.tenant', true) = 'system'
        OR tenant_id = (SELECT NULLIF(current_setting('app.tenant', true), '')::uuid)
      )
      WITH CHECK (
        current_setting('app.tenant', true) = 'system'
        OR tenant_id = (SELECT NULLIF(current_setting('app.tenant', true), '')::uuid)
      )
    `);

    // The app connects as the non-owner runtime role; new tables need the same
    // grants the db-init script applies to the rest of the schema.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'glide_hims_runtime') THEN
          GRANT SELECT, INSERT, UPDATE, DELETE ON "dr_drills" TO glide_hims_runtime;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "dr_drills"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dr_drills"`);
  }
}
