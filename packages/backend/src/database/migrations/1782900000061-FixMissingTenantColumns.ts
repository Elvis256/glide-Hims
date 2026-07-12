import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes schema drift introduced by the tenantId enforcement sweep:
 * 1. appointments.tenant_id was added to the entity without a migration,
 *    breaking the appointment reminder cron jobs. Add the column, backfill
 *    from the owning facility's tenant, and index it.
 * 2. facility_budgets and budget_reservations entities exist in code
 *    (finance/budget.service.ts) but the tables were never created.
 */
export class FixMissingTenantColumns1782900000061 implements MigrationInterface {
  name = 'FixMissingTenantColumns1782900000061';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- appointments: add tenant_id, backfill from facility, index ---
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD COLUMN "tenant_id" uuid
    `);

    await queryRunner.query(`
      UPDATE "appointments" a
      SET "tenant_id" = f."tenant_id"
      FROM "facilities" f
      WHERE a."facility_id" = f."id" AND a."tenant_id" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_appointments_tenant_id" ON "appointments" ("tenant_id")
    `);

    // --- New table: facility_budgets ---
    await queryRunner.query(`
      CREATE TABLE "facility_budgets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "facility_id" uuid NOT NULL,
        "fiscal_year_start" date NOT NULL,
        "fiscal_year_end" date,
        "total_budget_allocation" numeric(12,2) NOT NULL,
        "notes" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_facility_budgets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_facility_budgets_facility_tenant_fy"
          UNIQUE ("facility_id", "tenant_id", "fiscal_year_start")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_facility_budgets_facility_id" ON "facility_budgets" ("facility_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_facility_budgets_fiscal_year_start" ON "facility_budgets" ("fiscal_year_start")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_facility_budgets_tenant_id" ON "facility_budgets" ("tenant_id")
    `);

    // --- New table: budget_reservations ---
    await queryRunner.query(`
      CREATE TYPE "budget_reservations_status_enum" AS ENUM (
        'pending', 'approved', 'released', 'spent'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "budget_reservations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "budget_id" uuid NOT NULL,
        "document_id" uuid NOT NULL,
        "document_type" varchar(10) NOT NULL,
        "reserved_amount" numeric(12,2) NOT NULL,
        "status" "budget_reservations_status_enum" NOT NULL DEFAULT 'pending',
        "remarks" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_budget_reservations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_budget_reservations_budget_id" ON "budget_reservations" ("budget_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_budget_reservations_document_id" ON "budget_reservations" ("document_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_budget_reservations_status" ON "budget_reservations" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_budget_reservations_tenant_id" ON "budget_reservations" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "budget_reservations"`);
    await queryRunner.query(`DROP TYPE "budget_reservations_status_enum"`);
    await queryRunner.query(`DROP TABLE "facility_budgets"`);
    await queryRunner.query(`DROP INDEX "IDX_appointments_tenant_id"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "tenant_id"`);
  }
}
