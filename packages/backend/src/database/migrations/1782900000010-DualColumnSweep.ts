import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sweep dual-column TypeORM trap.
 *
 * Several entities declared BOTH `@Column('uuid') xId` (which TypeORM mapped
 * to the camelCase column `"xId"`) AND `@JoinColumn({ name: 'x_id' })` for
 * the matching ManyToOne relation, causing two separate physical columns
 * (`"xId"` AND `x_id`) to exist in the same table — both NOT NULL on tables
 * where the FK was required.
 *
 * The entities have been updated to map the column to the snake_case name
 * (`@Column({ name: 'x_id', type: 'uuid' })`). This migration:
 *   1. Backfills the snake_case column from the camelCase one where it is NULL
 *      (in case any code path populated only the camelCase side historically).
 *   2. Drops the now-orphaned camelCase columns.
 */

type Pair = { table: string; camel: string; snake: string };

const PAIRS: Pair[] = [
  { table: 'change_sets', camel: 'tenantId', snake: 'tenant_id' },
  { table: 'change_sets', camel: 'deploymentId', snake: 'deployment_id' },
  { table: 'deployment_alerts', camel: 'deploymentId', snake: 'deployment_id' },
  { table: 'deployment_health', camel: 'deploymentId', snake: 'deployment_id' },
  { table: 'release_candidates', camel: 'appVersionId', snake: 'app_version_id' },
  { table: 'replication_logs', camel: 'tenantId', snake: 'tenant_id' },
  { table: 'replication_logs', camel: 'deploymentId', snake: 'deployment_id' },
  { table: 'update_notifications', camel: 'deploymentId', snake: 'deployment_id' },
  { table: 'update_notifications', camel: 'updateRolloutId', snake: 'update_rollout_id' },
  { table: 'update_rollouts', camel: 'releaseCandidateId', snake: 'release_candidate_id' },
];

export class DualColumnSweep1782900000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const p of PAIRS) {
      const cols: Array<{ column_name: string }> = await queryRunner.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1 AND column_name IN ($2, $3)`,
        [p.table, p.camel, p.snake],
      );
      const present = new Set(cols.map((c) => c.column_name));
      if (!present.has(p.camel)) continue;

      // Backfill snake from camel where snake is NULL (or doesn't exist yet).
      if (present.has(p.snake)) {
        await queryRunner.query(
          `UPDATE "${p.table}" SET "${p.snake}" = "${p.camel}"
           WHERE "${p.snake}" IS NULL AND "${p.camel}" IS NOT NULL`,
        );
      } else {
        // Snake column missing entirely — rename camel to snake.
        await queryRunner.query(
          `ALTER TABLE "${p.table}" RENAME COLUMN "${p.camel}" TO "${p.snake}"`,
        );
        continue;
      }

      // Drop the orphan camelCase column (CASCADE to remove any indexes/FKs
      // that referenced it; the relation indexes/FKs target the snake column).
      await queryRunner.query(`ALTER TABLE "${p.table}" DROP COLUMN "${p.camel}" CASCADE`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-create the camelCase columns and copy data back. NOT NULL constraints
    // are not restored — they were redundant with the snake column anyway.
    for (const p of PAIRS) {
      const exists: Array<{ column_name: string }> = await queryRunner.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1 AND column_name = $2`,
        [p.table, p.camel],
      );
      if (exists.length > 0) continue;
      await queryRunner.query(`ALTER TABLE "${p.table}" ADD COLUMN "${p.camel}" uuid`);
      await queryRunner.query(`UPDATE "${p.table}" SET "${p.camel}" = "${p.snake}"`);
    }
  }
}
