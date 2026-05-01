import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDoctorFeeProfiles1777800000000 implements MigrationInterface {
  name = 'CreateDoctorFeeProfiles1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "doctor_fee_profiles_employment_type_enum" AS ENUM ('employed','visiting_consultant','locum');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "doctor_fee_profiles_fee_mode_enum" AS ENUM ('flat','percent_of_specialty','split');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_fee_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        "doctor_id" uuid NOT NULL,
        "employment_type" "doctor_fee_profiles_employment_type_enum" NOT NULL DEFAULT 'employed',
        "fee_mode" "doctor_fee_profiles_fee_mode_enum" NOT NULL DEFAULT 'flat',
        "flat_fee" numeric(12,2),
        "percent_of_specialty" numeric(6,2),
        "doctor_share_percent" numeric(5,2),
        "hospital_share_percent" numeric(5,2),
        "working_days" int[],
        "follow_up_window_days" int,
        "follow_up_fee" numeric(12,2),
        "effective_from" date,
        "effective_to" date,
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        CONSTRAINT "PK_doctor_fee_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_doctor_fee_profiles_doctor" UNIQUE ("doctor_id"),
        CONSTRAINT "FK_doctor_fee_profiles_doctor" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_doctor_fee_profiles_tenant" ON "doctor_fee_profiles" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_doctor_fee_profiles_doctor" ON "doctor_fee_profiles" ("doctor_id")`,
    );

    // Track per-doctor revenue split on each charged item (visiting consultants).
    await queryRunner.query(`
      ALTER TABLE "invoice_items"
      ADD COLUMN IF NOT EXISTS "fee_metadata" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoice_items" DROP COLUMN IF EXISTS "fee_metadata"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_fee_profiles"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "doctor_fee_profiles_fee_mode_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "doctor_fee_profiles_employment_type_enum"`);
  }
}
