import { MigrationInterface } from 'typeorm';

/**
 * RETIRED — this migration is intentionally a no-op.
 *
 * It used to enable RLS and create a `tenant_isolation_<table>` policy on
 * every table that had a tenant_id column *at the moment it ran*. Two things
 * were wrong with it, and both only became visible once the chain could build
 * a database from empty:
 *
 *  1. Wrong GUC. Its policy compared tenant_id against
 *     `current_setting('app.tenant_id')`, but the RLS driver patch
 *     (common/database/rls-driver-patch.ts) sets `app.tenant`. The setting was
 *     never populated, so the comparison was NULL and the policy reduced to
 *     `tenant_id IS NULL` — it granted nothing and hid everything else.
 *  2. Non-deterministic scope. Because it enumerated tables at run time, its
 *     effect depended entirely on how much of the schema happened to exist
 *     when it executed. On every real deployment it ran early against a nearly
 *     empty schema and covered almost nothing; production carries zero of
 *     these policies today. Against a schema built from
 *     BaselineSchema1690000000000 it instead matched 226 tables, and applying
 *     rule (1) to the platform catalog (users, roles, permissions, sessions,
 *     ...) made every tenant-scoped row invisible to the runtime role — a
 *     fresh install could not authenticate anyone.
 *
 * RlsPhase1/2/3 (1782900000062-64) are the real policy set: explicit table
 * lists, the correct `app.tenant` GUC, and a documented exclusion list for the
 * platform catalog that is read during pre-auth flows.
 *
 * The body is emptied rather than the file deleted: this migration is recorded
 * as applied in every existing deployment's ledger, and TypeORM needs the
 * class to resolve for `migration:revert` and for anything that reads the
 * chain. Re-running it must do nothing, which is what it now does.
 * DropLegacyDynamicRlsPolicies1782900000088 remains as the cleanup for any
 * database where this migration did leave policies behind.
 */
export class EnableRowLevelSecurity1775300000000 implements MigrationInterface {
  name = 'EnableRowLevelSecurity1775300000000';

  public async up(): Promise<void> {
    // Deliberately empty — see the note above.
  }

  public async down(): Promise<void> {
    // Deliberately empty. The original down() dropped tenant_isolation_<table>
    // policies and disabled RLS on every table with a tenant_id column, which
    // would now strip the policies RlsPhase1-3 own.
  }
}
