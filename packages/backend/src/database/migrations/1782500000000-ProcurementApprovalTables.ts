import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the missing procurement approval tables.
 *
 * The ProcurementApprovalChain and ProcurementApprovalThreshold entities
 * were added with the procurement approvals feature but no migration was
 * ever shipped, so the tables only existed on environments that ran
 * synchronize:true. Production runs synchronize:false, so PR/PO submit
 * always failed silently when trying to create a chain. This migration
 * provisions both tables.
 */
export class ProcurementApprovalTables1782500000000 implements MigrationInterface {
  name = 'ProcurementApprovalTables1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "procurement_approval_chains_status_enum" AS ENUM ('pending','approved','rejected');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "procurement_approval_chains" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"       uuid NULL,
        "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"      TIMESTAMP NULL,
        "document_id"     uuid NOT NULL,
        "document_type"   varchar(10) NOT NULL,
        "approval_level"  int  NOT NULL,
        "required_role"   varchar(50) NOT NULL,
        "approver_id"     uuid NULL,
        "approved_at"     TIMESTAMP NULL,
        "approved_by_id"  uuid NULL,
        "comments"        text NULL,
        "status"          "procurement_approval_chains_status_enum" NOT NULL DEFAULT 'pending',
        CONSTRAINT "PK_procurement_approval_chains" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pac_doc_type"  ON "procurement_approval_chains" ("document_id","document_type");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pac_doc_level" ON "procurement_approval_chains" ("document_id","approval_level");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pac_approver_status" ON "procurement_approval_chains" ("approver_id","status");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pac_tenant" ON "procurement_approval_chains" ("tenant_id");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "procurement_approval_thresholds" (
        "id"                          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"                   uuid NULL,
        "created_at"                  TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"                  TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"                  TIMESTAMP NULL,
        "facility_id"                 uuid NOT NULL,
        "level1_max_amount"           numeric(12,2) NOT NULL DEFAULT 500000,
        "level2_max_amount"           numeric(12,2) NOT NULL DEFAULT 5000000,
        "level3_max_amount"           numeric(12,2) NOT NULL DEFAULT 50000000,
        "level4_max_amount"           numeric(12,2) NULL,
        "require_justification_min"   numeric(12,2) NOT NULL DEFAULT 5000000,
        "is_active"                   boolean NOT NULL DEFAULT true,
        "notes"                       text NULL,
        CONSTRAINT "PK_procurement_approval_thresholds" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pat_facility_tenant" UNIQUE ("facility_id","tenant_id")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pat_facility" ON "procurement_approval_thresholds" ("facility_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pat_tenant" ON "procurement_approval_thresholds" ("tenant_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "procurement_approval_thresholds";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "procurement_approval_chains";`);
    await queryRunner.query(`DROP TYPE  IF EXISTS "procurement_approval_chains_status_enum";`);
  }
}
