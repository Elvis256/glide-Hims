import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceQueueManagement1771500000000 implements MigrationInterface {
  name = 'EnhanceQueueManagement1771500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extend service_point enum with new values (real enum name is queues_servicepoint_enum)
    await queryRunner.query(`ALTER TYPE "queues_servicepoint_enum" ADD VALUE IF NOT EXISTS 'ipd'`);
    await queryRunner.query(`ALTER TYPE "queues_servicepoint_enum" ADD VALUE IF NOT EXISTS 'emergency'`);
    await queryRunner.query(`ALTER TYPE "queues_servicepoint_enum" ADD VALUE IF NOT EXISTS 'theatre'`);
    await queryRunner.query(`ALTER TYPE "queues_servicepoint_enum" ADD VALUE IF NOT EXISTS 'physiotherapy'`);
    await queryRunner.query(`ALTER TYPE "queues_servicepoint_enum" ADD VALUE IF NOT EXISTS 'dental'`);
    await queryRunner.query(`ALTER TYPE "queues_servicepoint_enum" ADD VALUE IF NOT EXISTS 'optical'`);
    await queryRunner.query(`ALTER TYPE "queues_servicepoint_enum" ADD VALUE IF NOT EXISTS 'nutrition'`);
    await queryRunner.query(`ALTER TYPE "queues_servicepoint_enum" ADD VALUE IF NOT EXISTS 'counselling'`);

    // Columns already added by TypeORM sync — add IF NOT EXISTS as safety
    await queryRunner.query(`ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "next_service_point" varchar`);
    await queryRunner.query(`ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "visit_type" varchar(50)`);
    await queryRunner.query(`ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "chief_complaint_at_token" text`);
    await queryRunner.query(`ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "patient_condition_flags" jsonb`);
    await queryRunner.query(`ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "on_hold" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "hold_reason" text`);
    await queryRunner.query(`ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "hold_started_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "previous_service_point" varchar`);

    // Queue audit log table for regulatory compliance
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "queue_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "queue_id" uuid NOT NULL,
        "action" varchar(100) NOT NULL,
        "from_status" varchar(50),
        "to_status" varchar(50),
        "performed_by_id" uuid NOT NULL,
        "reason" text,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_queue_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_queue_audit_queue_id" ON "queue_audit_logs" ("queue_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_queue_audit_created_at" ON "queue_audit_logs" ("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "queue_audit_logs"`);
    await queryRunner.query(`ALTER TABLE "queues" DROP COLUMN IF EXISTS "previous_service_point"`);
    await queryRunner.query(`ALTER TABLE "queues" DROP COLUMN IF EXISTS "hold_started_at"`);
    await queryRunner.query(`ALTER TABLE "queues" DROP COLUMN IF EXISTS "hold_reason"`);
    await queryRunner.query(`ALTER TABLE "queues" DROP COLUMN IF EXISTS "on_hold"`);
    await queryRunner.query(`ALTER TABLE "queues" DROP COLUMN IF EXISTS "patient_condition_flags"`);
    await queryRunner.query(`ALTER TABLE "queues" DROP COLUMN IF EXISTS "chief_complaint_at_token"`);
    await queryRunner.query(`ALTER TABLE "queues" DROP COLUMN IF EXISTS "visit_type"`);
  }
}
