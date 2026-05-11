import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfills `settings.facilityMode` on existing tenants that were created
 * before the setup wizard reliably populated this field. Without it, the
 * System Admin → Organizations table renders "—" in the Mode column.
 *
 * Strategy: set facilityMode to 'hospital' (the historical default used by
 * SetupService) for any tenant whose settings JSON is missing the key.
 * Existing settings keys are preserved.
 */
export class BackfillTenantFacilityMode1782800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // settings IS NULL  -> initialize with { facilityMode: 'hospital' }
    await queryRunner.query(`
      UPDATE "tenants"
      SET "settings" = jsonb_build_object('facilityMode', 'hospital')
      WHERE "settings" IS NULL
    `);

    // settings exists but has no facilityMode key -> merge it in
    await queryRunner.query(`
      UPDATE "tenants"
      SET "settings" = "settings" || jsonb_build_object('facilityMode', 'hospital')
      WHERE "settings" IS NOT NULL
        AND NOT ("settings" ? 'facilityMode')
    `);

    // settings has facilityMode but it's null/empty string -> set to 'hospital'
    await queryRunner.query(`
      UPDATE "tenants"
      SET "settings" = "settings" || jsonb_build_object('facilityMode', 'hospital')
      WHERE "settings" IS NOT NULL
        AND ("settings" ? 'facilityMode')
        AND (
          "settings"->>'facilityMode' IS NULL
          OR "settings"->>'facilityMode' = ''
        )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive backfill; nothing to revert. Removing the key on
    // downgrade could mask manual configuration, so we leave it in place.
  }
}
