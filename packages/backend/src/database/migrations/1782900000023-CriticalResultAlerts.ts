import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Critical-result acknowledgement loop.
 *
 * Creates `critical_result_alerts` — one row per Lab/Radiology finding
 * flagged abnormal/critical. Tracks pending → acknowledged → escalated
 * lifecycle with SLA deadline + audit trail (who flagged, who acked,
 * who escalation went to, justification + action taken).
 *
 * Used to satisfy patient-safety standards requiring closed-loop
 * communication of critical results within a defined SLA window.
 */
export class CriticalResultAlerts1782900000023 implements MigrationInterface {
  name = 'CriticalResultAlerts1782900000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "critical_result_alerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "resource_type" varchar(24) NOT NULL,
        "resource_id" uuid NOT NULL,
        "order_id" uuid,
        "patient_id" uuid NOT NULL,
        "encounter_id" uuid,
        "severity" varchar(24) NOT NULL,
        "summary" text,
        "flagged_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "flagged_by_id" uuid,
        "assigned_to_id" uuid,
        "status" varchar(24) NOT NULL DEFAULT 'pending',
        "sla_deadline" TIMESTAMPTZ NOT NULL,
        "acknowledged_at" TIMESTAMPTZ,
        "acknowledged_by_id" uuid,
        "acknowledgement_note" text,
        "action_taken" text,
        "follow_up_order_id" uuid,
        "escalated_at" TIMESTAMPTZ,
        "escalated_to_id" uuid,
        "escalation_level" int NOT NULL DEFAULT 0,
        "last_notified_at" TIMESTAMPTZ,
        CONSTRAINT "PK_critical_result_alerts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cra_patient" FOREIGN KEY ("patient_id")
          REFERENCES "patients"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cra_tenant_resource"
         ON "critical_result_alerts" ("tenant_id","resource_type","resource_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cra_tenant_status"
         ON "critical_result_alerts" ("tenant_id","status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cra_tenant_assigned_status"
         ON "critical_result_alerts" ("tenant_id","assigned_to_id","status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cra_tenant_patient"
         ON "critical_result_alerts" ("tenant_id","patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cra_sla_deadline"
         ON "critical_result_alerts" ("status","sla_deadline")
         WHERE status = 'pending'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cra_sla_deadline"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cra_tenant_patient"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cra_tenant_assigned_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cra_tenant_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_cra_tenant_resource"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "critical_result_alerts"`);
  }
}
