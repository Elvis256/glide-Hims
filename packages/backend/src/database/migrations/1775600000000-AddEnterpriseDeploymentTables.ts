import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Enterprise Deployment Tables
 * 
 * Creates tables for:
 * - License management (licenses)
 * - Phone home tracking (phone_home_records)
 * - Feature flags (feature_flags, system_features)
 * - App versions (app_versions)
 */
export class AddEnterpriseDeploymentTables1775600000000 implements MigrationInterface {
  name = 'AddEnterpriseDeploymentTables1775600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============== LICENSES TABLE ==============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "licenses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "license_key" varchar(128) NOT NULL,
        "organization_name" varchar(255) NOT NULL,
        "email" varchar(255),
        "status" varchar(50) NOT NULL DEFAULT 'active',
        "license_type" varchar(50) NOT NULL,
        "issued_at" TIMESTAMP NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP NOT NULL,
        "max_users" integer NOT NULL DEFAULT 50,
        "max_facilities" integer NOT NULL DEFAULT 1,
        "enabled_modules" jsonb,
        "features" jsonb,
        "hardware_id" varchar(255),
        "last_validated_at" TIMESTAMP,
        "validation_failures" integer NOT NULL DEFAULT 0,
        "signature" text,
        "tenant_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_licenses" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_licenses_license_key" UNIQUE ("license_key"),
        CONSTRAINT "FK_licenses_tenant" FOREIGN KEY ("tenant_id") 
          REFERENCES "tenants"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_licenses_license_key" ON "licenses" ("license_key");
      CREATE INDEX "IDX_licenses_tenant_id" ON "licenses" ("tenant_id");
      CREATE INDEX "IDX_licenses_status" ON "licenses" ("status");
      CREATE INDEX "IDX_licenses_expires_at" ON "licenses" ("expires_at");
    `);

    // ============== PHONE HOME RECORDS TABLE ==============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "phone_home_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "license_id" uuid NOT NULL,
        "ip_address" varchar(45) NOT NULL,
        "hardware_id" varchar(255),
        "app_version" varchar(50),
        "active_users" integer NOT NULL DEFAULT 0,
        "total_users" integer NOT NULL DEFAULT 0,
        "total_patients" integer NOT NULL DEFAULT 0,
        "total_encounters" integer NOT NULL DEFAULT 0,
        "system_info" jsonb,
        "usage_stats" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_phone_home_records" PRIMARY KEY ("id"),
        CONSTRAINT "FK_phone_home_records_license" FOREIGN KEY ("license_id") 
          REFERENCES "licenses"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_phone_home_records_license_id" ON "phone_home_records" ("license_id");
      CREATE INDEX "IDX_phone_home_records_created_at" ON "phone_home_records" ("created_at");
    `);

    // ============== FEATURE FLAGS TABLE ==============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feature_flags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "feature_key" varchar(100) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "is_enabled" boolean NOT NULL DEFAULT false,
        "value_type" varchar(50) NOT NULL DEFAULT 'boolean',
        "value" text,
        "category" varchar(50) NOT NULL DEFAULT 'feature',
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_feature_flags" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feature_flags_tenant_key" UNIQUE ("tenant_id", "feature_key"),
        CONSTRAINT "FK_feature_flags_tenant" FOREIGN KEY ("tenant_id") 
          REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_feature_flags_tenant_id" ON "feature_flags" ("tenant_id");
      CREATE INDEX "IDX_feature_flags_feature_key" ON "feature_flags" ("feature_key");
      CREATE INDEX "IDX_feature_flags_category" ON "feature_flags" ("category");
    `);

    // ============== SYSTEM FEATURES TABLE ==============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_features" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "feature_key" varchar(100) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "category" varchar(50) NOT NULL,
        "default_enabled" boolean NOT NULL DEFAULT true,
        "min_license_type" varchar(50) NOT NULL DEFAULT 'standard',
        "dependencies" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_features" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_system_features_feature_key" UNIQUE ("feature_key")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_system_features_feature_key" ON "system_features" ("feature_key");
      CREATE INDEX "IDX_system_features_category" ON "system_features" ("category");
    `);

    // ============== APP VERSIONS TABLE ==============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "version" varchar(50) NOT NULL,
        "version_code" varchar(50) NOT NULL,
        "release_notes" text,
        "min_upgrade_from" varchar(50),
        "is_mandatory" boolean NOT NULL DEFAULT false,
        "is_latest" boolean NOT NULL DEFAULT false,
        "download_url" varchar(500),
        "checksum" varchar(64),
        "file_size" bigint,
        "released_at" TIMESTAMP NOT NULL DEFAULT now(),
        "end_of_support" TIMESTAMP,
        CONSTRAINT "PK_app_versions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_app_versions_version" UNIQUE ("version")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_app_versions_version" ON "app_versions" ("version");
      CREATE INDEX "IDX_app_versions_is_latest" ON "app_versions" ("is_latest");
      CREATE INDEX "IDX_app_versions_released_at" ON "app_versions" ("released_at");
    `);

    // ============== SEED INITIAL DATA ==============
    
    // Insert default system features
    await queryRunner.query(`
      INSERT INTO "system_features" ("feature_key", "name", "description", "category", "default_enabled", "min_license_type") 
      VALUES 
        ('patients', 'Patient Management', 'Core patient registration and management', 'core', true, 'trial'),
        ('encounters', 'Encounters', 'Patient encounters and visits', 'core', true, 'trial'),
        ('billing', 'Billing', 'Basic billing and invoicing', 'core', true, 'trial'),
        ('reports', 'Reports', 'Basic reporting', 'core', true, 'trial'),
        ('pharmacy', 'Pharmacy', 'Pharmacy management', 'module', true, 'standard'),
        ('lab', 'Laboratory', 'Laboratory management', 'module', true, 'standard'),
        ('inventory', 'Inventory', 'Inventory management', 'module', true, 'standard'),
        ('radiology', 'Radiology', 'Radiology/Imaging', 'module', true, 'professional'),
        ('ipd', 'Inpatient', 'Inpatient department', 'module', true, 'professional'),
        ('surgery', 'Surgery', 'Surgery scheduling and tracking', 'module', true, 'professional'),
        ('hr', 'Human Resources', 'HR management', 'module', true, 'enterprise'),
        ('finance', 'Finance', 'Advanced finance and accounting', 'module', true, 'enterprise'),
        ('analytics', 'Analytics', 'Advanced analytics dashboard', 'module', true, 'enterprise'),
        ('integrations', 'Integrations', 'Third-party integrations', 'module', true, 'enterprise'),
        ('api_access', 'API Access', 'External API access', 'feature', false, 'professional'),
        ('sso', 'Single Sign-On', 'SSO integration', 'feature', false, 'enterprise'),
        ('audit_logs', 'Audit Logs', 'Comprehensive audit logging', 'feature', true, 'professional'),
        ('multi_facility', 'Multi-Facility', 'Multiple facility support', 'feature', false, 'professional'),
        ('white_label', 'White Label', 'White labeling support', 'feature', false, 'enterprise'),
        ('sms_notifications', 'SMS Notifications', 'SMS notification support', 'feature', false, 'standard')
      ON CONFLICT ("feature_key") DO NOTHING
    `);

    // Insert initial version
    await queryRunner.query(`
      INSERT INTO "app_versions" ("version", "version_code", "release_notes", "is_latest", "is_mandatory")
      VALUES ('1.0.0', '20240409', 'Initial release with enterprise deployment support', true, false)
      ON CONFLICT ("version") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "phone_home_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "licenses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feature_flags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_features"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "app_versions"`);
  }
}
