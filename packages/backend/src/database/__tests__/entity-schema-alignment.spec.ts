import { DataSource } from 'typeorm';
import { join } from 'path';

/**
 * Guards the gap between what the entities declare and what the migrations
 * actually build.
 *
 * Nothing else catches this class of bug. The entities compile, the migrations
 * run, and the mismatch only surfaces as a 500 the first time someone touches
 * the feature — which is how `usage_meter_aggregate`, `usage_quota`,
 * `usage_alert`, `admin_audit_log`, `blood_glucose_readings`,
 * `medication_reconciliation_items` and `dr_drills` all shipped broken.
 *
 * Two failure modes are checked:
 *   1. An entity maps to a table no migration creates.
 *   2. An entity declares a column the table does not have — usually a
 *      camelCase property with no `name:` mapping, or a relation missing its
 *      @JoinColumn (TypeORM then derives a FK column name that nobody built).
 *
 * Columns present in the table but absent from the entity are NOT failures:
 * migrations legitimately hold operational columns no entity maps.
 *
 * DATABASE REQUIRED. Reads DB_* from the environment and skips when they are
 * unset or the server is unreachable, so `pnpm test` still passes on a machine
 * (or CI runner) with no Postgres. The check is strictly read-only — it touches
 * information_schema only. Run it against a migrated database with:
 *
 *     ./dev.sh test:schema        # from the repo root
 */
const CONNECT_TIMEOUT_MS = 5000;

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_MIGRATION_USERNAME || process.env.DB_USERNAME,
  password: process.env.DB_MIGRATION_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.DB_NAME || process.env.DB_DATABASE,
};

const configured = Boolean(
  dbConfig.host && dbConfig.username && dbConfig.password && dbConfig.database,
);

describe('entity / schema alignment', () => {
  let ds: DataSource | undefined;
  let reachable = false;
  let skipReason = '';

  beforeAll(async () => {
    if (!configured) {
      skipReason = 'DB_HOST/DB_USERNAME/DB_PASSWORD/DB_NAME not set';
      return;
    }
    ds = new DataSource({
      type: 'postgres',
      ...dbConfig,
      // Entities live beside this spec's package; the same glob the app uses.
      entities: [
        join(__dirname, '../../**/*.entity{.ts,.js}'),
        join(__dirname, '../../**/*.entities{.ts,.js}'),
      ],
      synchronize: false,
      logging: false,
      extra: { connectionTimeoutMillis: CONNECT_TIMEOUT_MS },
    });
    try {
      await ds.initialize();
      reachable = true;
    } catch (err: any) {
      skipReason = `cannot reach ${dbConfig.host}:${dbConfig.port}/${dbConfig.database} — ${err.message}`;
      ds = undefined;
    }
  }, 60000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('every entity maps to a table that exists, with all of its columns', async () => {
    if (!reachable || !ds) {
      // Loud on purpose: a silently skipped guard reads as a passing guard.
      console.warn(`[entity/schema alignment] SKIPPED — ${skipReason}`);
      return;
    }

    const rows: Array<{ table_name: string; column_name: string }> = await ds.query(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'`,
    );

    const columnsByTable = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!columnsByTable.has(row.table_name)) columnsByTable.set(row.table_name, new Set());
      columnsByTable.get(row.table_name)!.add(row.column_name);
    }

    const missingTables: string[] = [];
    const missingColumns: string[] = [];

    for (const md of ds.entityMetadatas) {
      // Views and embedded metadata have no table of their own to verify.
      if (md.tableType !== 'regular') continue;

      const actual = columnsByTable.get(md.tableName);
      if (!actual) {
        missingTables.push(`${md.tableName} (entity ${md.name})`);
        continue;
      }

      const absent = md.columns
        .map((c) => c.databaseName)
        .filter((name) => !actual.has(name))
        .sort();
      if (absent.length) {
        missingColumns.push(`${md.tableName} (entity ${md.name}) is missing: ${absent.join(', ')}`);
      }
    }

    const problems: string[] = [];
    if (missingTables.length) {
      problems.push(
        `No migration creates these tables:\n  ${missingTables.sort().join('\n  ')}`,
      );
    }
    if (missingColumns.length) {
      problems.push(
        `Entities declare columns their tables lack:\n  ${missingColumns.sort().join('\n  ')}`,
      );
    }

    if (problems.length) {
      throw new Error(
        `Entity/schema drift against ${dbConfig.database} ` +
          `(${ds.entityMetadatas.length} entities checked).\n\n${problems.join('\n\n')}\n\n` +
          `Fix by adding the column/table in a migration, or by correcting the ` +
          `entity's name: mapping / @JoinColumn if the table is right.`,
      );
    }
  }, 120000);
});
