import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockTransferTables1775100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "transfer_status_enum" AS ENUM (
          'requested', 'approved', 'in_transit', 'received', 'cancelled', 'rejected'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "transfer_reason_enum" AS ENUM (
          'near_expiry', 'surplus', 'stockout_relief', 'redistribution', 'other'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create stock_transfers table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_transfers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "transfer_number" varchar NOT NULL,
        "from_facility_id" uuid NOT NULL,
        "to_facility_id" uuid NOT NULL,
        "status" "transfer_status_enum" NOT NULL DEFAULT 'requested',
        "reason" "transfer_reason_enum" NOT NULL,
        "notes" text,
        "requested_by_id" uuid NOT NULL,
        "approved_by_id" uuid,
        "approved_at" TIMESTAMPTZ,
        "received_by_id" uuid,
        "received_at" TIMESTAMPTZ,
        "shipped_at" TIMESTAMPTZ,
        "rejection_reason" text,
        "cancellation_reason" text,
        CONSTRAINT "PK_stock_transfers" PRIMARY KEY ("id")
      )
    `);

    // Create stock_transfer_items table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_transfer_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "transfer_id" uuid NOT NULL,
        "item_id" uuid NOT NULL,
        "batch_number" varchar NOT NULL,
        "expiry_date" date NOT NULL,
        "requested_quantity" int NOT NULL,
        "approved_quantity" int,
        "received_quantity" int,
        "unit_cost" decimal(10,2) NOT NULL,
        "notes" text,
        CONSTRAINT "PK_stock_transfer_items" PRIMARY KEY ("id")
      )
    `);

    // Add indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_transfers_tenant_id" ON "stock_transfers" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_stock_transfers_transfer_number" ON "stock_transfers" ("transfer_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_transfers_from_facility_id" ON "stock_transfers" ("from_facility_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_transfers_to_facility_id" ON "stock_transfers" ("to_facility_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_transfers_status" ON "stock_transfers" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_transfer_items_tenant_id" ON "stock_transfer_items" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_transfer_items_transfer_id" ON "stock_transfer_items" ("transfer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_transfer_items_item_id" ON "stock_transfer_items" ("item_id")`,
    );

    // Add foreign keys (safe — ignored if already exist)
    await queryRunner
      .query(
        `
      ALTER TABLE "stock_transfers"
      ADD CONSTRAINT "FK_stock_transfers_from_facility"
      FOREIGN KEY ("from_facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT
    `,
      )
      .catch(() => {
        /* already exists */
      });

    await queryRunner
      .query(
        `
      ALTER TABLE "stock_transfers"
      ADD CONSTRAINT "FK_stock_transfers_to_facility"
      FOREIGN KEY ("to_facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT
    `,
      )
      .catch(() => {
        /* already exists */
      });

    await queryRunner
      .query(
        `
      ALTER TABLE "stock_transfers"
      ADD CONSTRAINT "FK_stock_transfers_requested_by"
      FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
    `,
      )
      .catch(() => {
        /* already exists */
      });

    await queryRunner
      .query(
        `
      ALTER TABLE "stock_transfers"
      ADD CONSTRAINT "FK_stock_transfers_approved_by"
      FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `,
      )
      .catch(() => {
        /* already exists */
      });

    await queryRunner
      .query(
        `
      ALTER TABLE "stock_transfers"
      ADD CONSTRAINT "FK_stock_transfers_received_by"
      FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `,
      )
      .catch(() => {
        /* already exists */
      });

    await queryRunner
      .query(
        `
      ALTER TABLE "stock_transfer_items"
      ADD CONSTRAINT "FK_stock_transfer_items_transfer"
      FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE
    `,
      )
      .catch(() => {
        /* already exists */
      });

    await queryRunner
      .query(
        `
      ALTER TABLE "stock_transfer_items"
      ADD CONSTRAINT "FK_stock_transfer_items_item"
      FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT
    `,
      )
      .catch(() => {
        /* already exists */
      });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_transfer_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_transfers"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transfer_reason_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transfer_status_enum"`);
  }
}
