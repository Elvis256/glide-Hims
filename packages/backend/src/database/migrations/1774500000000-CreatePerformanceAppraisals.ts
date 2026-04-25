import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePerformanceAppraisals1774500000000 implements MigrationInterface {
  name = 'CreatePerformanceAppraisals1774500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "appraisal_status_enum" AS ENUM ('draft', 'self_review', 'manager_review', 'completed', 'acknowledged');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "appraisal_period_enum" AS ENUM ('Q1', 'Q2', 'Q3', 'Q4', 'annual', 'probation');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Create table
    const tableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name = 'performance_appraisals'
    `);
    if (tableExists.length > 0) return;

    await queryRunner.query(`
      CREATE TABLE "performance_appraisals" (
        "id" UUID DEFAULT uuid_generate_v4() NOT NULL,
        "facility_id" UUID NOT NULL,
        "employee_id" UUID NOT NULL,
        "reviewer_id" UUID NOT NULL,
        "appraisal_period" "appraisal_period_enum" NOT NULL,
        "year" INTEGER NOT NULL,
        "status" "appraisal_status_enum" NOT NULL DEFAULT 'draft',
        "job_knowledge_rating" DECIMAL(3,2),
        "work_quality_rating" DECIMAL(3,2),
        "attendance_rating" DECIMAL(3,2),
        "communication_rating" DECIMAL(3,2),
        "teamwork_rating" DECIMAL(3,2),
        "initiative_rating" DECIMAL(3,2),
        "overall_rating" DECIMAL(3,2),
        "employee_comments" TEXT,
        "reviewer_comments" TEXT,
        "strengths" TEXT,
        "areas_for_improvement" TEXT,
        "goals" TEXT,
        "review_date" DATE,
        "acknowledged_date" DATE,
        "tenant_id" UUID,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_performance_appraisals" PRIMARY KEY ("id")
      )
    `);

    // Foreign keys
    await queryRunner.query(`
      ALTER TABLE "performance_appraisals"
        ADD CONSTRAINT "FK_performance_appraisals_facility"
        FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "performance_appraisals"
        ADD CONSTRAINT "FK_performance_appraisals_employee"
        FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "performance_appraisals"
        ADD CONSTRAINT "FK_performance_appraisals_reviewer"
        FOREIGN KEY ("reviewer_id") REFERENCES "employees"("id") ON DELETE CASCADE
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_perf_appraisals_facility" ON "performance_appraisals" ("facility_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_perf_appraisals_employee" ON "performance_appraisals" ("employee_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_perf_appraisals_reviewer" ON "performance_appraisals" ("reviewer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_perf_appraisals_tenant" ON "performance_appraisals" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_perf_appraisals_status" ON "performance_appraisals" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_perf_appraisals_year" ON "performance_appraisals" ("year")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_perf_appraisals_unique" ON "performance_appraisals" ("employee_id", "appraisal_period", "year") WHERE "tenant_id" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "performance_appraisals"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "appraisal_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "appraisal_period_enum"`);
  }
}
