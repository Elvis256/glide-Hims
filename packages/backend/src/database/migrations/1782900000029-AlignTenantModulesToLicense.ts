import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Align each tenant's enabled-modules settings with the upper bound set
 * by its active license.
 *
 * Background: two code paths used to disagree on how license + tenant
 * settings combine. `auth.service.ts` was unioning license into settings
 * (FE saw modules the license didn't cover) while `module.guard.ts`
 * intersected (BE 403'd those same modules). The companion code change in
 * this commit makes `auth.service.ts` also intersect; this migration
 * cleans up the data so the FE and BE agree from the first request after
 * deploy without needing a cache flush.
 *
 * Idempotent: writes only when the resulting value differs.
 */
export class AlignTenantModulesToLicense1782900000029 implements MigrationInterface {
  name = 'AlignTenantModulesToLicense1782900000029';

  public async up(q: QueryRunner): Promise<void> {
    // 1) system_settings.enabled_modules → intersection with active license
    await q.query(`
      UPDATE system_settings ss
      SET value = sub.intersected,
          updated_at = NOW()
      FROM (
        SELECT ss2.id,
               (
                 SELECT COALESCE(jsonb_agg(m ORDER BY m), '[]'::jsonb)
                 FROM (
                   SELECT DISTINCT s.m AS m
                   FROM jsonb_array_elements_text(
                          CASE jsonb_typeof(ss2.value)
                            WHEN 'array' THEN ss2.value
                            WHEN 'string' THEN (ss2.value #>> '{}')::jsonb
                            ELSE '[]'::jsonb
                          END
                        ) s(m)
                   WHERE EXISTS (
                     SELECT 1
                     FROM jsonb_array_elements_text(l.enabled_modules) lm(x)
                     WHERE lm.x = s.m
                   )
                 ) k
               ) AS intersected
        FROM system_settings ss2
        JOIN licenses l
          ON l.tenant_id = ss2.tenant_id
         AND l.status = 'active'
        WHERE ss2.key = 'enabled_modules'
          AND ss2.deleted_at IS NULL
      ) sub
      WHERE ss.id = sub.id
        AND ss.value::text IS DISTINCT FROM sub.intersected::text;
    `);

    // 2) tenants.settings -> 'enabledModules' → intersection with active license
    await q.query(`
      UPDATE tenants t
      SET settings = jsonb_set(
                       COALESCE(t.settings, '{}'::jsonb),
                       '{enabledModules}',
                       sub.intersected,
                       true
                     ),
          updated_at = NOW()
      FROM (
        SELECT t2.id,
               (
                 SELECT COALESCE(jsonb_agg(m ORDER BY m), '[]'::jsonb)
                 FROM (
                   SELECT DISTINCT s.m AS m
                   FROM jsonb_array_elements_text(
                          COALESCE(t2.settings->'enabledModules', '[]'::jsonb)
                        ) s(m)
                   WHERE EXISTS (
                     SELECT 1
                     FROM jsonb_array_elements_text(l.enabled_modules) lm(x)
                     WHERE lm.x = s.m
                   )
                 ) k
               ) AS intersected
        FROM tenants t2
        JOIN licenses l
          ON l.tenant_id = t2.id
         AND l.status = 'active'
        WHERE t2.deleted_at IS NULL
          AND t2.settings ? 'enabledModules'
      ) sub
      WHERE t.id = sub.id
        AND (t.settings->'enabledModules')::text IS DISTINCT FROM sub.intersected::text;
    `);
  }

  public async down(_q: QueryRunner): Promise<void> {
    // Intentionally a no-op. The pre-migration state was a license/settings
    // drift bug; reverting would re-introduce phantom modules in tenant
    // settings without restoring any meaningful information.
  }
}
