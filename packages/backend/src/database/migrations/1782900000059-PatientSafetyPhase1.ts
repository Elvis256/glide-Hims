import { MigrationInterface, QueryRunner } from 'typeorm';

export class PatientSafetyPhase11782900000059 implements MigrationInterface {
  name = 'PatientSafetyPhase11782900000059';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Enum types ---
    await queryRunner.query(`
      CREATE TYPE "active_medication_status_enum" AS ENUM (
        'active', 'completed', 'stopped', 'expired'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "drug_disease_severity_enum" AS ENUM (
        'minor', 'moderate', 'major', 'contraindicated'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "consciousness_level_enum" AS ENUM (
        'A', 'V', 'P', 'U'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "clinical_risk_level_enum" AS ENUM (
        'low', 'low_medium', 'medium', 'high'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "esi_level_enum" AS ENUM (
        '1', '2', '3', '4', '5'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "triage_acuity_color_enum" AS ENUM (
        'red', 'orange', 'yellow', 'green', 'blue'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "triage_disposition_enum" AS ENUM (
        'consultation', 'emergency_resuscitation', 'observation', 'referral',
        'discharge', 'admit'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "mobility_status_enum" AS ENUM (
        'ambulatory', 'wheelchair', 'stretcher', 'carried'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "mental_status_enum" AS ENUM (
        'alert', 'confused', 'agitated', 'lethargic', 'unresponsive'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "reconciliation_status_enum" AS ENUM (
        'draft', 'in_review', 'completed', 'signed'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "reconciliation_source_type_enum" AS ENUM (
        'active_medication', 'encounter_prescription', 'manual'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "reconciliation_item_status_enum" AS ENUM (
        'pending_review', 'continued_unchanged', 'continued_modified',
        'discontinued', 'new_at_discharge'
      )
    `);

    // --- New table: patient_active_medications ---
    await queryRunner.query(`
      CREATE TABLE "patient_active_medications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "patient_id" uuid NOT NULL,
        "encounter_id" uuid NOT NULL,
        "prescription_id" uuid NOT NULL,
        "prescription_item_id" uuid NOT NULL,
        "drug_id" uuid,
        "drug_code" varchar NOT NULL,
        "drug_name" varchar NOT NULL,
        "generic_name" varchar,
        "dose" varchar NOT NULL,
        "frequency" varchar NOT NULL,
        "route" varchar,
        "duration" varchar,
        "start_date" date NOT NULL,
        "expected_end_date" date,
        "actual_end_date" date,
        "status" "active_medication_status_enum" NOT NULL DEFAULT 'active',
        "stopped_by_id" uuid,
        "stopped_reason" text,
        "facility_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_patient_active_medications" PRIMARY KEY ("id")
      )
    `);

    // --- New table: drug_disease_interactions ---
    await queryRunner.query(`
      CREATE TABLE "drug_disease_interactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "drug_classification_id" uuid,
        "drug_id" uuid,
        "atc_code" varchar,
        "icd10_code" varchar NOT NULL,
        "severity" "drug_disease_severity_enum" NOT NULL DEFAULT 'moderate',
        "description" text NOT NULL,
        "clinical_effects" text,
        "recommendation" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_drug_disease_interactions" PRIMARY KEY ("id")
      )
    `);

    // --- New table: triage_assessments ---
    await queryRunner.query(`
      CREATE TABLE "triage_assessments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "queue_id" uuid NOT NULL,
        "encounter_id" uuid,
        "patient_id" uuid NOT NULL,
        "facility_id" uuid NOT NULL,
        "chief_complaint" text NOT NULL,
        "onset" varchar,
        "duration" varchar,
        "severity" varchar,
        "esi_level" "esi_level_enum",
        "acuity_color" "triage_acuity_color_enum",
        "pain_score" smallint,
        "pain_location" varchar,
        "pain_character" varchar,
        "mobility_status" "mobility_status_enum",
        "mental_status" "mental_status_enum",
        "consciousness_level" "consciousness_level_enum",
        "supplemental_oxygen" boolean DEFAULT false,
        "temperature" decimal(4,1),
        "pulse" int,
        "bp_systolic" int,
        "bp_diastolic" int,
        "respiratory_rate" int,
        "oxygen_saturation" decimal(5,2),
        "blood_glucose" decimal(6,2),
        "weight" decimal(5,2),
        "news_score" smallint,
        "mews_score" smallint,
        "disposition" "triage_disposition_enum",
        "nursing_notes" text,
        "assessed_by_id" uuid NOT NULL,
        "reassessment_of" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_triage_assessments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_triage_assessments_reassessment"
          FOREIGN KEY ("reassessment_of") REFERENCES "triage_assessments"("id")
      )
    `);

    // --- New table: medication_reconciliations ---
    await queryRunner.query(`
      CREATE TABLE "medication_reconciliations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "encounter_id" uuid NOT NULL,
        "patient_id" uuid NOT NULL,
        "facility_id" uuid NOT NULL,
        "discharge_summary_id" uuid,
        "status" "reconciliation_status_enum" NOT NULL DEFAULT 'draft',
        "completed_by_id" uuid,
        "completed_at" TIMESTAMP,
        "signed_by_id" uuid,
        "signed_at" TIMESTAMP,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_medication_reconciliations" PRIMARY KEY ("id")
      )
    `);

    // --- New table: medication_reconciliation_items ---
    await queryRunner.query(`
      CREATE TABLE "medication_reconciliation_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "reconciliation_id" uuid NOT NULL,
        "source_type" "reconciliation_source_type_enum" NOT NULL,
        "source_id" uuid,
        "drug_name" varchar NOT NULL,
        "generic_name" varchar,
        "dose" varchar,
        "frequency" varchar,
        "route" varchar,
        "duration" varchar,
        "instructions" text,
        "reconciliation_status" "reconciliation_item_status_enum" NOT NULL DEFAULT 'pending_review',
        "discharge_dose" varchar,
        "discharge_frequency" varchar,
        "discharge_duration" varchar,
        "discharge_instructions" text,
        "reason" text,
        "reviewed_by_id" uuid,
        "reviewed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_medication_reconciliation_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reconciliation_items_reconciliation"
          FOREIGN KEY ("reconciliation_id") REFERENCES "medication_reconciliations"("id")
      )
    `);

    // --- Alter vitals ---
    await queryRunner.query(
      `ALTER TABLE "vitals" ADD COLUMN IF NOT EXISTS "news_score" smallint`,
    );
    await queryRunner.query(
      `ALTER TABLE "vitals" ADD COLUMN IF NOT EXISTS "mews_score" smallint`,
    );
    await queryRunner.query(
      `ALTER TABLE "vitals" ADD COLUMN IF NOT EXISTS "news_components" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "vitals" ADD COLUMN IF NOT EXISTS "consciousness_level" "consciousness_level_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vitals" ADD COLUMN IF NOT EXISTS "supplemental_oxygen" boolean DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "vitals" ADD COLUMN IF NOT EXISTS "clinical_risk_level" "clinical_risk_level_enum"`,
    );

    // --- Alter queues ---
    await queryRunner.query(
      `ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "triage_assessment_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "last_escalated_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "escalation_count" int DEFAULT 0`,
    );

    // --- Alter discharge_summaries ---
    await queryRunner.query(
      `ALTER TABLE "discharge_summaries" ADD COLUMN IF NOT EXISTS "medication_reconciliation_id" uuid`,
    );

    // --- Indexes ---
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_active_med_patient_status"
       ON "patient_active_medications" ("patient_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_active_med_facility_status_end"
       ON "patient_active_medications" ("facility_id", "status", "expected_end_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_active_med_prescription_item"
       ON "patient_active_medications" ("prescription_item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_drug_disease_icd10_active"
       ON "drug_disease_interactions" ("icd10_code", "is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_drug_disease_drug_id"
       ON "drug_disease_interactions" ("drug_id") WHERE "drug_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_drug_disease_classification"
       ON "drug_disease_interactions" ("drug_classification_id")
       WHERE "drug_classification_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_triage_assessment_queue"
       ON "triage_assessments" ("queue_id") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_triage_assessment_encounter"
       ON "triage_assessments" ("encounter_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_triage_assessment_patient"
       ON "triage_assessments" ("patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_vitals_patient_news"
       ON "vitals" ("patient_id", "news_score") WHERE "news_score" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reconciliation_encounter"
       ON "medication_reconciliations" ("encounter_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reconciliation_discharge"
       ON "medication_reconciliations" ("discharge_summary_id")
       WHERE "discharge_summary_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reconciliation_items_reconciliation"
       ON "medication_reconciliation_items" ("reconciliation_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // --- Drop indexes ---
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reconciliation_items_reconciliation"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reconciliation_discharge"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reconciliation_encounter"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vitals_patient_news"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_triage_assessment_patient"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_triage_assessment_encounter"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_triage_assessment_queue"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_drug_disease_classification"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_drug_disease_drug_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_drug_disease_icd10_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_active_med_prescription_item"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_active_med_facility_status_end"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_active_med_patient_status"`);

    // --- Revert discharge_summaries ---
    await queryRunner.query(
      `ALTER TABLE "discharge_summaries" DROP COLUMN IF EXISTS "medication_reconciliation_id"`,
    );

    // --- Revert queues ---
    await queryRunner.query(`ALTER TABLE "queues" DROP COLUMN IF EXISTS "escalation_count"`);
    await queryRunner.query(`ALTER TABLE "queues" DROP COLUMN IF EXISTS "last_escalated_at"`);
    await queryRunner.query(`ALTER TABLE "queues" DROP COLUMN IF EXISTS "triage_assessment_id"`);

    // --- Revert vitals ---
    await queryRunner.query(
      `ALTER TABLE "vitals" DROP COLUMN IF EXISTS "clinical_risk_level"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vitals" DROP COLUMN IF EXISTS "supplemental_oxygen"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vitals" DROP COLUMN IF EXISTS "consciousness_level"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vitals" DROP COLUMN IF EXISTS "news_components"`,
    );
    await queryRunner.query(`ALTER TABLE "vitals" DROP COLUMN IF EXISTS "mews_score"`);
    await queryRunner.query(`ALTER TABLE "vitals" DROP COLUMN IF EXISTS "news_score"`);

    // --- Drop tables ---
    await queryRunner.query(`DROP TABLE IF EXISTS "medication_reconciliation_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "medication_reconciliations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "triage_assessments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drug_disease_interactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_active_medications"`);

    // --- Drop enums ---
    await queryRunner.query(`DROP TYPE IF EXISTS "reconciliation_item_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "reconciliation_source_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "reconciliation_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "mental_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "mobility_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "triage_disposition_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "triage_acuity_color_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "esi_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "clinical_risk_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "consciousness_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "drug_disease_severity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "active_medication_status_enum"`);
  }
}
