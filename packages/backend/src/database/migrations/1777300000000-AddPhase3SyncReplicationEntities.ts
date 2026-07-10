import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddPhase3SyncReplicationEntities1777300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create replication_logs table
    await queryRunner.createTable(
      new Table({
        name: 'replication_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'deployment_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'entity_type',
            type: 'enum',
            enum: [
              'drug',
              'patient',
              'appointment',
              'billing',
              'inventory',
              'staff',
              'facility',
              'config',
              'user',
              'permission',
              'module',
              'other',
            ],
            isNullable: false,
          },
          {
            name: 'entity_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'operation_type',
            type: 'enum',
            enum: ['create', 'update', 'delete', 'bulk_update'],
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'sent', 'acknowledged', 'failed', 'retrying'],
            default: "'pending'",
          },
          {
            name: 'old_data',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'new_data',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'change_set',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'failure_reason',
            type: 'text',
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
            name: 'acknowledged_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'changed_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'change_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'processed_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Add indexes to replication_logs
    await queryRunner.createIndex(
      'replication_logs',
      new TableIndex({
        name: 'IDX_replication_logs_tenant_deployment_status',
        columnNames: ['tenant_id', 'deployment_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'replication_logs',
      new TableIndex({
        name: 'IDX_replication_logs_entity_type_operation',
        columnNames: ['entity_type', 'operation_type'],
      }),
    );

    await queryRunner.createIndex(
      'replication_logs',
      new TableIndex({
        name: 'IDX_replication_logs_created_at_status',
        columnNames: ['created_at', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'replication_logs',
      new TableIndex({
        name: 'IDX_replication_logs_deployment_status',
        columnNames: ['deployment_id', 'status'],
      }),
    );

    // Add foreign keys to replication_logs
    await queryRunner.createForeignKey(
      'replication_logs',
      new TableForeignKey({
        columnNames: ['tenant_id'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'replication_logs',
      new TableForeignKey({
        columnNames: ['deployment_id'],
        referencedTableName: 'deployments',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // Create change_sets table
    await queryRunner.createTable(
      new Table({
        name: 'change_sets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'deployment_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'batch_id',
            type: 'varchar',
            length: 255 as any,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'ready', 'applying', 'applied', 'failed', 'rolled_back'],
            default: "'pending'",
          },
          {
            name: 'change_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'changes',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'success_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'failure_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'failure_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'can_rollback',
            type: 'boolean',
            default: false,
          },
          {
            name: 'applied_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'rolled_back_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'applied_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'rolled_back_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'source_system',
            type: 'varchar',
            length: 255 as any,
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

    // Add indexes to change_sets
    await queryRunner.createIndex(
      'change_sets',
      new TableIndex({
        name: 'IDX_change_sets_tenant_status',
        columnNames: ['tenant_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'change_sets',
      new TableIndex({
        name: 'IDX_change_sets_deployment_status',
        columnNames: ['deployment_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'change_sets',
      new TableIndex({
        name: 'IDX_change_sets_created_at_status',
        columnNames: ['created_at', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'change_sets',
      new TableIndex({
        name: 'IDX_change_sets_batch_id',
        columnNames: ['batch_id'],
      }),
    );

    // Add foreign keys to change_sets
    await queryRunner.createForeignKey(
      'change_sets',
      new TableForeignKey({
        columnNames: ['tenant_id'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'change_sets',
      new TableForeignKey({
        columnNames: ['deployment_id'],
        referencedTableName: 'deployments',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop change_sets table
    const changeSetsTable = await queryRunner.getTable('change_sets');
    if (changeSetsTable) {
      await queryRunner.dropTable('change_sets');
    }

    // Drop replication_logs table
    const replicationLogsTable = await queryRunner.getTable('replication_logs');
    if (replicationLogsTable) {
      await queryRunner.dropTable('replication_logs');
    }
  }
}
