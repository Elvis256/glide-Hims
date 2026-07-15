import { MigrationInterface, QueryRunner } from 'typeorm';

export class NursingEntities1782900000079 implements MigrationInterface {
  name = 'NursingEntities1782900000079';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenantMatch = `
      current_setting('app.tenant', true) = 'system'
      OR tenant_id = (SELECT NULLIF(current_setting('app.tenant', true), '')::uuid)
    `;

    // 1. intake_output_entries
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "intake_output_entries" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "admission_id" uuid NOT NULL,
        "timestamp" timestamptz NOT NULL,
        "type" varchar(10) NOT NULL,
        "category" varchar(100) NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "unit" varchar(20) NOT NULL DEFAULT 'ml',
        "characteristics" jsonb,
        "notes" text,
        "recorded_by_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "FK_io_admission" FOREIGN KEY ("admission_id")
          REFERENCES "admissions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_io_recorded_by" FOREIGN KEY ("recorded_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_io_admission_ts" ON "intake_output_entries" ("admission_id", "timestamp")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_io_tenant" ON "intake_output_entries" ("tenant_id")`);
    await queryRunner.query(`ALTER TABLE "intake_output_entries" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "intake_output_entries"`);
    await queryRunner.query(`CREATE POLICY "tenant_isolation" ON "intake_output_entries" USING (${tenantMatch}) WITH CHECK (${tenantMatch})`);

    // 2. blood_glucose_readings
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "blood_glucose_readings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "admission_id" uuid NOT NULL,
        "value" numeric(6,2) NOT NULL,
        "timing" varchar(30) NOT NULL,
        "insulin_given" jsonb,
        "notes" text,
        "recorded_by_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "FK_glucose_admission" FOREIGN KEY ("admission_id")
          REFERENCES "admissions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_glucose_recorded_by" FOREIGN KEY ("recorded_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_glucose_admission" ON "blood_glucose_readings" ("admission_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_glucose_tenant" ON "blood_glucose_readings" ("tenant_id")`);
    await queryRunner.query(`ALTER TABLE "blood_glucose_readings" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "blood_glucose_readings"`);
    await queryRunner.query(`CREATE POLICY "tenant_isolation" ON "blood_glucose_readings" USING (${tenantMatch}) WITH CHECK (${tenantMatch})`);

    // 3. neuro_observations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "neuro_observations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "admission_id" uuid NOT NULL,
        "avpu" varchar(10) NOT NULL,
        "gcs_eye" smallint,
        "gcs_verbal" smallint,
        "gcs_motor" smallint,
        "gcs_total" smallint,
        "pupil_left_size" varchar(30),
        "pupil_left_reaction" varchar(30),
        "pupil_right_size" varchar(30),
        "pupil_right_reaction" varchar(30),
        "limb_left_arm" varchar(30),
        "limb_right_arm" varchar(30),
        "limb_left_leg" varchar(30),
        "limb_right_leg" varchar(30),
        "notes" text,
        "assessed_by_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "FK_neuro_admission" FOREIGN KEY ("admission_id")
          REFERENCES "admissions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_neuro_assessed_by" FOREIGN KEY ("assessed_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_neuro_admission" ON "neuro_observations" ("admission_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_neuro_tenant" ON "neuro_observations" ("tenant_id")`);
    await queryRunner.query(`ALTER TABLE "neuro_observations" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "neuro_observations"`);
    await queryRunner.query(`CREATE POLICY "tenant_isolation" ON "neuro_observations" USING (${tenantMatch}) WITH CHECK (${tenantMatch})`);

    // 4. incident_reports
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "incident_reports" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "report_number" varchar(50) NOT NULL,
        "patient_id" uuid,
        "type" varchar(50) NOT NULL,
        "severity" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'draft',
        "description" text NOT NULL,
        "location" varchar(200),
        "incident_date" timestamptz NOT NULL,
        "immediate_action" text,
        "root_cause" text,
        "corrective_action" text,
        "witnesses" jsonb,
        "reported_by_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "FK_incident_patient" FOREIGN KEY ("patient_id")
          REFERENCES "patients"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_incident_reported_by" FOREIGN KEY ("reported_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_incident_tenant_number" UNIQUE ("tenant_id", "report_number")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_incident_tenant" ON "incident_reports" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_incident_status" ON "incident_reports" ("status")`);
    await queryRunner.query(`ALTER TABLE "incident_reports" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "incident_reports"`);
    await queryRunner.query(`CREATE POLICY "tenant_isolation" ON "incident_reports" USING (${tenantMatch}) WITH CHECK (${tenantMatch})`);

    // 5. care_plans
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "care_plans" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "admission_id" uuid NOT NULL,
        "diagnosis" varchar(500) NOT NULL,
        "priority" varchar(20) NOT NULL DEFAULT 'medium',
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "notes" text,
        "created_by_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "FK_careplan_admission" FOREIGN KEY ("admission_id")
          REFERENCES "admissions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_careplan_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_careplan_admission" ON "care_plans" ("admission_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_careplan_tenant" ON "care_plans" ("tenant_id")`);
    await queryRunner.query(`ALTER TABLE "care_plans" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "care_plans"`);
    await queryRunner.query(`CREATE POLICY "tenant_isolation" ON "care_plans" USING (${tenantMatch}) WITH CHECK (${tenantMatch})`);

    // 6. care_plan_goals
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "care_plan_goals" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "care_plan_id" uuid NOT NULL,
        "description" text NOT NULL,
        "target_date" date,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "FK_goal_careplan" FOREIGN KEY ("care_plan_id")
          REFERENCES "care_plans"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_goal_careplan" ON "care_plan_goals" ("care_plan_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_goal_tenant" ON "care_plan_goals" ("tenant_id")`);
    await queryRunner.query(`ALTER TABLE "care_plan_goals" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "care_plan_goals"`);
    await queryRunner.query(`CREATE POLICY "tenant_isolation" ON "care_plan_goals" USING (${tenantMatch}) WITH CHECK (${tenantMatch})`);

    // 7. care_plan_interventions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "care_plan_interventions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "care_plan_id" uuid NOT NULL,
        "goal_id" uuid,
        "description" text NOT NULL,
        "frequency" varchar(100),
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "FK_intervention_careplan" FOREIGN KEY ("care_plan_id")
          REFERENCES "care_plans"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_intervention_goal" FOREIGN KEY ("goal_id")
          REFERENCES "care_plan_goals"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_intervention_careplan" ON "care_plan_interventions" ("care_plan_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_intervention_tenant" ON "care_plan_interventions" ("tenant_id")`);
    await queryRunner.query(`ALTER TABLE "care_plan_interventions" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "care_plan_interventions"`);
    await queryRunner.query(`CREATE POLICY "tenant_isolation" ON "care_plan_interventions" USING (${tenantMatch}) WITH CHECK (${tenantMatch})`);

    // 8. wound_assessments
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wound_assessments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "admission_id" uuid NOT NULL,
        "location" varchar(100) NOT NULL,
        "wound_type" varchar(50) NOT NULL,
        "stage" varchar(20),
        "length" numeric(6,2),
        "width" numeric(6,2),
        "depth" numeric(6,2),
        "wound_bed" jsonb,
        "exudate" jsonb,
        "periwound_skin" varchar(200),
        "treatment" text,
        "notes" text,
        "assessed_by_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "FK_wound_admission" FOREIGN KEY ("admission_id")
          REFERENCES "admissions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_wound_assessed_by" FOREIGN KEY ("assessed_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_wound_admission" ON "wound_assessments" ("admission_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_wound_tenant" ON "wound_assessments" ("tenant_id")`);
    await queryRunner.query(`ALTER TABLE "wound_assessments" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "wound_assessments"`);
    await queryRunner.query(`CREATE POLICY "tenant_isolation" ON "wound_assessments" USING (${tenantMatch}) WITH CHECK (${tenantMatch})`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "care_plan_interventions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "care_plan_goals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "care_plans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wound_assessments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "incident_reports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "neuro_observations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blood_glucose_readings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "intake_output_entries"`);
  }
}
