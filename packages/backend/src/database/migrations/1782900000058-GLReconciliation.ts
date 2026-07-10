import { MigrationInterface, QueryRunner } from 'typeorm';

export class GLReconciliation1782900000058 implements MigrationInterface {
  name = 'GLReconciliation1782900000058';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // GL Reconciliation status enum
    await queryRunner.query(`
      CREATE TYPE "gl_reconciliation_status_enum"
        AS ENUM ('pending', 'in_progress', 'reconciled', 'partial')
    `);

    // GL Reconciliation item type enum
    await queryRunner.query(`
      CREATE TYPE "gl_reconciliation_item_type_enum"
        AS ENUM ('gl_entry', 'external_entry', 'adjustment')
    `);

    // GL Reconciliation item match status enum
    await queryRunner.query(`
      CREATE TYPE "gl_reconciliation_item_match_status_enum"
        AS ENUM ('matched', 'unmatched', 'adjusted')
    `);

    // GL Reconciliation Status table
    await queryRunner.query(`
      CREATE TABLE "gl_reconciliation_status" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "facility_id" uuid NOT NULL,
        "account_id" uuid NOT NULL,
        "fiscal_period_id" uuid NOT NULL,
        "gl_total" numeric(15,2) NOT NULL DEFAULT 0,
        "external_total" numeric(15,2) NOT NULL DEFAULT 0,
        "difference" numeric(15,2) NOT NULL DEFAULT 0,
        "status" "gl_reconciliation_status_enum" NOT NULL DEFAULT 'pending',
        "reconciled_by" uuid,
        "reconciled_at" TIMESTAMP,
        "item_count" integer NOT NULL DEFAULT 0,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_gl_reconciliation_status" PRIMARY KEY ("id"),
        CONSTRAINT "FK_gl_recon_facility" FOREIGN KEY ("facility_id")
          REFERENCES "facilities"("id") ON DELETE NO ACTION,
        CONSTRAINT "FK_gl_recon_account" FOREIGN KEY ("account_id")
          REFERENCES "chart_of_accounts"("id") ON DELETE NO ACTION,
        CONSTRAINT "FK_gl_recon_fiscal_period" FOREIGN KEY ("fiscal_period_id")
          REFERENCES "fiscal_periods"("id") ON DELETE NO ACTION
      )
    `);

    // Unique constraint: one reconciliation per account per period per facility
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_gl_recon_facility_account_period"
        ON "gl_reconciliation_status" ("facility_id", "account_id", "fiscal_period_id")
        WHERE "deleted_at" IS NULL
    `);

    // Status index for summary queries
    await queryRunner.query(`
      CREATE INDEX "IDX_gl_recon_facility_status"
        ON "gl_reconciliation_status" ("facility_id", "status")
    `);

    // Tenant index
    await queryRunner.query(`
      CREATE INDEX "IDX_gl_recon_tenant"
        ON "gl_reconciliation_status" ("tenant_id")
    `);

    // GL Reconciliation Items table
    await queryRunner.query(`
      CREATE TABLE "gl_reconciliation_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "reconciliation_id" uuid NOT NULL,
        "item_type" "gl_reconciliation_item_type_enum" NOT NULL DEFAULT 'gl_entry',
        "journal_entry_id" uuid,
        "external_reference" varchar,
        "amount" numeric(15,2) NOT NULL,
        "entry_date" date NOT NULL,
        "description" varchar,
        "match_status" "gl_reconciliation_item_match_status_enum" NOT NULL DEFAULT 'unmatched',
        "matched_with_id" uuid,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_gl_reconciliation_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_gl_recon_item_recon" FOREIGN KEY ("reconciliation_id")
          REFERENCES "gl_reconciliation_status"("id") ON DELETE CASCADE
      )
    `);

    // Match status index for filtering
    await queryRunner.query(`
      CREATE INDEX "IDX_gl_recon_items_recon_status"
        ON "gl_reconciliation_items" ("reconciliation_id", "match_status")
    `);

    // Tenant index
    await queryRunner.query(`
      CREATE INDEX "IDX_gl_recon_items_tenant"
        ON "gl_reconciliation_items" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "gl_reconciliation_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gl_reconciliation_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "gl_reconciliation_item_match_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "gl_reconciliation_item_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "gl_reconciliation_status_enum"`);
  }
}
