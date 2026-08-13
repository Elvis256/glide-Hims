import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Move the tenants.slug column creation and slug backfill out of
 * TenantsService.onModuleInit() and into a migration, where they belong.
 *
 * The service ran `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug ...` on
 * every boot. That can never succeed under the RLS role split introduced by
 * RlsPhase1: the app connects as `glide_hims_runtime`, a deliberate non-owner,
 * so PostgreSQL rejects the DDL with `must be owner of table tenants`. The
 * error was swallowed by a .catch(), so each startup silently logged a failure
 * and moved on — the column only existed because some earlier environment had
 * created it by other means. A database built purely from migrations never got
 * the column at all.
 *
 * The backfill had the same problem in milder form: createTenant() has always
 * assigned a slug (see TenantsService.createTenant), so the NULL-slug sweep is
 * historical repair work, not steady-state behaviour. Re-running it on every
 * boot cost a table scan per process start and could race between instances.
 *
 * Both steps are idempotent, so this is a no-op on databases that already went
 * through the old startup path.
 */
export class TenantSlugColumnAndBackfill1782900000083 implements MigrationInterface {
  name = 'TenantSlugColumnAndBackfill1782900000083';

  // TypeORM's hash-derived names for Tenant.slug's @Column({unique}) and
  // @Index({unique}). Reused verbatim so a schema diff against the entity
  // stays clean instead of proposing a rename.
  private readonly uniqueConstraint = 'UQ_2310ecc5cb8be427097154b18fc';
  private readonly uniqueIndex = 'IDX_2310ecc5cb8be427097154b18f';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "slug" character varying(100)`,
    );

    // Backfill before adding the unique index, so a database that somehow holds
    // duplicate NULLs fails on the index rather than midway through the sweep.
    //
    // Mirrors TenantsService.generateSlug: lowercase, drop anything outside
    // [a-z0-9\s-], collapse whitespace to '-', collapse repeated '-', trim
    // leading/trailing '-'. The empty-base guard is new — a name consisting
    // only of punctuation used to slugify to '', and the second such tenant
    // would then collide on the unique index.
    await queryRunner.query(`
      DO $$
      DECLARE
        r RECORD;
        base TEXT;
        candidate TEXT;
        n INT;
      BEGIN
        FOR r IN SELECT id, name FROM tenants WHERE slug IS NULL LOOP
          base := regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        regexp_replace(lower(btrim(r.name)), '[^a-z0-9[:space:]-]', '', 'g'),
                      '[[:space:]]+', '-', 'g'),
                    '-+', '-', 'g'),
                  '^-|-$', '', 'g');
          IF base = '' THEN
            base := 'tenant';
          END IF;

          candidate := base;
          n := 1;
          WHILE EXISTS (SELECT 1 FROM tenants WHERE slug = candidate) LOOP
            candidate := base || '-' || n;
            n := n + 1;
          END LOOP;

          UPDATE tenants SET slug = candidate WHERE id = r.id;
        END LOOP;
      END
      $$;
    `);

    // Skip when the constraint already exists — on those databases the index
    // below is the constraint's own and must not be created a second time.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = '${this.uniqueConstraint}'
        ) THEN
          ALTER TABLE "tenants"
            ADD CONSTRAINT "${this.uniqueConstraint}" UNIQUE ("slug");
        END IF;
      END
      $$;
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "${this.uniqueIndex}" ON "tenants" ("slug")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "${this.uniqueIndex}"`);
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "${this.uniqueConstraint}"`,
    );
    // The column itself is left in place: dropping it would discard slugs that
    // are referenced by tenant URLs and by FixDemoDataInconsistencies.
  }
}
