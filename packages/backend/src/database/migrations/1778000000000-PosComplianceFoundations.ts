import { MigrationInterface, QueryRunner } from 'typeorm';

export class PosComplianceFoundations1778000000000 implements MigrationInterface {
  name = 'PosComplianceFoundations1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Enums ────────────────────────────────────────────────────────────
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "pharmacy_sales_sale_channel_enum" AS ENUM (
        'retail_pos','internal_pharmacy','ward_inpatient','insurance_b2b','wholesale','legacy'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "pharmacy_sales_tax_pricing_mode_enum" AS ENUM ('inclusive','exclusive');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "pharmacy_sale_items_tax_treatment_enum" AS ENUM (
        'standard','zero_rated','exempt','out_of_scope'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "efris_documents_document_type_enum" AS ENUM ('invoice','credit_note','debit_note');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "efris_documents_status_enum" AS ENUM (
        'pending_submission','submitting','submitted','accepted','rejected',
        'retrying','failed_requires_attention','cancelled'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "efris_environment_enum" AS ENUM ('sandbox','production');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "pos_cash_drawer_events_event_type_enum" AS ENUM (
        'no_sale','paid_in','paid_out','cash_drop','opening_float'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "outbox_events_status_enum" AS ENUM ('pending','processing','processed','failed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);

    // ─── pharmacy_sales: add columns ──────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "pharmacy_sales"
      ADD COLUMN IF NOT EXISTS "sale_channel" "pharmacy_sales_sale_channel_enum"
        NOT NULL DEFAULT 'internal_pharmacy',
      ADD COLUMN IF NOT EXISTS "tax_pricing_mode" "pharmacy_sales_tax_pricing_mode_enum"
        NOT NULL DEFAULT 'inclusive',
      ADD COLUMN IF NOT EXISTS "pos_shift_id" uuid,
      ADD COLUMN IF NOT EXISTS "pos_register_id" uuid
    `);
    // Backfill: every pre-existing sale is "legacy" channel (we don't know origin)
    await queryRunner.query(`
      UPDATE "pharmacy_sales"
      SET "sale_channel" = 'legacy'
      WHERE "created_at" < now() - INTERVAL '1 second'
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pharmacy_sales_pos_shift" ON "pharmacy_sales"("pos_shift_id") WHERE "pos_shift_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pharmacy_sales_sale_channel" ON "pharmacy_sales"("sale_channel")`,
    );

    // ─── pharmacy_sale_items: per-line tax fields ─────────────────────────
    await queryRunner.query(`
      ALTER TABLE "pharmacy_sale_items"
      ADD COLUMN IF NOT EXISTS "net_amount" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "tax_amount" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "gross_amount" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "tax_rate" numeric(5,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "tax_treatment" "pharmacy_sale_items_tax_treatment_enum"
        NOT NULL DEFAULT 'standard',
      ADD COLUMN IF NOT EXISTS "tax_code" varchar(20),
      ADD COLUMN IF NOT EXISTS "tax_exemption_reason" text
    `);
    // Backfill gross_amount = amount for legacy rows so reports don't break
    await queryRunner.query(`
      UPDATE "pharmacy_sale_items"
      SET "gross_amount" = "amount", "net_amount" = "amount"
      WHERE "gross_amount" = 0 AND "amount" > 0
    `);

    // ─── controlled_substance_logs: relax + extend ────────────────────────
    await queryRunner.query(`
      ALTER TABLE "controlled_substance_logs"
      ALTER COLUMN "prescription_item_id" DROP NOT NULL,
      ALTER COLUMN "dispensation_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "controlled_substance_logs"
      ADD COLUMN IF NOT EXISTS "pharmacy_sale_item_id" uuid,
      ADD COLUMN IF NOT EXISTS "buyer_name" varchar(255),
      ADD COLUMN IF NOT EXISTS "buyer_id_type" varchar(30),
      ADD COLUMN IF NOT EXISTS "buyer_id_number" varchar(60),
      ADD COLUMN IF NOT EXISTS "buyer_phone" varchar(30),
      ADD COLUMN IF NOT EXISTS "prescriber_name" varchar(255),
      ADD COLUMN IF NOT EXISTS "prescriber_license" varchar(60),
      ADD COLUMN IF NOT EXISTS "pharmacist_id" uuid,
      ADD COLUMN IF NOT EXISTS "is_otc_permitted" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_controlled_logs_sale_item" ON "controlled_substance_logs"("pharmacy_sale_item_id") WHERE "pharmacy_sale_item_id" IS NOT NULL`,
    );

    // ─── pos_payment_splits: shift_id ─────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "pos_payment_splits"
      ADD COLUMN IF NOT EXISTS "shift_id" uuid
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pos_payment_splits_shift" ON "pos_payment_splits"("shift_id") WHERE "shift_id" IS NOT NULL`,
    );

    // ─── efris_documents ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "efris_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        "document_type" "efris_documents_document_type_enum" NOT NULL DEFAULT 'invoice',
        "status" "efris_documents_status_enum" NOT NULL DEFAULT 'pending_submission',
        "sale_id" uuid NOT NULL,
        "original_document_id" uuid,
        "idempotency_key" varchar(255) NOT NULL,
        "fiscal_invoice_number" varchar(255),
        "fiscal_serial_number" varchar(255),
        "qr_code" text,
        "verification_url" text,
        "device_serial" varchar(255),
        "taxpayer_tin" varchar(255),
        "request_payload" jsonb,
        "response_payload" jsonb,
        "error_code" varchar(255),
        "error_message" text,
        "retry_count" integer NOT NULL DEFAULT 0,
        "next_retry_at" timestamptz,
        "submitted_at" timestamptz,
        "accepted_at" timestamptz,
        "environment" "efris_environment_enum" NOT NULL DEFAULT 'sandbox',
        CONSTRAINT "PK_efris_documents" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_efris_idempotency" UNIQUE ("tenant_id","idempotency_key"),
        CONSTRAINT "FK_efris_documents_sale" FOREIGN KEY ("sale_id") REFERENCES "pharmacy_sales"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_efris_documents_status" ON "efris_documents"("tenant_id","status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_efris_documents_sale" ON "efris_documents"("sale_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_efris_documents_next_retry" ON "efris_documents"("next_retry_at") WHERE "status" IN ('pending_submission','retrying')`,
    );

    // ─── efris_configs ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "efris_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        "taxpayer_tin" varchar(255) NOT NULL,
        "taxpayer_name" varchar(255) NOT NULL,
        "device_serial" varchar(255) NOT NULL,
        "environment" "efris_environment_enum" NOT NULL DEFAULT 'sandbox',
        "sandbox_url" varchar(255),
        "production_url" varchar(255),
        "api_key_encrypted" text,
        "is_enabled" boolean NOT NULL DEFAULT false,
        "submit_on_completion" boolean NOT NULL DEFAULT true,
        "max_retries" integer NOT NULL DEFAULT 5,
        "retry_backoff_seconds" integer NOT NULL DEFAULT 60,
        "allow_offline_receipts" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_efris_configs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_efris_config_tenant" UNIQUE ("tenant_id")
      )
    `);

    // ─── pos_cash_drawer_events ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pos_cash_drawer_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        "shift_id" uuid NOT NULL,
        "event_type" "pos_cash_drawer_events_event_type_enum" NOT NULL,
        "amount" numeric(12,2) NOT NULL DEFAULT 0,
        "reason" text,
        "created_by_id" uuid NOT NULL,
        "approved_by_id" uuid,
        "affects_expected_cash" boolean NOT NULL DEFAULT true,
        "reference" varchar(255),
        CONSTRAINT "PK_pos_cash_drawer_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_drawer_events_shift" FOREIGN KEY ("shift_id") REFERENCES "pos_shifts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_drawer_events_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_drawer_events_approved_by" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_drawer_events_shift" ON "pos_cash_drawer_events"("tenant_id","shift_id")`,
    );

    // ─── pos_z_reports ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pos_z_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        "shift_id" uuid NOT NULL,
        "register_id" uuid NOT NULL,
        "report_number" varchar(255) NOT NULL,
        "generated_at" timestamptz NOT NULL,
        "generated_by_id" uuid NOT NULL,
        "opening_cash" numeric(12,2) NOT NULL DEFAULT 0,
        "cash_sales" numeric(12,2) NOT NULL DEFAULT 0,
        "cash_refunds" numeric(12,2) NOT NULL DEFAULT 0,
        "paid_in_total" numeric(12,2) NOT NULL DEFAULT 0,
        "paid_out_total" numeric(12,2) NOT NULL DEFAULT 0,
        "cash_drop_total" numeric(12,2) NOT NULL DEFAULT 0,
        "expected_cash" numeric(12,2) NOT NULL DEFAULT 0,
        "counted_cash" numeric(12,2) NOT NULL DEFAULT 0,
        "cash_variance" numeric(12,2) NOT NULL DEFAULT 0,
        "payment_method_breakdown" jsonb,
        "denomination_count" jsonb,
        "transaction_count" integer NOT NULL DEFAULT 0,
        "return_count" integer NOT NULL DEFAULT 0,
        "gross_sales" numeric(12,2) NOT NULL DEFAULT 0,
        "returns_total" numeric(12,2) NOT NULL DEFAULT 0,
        "net_sales" numeric(12,2) NOT NULL DEFAULT 0,
        "tax_total" numeric(12,2) NOT NULL DEFAULT 0,
        "discount_total" numeric(12,2) NOT NULL DEFAULT 0,
        "efris_summary" jsonb,
        "notes" text,
        "payload_hash" varchar(128) NOT NULL,
        CONSTRAINT "PK_pos_z_reports" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_z_report_shift" UNIQUE ("shift_id"),
        CONSTRAINT "UQ_z_report_number" UNIQUE ("report_number"),
        CONSTRAINT "FK_z_report_shift" FOREIGN KEY ("shift_id") REFERENCES "pos_shifts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_z_report_register" FOREIGN KEY ("register_id") REFERENCES "pos_registers"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_z_report_generated_by" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_z_reports_generated_at" ON "pos_z_reports"("tenant_id","generated_at")`,
    );

    // ─── outbox_events ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        "event_type" varchar(100) NOT NULL,
        "aggregate_type" varchar(100) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "outbox_events_status_enum" NOT NULL DEFAULT 'pending',
        "attempt_count" integer NOT NULL DEFAULT 0,
        "max_attempts" integer NOT NULL DEFAULT 10,
        "next_attempt_at" timestamptz,
        "last_error" text,
        "processed_at" timestamptz,
        CONSTRAINT "PK_outbox_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_outbox_status_next" ON "outbox_events"("status","next_attempt_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_outbox_aggregate" ON "outbox_events"("tenant_id","aggregate_type","aggregate_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pos_z_reports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pos_cash_drawer_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "efris_configs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "efris_documents"`);

    await queryRunner.query(
      `ALTER TABLE "pos_payment_splits" DROP COLUMN IF EXISTS "shift_id"`,
    );

    await queryRunner.query(`
      ALTER TABLE "controlled_substance_logs"
      DROP COLUMN IF EXISTS "is_otc_permitted",
      DROP COLUMN IF EXISTS "pharmacist_id",
      DROP COLUMN IF EXISTS "prescriber_license",
      DROP COLUMN IF EXISTS "prescriber_name",
      DROP COLUMN IF EXISTS "buyer_phone",
      DROP COLUMN IF EXISTS "buyer_id_number",
      DROP COLUMN IF EXISTS "buyer_id_type",
      DROP COLUMN IF EXISTS "buyer_name",
      DROP COLUMN IF EXISTS "pharmacy_sale_item_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "pharmacy_sale_items"
      DROP COLUMN IF EXISTS "tax_exemption_reason",
      DROP COLUMN IF EXISTS "tax_code",
      DROP COLUMN IF EXISTS "tax_treatment",
      DROP COLUMN IF EXISTS "tax_rate",
      DROP COLUMN IF EXISTS "gross_amount",
      DROP COLUMN IF EXISTS "tax_amount",
      DROP COLUMN IF EXISTS "net_amount"
    `);

    await queryRunner.query(`
      ALTER TABLE "pharmacy_sales"
      DROP COLUMN IF EXISTS "pos_register_id",
      DROP COLUMN IF EXISTS "pos_shift_id",
      DROP COLUMN IF EXISTS "tax_pricing_mode",
      DROP COLUMN IF EXISTS "sale_channel"
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS "outbox_events_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pos_cash_drawer_events_event_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "efris_environment_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "efris_documents_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "efris_documents_document_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pharmacy_sale_items_tax_treatment_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pharmacy_sales_tax_pricing_mode_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pharmacy_sales_sale_channel_enum"`);
  }
}
