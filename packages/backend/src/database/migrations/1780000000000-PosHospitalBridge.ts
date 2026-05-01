import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase C — Hospital Bridge
 * Additive-only migration. All new columns nullable or with defaults.
 * No destructive changes.
 */
export class PosHospitalBridge1780000000000 implements MigrationInterface {
  name = 'PosHospitalBridge1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── C2: prescription_item_id on pharmacy_sale_items ───────────────────────
    await queryRunner.query(`
      ALTER TABLE pharmacy_sale_items
        ADD COLUMN IF NOT EXISTS prescription_item_id UUID
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_psi_prescription_item_id
        ON pharmacy_sale_items(prescription_item_id)
        WHERE prescription_item_id IS NOT NULL
    `);

    // ── C1: patient_id on pharmacy_sales (likely exists; guard with IF NOT EXISTS)
    await queryRunner.query(`
      ALTER TABLE pharmacy_sales
        ADD COLUMN IF NOT EXISTS patient_id UUID
    `);

    // ── C3: interactions jsonb on drug_classifications ────────────────────────
    await queryRunner.query(`
      ALTER TABLE drug_classifications
        ADD COLUMN IF NOT EXISTS interactions JSONB NOT NULL DEFAULT '[]'
    `);

    // ── C3: drug_interaction_overrides table ──────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS drug_interaction_overrides (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at          TIMESTAMPTZ,
        sale_id             UUID,
        patient_id          UUID,
        warnings            JSONB       NOT NULL DEFAULT '[]',
        reason              TEXT        NOT NULL,
        overridden_by_id    UUID        NOT NULL,
        overridden_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        manager_approver_id UUID
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_dio_tenant_sale
        ON drug_interaction_overrides(tenant_id, sale_id)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_dio_tenant_patient
        ON drug_interaction_overrides(tenant_id, patient_id)
        WHERE deleted_at IS NULL
    `);

    // ── C3: Seed drug_interactions table with common high-risk pairs ──────────
    // Uses drug_classifications to look up item IDs by generic name.
    // Fully idempotent — skips if drug_classifications table is empty or pair already exists.
    await queryRunner.query(`
      DO $$
      DECLARE
        v_warfarin      UUID;
        v_ibuprofen     UUID;
        v_aspirin       UUID;
        v_lisinopril    UUID;
        v_spironolactone UUID;
        v_fluoxetine    UUID;
        v_phenelzine    UUID;
        v_metformin     UUID;
        v_alcohol_note  TEXT := 'Note: seeded by Phase C migration';
      BEGIN
        -- Only seed if there are drug classifications present
        IF (SELECT COUNT(*) FROM drug_classifications) = 0 THEN
          RETURN;
        END IF;

        -- Look up item IDs by generic_name (case-insensitive, take first match)
        SELECT dc.item_id INTO v_warfarin      FROM drug_classifications dc WHERE LOWER(dc.generic_name) LIKE '%warfarin%'      LIMIT 1;
        SELECT dc.item_id INTO v_ibuprofen     FROM drug_classifications dc WHERE LOWER(dc.generic_name) LIKE '%ibuprofen%'     LIMIT 1;
        SELECT dc.item_id INTO v_aspirin       FROM drug_classifications dc WHERE LOWER(dc.generic_name) LIKE '%aspirin%'       LIMIT 1;
        SELECT dc.item_id INTO v_lisinopril    FROM drug_classifications dc WHERE LOWER(dc.generic_name) LIKE '%lisinopril%'    LIMIT 1;
        SELECT dc.item_id INTO v_spironolactone FROM drug_classifications dc WHERE LOWER(dc.generic_name) LIKE '%spironolactone%' LIMIT 1;
        SELECT dc.item_id INTO v_fluoxetine    FROM drug_classifications dc WHERE LOWER(dc.generic_name) LIKE '%fluoxetine%'    LIMIT 1;
        SELECT dc.item_id INTO v_phenelzine    FROM drug_classifications dc WHERE LOWER(dc.generic_name) LIKE '%phenelzine%' OR LOWER(dc.generic_name) LIKE '%maoi%' LIMIT 1;

        -- Warfarin + Ibuprofen (Severe: bleeding risk)
        IF v_warfarin IS NOT NULL AND v_ibuprofen IS NOT NULL THEN
          INSERT INTO drug_interactions(id, drug_a_id, drug_b_id, severity, description, mechanism, management, is_active, created_at, updated_at)
          VALUES (gen_random_uuid(), v_warfarin, v_ibuprofen, 'major',
            'Warfarin + NSAID: increased bleeding risk',
            'NSAIDs inhibit platelet aggregation and may displace warfarin from protein binding, increasing anticoagulant effect and GI bleeding risk.',
            'Avoid combination. If necessary, use lowest NSAID dose for shortest duration with INR monitoring and GI protection.',
            true, now(), now())
          ON CONFLICT (drug_a_id, drug_b_id) WHERE deleted_at IS NULL DO NOTHING;
        END IF;

        -- Warfarin + Aspirin (Severe: bleeding risk)
        IF v_warfarin IS NOT NULL AND v_aspirin IS NOT NULL THEN
          INSERT INTO drug_interactions(id, drug_a_id, drug_b_id, severity, description, mechanism, management, is_active, created_at, updated_at)
          VALUES (gen_random_uuid(), v_warfarin, v_aspirin, 'major',
            'Warfarin + Aspirin: significantly increased bleeding risk',
            'Aspirin inhibits platelet function and can increase free warfarin via protein displacement.',
            'Avoid unless benefit clearly outweighs risk (e.g. mechanical heart valve). Monitor INR closely.',
            true, now(), now())
          ON CONFLICT (drug_a_id, drug_b_id) WHERE deleted_at IS NULL DO NOTHING;
        END IF;

        -- Lisinopril (ACE-I) + Spironolactone (K-sparing): hyperkalemia
        IF v_lisinopril IS NOT NULL AND v_spironolactone IS NOT NULL THEN
          INSERT INTO drug_interactions(id, drug_a_id, drug_b_id, severity, description, mechanism, management, is_active, created_at, updated_at)
          VALUES (gen_random_uuid(), v_lisinopril, v_spironolactone, 'major',
            'ACE-inhibitor + Potassium-sparing diuretic: hyperkalemia risk',
            'Both agents reduce aldosterone effect, leading to potassium retention. Combined use markedly increases risk of life-threatening hyperkalemia.',
            'Monitor serum potassium and renal function closely. Avoid in patients with renal impairment.',
            true, now(), now())
          ON CONFLICT (drug_a_id, drug_b_id) WHERE deleted_at IS NULL DO NOTHING;
        END IF;

        -- SSRI + MAOI: serotonin syndrome
        IF v_fluoxetine IS NOT NULL AND v_phenelzine IS NOT NULL THEN
          INSERT INTO drug_interactions(id, drug_a_id, drug_b_id, severity, description, mechanism, management, is_active, created_at, updated_at)
          VALUES (gen_random_uuid(), v_fluoxetine, v_phenelzine, 'contraindicated',
            'SSRI + MAOI: serotonin syndrome (potentially fatal)',
            'Concurrent serotonergic agents cause dangerous serotonin accumulation leading to hyperthermia, rigidity, and cardiovascular collapse.',
            'CONTRAINDICATED. Allow ≥14 days washout after stopping MAOI before starting SSRI (≥5 weeks for fluoxetine due to long half-life).',
            true, now(), now())
          ON CONFLICT (drug_a_id, drug_b_id) WHERE deleted_at IS NULL DO NOTHING;
        END IF;

      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS drug_interaction_overrides`);
    await queryRunner.query(`ALTER TABLE drug_classifications DROP COLUMN IF EXISTS interactions`);
    await queryRunner.query(`ALTER TABLE pharmacy_sale_items DROP COLUMN IF EXISTS prescription_item_id`);
  }
}
