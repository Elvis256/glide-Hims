import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner';
import { tenantContext } from '../context/tenant-context';

/**
 * Row-Level Security driver patch.
 *
 * Postgres RLS policies (see migration 1782900000062-RlsPhase1) filter rows by
 * the `app.tenant` GUC. Pooled connections are reused across requests, so the
 * GUC must be (re)set on the same connection each query batch runs on. The
 * only choke point every TypeORM access path shares — repository calls,
 * dataSource.transaction(), pessimistic locks, raw manager.query() — is
 * PostgresQueryRunner.query, so we patch it once at bootstrap.
 *
 * Why not SET LOCAL in an interceptor: SET LOCAL only lives inside a
 * transaction, and plain repository reads run as auto-commit statements on
 * per-query pool checkouts — the old TenantInterceptor approach never reached
 * them. set_config(..., false) is session-level and always issued on the exact
 * connection about to run the query, so stale values from previous checkouts
 * are overwritten every time.
 *
 * GUC resolution (documented in tenant-context.ts): request tenant, 'system'
 * for explicit system context and store-less background jobs, '' (deny) for
 * authenticated requests without a tenant.
 */
export function applyRlsDriverPatch(): void {
  const proto = PostgresQueryRunner.prototype as any;
  if (proto.__rlsPatched) return;
  proto.__rlsPatched = true;

  const originalQuery = proto.query;
  proto.query = async function (
    query: string,
    parameters?: any[],
    useStructuredResult?: boolean,
  ): Promise<any> {
    const store = tenantContext.getStore();
    const guc = store
      ? store.isSystemContext
        ? 'system'
        : (store.tenantId ?? '')
      : 'system';

    if (this.__rlsLastGuc !== guc || !this.__rlsGucSet) {
      await originalQuery.call(this, 'SELECT set_config($1, $2, false)', ['app.tenant', guc]);
      this.__rlsLastGuc = guc;
      this.__rlsGucSet = true;
    }

    return originalQuery.call(this, query, parameters, useStructuredResult);
  };
}
