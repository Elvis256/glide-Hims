import { AsyncLocalStorage } from 'async_hooks';

/**
 * Per-request (or per-job) tenant context propagated via AsyncLocalStorage.
 *
 * Consumed by the RLS driver patch (see ../database/rls-driver-patch.ts),
 * which forwards it to PostgreSQL as the `app.tenant` GUC on every query:
 *
 *   store.isSystemContext === true  -> app.tenant = 'system'  (RLS bypass policy)
 *   store.tenantId set              -> app.tenant = <uuid>    (rows of that tenant)
 *   store present, no tenantId      -> app.tenant = ''        (default-deny)
 *   no store (background jobs)      -> app.tenant = 'system'  (trusted system code)
 *
 * HTTP requests ALWAYS have a store (TenantInterceptor), so a system admin
 * request without a tenant resolves to default-deny on RLS-protected tables
 * unless the endpoint explicitly opts into system context.
 */
export interface TenantStore {
  tenantId?: string;
  isSystemContext?: boolean;
}

export const tenantContext = new AsyncLocalStorage<TenantStore>();

/** Run `fn` scoped to a specific tenant (crons iterating tenants, workers). */
export function withTenant<T>(tenantId: string, fn: () => Promise<T> | T): Promise<T> | T {
  return tenantContext.run({ tenantId }, fn);
}

/**
 * Run `fn` with cross-tenant (system) visibility. Reserve for platform-admin
 * endpoints and trusted background jobs; every use is a deliberate bypass of
 * tenant isolation.
 */
export function withSystemContext<T>(fn: () => Promise<T> | T): Promise<T> | T {
  return tenantContext.run({ isSystemContext: true }, fn);
}
