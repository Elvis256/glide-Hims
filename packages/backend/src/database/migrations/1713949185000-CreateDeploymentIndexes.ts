import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class CreateDeploymentIndexes1713949185000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Legacy migration — references the camelCase singular `deployment` table
    // from an earlier prototype. The current schema uses `deployments` (plural,
    // snake_case columns) created by AddPhase1DeploymentEntities. Skip on
    // fresh installs to avoid failing the migration chain.
    if (!(await queryRunner.hasTable('deployment'))) return;

    // Deployment table indexes
    await queryRunner.createIndex(
      'deployment',
      new TableIndex({
        name: 'IDX_DEPLOYMENT_TENANT_ID',
        columnNames: ['tenantId'],
      }),
    );

    await queryRunner.createIndex(
      'deployment',
      new TableIndex({
        name: 'IDX_DEPLOYMENT_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'deployment',
      new TableIndex({
        name: 'IDX_DEPLOYMENT_TYPE',
        columnNames: ['deploymentType'],
      }),
    );

    // Composite index for common queries
    await queryRunner.createIndex(
      'deployment',
      new TableIndex({
        name: 'IDX_DEPLOYMENT_TENANT_STATUS',
        columnNames: ['tenantId', 'status'],
      }),
    );

    // Date range queries
    await queryRunner.createIndex(
      'deployment',
      new TableIndex({
        name: 'IDX_DEPLOYMENT_CREATED_AT',
        columnNames: ['createdAt'],
      }),
    );

    // UpdateRollout table indexes
    await queryRunner.createIndex(
      'update_rollout',
      new TableIndex({
        name: 'IDX_ROLLOUT_DEPLOYMENT_ID',
        columnNames: ['deploymentId'],
      }),
    );

    await queryRunner.createIndex(
      'update_rollout',
      new TableIndex({
        name: 'IDX_ROLLOUT_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'update_rollout',
      new TableIndex({
        name: 'IDX_ROLLOUT_STARTED_AT',
        columnNames: ['startedAt'],
      }),
    );

    // DeploymentHealth table indexes
    await queryRunner.createIndex(
      'deployment_health',
      new TableIndex({
        name: 'IDX_HEALTH_DEPLOYMENT_ID',
        columnNames: ['deploymentId'],
      }),
    );

    await queryRunner.createIndex(
      'deployment_health',
      new TableIndex({
        name: 'IDX_HEALTH_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'deployment_health',
      new TableIndex({
        name: 'IDX_HEALTH_LAST_CHECK',
        columnNames: ['lastCheck'],
      }),
    );

    // DeploymentAlert table indexes
    await queryRunner.createIndex(
      'deployment_alert',
      new TableIndex({
        name: 'IDX_ALERT_DEPLOYMENT_ID',
        columnNames: ['deploymentId'],
      }),
    );

    await queryRunner.createIndex(
      'deployment_alert',
      new TableIndex({
        name: 'IDX_ALERT_SEVERITY',
        columnNames: ['severity'],
      }),
    );

    await queryRunner.createIndex(
      'deployment_alert',
      new TableIndex({
        name: 'IDX_ALERT_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'deployment_alert',
      new TableIndex({
        name: 'IDX_ALERT_CREATED_AT',
        columnNames: ['createdAt'],
      }),
    );

    // ReplicationLog indexes
    await queryRunner.createIndex(
      'replication_log',
      new TableIndex({
        name: 'IDX_REPLICATION_DEPLOYMENT_ID',
        columnNames: ['deploymentId'],
      }),
    );

    // ChangeSet indexes
    await queryRunner.createIndex(
      'changeset',
      new TableIndex({
        name: 'IDX_CHANGESET_DEPLOYMENT_ID',
        columnNames: ['deploymentId'],
      }),
    );

    await queryRunner.createIndex(
      'changeset',
      new TableIndex({
        name: 'IDX_CHANGESET_STATUS',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('deployment'))) return;
    // Drop all indexes
    await queryRunner.dropIndex('deployment', 'IDX_DEPLOYMENT_TENANT_ID');
    await queryRunner.dropIndex('deployment', 'IDX_DEPLOYMENT_STATUS');
    await queryRunner.dropIndex('deployment', 'IDX_DEPLOYMENT_TYPE');
    await queryRunner.dropIndex('deployment', 'IDX_DEPLOYMENT_TENANT_STATUS');
    await queryRunner.dropIndex('deployment', 'IDX_DEPLOYMENT_CREATED_AT');

    await queryRunner.dropIndex('update_rollout', 'IDX_ROLLOUT_DEPLOYMENT_ID');
    await queryRunner.dropIndex('update_rollout', 'IDX_ROLLOUT_STATUS');
    await queryRunner.dropIndex('update_rollout', 'IDX_ROLLOUT_STARTED_AT');

    await queryRunner.dropIndex('deployment_health', 'IDX_HEALTH_DEPLOYMENT_ID');
    await queryRunner.dropIndex('deployment_health', 'IDX_HEALTH_STATUS');
    await queryRunner.dropIndex('deployment_health', 'IDX_HEALTH_LAST_CHECK');

    await queryRunner.dropIndex('deployment_alert', 'IDX_ALERT_DEPLOYMENT_ID');
    await queryRunner.dropIndex('deployment_alert', 'IDX_ALERT_SEVERITY');
    await queryRunner.dropIndex('deployment_alert', 'IDX_ALERT_STATUS');
    await queryRunner.dropIndex('deployment_alert', 'IDX_ALERT_CREATED_AT');

    await queryRunner.dropIndex('replication_log', 'IDX_REPLICATION_DEPLOYMENT_ID');

    await queryRunner.dropIndex('changeset', 'IDX_CHANGESET_DEPLOYMENT_ID');
    await queryRunner.dropIndex('changeset', 'IDX_CHANGESET_STATUS');
  }
}
