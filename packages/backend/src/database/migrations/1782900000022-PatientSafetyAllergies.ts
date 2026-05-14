import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Patient safety hardening — Phase 1.
 *
 * 1. Creates `patient_allergies` (FHIR AllergyIntolerance-aligned) replacing
 *    the unstructured `patient.allergies: jsonb string[]`.
 *
 * 2. Creates `prescription_safety_overrides` for prescribe-time DDI / allergy
 *    overrides (sibling of pharmacy-side `drug_interaction_overrides`).
 *
 * 3. Backfills existing `patient.allergies` strings into the new table
 *    (one row per non-empty string, status='active', source='imported').
 *    The legacy column is left in place to avoid breaking any code path that
 *    still reads it; subsequent code reads from `patient_allergies` and
 *    treats the legacy column as advisory only.
 */
export class PatientSafetyAllergies1782900000022 implements MigrationInterface {
  name = 'PatientSafetyAllergies1782900000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── patient_allergies ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_allergies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "patient_id" uuid NOT NULL,
        "allergen" varchar(255) NOT NULL,
        "allergen_normalized" varchar(255) NOT NULL,
        "allergen_code" varchar(100),
        "code_system" varchar(50),
        "type" varchar(20) NOT NULL DEFAULT 'allergy',
        "category" varchar(20) NOT NULL DEFAULT 'medication',
        "criticality" varchar(20) NOT NULL DEFAULT 'unable-to-assess',
        "severity" varchar(20),
        "reaction" text,
        "status" varchar(30) NOT NULL DEFAULT 'active',
        "verification" varchar(30) NOT NULL DEFAULT 'unconfirmed',
        "source" varchar(30) NOT NULL DEFAULT 'patient-reported',
        "onset_date" date,
        "recorded_by_id" uuid,
        "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "last_reaction_at" TIMESTAMPTZ,
        "notes" text,
        CONSTRAINT "PK_patient_allergies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_patient_allergies_patient" FOREIGN KEY ("patient_id")
          REFERENCES "patients"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_allergies_tenant" ON "patient_allergies" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_allergies_tenant_patient" ON "patient_allergies" ("tenant_id","patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_allergies_tenant_patient_norm" ON "patient_allergies" ("tenant_id","patient_id","allergen_normalized")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_allergies_tenant_status" ON "patient_allergies" ("tenant_id","status")`,
    );

    // ─── prescription_safety_overrides ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prescription_safety_overrides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "prescription_id" uuid NOT NULL,
        "patient_id" uuid,
        "encounter_id" uuid,
        "alerts" jsonb NOT NULL,
        "reason" text NOT NULL,
        "overridden_by_id" uuid NOT NULL,
        "overridden_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "cosigned" boolean NOT NULL DEFAULT false,
        "cosigner_id" uuid,
        CONSTRAINT "PK_prescription_safety_overrides" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_prx_safety_ovr_tenant" ON "prescription_safety_overrides" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_prx_safety_ovr_tenant_prescription" ON "prescription_safety_overrides" ("tenant_id","prescription_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_prx_safety_ovr_tenant_patient" ON "prescription_safety_overrides" ("tenant_id","patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_prx_safety_ovr_tenant_user" ON "prescription_safety_overrides" ("tenant_id","overridden_by_id")`,
    );

    // ─── Backfill from patient.allergies ────────────────────────────────────
    // Inserts one row per non-empty allergen string. Skips patients that
    // already have rows so the migration is safely re-runnable.
    await queryRunner.query(`
      INSERT INTO "patient_allergies"
        ("tenant_id","patient_id","allergen","allergen_normalized","status","source","verification","recorded_at")
      SELECT
        p.tenant_id,
        p.id AS patient_id,
        TRIM(BOTH FROM elem.value) AS allergen,
        LOWER(TRIM(BOTH FROM elem.value)) AS allergen_normalized,
        'active',
        'imported',
        'unconfirmed',
        now()
      FROM patients p
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(p.allergies) = 'array' THEN p.allergies
          ELSE '[]'::jsonb
        END
      ) AS elem(value)
      WHERE p.allergies IS NOT NULL
        AND jsonb_typeof(p.allergies) = 'array'
        AND jsonb_array_length(p.allergies) > 0
        AND TRIM(BOTH FROM elem.value) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM patient_allergies pa
          WHERE pa.patient_id = p.id
            AND pa.allergen_normalized = LOWER(TRIM(BOTH FROM elem.value))
            AND pa.deleted_at IS NULL
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "prescription_safety_overrides"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_allergies"`);
  }
}
