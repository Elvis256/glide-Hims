import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddPhase4MonitoringEntities1777400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create deployment_health table
    await queryRunner.createTable(
      new Table({
        name: 'deployment_health',
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
            name: 'status',
            type: 'enum',
            enum: ['healthy', 'warning', 'critical', 'offline', 'degraded'],
            default: "'healthy'",
          },
          {
            name: 'uptime',
            type: 'integer',
            default: 0,
          },
          {
            name: 'uptime_percentage',
            type: 'float',
            default: 0,
          },
          {
            name: 'cpu_usage_percent',
            type: 'float',
            default: 0,
          },
          {
            name: 'memory_usage_percent',
            type: 'float',
            default: 0,
          },
          {
            name: 'disk_usage_percent',
            type: 'float',
            default: 0,
          },
          {
            name: 'error_rate_percent',
            type: 'integer',
            default: 0,
          },
          {
            name: 'response_time_ms',
            type: 'integer',
            default: 0,
          },
          {
            name: 'request_count_per_minute',
            type: 'integer',
            default: 0,
          },
          {
            name: 'active_connections_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'queued_requests_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'total_errors_last24h',
            type: 'integer',
            default: 0,
          },
          {
            name: 'sync_delay_seconds',
            type: 'integer',
            default: 0,
          },
          {
            name: 'last_error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'last_error_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'last_sync_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'last_health_check_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'service_metrics',
            type: 'jsonb',
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

    // Add indexes to deployment_health
    await queryRunner.createIndex(
      'deployment_health',
      new TableIndex({
        name: 'IDX_deployment_health_deployment_id_status',
        columnNames: ['deployment_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'deployment_health',
      new TableIndex({
        name: 'IDX_deployment_health_deployment_id_created_at',
        columnNames: ['deployment_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'deployment_health',
      new TableIndex({
        name: 'IDX_deployment_health_status_updated_at',
        columnNames: ['status', 'updated_at'],
      }),
    );

    // Add foreign key to deployment_health
    await queryRunner.createForeignKey(
      'deployment_health',
      new TableForeignKey({
        columnNames: ['deployment_id'],
        referencedTableName: 'deployments',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create deployment_alerts table
    await queryRunner.createTable(
      new Table({
        name: 'deployment_alerts',
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
            name: 'alert_type',
            type: 'enum',
            enum: [
              'high_error_rate',
              'high_cpu',
              'high_memory',
              'high_disk',
              'slow_response',
              'sync_delay',
              'connection_failure',
              'deployment_offline',
              'version_mismatch',
              'license_expired',
              'quota_exceeded',
              'data_integrity',
              'replication_failed',
              'unknown',
            ],
            default: "'unknown'",
          },
          {
            name: 'severity',
            type: 'enum',
            enum: ['info', 'warning', 'critical', 'resolved'],
            default: "'warning'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['open', 'acknowledged', 'resolved', 'escalated', 'false_positive'],
            default: "'open'",
          },
          {
            name: 'title',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'occurrence_count',
            type: 'integer',
            default: 1,
          },
          {
            name: 'acknowledged_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'trigger_condition',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'threshold',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'actual_value',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'notifications_sent',
            type: 'integer',
            default: 0,
          },
          {
            name: 'escalated',
            type: 'boolean',
            default: false,
          },
          {
            name: 'escalation_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'escalated_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'acknowledged_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'acknowledged_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'acknowledgment_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'resolved_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'resolved_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'resolution_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_by',
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
        ],
      }),
      true,
    );

    // Add indexes to deployment_alerts
    await queryRunner.createIndex(
      'deployment_alerts',
      new TableIndex({
        name: 'IDX_deployment_alerts_deployment_status',
        columnNames: ['deployment_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'deployment_alerts',
      new TableIndex({
        name: 'IDX_deployment_alerts_status_severity',
        columnNames: ['status', 'severity'],
      }),
    );

    await queryRunner.createIndex(
      'deployment_alerts',
      new TableIndex({
        name: 'IDX_deployment_alerts_alert_type_created_at',
        columnNames: ['alert_type', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'deployment_alerts',
      new TableIndex({
        name: 'IDX_deployment_alerts_deployment_created_at',
        columnNames: ['deployment_id', 'created_at'],
      }),
    );

    // Add foreign key to deployment_alerts
    await queryRunner.createForeignKey(
      'deployment_alerts',
      new TableForeignKey({
        columnNames: ['deployment_id'],
        referencedTableName: 'deployments',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop deployment_alerts table
    const alertsTable = await queryRunner.getTable('deployment_alerts');
    if (alertsTable) {
      await queryRunner.dropTable('deployment_alerts');
    }

    // Drop deployment_health table
    const healthTable = await queryRunner.getTable('deployment_health');
    if (healthTable) {
      await queryRunner.dropTable('deployment_health');
    }
  }
}
