import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vitals canonicalization.
 *
 * Today vital signs live in 4+ shapes: the canonical `vitals` table
 * (encounter-scoped), `nursing_notes.vitals` JSONB blob, `emergency_cases`
 * triage columns, and `discharge_summaries.vital_signs_at_discharge` JSONB.
 * Patient-safety queries (timeline, trend) only see the OPD slice today.
 *
 * This migration evolves `vitals` into a single source of truth:
 *   - `encounter_id` becomes nullable (nursing rounds + emergency triage
 *     may not yet have a billed encounter).
 *   - `patient_id` is denormalized so cross-context queries skip the join.
 *   - `source` + `source_ref_id` describe where the row originated so the
 *     UI can render context (TRIAGE / WARD ROUND / DISCHARGE / OPD).
 * Mirror writes from EmergencyService.triageCase, IpdService.createNursingNote,
 * and DischargeService.create populate these columns.
 */
export class VitalsCanonicalize1782900000024 implements MigrationInterface {
  name = 'VitalsCanonicalize1782900000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "vitals" ALTER COLUMN "encounter_id" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "vitals" ADD COLUMN IF NOT EXISTS "patient_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "vitals" ADD COLUMN IF NOT EXISTS "source" varchar(32) NOT NULL DEFAULT 'OPD_ENCOUNTER'`,
    );
    await queryRunner.query(`ALTER TABLE "vitals" ADD COLUMN IF NOT EXISTS "source_ref_id" uuid`);

    // Backfill patient_id for legacy rows from their encounter.
    await queryRunner.query(`
      UPDATE "vitals" v
      SET "patient_id" = e."patient_id"
      FROM "encounters" e
      WHERE v."encounter_id" = e."id" AND v."patient_id" IS NULL
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_vitals_patient_recorded" ON "vitals" ("patient_id", "recorded_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_vitals_source_ref" ON "vitals" ("source", "source_ref_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vitals_source_ref"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vitals_patient_recorded"`);
    await queryRunner.query(`ALTER TABLE "vitals" DROP COLUMN IF EXISTS "source_ref_id"`);
    await queryRunner.query(`ALTER TABLE "vitals" DROP COLUMN IF EXISTS "source"`);
    await queryRunner.query(`ALTER TABLE "vitals" DROP COLUMN IF EXISTS "patient_id"`);
    // Leaving encounter_id nullable — re-tightening would fail if mirrored
    // emergency/nursing/discharge rows exist without an encounter.
  }
}
