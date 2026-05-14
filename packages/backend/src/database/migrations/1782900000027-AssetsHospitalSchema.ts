import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssetsHospitalSchema1782900000027 implements MigrationInterface {
  name = 'AssetsHospitalSchema1782900000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== Enums =====
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "asset_class_enum" AS ENUM ('medical','it','furniture','vehicle','utility','building','other');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "asset_criticality_enum" AS ENUM ('life_support','high','medium','low');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "asset_transfer_stage_enum" AS ENUM ('origin_dept_head','receiving_dept_head','store_keeper');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "asset_disposal_method_enum" AS ENUM ('sale','scrap','donation','trade_in','write_off');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "asset_disposal_status_enum" AS ENUM ('requested','biomed_review','committee_approval','approved','rejected','completed','cancelled');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "asset_allocation_status_enum" AS ENUM ('requested','dept_head_approved','allocated','returned','rejected','cancelled');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);

    // ===== fixed_assets — add hospital-specific columns =====
    await queryRunner.query(`ALTER TABLE "fixed_assets"
      ADD COLUMN IF NOT EXISTS "asset_class" "asset_class_enum",
      ADD COLUMN IF NOT EXISTS "criticality_level" "asset_criticality_enum",
      ADD COLUMN IF NOT EXISTS "category_id" uuid,
      ADD COLUMN IF NOT EXISTS "parent_asset_id" uuid,
      ADD COLUMN IF NOT EXISTS "building_id" uuid,
      ADD COLUMN IF NOT EXISTS "floor_id" uuid,
      ADD COLUMN IF NOT EXISTS "room_id" uuid,
      ADD COLUMN IF NOT EXISTS "calibration_interval_days" int,
      ADD COLUMN IF NOT EXISTS "last_calibration_date" date,
      ADD COLUMN IF NOT EXISTS "next_calibration_due" date,
      ADD COLUMN IF NOT EXISTS "biomed_engineer_id" uuid,
      ADD COLUMN IF NOT EXISTS "amc_vendor" varchar(255),
      ADD COLUMN IF NOT EXISTS "amc_start_date" date,
      ADD COLUMN IF NOT EXISTS "amc_end_date" date,
      ADD COLUMN IF NOT EXISTS "amc_contract_ref" varchar(100),
      ADD COLUMN IF NOT EXISTS "barcode_qr" varchar(100),
      ADD COLUMN IF NOT EXISTS "rfid_tag" varchar(100),
      ADD COLUMN IF NOT EXISTS "asset_tag" varchar(100),
      ADD COLUMN IF NOT EXISTS "is_capex" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "replacement_cost" decimal(15,2),
      ADD COLUMN IF NOT EXISTS "purchase_order_id" uuid,
      ADD COLUMN IF NOT EXISTS "grn_id" uuid;`);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_fixed_assets_next_calibration" ON "fixed_assets" ("next_calibration_due") WHERE deleted_at IS NULL;`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_fixed_assets_amc_end" ON "fixed_assets" ("amc_end_date") WHERE deleted_at IS NULL;`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_fixed_assets_barcode" ON "fixed_assets" ("barcode_qr") WHERE deleted_at IS NULL AND barcode_qr IS NOT NULL;`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_fixed_assets_facility_status" ON "fixed_assets" ("facility_id","status") WHERE deleted_at IS NULL;`,
    );

    // ===== asset_transfers — extra columns =====
    await queryRunner.query(`ALTER TABLE "asset_transfers"
      ADD COLUMN IF NOT EXISTS "transfer_number" varchar(50),
      ADD COLUMN IF NOT EXISTS "to_custodian_id" uuid;`);

    // ===== asset_transfer_approvals =====
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "asset_transfer_approvals" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant_id" uuid,
      "transfer_id" uuid NOT NULL REFERENCES "asset_transfers"("id") ON DELETE CASCADE,
      "stage" "asset_transfer_stage_enum" NOT NULL,
      "decision" varchar(20) NOT NULL DEFAULT 'pending',
      "decided_by" uuid,
      "decided_at" timestamp,
      "comments" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      "deleted_at" timestamp
    );`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_asset_transfer_approvals_transfer" ON "asset_transfer_approvals" ("transfer_id");`,
    );

    // ===== asset_categories =====
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "asset_categories" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant_id" uuid,
      "code" varchar(50) NOT NULL,
      "name" varchar(150) NOT NULL,
      "asset_class" "asset_class_enum" NOT NULL,
      "parent_id" uuid REFERENCES "asset_categories"("id") ON DELETE SET NULL,
      "default_useful_life_months" int,
      "default_depreciation_method" varchar(40),
      "default_depreciation_rate" decimal(5,2),
      "default_calibration_interval_days" int,
      "default_maintenance_interval_days" int,
      "is_active" boolean NOT NULL DEFAULT true,
      "description" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      "deleted_at" timestamp
    );`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_asset_categories_tenant_code" ON "asset_categories" ("tenant_id","code") WHERE deleted_at IS NULL;`,
    );

    // ===== asset_disposals =====
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "asset_disposals" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant_id" uuid,
      "disposal_number" varchar(50) NOT NULL,
      "asset_id" uuid NOT NULL REFERENCES "fixed_assets"("id"),
      "facility_id" uuid NOT NULL,
      "method" "asset_disposal_method_enum" NOT NULL,
      "status" "asset_disposal_status_enum" NOT NULL DEFAULT 'requested',
      "reason" text NOT NULL,
      "expected_value" decimal(15,2) NOT NULL DEFAULT 0,
      "actual_value" decimal(15,2) NOT NULL DEFAULT 0,
      "buyer" varchar(255),
      "requested_date" date NOT NULL,
      "requested_by" uuid NOT NULL,
      "biomed_reviewed_by" uuid,
      "biomed_reviewed_at" timestamp,
      "biomed_assessment" text,
      "committee_approvals" jsonb,
      "disposal_date" date,
      "completed_by" uuid,
      "journal_entry_id" uuid,
      "attachments" jsonb,
      "notes" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      "deleted_at" timestamp
    );`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_asset_disposals_tenant_no" ON "asset_disposals" ("tenant_id","disposal_number") WHERE deleted_at IS NULL;`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_asset_disposals_facility_status" ON "asset_disposals" ("facility_id","status");`,
    );

    // ===== asset_allocations =====
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "asset_allocations" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant_id" uuid,
      "allocation_number" varchar(50) NOT NULL,
      "asset_id" uuid NOT NULL REFERENCES "fixed_assets"("id"),
      "facility_id" uuid NOT NULL,
      "department_id" uuid,
      "custodian_id" uuid NOT NULL,
      "room_id" uuid,
      "allocation_date" date NOT NULL,
      "expected_return_date" date,
      "actual_return_date" date,
      "status" "asset_allocation_status_enum" NOT NULL DEFAULT 'requested',
      "purpose" text,
      "requested_by" uuid NOT NULL,
      "approved_by" uuid,
      "approved_at" timestamp,
      "condition_on_issue" text,
      "condition_on_return" text,
      "notes" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      "deleted_at" timestamp
    );`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_asset_allocations_tenant_no" ON "asset_allocations" ("tenant_id","allocation_number") WHERE deleted_at IS NULL;`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_asset_allocations_asset" ON "asset_allocations" ("asset_id","status");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_asset_allocations_custodian" ON "asset_allocations" ("custodian_id","status");`,
    );

    // ===== asset_location_history =====
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "asset_location_history" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant_id" uuid,
      "asset_id" uuid NOT NULL REFERENCES "fixed_assets"("id"),
      "facility_id" uuid NOT NULL,
      "department_id" uuid,
      "room_id" uuid,
      "location_label" varchar(255),
      "custodian_id" uuid,
      "moved_at" timestamp NOT NULL,
      "moved_by" uuid,
      "reason" varchar(50),
      "reference_id" uuid,
      "notes" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      "deleted_at" timestamp
    );`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_asset_location_hist" ON "asset_location_history" ("asset_id","moved_at");`,
    );

    // ===== Seed default categories per tenant (one-shot, idempotent) =====
    // Tenants will see these as starter taxonomy; they can edit/extend.
    const defaults = [
      ['MED-MON', 'Patient Monitor', 'medical', 60, 365],
      ['MED-VENT', 'Ventilator', 'medical', 36, 365],
      ['MED-XRAY', 'X-Ray Machine', 'medical', 60, 365],
      ['MED-ULTR', 'Ultrasound', 'medical', 60, 365],
      ['MED-DEFI', 'Defibrillator', 'medical', 30, 90],
      ['MED-INFU', 'Infusion Pump', 'medical', 30, 365],
      ['LAB-ANAL', 'Lab Analyzer', 'medical', 60, 90],
      ['IT-SRVR', 'Server', 'it', 60, null],
      ['IT-DESK', 'Desktop', 'it', 48, null],
      ['IT-LAPT', 'Laptop', 'it', 36, null],
      ['IT-PRNT', 'Printer', 'it', 48, null],
      ['IT-NETW', 'Network Switch', 'it', 60, null],
      ['FRN-DESK', 'Office Desk', 'furniture', 120, null],
      ['FRN-CHR', 'Chair', 'furniture', 60, null],
      ['FRN-BED', 'Hospital Bed', 'furniture', 120, null],
      ['VEH-AMB', 'Ambulance', 'vehicle', 96, null],
      ['UTL-GEN', 'Generator', 'utility', 120, 90],
      ['UTL-AC', 'Air Conditioner', 'utility', 84, 180],
    ];
    for (const [code, name, cls, life, calib] of defaults) {
      await queryRunner.query(
        `INSERT INTO "asset_categories" ("code","name","asset_class","default_useful_life_months","default_calibration_interval_days","tenant_id")
         SELECT $1::varchar, $2::varchar, $3::"asset_class_enum", $4::int, $5::int, t.id FROM "tenants" t
         WHERE NOT EXISTS (SELECT 1 FROM "asset_categories" c WHERE c.tenant_id = t.id AND c.code = $1::varchar AND c.deleted_at IS NULL);`,
        [code, name, cls, life, calib],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_location_history";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_allocations";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_disposals";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_categories";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_transfer_approvals";`);
    await queryRunner.query(
      `ALTER TABLE "asset_transfers" DROP COLUMN IF EXISTS "transfer_number", DROP COLUMN IF EXISTS "to_custodian_id";`,
    );
    await queryRunner.query(`ALTER TABLE "fixed_assets"
      DROP COLUMN IF EXISTS "asset_class",
      DROP COLUMN IF EXISTS "criticality_level",
      DROP COLUMN IF EXISTS "category_id",
      DROP COLUMN IF EXISTS "parent_asset_id",
      DROP COLUMN IF EXISTS "building_id",
      DROP COLUMN IF EXISTS "floor_id",
      DROP COLUMN IF EXISTS "room_id",
      DROP COLUMN IF EXISTS "calibration_interval_days",
      DROP COLUMN IF EXISTS "last_calibration_date",
      DROP COLUMN IF EXISTS "next_calibration_due",
      DROP COLUMN IF EXISTS "biomed_engineer_id",
      DROP COLUMN IF EXISTS "amc_vendor",
      DROP COLUMN IF EXISTS "amc_start_date",
      DROP COLUMN IF EXISTS "amc_end_date",
      DROP COLUMN IF EXISTS "amc_contract_ref",
      DROP COLUMN IF EXISTS "barcode_qr",
      DROP COLUMN IF EXISTS "rfid_tag",
      DROP COLUMN IF EXISTS "asset_tag",
      DROP COLUMN IF EXISTS "is_capex",
      DROP COLUMN IF EXISTS "replacement_cost",
      DROP COLUMN IF EXISTS "purchase_order_id",
      DROP COLUMN IF EXISTS "grn_id";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "asset_allocation_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "asset_disposal_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "asset_disposal_method_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "asset_transfer_stage_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "asset_criticality_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "asset_class_enum";`);
  }
}
