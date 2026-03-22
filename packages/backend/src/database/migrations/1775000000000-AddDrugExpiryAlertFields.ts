import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDrugExpiryAlertFields1775000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add AlertLevel enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "expiry_alerts_alert_level_enum" AS ENUM ('info', 'warning', 'urgent');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Add new columns to expiry_alerts
    await queryRunner.query(`ALTER TABLE "expiry_alerts" ADD COLUMN IF NOT EXISTS "days_until_expiry" integer`);
    await queryRunner.query(`ALTER TABLE "expiry_alerts" ADD COLUMN IF NOT EXISTS "alert_level" "expiry_alerts_alert_level_enum"`);
    await queryRunner.query(`ALTER TABLE "expiry_alerts" ADD COLUMN IF NOT EXISTS "sms_sent" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "expiry_alerts" ADD COLUMN IF NOT EXISTS "in_app_sent" boolean NOT NULL DEFAULT false`);

    // Add index on alert_level for efficient querying
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_expiry_alerts_alert_level" ON "expiry_alerts" ("alert_level")`);

    // Create expiry_alert_configs table if not exists
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "expiry_alert_configs_severity_enum" AS ENUM ('low', 'medium', 'high', 'critical');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "expiry_alert_history_channel_enum" AS ENUM ('email', 'sms', 'in_app', 'push');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expiry_alert_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "config_name" character varying NOT NULL,
        "days_before_expiry" integer NOT NULL,
        "severity" "expiry_alert_configs_severity_enum" NOT NULL DEFAULT 'medium',
        "channels" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "notify_emails" text,
        "notify_phones" text,
        "facility_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        CONSTRAINT "PK_expiry_alert_configs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_expiry_alert_configs_facility" ON "expiry_alert_configs" ("facility_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_expiry_alert_configs_tenant" ON "expiry_alert_configs" ("tenant_id")`);

    // Create expiry_alert_history table if not exists
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expiry_alert_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "alert_type" character varying NOT NULL,
        "items_affected" integer NOT NULL,
        "total_value" numeric(10,2) NOT NULL DEFAULT 0,
        "severity" "expiry_alert_configs_severity_enum" NOT NULL DEFAULT 'medium',
        "message" text,
        "acknowledged" boolean NOT NULL DEFAULT false,
        "acknowledged_at" TIMESTAMP,
        "channel" "expiry_alert_history_channel_enum",
        "sent_at" TIMESTAMP,
        "facility_id" uuid NOT NULL,
        "acknowledged_by_id" uuid,
        CONSTRAINT "PK_expiry_alert_history" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_expiry_alert_history_facility_created" ON "expiry_alert_history" ("facility_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_expiry_alert_history_acknowledged" ON "expiry_alert_history" ("acknowledged")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_expiry_alert_history_tenant" ON "expiry_alert_history" ("tenant_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop expiry_alert_history table
    await queryRunner.query(`DROP TABLE IF EXISTS "expiry_alert_history"`);

    // Drop expiry_alert_configs table
    await queryRunner.query(`DROP TABLE IF EXISTS "expiry_alert_configs"`);

    // Remove new columns from expiry_alerts
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expiry_alerts_alert_level"`);
    await queryRunner.query(`ALTER TABLE "expiry_alerts" DROP COLUMN IF EXISTS "in_app_sent"`);
    await queryRunner.query(`ALTER TABLE "expiry_alerts" DROP COLUMN IF EXISTS "sms_sent"`);
    await queryRunner.query(`ALTER TABLE "expiry_alerts" DROP COLUMN IF EXISTS "alert_level"`);
    await queryRunner.query(`ALTER TABLE "expiry_alerts" DROP COLUMN IF EXISTS "days_until_expiry"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "expiry_alert_history_channel_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "expiry_alert_configs_severity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "expiry_alerts_alert_level_enum"`);
  }
}
