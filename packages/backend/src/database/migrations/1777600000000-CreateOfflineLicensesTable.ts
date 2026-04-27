import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create offline_licenses table for air-gapped/standalone deployments.
 * Matches OfflineLicense entity in modules/licenses/offline-license.entity.ts
 */
export class CreateOfflineLicensesTable1777600000000 implements MigrationInterface {
  name = 'CreateOfflineLicensesTable1777600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "offline_licenses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "licenseKey" varchar(255) NOT NULL,
        "organizationName" varchar(255) NOT NULL,
        "licenseType" varchar(50) NOT NULL DEFAULT 'standalone',
        "tier" varchar(50) NOT NULL DEFAULT 'basic',
        "maxDeployments" integer NOT NULL DEFAULT 1,
        "maxUsers" integer NOT NULL DEFAULT 0,
        "maxPatients" integer NOT NULL DEFAULT 0,
        "issuedAt" TIMESTAMP NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "signature" varchar(1024) NOT NULL,
        "metadata" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "revokedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_offline_licenses" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_offline_licenses_key" UNIQUE ("licenseKey")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_offline_licenses_active" ON "offline_licenses" ("isActive")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_offline_licenses_expires" ON "offline_licenses" ("expiresAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_offline_licenses_expires"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_offline_licenses_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "offline_licenses"`);
  }
}
