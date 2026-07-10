import { MigrationInterface, QueryRunner } from 'typeorm';

export class RevenueIntegrityPhase21782900000060 implements MigrationInterface {
  name = 'RevenueIntegrityPhase21782900000060';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Enum types ---
    await queryRunner.query(`
      CREATE TYPE "consent_type_enum" AS ENUM (
        'data_processing', 'treatment', 'research', 'communication',
        'data_sharing', 'photography', 'telemedicine'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "patient_debt_status_enum" AS ENUM (
        'none', 'current', 'overdue_30', 'overdue_60', 'overdue_90', 'collections'
      )
    `);

    // --- New table: patient_consents ---
    await queryRunner.query(`
      CREATE TABLE "patient_consents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "patient_id" uuid NOT NULL,
        "consent_type" "consent_type_enum" NOT NULL,
        "version" varchar(50) NOT NULL DEFAULT '1.0',
        "accepted" boolean NOT NULL DEFAULT true,
        "accepted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "ip_address" varchar(45),
        "user_agent" text,
        "recorded_by_id" uuid,
        "witnessed_by_id" uuid,
        "withdrawn_at" TIMESTAMPTZ,
        "withdrawn_reason" text,
        "withdrawn_by_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_patient_consents" PRIMARY KEY ("id")
      )
    `);

    // --- Alter existing tables ---

    // pharmacy_sales: add encounter_id
    await queryRunner.query(`
      ALTER TABLE "pharmacy_sales"
      ADD COLUMN "encounter_id" uuid
    `);

    // queues: add appointment_id
    await queryRunner.query(`
      ALTER TABLE "queues"
      ADD COLUMN "appointment_id" uuid
    `);

    // appointments: add encounter_id, queue_id, checked_in_at
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD COLUMN "encounter_id" uuid,
      ADD COLUMN "queue_id" uuid,
      ADD COLUMN "checked_in_at" TIMESTAMPTZ
    `);

    // patients: add debt tracking columns
    await queryRunner.query(`
      ALTER TABLE "patients"
      ADD COLUMN "debt_status" "patient_debt_status_enum" NOT NULL DEFAULT 'none',
      ADD COLUMN "total_outstanding_balance" decimal(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN "blocks_new_visits" boolean NOT NULL DEFAULT false,
      ADD COLUMN "debt_last_calculated_at" TIMESTAMPTZ
    `);

    // --- Indexes ---

    // patient_consents: active consents per patient+type
    await queryRunner.query(`
      CREATE INDEX "IDX_patient_consents_patient_type_active"
      ON "patient_consents" ("patient_id", "consent_type")
      WHERE "deleted_at" IS NULL AND "withdrawn_at" IS NULL
    `);

    // pharmacy_sales: encounter lookup
    await queryRunner.query(`
      CREATE INDEX "IDX_pharmacy_sales_encounter"
      ON "pharmacy_sales" ("encounter_id")
      WHERE "encounter_id" IS NOT NULL
    `);

    // queues: appointment lookup
    await queryRunner.query(`
      CREATE INDEX "IDX_queues_appointment"
      ON "queues" ("appointment_id")
      WHERE "appointment_id" IS NOT NULL
    `);

    // appointments: encounter lookup
    await queryRunner.query(`
      CREATE INDEX "IDX_appointments_encounter"
      ON "appointments" ("encounter_id")
      WHERE "encounter_id" IS NOT NULL
    `);

    // patients: debt status for queries
    await queryRunner.query(`
      CREATE INDEX "IDX_patients_debt_status"
      ON "patients" ("debt_status")
      WHERE "debt_status" != 'none'
    `);

    // patients: visit-blocked flag
    await queryRunner.query(`
      CREATE INDEX "IDX_patients_blocks_new_visits"
      ON "patients" ("blocks_new_visits")
      WHERE "blocks_new_visits" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patients_blocks_new_visits"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patients_debt_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_appointments_encounter"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_queues_appointment"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pharmacy_sales_encounter"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patient_consents_patient_type_active"`);

    // Drop columns from patients
    await queryRunner.query(`
      ALTER TABLE "patients"
      DROP COLUMN IF EXISTS "debt_last_calculated_at",
      DROP COLUMN IF EXISTS "blocks_new_visits",
      DROP COLUMN IF EXISTS "total_outstanding_balance",
      DROP COLUMN IF EXISTS "debt_status"
    `);

    // Drop columns from appointments
    await queryRunner.query(`
      ALTER TABLE "appointments"
      DROP COLUMN IF EXISTS "checked_in_at",
      DROP COLUMN IF EXISTS "queue_id",
      DROP COLUMN IF EXISTS "encounter_id"
    `);

    // Drop column from queues
    await queryRunner.query(`
      ALTER TABLE "queues"
      DROP COLUMN IF EXISTS "appointment_id"
    `);

    // Drop column from pharmacy_sales
    await queryRunner.query(`
      ALTER TABLE "pharmacy_sales"
      DROP COLUMN IF EXISTS "encounter_id"
    `);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_consents"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "patient_debt_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "consent_type_enum"`);
  }
}
