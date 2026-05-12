import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-instance update reports for rollouts.
 * Lets tenant agents post {status, fromVersion, toVersion, error?} for a
 * given rollout so the platform can compute real success/failure counters
 * and let the rollout-scheduler auto-rollback or auto-advance.
 */
export class DeploymentReports1782900000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE deployment_reports_status_enum AS ENUM (
          'started', 'in_progress', 'success', 'failed', 'rolled_back'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS deployment_reports (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        rollout_id uuid NOT NULL,
        license_id uuid NOT NULL,
        tenant_id uuid NULL,
        hardware_id varchar(255) NULL,
        from_version varchar(50) NULL,
        to_version varchar(50) NULL,
        status deployment_reports_status_enum NOT NULL DEFAULT 'started',
        error_message text NULL,
        metadata jsonb NULL,
        ip_address varchar(45) NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT fk_deployment_reports_rollout FOREIGN KEY (rollout_id)
          REFERENCES update_rollouts(id) ON DELETE CASCADE,
        CONSTRAINT fk_deployment_reports_license FOREIGN KEY (license_id)
          REFERENCES licenses(id) ON DELETE CASCADE,
        CONSTRAINT uq_deployment_report_rollout_license UNIQUE (rollout_id, license_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_deployment_reports_rollout_status
        ON deployment_reports (rollout_id, status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_deployment_reports_license
        ON deployment_reports (license_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS deployment_reports`);
    await queryRunner.query(`DROP TYPE IF EXISTS deployment_reports_status_enum`);
  }
}
