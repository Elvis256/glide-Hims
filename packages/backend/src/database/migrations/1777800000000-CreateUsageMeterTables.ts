import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateUsageMeterTables1777800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // UsageMeterEvent table - raw events with granularity
    await queryRunner.createTable(
      new Table({
        name: 'usage_meter_event',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'metric_type',
            type: 'enum',
            enum: [
              'api_calls',
              'storage_gb',
              'active_users',
              'sms_sent',
              'pdf_generated',
              'email_sent',
              'reports_generated',
              'data_synced_gb',
              'backup_size_gb',
            ],
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'numeric',
            precision: 18,
            scale: 4,
            default: 0,
          },
          {
            name: 'event_source',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'billable',
            type: 'boolean',
            default: true,
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            name: 'FK_usage_meter_event_tenant_id',
            columnNames: ['tenant_id'],
            referencedTableName: 'tenant',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // Index for efficient queries
    await queryRunner.createIndex(
      'usage_meter_event',
      new TableIndex({
        name: 'idx_usage_event_tenant_metric_time',
        columnNames: ['tenant_id', 'metric_type', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'usage_meter_event',
      new TableIndex({
        name: 'idx_usage_event_tenant_metric',
        columnNames: ['tenant_id', 'metric_type'],
      }),
    );

    // UsageMeterAggregate table - pre-computed summaries
    await queryRunner.createTable(
      new Table({
        name: 'usage_meter_aggregate',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'metric_type',
            type: 'enum',
            enum: [
              'api_calls',
              'storage_gb',
              'active_users',
              'sms_sent',
              'pdf_generated',
              'email_sent',
              'reports_generated',
              'data_synced_gb',
              'backup_size_gb',
            ],
            isNullable: false,
          },
          {
            name: 'period',
            type: 'enum',
            enum: ['hourly', 'daily', 'monthly'],
          },
          {
            name: 'period_start',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'period_end',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'total_amount',
            type: 'numeric',
            precision: 18,
            scale: 4,
            default: 0,
          },
          {
            name: 'event_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'avg_per_event',
            type: 'numeric',
            precision: 18,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'max_amount',
            type: 'numeric',
            precision: 18,
            scale: 4,
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_usage_meter_aggregate_tenant_id',
            columnNames: ['tenant_id'],
            referencedTableName: 'tenant',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'usage_meter_aggregate',
      new TableIndex({
        name: 'idx_usage_aggregate_tenant_metric_period',
        columnNames: ['tenant_id', 'metric_type', 'period', 'period_start'],
      }),
    );

    await queryRunner.createIndex(
      'usage_meter_aggregate',
      new TableIndex({
        name: 'idx_usage_aggregate_tenant_time',
        columnNames: ['tenant_id', 'period_start'],
      }),
    );

    // UsageQuota table - plan-based limits
    await queryRunner.createTable(
      new Table({
        name: 'usage_quota',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'metric_type',
            type: 'enum',
            enum: [
              'api_calls',
              'storage_gb',
              'active_users',
              'sms_sent',
              'pdf_generated',
              'email_sent',
              'reports_generated',
              'data_synced_gb',
              'backup_size_gb',
            ],
            isNullable: false,
          },
          {
            name: 'limit_monthly',
            type: 'numeric',
            precision: 18,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'limit_daily',
            type: 'numeric',
            precision: 18,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'limit_hourly',
            type: 'numeric',
            precision: 18,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'hard_limit',
            type: 'boolean',
            default: true,
          },
          {
            name: 'alert_threshold_pct',
            type: 'numeric',
            precision: 5,
            scale: 2,
            default: 80,
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_usage_quota_tenant_id',
            columnNames: ['tenant_id'],
            referencedTableName: 'tenant',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        uniques: [
          {
            name: 'UQ_usage_quota_tenant_metric',
            columnNames: ['tenant_id', 'metric_type'],
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'usage_quota',
      new TableIndex({
        name: 'idx_quota_tenant_metric',
        columnNames: ['tenant_id', 'metric_type'],
      }),
    );

    // UsageAlert table - quota breach alerts
    await queryRunner.createTable(
      new Table({
        name: 'usage_alert',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'metric_type',
            type: 'enum',
            enum: [
              'api_calls',
              'storage_gb',
              'active_users',
              'sms_sent',
              'pdf_generated',
              'email_sent',
              'reports_generated',
              'data_synced_gb',
              'backup_size_gb',
            ],
            isNullable: false,
          },
          {
            name: 'severity',
            type: 'varchar',
            length: '50',
            default: "'warning'",
          },
          {
            name: 'current_usage',
            type: 'numeric',
            precision: 18,
            scale: 4,
            isNullable: false,
          },
          {
            name: 'limit',
            type: 'numeric',
            precision: 18,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'limit_period',
            type: 'varchar',
            length: '100',
            default: "'monthly'",
          },
          {
            name: 'usage_pct',
            type: 'numeric',
            precision: 5,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'acknowledged',
            type: 'boolean',
            default: false,
          },
          {
            name: 'resolved_at',
            type: 'timestamp',
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_usage_alert_tenant_id',
            columnNames: ['tenant_id'],
            referencedTableName: 'tenant',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'usage_alert',
      new TableIndex({
        name: 'idx_alert_tenant_metric_time',
        columnNames: ['tenant_id', 'metric_type', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'usage_alert',
      new TableIndex({
        name: 'idx_alert_tenant_resolved',
        columnNames: ['tenant_id', 'resolved_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.dropTable('usage_alert', true);
    await queryRunner.dropTable('usage_quota', true);
    await queryRunner.dropTable('usage_meter_aggregate', true);
    await queryRunner.dropTable('usage_meter_event', true);
  }
}
