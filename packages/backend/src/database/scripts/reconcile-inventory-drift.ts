/**
 * Reconcile inventory drift between batch_stock_balances and stock_balances/stock_ledger.
 *
 * Background: prior to audit Phase 2, pharmacy.service.receiveBatch only wrote
 * `batch_stock_balances`, never `stock_balances` or `stock_ledger`. As a result,
 * pharmacy receipts were invisible to /inventory and /stores low-stock and
 * movement queries (which read stock_balances/stock_ledger). After Phase 2 the
 * write paths are unified, but historic data may already be drifted.
 *
 * This script:
 *   1. For each (facility_id, item_id, store_id) tuple, sums batch_stock_balances.quantity
 *      → expected_total.
 *   2. Compares to stock_balances.total_quantity at the same scope → actual_total.
 *   3. Reports rows where actual_total != expected_total.
 *   4. If --apply is passed, writes one stock_ledger row per drift (movement_type=adjustment,
 *      reference_type=reconciliation, notes=…) and updates stock_balances.total_quantity to
 *      expected_total in a single transaction per drift row.
 *
 * Default mode is dry-run (read-only). Use --apply to commit fixes.
 *
 * Usage:
 *   ts-node src/database/scripts/reconcile-inventory-drift.ts            # dry-run
 *   ts-node src/database/scripts/reconcile-inventory-drift.ts --apply    # write fixes
 *   ts-node src/database/scripts/reconcile-inventory-drift.ts --facility <uuid>   # scope
 */
import dataSource from '../../config/database.config';

interface DriftRow {
  facility_id: string;
  item_id: string;
  store_id: string | null;
  tenant_id: string;
  expected: number;
  actual: number;
  diff: number;
  balance_id: string | null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const facilityIdx = args.indexOf('--facility');
  const facilityFilter = facilityIdx >= 0 ? args[facilityIdx + 1] : null;

  await dataSource.initialize();
  const qr = dataSource.createQueryRunner();
  await qr.connect();

  try {
    const facilityClause = facilityFilter
      ? 'AND b.facility_id = $1'
      : '';
    const params = facilityFilter ? [facilityFilter] : [];

    const query = `
      WITH expected AS (
        SELECT b.facility_id,
               b.item_id,
               b.store_id,
               ROUND(COALESCE(SUM(b.quantity), 0))::int AS expected_total,
               (array_agg(b.tenant_id))[1]              AS tenant_id
        FROM batch_stock_balances b
        WHERE b.status = 'active'
          AND b.deleted_at IS NULL
          ${facilityClause}
        GROUP BY b.facility_id, b.item_id, b.store_id
      ),
      actual AS (
        SELECT s.id           AS balance_id,
               s.facility_id,
               s.item_id,
               s.store_id,
               s.total_quantity::int AS actual_total,
               s.tenant_id           AS s_tenant_id
        FROM stock_balances s
        WHERE s.deleted_at IS NULL
      )
      SELECT
        e.facility_id,
        e.item_id,
        e.store_id,
        COALESCE(a.s_tenant_id, e.tenant_id)          AS tenant_id,
        e.expected_total                              AS expected,
        COALESCE(a.actual_total, 0)                   AS actual,
        e.expected_total - COALESCE(a.actual_total,0) AS diff,
        a.balance_id
      FROM expected e
      LEFT JOIN actual a
        ON a.facility_id = e.facility_id
       AND a.item_id     = e.item_id
       AND ((a.store_id IS NULL AND e.store_id IS NULL) OR a.store_id = e.store_id)
      WHERE e.expected_total <> COALESCE(a.actual_total, 0)
      ORDER BY ABS(e.expected_total - COALESCE(a.actual_total, 0)) DESC;
    `;

    const rows: DriftRow[] = await qr.query(query, params);

    if (rows.length === 0) {
      console.log('✅ No inventory drift detected. batch_stock_balances and stock_balances are in sync.');
      return;
    }

    console.log(`\nFound ${rows.length} drifted (facility, item, store) tuples:\n`);
    console.log(
      [
        'facility_id'.padEnd(38),
        'item_id'.padEnd(38),
        'store_id'.padEnd(38),
        'expected'.padStart(10),
        'actual'.padStart(10),
        'diff'.padStart(10),
      ].join(' | '),
    );
    console.log('-'.repeat(160));

    for (const r of rows.slice(0, 50)) {
      console.log(
        [
          r.facility_id.padEnd(38),
          r.item_id.padEnd(38),
          (r.store_id ?? '(facility-level)').padEnd(38),
          String(r.expected).padStart(10),
          String(r.actual).padStart(10),
          String(r.diff).padStart(10),
        ].join(' | '),
      );
    }
    if (rows.length > 50) {
      console.log(`… and ${rows.length - 50} more.`);
    }

    if (!apply) {
      console.log('\nDry-run mode. Re-run with --apply to write reconciliation entries.');
      return;
    }

    console.log('\n--apply specified — writing reconciliation entries…\n');

    // Pick a system user to attribute the reconciliation ledger entries to.
    const systemUser: { id: string }[] = await qr.query(
      `SELECT id FROM users
        WHERE email IN ('elvis@glide-hims.local','system@glide-hims.local')
           OR LOWER(email) LIKE '%admin%'
        ORDER BY created_at ASC
        LIMIT 1`,
    );
    if (systemUser.length === 0) {
      throw new Error(
        'Cannot locate a system/admin user to attribute reconciliation entries to. ' +
          'Create a user with email system@glide-hims.local first.',
      );
    }
    const systemUserId = systemUser[0].id;

    let fixed = 0;
    let failed = 0;

    for (const r of rows) {
      await qr.startTransaction();
      try {
        let balanceId = r.balance_id;

        if (!balanceId) {
          const inserted: { id: string }[] = await qr.query(
            `INSERT INTO stock_balances
                (item_id, facility_id, store_id, tenant_id,
                 total_quantity, reserved_quantity, available_quantity,
                 created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 0, $5, NOW(), NOW())
             RETURNING id`,
            [r.item_id, r.facility_id, r.store_id, r.tenant_id, r.expected],
          );
          balanceId = inserted[0].id;
        } else {
          await qr.query(
            `UPDATE stock_balances
               SET total_quantity     = $1,
                   available_quantity = $1 - reserved_quantity,
                   updated_at         = NOW()
             WHERE id = $2`,
            [r.expected, balanceId],
          );
        }

        await qr.query(
          `INSERT INTO stock_ledger
              (item_id, facility_id, store_id, tenant_id, created_by_id,
               quantity, balance_after, movement_type, unit_cost,
               reference_type, reference_id, notes,
               created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5,
                   $6, $7, 'adjustment', 0,
                   'reconciliation', $8,
                   'Reconciliation: align stock_balances with batch_stock_balances total (audit Phase 4 follow-up).',
                   NOW(), NOW())`,
          [
            r.item_id,
            r.facility_id,
            r.store_id,
            r.tenant_id,
            systemUserId,
            r.diff,
            r.expected,
            balanceId,
          ],
        );

        await qr.commitTransaction();
        fixed++;
      } catch (err) {
        await qr.rollbackTransaction();
        failed++;
        console.error(
          `❌ Failed to reconcile facility=${r.facility_id} item=${r.item_id} store=${r.store_id ?? 'null'}:`,
          (err as Error).message,
        );
      }
    }

    console.log(`\n✅ Reconciliation complete. fixed=${fixed} failed=${failed}.`);
  } finally {
    await qr.release();
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
