import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Backups Table
 *
 * Stores metadata for tenant data backups.
 */
export class CreateBackupsTable1775700000000 implements MigrationInterface {
  name = 'CreateBackupsTable1775700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "backups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" varchar NOT NULL,
        "filename" varchar NOT NULL,
        "file_path" varchar NOT NULL,
        "size_bytes" bigint NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'completed',
        "created_by" varchar,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_backups" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_backups_tenant_id" ON "backups" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_backups_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "backups"`);
  }
}
