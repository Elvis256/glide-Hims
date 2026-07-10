import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddPhase2UpdateDistributionEntities1777200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create release_candidates table
    await queryRunner.createTable(
      new Table({
        name: 'release_candidates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'app_version_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'stage',
            type: 'enum',
            enum: ['alpha', 'beta', 'rc', 'stable', 'hotfix'],
            default: "'alpha'",
          },
          {
            name: 'release_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'testing_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'testers_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'deployment_count_risk',
            type: 'integer',
            default: 0,
          },
          {
            name: 'known_issues',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'performance_metrics',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'approved_for_rollout',
            type: 'boolean',
            default: false,
          },
          {
            name: 'approved_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'approved_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Add indexes to release_candidates
    await queryRunner.createIndex(
      'release_candidates',
      new TableIndex({
        name: 'IDX_release_candidates_app_version_id_stage',
        columnNames: ['app_version_id', 'stage'],
      }),
    );

    await queryRunner.createIndex(
      'release_candidates',
      new TableIndex({
        name: 'IDX_release_candidates_stage_created_at',
        columnNames: ['stage', 'created_at'],
      }),
    );

    // Add foreign key to release_candidates
    await queryRunner.createForeignKey(
      'release_candidates',
      new TableForeignKey({
        columnNames: ['app_version_id'],
        referencedTableName: 'app_versions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create update_rollouts table
    await queryRunner.createTable(
      new Table({
        name: 'update_rollouts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'release_candidate_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['scheduled', 'in_progress', 'paused', 'completed', 'rolled_back', 'failed'],
            default: "'scheduled'",
          },
          {
            name: 'current_phase',
            type: 'enum',
            enum: ['phase_1', 'phase_2', 'phase_3'],
            default: "'phase_1'",
          },
          {
            name: 'start_date',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'end_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'phase1_percentage_target',
            type: 'integer',
            default: 10,
          },
          {
            name: 'phase2_percentage_target',
            type: 'integer',
            default: 50,
          },
          {
            name: 'phase3_percentage_target',
            type: 'integer',
            default: 100,
          },
          {
            name: 'error_threshold_percentage',
            type: 'integer',
            default: 5,
          },
          {
            name: 'auto_rollback_on_error',
            type: 'boolean',
            default: false,
          },
          {
            name: 'deployments_total_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'deployments_success_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'deployments_failed_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'deployments_rolled_back_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'rollback_reason',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'rolled_back_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'scheduled_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add indexes to update_rollouts
    await queryRunner.createIndex(
      'update_rollouts',
      new TableIndex({
        name: 'IDX_update_rollouts_release_candidate_id_status',
        columnNames: ['release_candidate_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'update_rollouts',
      new TableIndex({
        name: 'IDX_update_rollouts_status_current_phase',
        columnNames: ['status', 'current_phase'],
      }),
    );

    await queryRunner.createIndex(
      'update_rollouts',
      new TableIndex({
        name: 'IDX_update_rollouts_start_date_end_date',
        columnNames: ['start_date', 'end_date'],
      }),
    );

    // Add foreign key to update_rollouts
    await queryRunner.createForeignKey(
      'update_rollouts',
      new TableForeignKey({
        columnNames: ['release_candidate_id'],
        referencedTableName: 'release_candidates',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create update_notifications table
    await queryRunner.createTable(
      new Table({
        name: 'update_notifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'deployment_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'update_rollout_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'notification_type',
            type: 'enum',
            enum: [
              'update_available',
              'update_started',
              'update_completed',
              'update_failed',
              'rollback_initiated',
              'rollback_completed',
              'feature_flag_changed',
              'maintenance_scheduled',
              'system_alert',
            ],
            default: "'update_available'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'sent', 'delivered', 'failed', 'retrying', 'acknowledged'],
            default: "'pending'",
          },
          {
            name: 'subject',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'retry_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'max_retries',
            type: 'integer',
            default: 3,
          },
          {
            name: 'sent_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'delivered_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'acknowledged_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'failed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'failure_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'deployment_response',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'sent_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'scheduled_for',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Add indexes to update_notifications
    await queryRunner.createIndex(
      'update_notifications',
      new TableIndex({
        name: 'IDX_update_notifications_deployment_id_status',
        columnNames: ['deployment_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'update_notifications',
      new TableIndex({
        name: 'IDX_update_notifications_notification_type_created_at',
        columnNames: ['notification_type', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'update_notifications',
      new TableIndex({
        name: 'IDX_update_notifications_update_rollout_id_status',
        columnNames: ['update_rollout_id', 'status'],
      }),
    );

    // Add foreign keys to update_notifications
    await queryRunner.createForeignKey(
      'update_notifications',
      new TableForeignKey({
        columnNames: ['deployment_id'],
        referencedTableName: 'deployments',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'update_notifications',
      new TableForeignKey({
        columnNames: ['update_rollout_id'],
        referencedTableName: 'update_rollouts',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop update_notifications table
    const updateNotificationsTable = await queryRunner.getTable('update_notifications');
    if (updateNotificationsTable) {
      await queryRunner.dropTable('update_notifications');
    }

    // Drop update_rollouts table
    const updateRolloutsTable = await queryRunner.getTable('update_rollouts');
    if (updateRolloutsTable) {
      await queryRunner.dropTable('update_rollouts');
    }

    // Drop release_candidates table
    const releaseCandidatesTable = await queryRunner.getTable('release_candidates');
    if (releaseCandidatesTable) {
      await queryRunner.dropTable('release_candidates');
    }
  }
}
