import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSampleReferralTable1775200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "referral_stage_enum" AS ENUM (
          'collected', 'packaged', 'in_transit', 'received_at_hub',
          'processing', 'result_ready', 'result_delivered', 'rejected'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "referral_priority_enum" AS ENUM ('STAT', 'URGENT', 'ROUTINE');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create sample_referrals table
    await queryRunner.query(`
      CREATE TABLE "sample_referrals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "referralNumber" varchar NOT NULL,
        "sampleId" uuid NOT NULL,
        "patientId" uuid NOT NULL,
        "fromFacilityId" uuid NOT NULL,
        "toFacilityId" uuid NOT NULL,
        "stage" "referral_stage_enum" NOT NULL DEFAULT 'collected',
        "testRequested" varchar,
        "clinicalInfo" text,
        "priority" "referral_priority_enum" NOT NULL DEFAULT 'ROUTINE',
        "collectedAt" TIMESTAMPTZ,
        "packagedAt" TIMESTAMPTZ,
        "shippedAt" TIMESTAMPTZ,
        "receivedAtHubAt" TIMESTAMPTZ,
        "processingStartedAt" TIMESTAMPTZ,
        "resultReadyAt" TIMESTAMPTZ,
        "resultDeliveredAt" TIMESTAMPTZ,
        "rejectedAt" TIMESTAMPTZ,
        "rejectionReason" text,
        "transportMethod" varchar,
        "transporterName" varchar,
        "transporterPhone" varchar,
        "temperatureOnArrival" decimal(5,2),
        "sampleConditionOnArrival" varchar,
        "notes" text,
        "collectedById" uuid,
        "receivedById" uuid,
        CONSTRAINT "PK_sample_referrals" PRIMARY KEY ("id")
      )
    `);

    // Add indexes
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_sample_referrals_referral_number" ON "sample_referrals" ("referralNumber")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sample_referrals_tenant_id" ON "sample_referrals" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sample_referrals_stage_created" ON "sample_referrals" ("stage", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sample_referrals_from_facility" ON "sample_referrals" ("fromFacilityId", "stage")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sample_referrals_to_facility" ON "sample_referrals" ("toFacilityId", "stage")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sample_referrals_sample_id" ON "sample_referrals" ("sampleId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sample_referrals_patient_id" ON "sample_referrals" ("patientId")`,
    );

    // Add foreign keys
    await queryRunner.query(`
      ALTER TABLE "sample_referrals"
      ADD CONSTRAINT "FK_sample_referrals_sample"
      FOREIGN KEY ("sampleId") REFERENCES "lab_samples"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "sample_referrals"
      ADD CONSTRAINT "FK_sample_referrals_patient"
      FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "sample_referrals"
      ADD CONSTRAINT "FK_sample_referrals_from_facility"
      FOREIGN KEY ("fromFacilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "sample_referrals"
      ADD CONSTRAINT "FK_sample_referrals_to_facility"
      FOREIGN KEY ("toFacilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sample_referrals"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "referral_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "referral_stage_enum"`);
  }
}
