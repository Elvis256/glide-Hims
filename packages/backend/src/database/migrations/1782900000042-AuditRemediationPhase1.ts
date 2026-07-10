import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditRemediationPhase11782900000042 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Gap 1: GRN Segregation of Duties — add approval columns
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_notes" ADD COLUMN IF NOT EXISTS "approved_by_id" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_notes" ADD COLUMN IF NOT EXISTS "approved_at" timestamptz NULL`,
    );

    // Gap 2: GL currentBalance Version Column — defense-in-depth against stale writes
    await queryRunner.query(
      `ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1`,
    );

    // Gap 4: Batch Recall tables
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_recalls_severity_enum') THEN
          CREATE TYPE "batch_recalls_severity_enum" AS ENUM ('class_i', 'class_ii', 'class_iii');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_recalls_status_enum') THEN
          CREATE TYPE "batch_recalls_status_enum" AS ENUM ('initiated', 'in_progress', 'completed', 'cancelled');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_recall_actions_action_type_enum') THEN
          CREATE TYPE "batch_recall_actions_action_type_enum" AS ENUM ('quarantine', 'patient_notification', 'return_to_manufacturer', 'disposal', 'investigation');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "batch_recalls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NULL,
        "recall_number" varchar NOT NULL,
        "batch_number" varchar NOT NULL,
        "item_id" uuid NOT NULL,
        "item_name" varchar NOT NULL,
        "reason" text NOT NULL,
        "severity" "batch_recalls_severity_enum" NOT NULL DEFAULT 'class_ii',
        "status" "batch_recalls_status_enum" NOT NULL DEFAULT 'initiated',
        "affected_quantity" decimal(15,4) NOT NULL DEFAULT 0,
        "quarantined_quantity" decimal(15,4) NOT NULL DEFAULT 0,
        "affected_patients_count" integer NOT NULL DEFAULT 0,
        "notes" text NULL,
        "completed_at" timestamptz NULL,
        "facility_id" uuid NULL,
        "initiated_by_id" uuid NOT NULL,
        "completed_by_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "PK_batch_recalls" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_batch_recalls_recall_number" UNIQUE ("recall_number")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_batch_recalls_status" ON "batch_recalls" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_batch_recalls_batch_number" ON "batch_recalls" ("batch_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_batch_recalls_tenant_id" ON "batch_recalls" ("tenant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "batch_recall_actions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NULL,
        "recall_id" uuid NOT NULL,
        "action_type" "batch_recall_actions_action_type_enum" NOT NULL,
        "description" text NULL,
        "performed_at" timestamptz NULL,
        "performed_by_id" uuid NOT NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "PK_batch_recall_actions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_batch_recall_actions_recall" FOREIGN KEY ("recall_id") REFERENCES "batch_recalls"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_batch_recall_actions_recall_id" ON "batch_recall_actions" ("recall_id")`,
    );

    // Gap 5: Cycle Count tables
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cycle_counts_status_enum') THEN
          CREATE TYPE "cycle_counts_status_enum" AS ENUM ('draft', 'in_progress', 'pending_review', 'approved', 'completed', 'cancelled');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cycle_count_items_variance_status_enum') THEN
          CREATE TYPE "cycle_count_items_variance_status_enum" AS ENUM ('none', 'within_tolerance', 'exceeds_tolerance', 'investigated', 'adjusted');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cycle_counts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NULL,
        "count_number" varchar NOT NULL,
        "status" "cycle_counts_status_enum" NOT NULL DEFAULT 'draft',
        "count_date" date NOT NULL,
        "notes" text NULL,
        "total_items" integer NOT NULL DEFAULT 0,
        "items_counted" integer NOT NULL DEFAULT 0,
        "variance_count" integer NOT NULL DEFAULT 0,
        "total_variance_value" decimal(12,2) NOT NULL DEFAULT 0,
        "completed_at" timestamptz NULL,
        "facility_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "approved_by_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "PK_cycle_counts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cycle_counts_count_number" UNIQUE ("count_number")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cycle_counts_status" ON "cycle_counts" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cycle_counts_facility_created" ON "cycle_counts" ("facility_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cycle_counts_tenant_id" ON "cycle_counts" ("tenant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cycle_count_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NULL,
        "cycle_count_id" uuid NOT NULL,
        "item_id" uuid NOT NULL,
        "item_name" varchar NOT NULL,
        "item_code" varchar NULL,
        "batch_number" varchar NULL,
        "system_quantity" decimal(15,4) NOT NULL DEFAULT 0,
        "counted_quantity" decimal(15,4) NULL,
        "variance" decimal(15,4) NULL,
        "variance_value" decimal(12,2) NULL,
        "variance_status" "cycle_count_items_variance_status_enum" NOT NULL DEFAULT 'none',
        "investigation_notes" text NULL,
        "unit_cost" decimal(10,2) NULL,
        "counted_by_id" uuid NULL,
        "counted_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "PK_cycle_count_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cycle_count_items_cycle_count" FOREIGN KEY ("cycle_count_id") REFERENCES "cycle_counts"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cycle_count_items_cycle_count_id" ON "cycle_count_items" ("cycle_count_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cycle_count_items_item_id" ON "cycle_count_items" ("item_id")`,
    );

    // Gap 6a: Disposal witness2 column
    await queryRunner.query(
      `ALTER TABLE "disposal_records" ADD COLUMN IF NOT EXISTS "witness2" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order
    await queryRunner.query(`ALTER TABLE "disposal_records" DROP COLUMN IF EXISTS "witness2"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "cycle_count_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cycle_counts"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "cycle_count_items_variance_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "cycle_counts_status_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "batch_recall_actions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "batch_recalls"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "batch_recall_actions_action_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "batch_recalls_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "batch_recalls_severity_enum"`);

    await queryRunner.query(`ALTER TABLE "chart_of_accounts" DROP COLUMN IF EXISTS "version"`);

    await queryRunner.query(
      `ALTER TABLE "goods_receipt_notes" DROP COLUMN IF EXISTS "approved_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_notes" DROP COLUMN IF EXISTS "approved_by_id"`,
    );
  }
}
