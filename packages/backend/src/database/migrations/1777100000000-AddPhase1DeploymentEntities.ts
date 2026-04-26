import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddPhase1DeploymentEntities1777100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create deployments table
    await queryRunner.createTable(
      new Table({
        name: 'deployments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'deployment_type',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'active'",
          },
          {
            name: 'api_endpoint',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'current_version',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'last_sync',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'last_health_check',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'config',
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
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['tenant_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'tenants',
            onDelete: 'NO ACTION',
          }),
        ],
        indices: [
          new TableIndex({
            columnNames: ['tenant_id', 'status'],
            name: 'IDX_deployments_tenant_id_status',
          }),
          new TableIndex({
            columnNames: ['deployment_type'],
            name: 'IDX_deployments_deployment_type',
          }),
          new TableIndex({
            columnNames: ['tenant_id'],
            name: 'IDX_deployments_tenant_id',
          }),
        ],
      }),
      true,
    );

    // Create deployment_versions table
    await queryRunner.createTable(
      new Table({
        name: 'deployment_versions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'deployment_id',
            type: 'uuid',
          },
          {
            name: 'app_version_id',
            type: 'uuid',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'deployed_at',
            type: 'timestamp',
          },
          {
            name: 'rollback_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'rolled_back_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deployment_metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['deployment_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'deployments',
            onDelete: 'CASCADE',
          }),
          new TableForeignKey({
            columnNames: ['app_version_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'app_versions',
            onDelete: 'NO ACTION',
          }),
        ],
        indices: [
          new TableIndex({
            columnNames: ['deployment_id', 'status'],
            name: 'IDX_deployment_versions_deployment_id_status',
          }),
          new TableIndex({
            columnNames: ['app_version_id'],
            name: 'IDX_deployment_versions_app_version_id',
          }),
        ],
      }),
      true,
    );

    // Create deployment_configs table
    await queryRunner.createTable(
      new Table({
        name: 'deployment_configs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'deployment_id',
            type: 'uuid',
          },
          {
            name: 'config_key',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'config_value',
            type: 'text',
          },
          {
            name: 'data_type',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'override_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_active',
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
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['deployment_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'deployments',
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({
            columnNames: ['deployment_id', 'config_key'],
            name: 'IDX_deployment_configs_deployment_id_config_key',
          }),
        ],
      }),
      true,
    );

    // Create tenant_feature_modules table
    await queryRunner.createTable(
      new Table({
        name: 'tenant_feature_modules',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
          },
          {
            name: 'module_key',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_enabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'config',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'feature_flags',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'enable_reason',
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
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['tenant_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'tenants',
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({
            columnNames: ['tenant_id', 'module_key'],
            name: 'IDX_tenant_feature_modules_tenant_id_module_key',
          }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tenant_feature_modules', true);
    await queryRunner.dropTable('deployment_configs', true);
    await queryRunner.dropTable('deployment_versions', true);
    await queryRunner.dropTable('deployments', true);
  }
}
