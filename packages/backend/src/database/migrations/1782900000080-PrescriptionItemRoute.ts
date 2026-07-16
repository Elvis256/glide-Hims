import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds prescription_items.route (route of administration).
 *
 * The prescriber has always been asked to choose a route — PO/IV/IM/SC/SL/PR/
 * Topical/Inhaled/Ophthalmic/Otic — but there was no column and no DTO field,
 * so forbidNonWhitelisted silently discarded that selection on every submit and
 * the dispensing label fell back to a hardcoded "Oral" for every item,
 * injectables and eye drops included.
 *
 * Nullable with NO default and NO backfill: rows written before this migration
 * genuinely have no recorded route, and inventing one (e.g. defaulting to
 * oral) would fabricate clinical data. Consumers must render a blank rather
 * than assume.
 *
 * prescription_items is tenant-scoped via its parent prescription and already
 * carries RLS from the Phase 2 rollout; adding a column does not change that.
 */
export class PrescriptionItemRoute1782900000080 implements MigrationInterface {
  name = 'PrescriptionItemRoute1782900000080';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prescription_items"
      ADD COLUMN IF NOT EXISTS "route" character varying(64)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prescription_items"
      DROP COLUMN IF EXISTS "route"
    `);
  }
}
