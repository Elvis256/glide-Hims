import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reconcile the deployment/replication tables with their entities.
 *
 * These eight tables are created by migrations that spell their columns in
 * snake_case, but the entities declare camelCase properties with no `name:`
 * mapping — so TypeORM looks for "createdAt", not "created_at". Every existing
 * deployment has the camelCase spelling because the tables were built by
 * `synchronize` before the migrations existed, and the migrations then found
 * the table already present and did nothing. The divergence only became
 * visible once the chain could build a database from empty.
 *
 * Renames rather than re-adds, so no data is lost, and each step is guarded:
 * a rename fires only when the snake_case column is present and the camelCase
 * one is not, which makes this a no-op everywhere the tables already look
 * right. `entity`, `operation`, `changesetCount`, `metadata` and the two
 * stock_transfers store columns have no snake_case counterpart — they were
 * never created by any migration at all — so those are added.
 */
export class ReconcileDeploymentColumnNames1782900000086 implements MigrationInterface {
  name = 'ReconcileDeploymentColumnNames1782900000086';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- change_sets ---
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='batch_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='batchId') THEN
          ALTER TABLE "change_sets" RENAME COLUMN "batch_id" TO "batchId";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='change_count')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='changeCount') THEN
          ALTER TABLE "change_sets" RENAME COLUMN "change_count" TO "changeCount";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='success_count')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='successCount') THEN
          ALTER TABLE "change_sets" RENAME COLUMN "success_count" TO "successCount";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='failure_count')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='failureCount') THEN
          ALTER TABLE "change_sets" RENAME COLUMN "failure_count" TO "failureCount";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='failure_reason')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='failureReason') THEN
          ALTER TABLE "change_sets" RENAME COLUMN "failure_reason" TO "failureReason";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='can_rollback')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='canRollback') THEN
          ALTER TABLE "change_sets" RENAME COLUMN "can_rollback" TO "canRollback";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='applied_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='appliedAt') THEN
          ALTER TABLE "change_sets" RENAME COLUMN "applied_at" TO "appliedAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='rolled_back_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='rolledBackAt') THEN
          ALTER TABLE "change_sets" RENAME COLUMN "rolled_back_at" TO "rolledBackAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='applied_by')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='appliedBy') THEN
          ALTER TABLE "change_sets" RENAME COLUMN "applied_by" TO "appliedBy";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='rolled_back_by')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='rolledBackBy') THEN
          ALTER TABLE "change_sets" RENAME COLUMN "rolled_back_by" TO "rolledBackBy";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='created_by')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='createdBy') THEN
          ALTER TABLE "change_sets" RENAME COLUMN "created_by" TO "createdBy";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='source_system')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='sourceSystem') THEN
          ALTER TABLE "change_sets" RENAME COLUMN "source_system" TO "sourceSystem";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='created_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='createdAt') THEN
          ALTER TABLE "change_sets" RENAME COLUMN "created_at" TO "createdAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='updated_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='change_sets' AND column_name='updatedAt') THEN
          ALTER TABLE "change_sets" RENAME COLUMN "updated_at" TO "updatedAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "change_sets" ADD COLUMN IF NOT EXISTS "entity" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "change_sets" ADD COLUMN IF NOT EXISTS "operation" character varying(50)`,
    );
    // --- deployment_alerts ---
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='alert_type')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='alertType') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "alert_type" TO "alertType";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='occurrence_count')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='occurrenceCount') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "occurrence_count" TO "occurrenceCount";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='acknowledged_count')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='acknowledgedCount') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "acknowledged_count" TO "acknowledgedCount";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='trigger_condition')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='triggerCondition') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "trigger_condition" TO "triggerCondition";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='actual_value')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='actualValue') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "actual_value" TO "actualValue";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='notifications_sent')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='notificationsSent') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "notifications_sent" TO "notificationsSent";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='escalation_reason')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='escalationReason') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "escalation_reason" TO "escalationReason";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='escalated_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='escalatedAt') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "escalated_at" TO "escalatedAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='acknowledged_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='acknowledgedAt') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "acknowledged_at" TO "acknowledgedAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='acknowledged_by')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='acknowledgedBy') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "acknowledged_by" TO "acknowledgedBy";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='acknowledgment_notes')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='acknowledgmentNotes') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "acknowledgment_notes" TO "acknowledgmentNotes";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='resolved_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='resolvedAt') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "resolved_at" TO "resolvedAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='resolved_by')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='resolvedBy') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "resolved_by" TO "resolvedBy";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='resolution_notes')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='resolutionNotes') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "resolution_notes" TO "resolutionNotes";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='created_by')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='createdBy') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "created_by" TO "createdBy";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='created_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='createdAt') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "created_at" TO "createdAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='updated_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_alerts' AND column_name='updatedAt') THEN
          ALTER TABLE "deployment_alerts" RENAME COLUMN "updated_at" TO "updatedAt";
        END IF;
      END $$;
    `);
    // --- deployment_health ---
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='uptime_percentage')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='uptimePercentage') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "uptime_percentage" TO "uptimePercentage";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='cpu_usage_percent')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='cpuUsagePercent') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "cpu_usage_percent" TO "cpuUsagePercent";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='memory_usage_percent')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='memoryUsagePercent') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "memory_usage_percent" TO "memoryUsagePercent";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='disk_usage_percent')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='diskUsagePercent') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "disk_usage_percent" TO "diskUsagePercent";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='error_rate_percent')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='errorRatePercent') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "error_rate_percent" TO "errorRatePercent";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='response_time_ms')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='responseTimeMs') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "response_time_ms" TO "responseTimeMs";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='request_count_per_minute')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='requestCountPerMinute') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "request_count_per_minute" TO "requestCountPerMinute";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='active_connections_count')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='activeConnectionsCount') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "active_connections_count" TO "activeConnectionsCount";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='queued_requests_count')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='queuedRequestsCount') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "queued_requests_count" TO "queuedRequestsCount";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='total_errors_last24h')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='totalErrorsLast24h') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "total_errors_last24h" TO "totalErrorsLast24h";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='sync_delay_seconds')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='syncDelaySeconds') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "sync_delay_seconds" TO "syncDelaySeconds";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='last_error_message')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='lastErrorMessage') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "last_error_message" TO "lastErrorMessage";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='last_error_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='lastErrorAt') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "last_error_at" TO "lastErrorAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='last_sync_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='lastSyncAt') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "last_sync_at" TO "lastSyncAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='last_health_check_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='lastHealthCheckAt') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "last_health_check_at" TO "lastHealthCheckAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='service_metrics')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='serviceMetrics') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "service_metrics" TO "serviceMetrics";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='created_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='createdAt') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "created_at" TO "createdAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='updated_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='deployment_health' AND column_name='updatedAt') THEN
          ALTER TABLE "deployment_health" RENAME COLUMN "updated_at" TO "updatedAt";
        END IF;
      END $$;
    `);
    // --- release_candidates ---
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='release_notes')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='releaseNotes') THEN
          ALTER TABLE "release_candidates" RENAME COLUMN "release_notes" TO "releaseNotes";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='testing_notes')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='testingNotes') THEN
          ALTER TABLE "release_candidates" RENAME COLUMN "testing_notes" TO "testingNotes";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='testers_count')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='testersCount') THEN
          ALTER TABLE "release_candidates" RENAME COLUMN "testers_count" TO "testersCount";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='deployment_count_risk')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='deploymentCountRisk') THEN
          ALTER TABLE "release_candidates" RENAME COLUMN "deployment_count_risk" TO "deploymentCountRisk";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='known_issues')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='knownIssues') THEN
          ALTER TABLE "release_candidates" RENAME COLUMN "known_issues" TO "knownIssues";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='performance_metrics')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='performanceMetrics') THEN
          ALTER TABLE "release_candidates" RENAME COLUMN "performance_metrics" TO "performanceMetrics";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='approved_for_rollout')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='approvedForRollout') THEN
          ALTER TABLE "release_candidates" RENAME COLUMN "approved_for_rollout" TO "approvedForRollout";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='approved_by')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='approvedBy') THEN
          ALTER TABLE "release_candidates" RENAME COLUMN "approved_by" TO "approvedBy";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='created_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='createdAt') THEN
          ALTER TABLE "release_candidates" RENAME COLUMN "created_at" TO "createdAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='updated_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='updatedAt') THEN
          ALTER TABLE "release_candidates" RENAME COLUMN "updated_at" TO "updatedAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='approved_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='release_candidates' AND column_name='approvedAt') THEN
          ALTER TABLE "release_candidates" RENAME COLUMN "approved_at" TO "approvedAt";
        END IF;
      END $$;
    `);
    // --- replication_logs ---
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='entity_type')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='entityType') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "entity_type" TO "entityType";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='entity_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='entityId') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "entity_id" TO "entityId";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='operation_type')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='operationType') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "operation_type" TO "operationType";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='old_data')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='oldData') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "old_data" TO "oldData";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='new_data')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='newData') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "new_data" TO "newData";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='change_set')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='changeSet') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "change_set" TO "changeSet";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='failure_reason')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='failureReason') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "failure_reason" TO "failureReason";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='retry_count')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='retryCount') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "retry_count" TO "retryCount";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='max_retries')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='maxRetries') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "max_retries" TO "maxRetries";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='sent_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='sentAt') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "sent_at" TO "sentAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='acknowledged_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='acknowledgedAt') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "acknowledged_at" TO "acknowledgedAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='changed_by')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='changedBy') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "changed_by" TO "changedBy";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='change_reason')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='changeReason') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "change_reason" TO "changeReason";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='created_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='createdAt') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "created_at" TO "createdAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='processed_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='replication_logs' AND column_name='processedAt') THEN
          ALTER TABLE "replication_logs" RENAME COLUMN "processed_at" TO "processedAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "replication_logs" ADD COLUMN IF NOT EXISTS "changesetCount" integer`,
    );
    // --- stock_transfers ---
    await queryRunner.query(
      `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "from_store_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_transfers" ADD COLUMN IF NOT EXISTS "to_store_id" uuid`,
    );
    // --- update_notifications ---
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='notification_type')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='notificationType') THEN
          ALTER TABLE "update_notifications" RENAME COLUMN "notification_type" TO "notificationType";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='retry_count')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='retryCount') THEN
          ALTER TABLE "update_notifications" RENAME COLUMN "retry_count" TO "retryCount";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='max_retries')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='maxRetries') THEN
          ALTER TABLE "update_notifications" RENAME COLUMN "max_retries" TO "maxRetries";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='sent_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='sentAt') THEN
          ALTER TABLE "update_notifications" RENAME COLUMN "sent_at" TO "sentAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='delivered_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='deliveredAt') THEN
          ALTER TABLE "update_notifications" RENAME COLUMN "delivered_at" TO "deliveredAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='acknowledged_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='acknowledgedAt') THEN
          ALTER TABLE "update_notifications" RENAME COLUMN "acknowledged_at" TO "acknowledgedAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='failed_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='failedAt') THEN
          ALTER TABLE "update_notifications" RENAME COLUMN "failed_at" TO "failedAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='failure_reason')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='failureReason') THEN
          ALTER TABLE "update_notifications" RENAME COLUMN "failure_reason" TO "failureReason";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='deployment_response')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='deploymentResponse') THEN
          ALTER TABLE "update_notifications" RENAME COLUMN "deployment_response" TO "deploymentResponse";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='sent_by')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='sentBy') THEN
          ALTER TABLE "update_notifications" RENAME COLUMN "sent_by" TO "sentBy";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='created_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='createdAt') THEN
          ALTER TABLE "update_notifications" RENAME COLUMN "created_at" TO "createdAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='updated_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='updatedAt') THEN
          ALTER TABLE "update_notifications" RENAME COLUMN "updated_at" TO "updatedAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='scheduled_for')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_notifications' AND column_name='scheduledFor') THEN
          ALTER TABLE "update_notifications" RENAME COLUMN "scheduled_for" TO "scheduledFor";
        END IF;
      END $$;
    `);
    // --- update_rollouts ---
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='current_phase')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='currentPhase') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "current_phase" TO "currentPhase";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='start_date')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='startDate') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "start_date" TO "startDate";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='end_date')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='endDate') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "end_date" TO "endDate";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='phase1_percentage_target')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='phase1PercentageTarget') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "phase1_percentage_target" TO "phase1PercentageTarget";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='phase2_percentage_target')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='phase2PercentageTarget') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "phase2_percentage_target" TO "phase2PercentageTarget";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='phase3_percentage_target')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='phase3PercentageTarget') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "phase3_percentage_target" TO "phase3PercentageTarget";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='error_threshold_percentage')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='errorThresholdPercentage') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "error_threshold_percentage" TO "errorThresholdPercentage";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='auto_rollback_on_error')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='autoRollbackOnError') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "auto_rollback_on_error" TO "autoRollbackOnError";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='deployments_total_count')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='deploymentsTotalCount') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "deployments_total_count" TO "deploymentsTotalCount";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='deployments_success_count')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='deploymentsSuccessCount') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "deployments_success_count" TO "deploymentsSuccessCount";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='deployments_failed_count')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='deploymentsFailedCount') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "deployments_failed_count" TO "deploymentsFailedCount";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='deployments_rolled_back_count')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='deploymentsRolledBackCount') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "deployments_rolled_back_count" TO "deploymentsRolledBackCount";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='rollback_reason')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='rollbackReason') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "rollback_reason" TO "rollbackReason";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='rolled_back_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='rolledBackAt') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "rolled_back_at" TO "rolledBackAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='scheduled_by')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='scheduledBy') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "scheduled_by" TO "scheduledBy";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='created_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='createdAt') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "created_at" TO "createdAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='updated_at')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                    AND table_name='update_rollouts' AND column_name='updatedAt') THEN
          ALTER TABLE "update_rollouts" RENAME COLUMN "updated_at" TO "updatedAt";
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "update_rollouts" ADD COLUMN IF NOT EXISTS "metadata" jsonb`,
    );
  }

  public async down(): Promise<void> {
    // Not reversed: renaming back would break every deployment whose columns
    // were already camelCase before this ran.
  }
}
