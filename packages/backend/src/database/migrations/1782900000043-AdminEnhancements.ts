import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminEnhancements1782900000043 implements MigrationInterface {
  name = 'AdminEnhancements1782900000043';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // System Admin Roles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_admin_roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "name" varchar(100) NOT NULL,
        "description" varchar(255),
        "permissions" jsonb NOT NULL DEFAULT '[]',
        "is_active" boolean NOT NULL DEFAULT true,
        "is_built_in" boolean NOT NULL DEFAULT false,
        CONSTRAINT "UQ_system_admin_roles_name" UNIQUE ("name"),
        CONSTRAINT "PK_system_admin_roles" PRIMARY KEY ("id")
      )
    `);

    // System Admin Role Assignments
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_admin_role_assignments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "user_id" uuid NOT NULL,
        "system_admin_role_id" uuid NOT NULL,
        "scoped_tenant_id" uuid,
        CONSTRAINT "PK_system_admin_role_assignments" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sysrole_assign_user" ON "system_admin_role_assignments" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sysrole_assign_role" ON "system_admin_role_assignments" ("system_admin_role_id")
    `);

    // API Keys
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "name" varchar(100) NOT NULL,
        "key_hash" varchar(64) NOT NULL,
        "key_prefix" varchar(16) NOT NULL,
        "created_by" uuid NOT NULL,
        "scopes" jsonb NOT NULL DEFAULT '[]',
        "rate_limit_per_hour" int NOT NULL DEFAULT 1000,
        "expires_at" TIMESTAMP,
        "last_used_at" TIMESTAMP,
        "usage_count" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "ip_whitelist" varchar(50),
        CONSTRAINT "PK_api_keys" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_api_keys_key_hash" ON "api_keys" ("key_hash")
    `);

    // Webhook Delivery Logs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhook_delivery_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "webhook_id" varchar(100) NOT NULL,
        "url" varchar(500) NOT NULL,
        "event" varchar(100) NOT NULL,
        "payload" jsonb,
        "response_status" int,
        "response_body" text,
        "duration_ms" int,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "retry_count" int NOT NULL DEFAULT 0,
        "error_message" text,
        "next_retry_at" TIMESTAMP,
        CONSTRAINT "PK_webhook_delivery_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_webhook_logs_webhook_id" ON "webhook_delivery_logs" ("webhook_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_webhook_logs_status" ON "webhook_delivery_logs" ("status")
    `);

    // System Metrics (if not already created)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_metrics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "metric_type" varchar(50) NOT NULL,
        "value" numeric(20,4) NOT NULL,
        "unit" varchar(20),
        "metadata" jsonb,
        "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_metrics" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_system_metrics_type_recorded" ON "system_metrics" ("metric_type", "recorded_at")
    `);

    // Alert Rules (if not already created)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "alert_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "name" varchar(100) NOT NULL,
        "metric_type" varchar(50) NOT NULL,
        "operator" varchar(5) NOT NULL,
        "threshold" numeric(20,4) NOT NULL,
        "severity" varchar(10) NOT NULL DEFAULT 'medium',
        "enabled" boolean NOT NULL DEFAULT true,
        "cooldown_minutes" int NOT NULL DEFAULT 60,
        "notify_channels" jsonb NOT NULL DEFAULT '["in_app"]',
        "last_triggered_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_alert_rules" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_alert_rules_metric" ON "alert_rules" ("metric_type")
    `);

    // System Alerts (if not already created)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_alerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "rule_id" uuid,
        "title" varchar(200) NOT NULL,
        "message" text NOT NULL,
        "severity" varchar(10) NOT NULL DEFAULT 'info',
        "status" varchar(15) NOT NULL DEFAULT 'open',
        "metric_type" varchar(50),
        "metric_value" numeric(20,4),
        "acknowledged_by" uuid,
        "acknowledged_at" TIMESTAMP WITH TIME ZONE,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb,
        CONSTRAINT "PK_system_alerts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_system_alerts_status" ON "system_alerts" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_system_alerts_severity" ON "system_alerts" ("severity")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "system_alerts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "alert_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_metrics"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_delivery_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_admin_role_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_admin_roles"`);
  }
}
