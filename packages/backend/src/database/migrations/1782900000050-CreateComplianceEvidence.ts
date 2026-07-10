import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateComplianceEvidence1782900000050 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "compliance_evidence" (
        "id"              uuid            NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"       uuid,
        "framework"       varchar(30)     NOT NULL,
        "control_id"      varchar(50)     NOT NULL,
        "control_name"    varchar(200)    NOT NULL,
        "evidence_type"   varchar(20)     NOT NULL,
        "status"          varchar(20)     NOT NULL DEFAULT 'not_assessed',
        "collected_at"    timestamp       NOT NULL,
        "collected_by"    varchar(100)    NOT NULL,
        "data"            jsonb           NOT NULL DEFAULT '{}',
        "notes"           text,
        "next_review_at"  timestamp,
        "hash"            varchar(64)     NOT NULL,
        "created_at"      timestamp       NOT NULL DEFAULT now(),
        "updated_at"      timestamp       NOT NULL DEFAULT now(),
        "deleted_at"      timestamp,
        CONSTRAINT "PK_compliance_evidence" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_compliance_evidence_tenant_id" ON "compliance_evidence" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_compliance_evidence_framework" ON "compliance_evidence" ("framework")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_compliance_evidence_control_id" ON "compliance_evidence" ("control_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_compliance_evidence_status" ON "compliance_evidence" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_compliance_evidence_collected_at" ON "compliance_evidence" ("collected_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "compliance_evidence"`);
  }
}
