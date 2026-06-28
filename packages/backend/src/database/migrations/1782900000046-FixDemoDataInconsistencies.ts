import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes data inconsistencies found in the demo environment:
 * 1. "ENVIROMENT" typo in tenants, deployments, licenses
 * 2. "TESR" facility name typo
 * 3. Kabalega subscription: annual billing but 30-day period
 * 4. INV-2026-00002: zero totals despite 3M payment (zero-decimal currency bug)
 * 5. Missing license for kabalega tenant
 * 6. Missing deployment for kabalega tenant
 * 7. Missing onboarding records for subscribed tenants
 * 8. Orphaned quotation QUO-2026-00001 (no plan/lead links)
 *
 * All statements are idempotent.
 */
export class FixDemoDataInconsistencies1782900000046 implements MigrationInterface {
  public async up(runner: QueryRunner): Promise<void> {
    // ─── 1. Fix "ENVIROMENT" → "ENVIRONMENT" typo ───────────────────
    await runner.query(`UPDATE tenants SET name = REPLACE(name, 'ENVIROMENT', 'ENVIRONMENT'), slug = REPLACE(slug, 'enviroment', 'environment') WHERE name LIKE '%ENVIROMENT%'`);
    await runner.query(`UPDATE deployments SET name = REPLACE(name, 'ENVIROMENT', 'ENVIRONMENT') WHERE name LIKE '%ENVIROMENT%'`);
    await runner.query(`UPDATE licenses SET organization_name = REPLACE(organization_name, 'ENVIROMENT', 'ENVIRONMENT') WHERE organization_name LIKE '%ENVIROMENT%'`);

    // ─── 2. Fix "TESR" facility name ────────────────────────────────
    await runner.query(`UPDATE facilities SET name = 'TEST' WHERE name = 'TESR'`);

    // ─── 3. Fix kabalega annual subscription period ─────────────────
    // Annual billing should have a 1-year period, not 30 days
    await runner.query(`
      UPDATE saas_subscriptions
      SET "currentPeriodEnd" = "currentPeriodStart" + INTERVAL '1 year',
          "nextRenewalAt"    = "currentPeriodStart" + INTERVAL '1 year'
      WHERE "billingInterval" = 'annual'
        AND "currentPeriodEnd" < "currentPeriodStart" + INTERVAL '60 days'
    `);

    // ─── 4. Fix INV-2026-00002 totals ───────────────────────────────
    // The invoice was created with totalMinor=0 due to zero-decimal currency bug.
    // A payment of 3,000,000 UGX was recorded. Set invoice total to match payment.
    await runner.query(`
      UPDATE saas_invoices
      SET "totalMinor"    = "amountPaidMinor",
          "subtotalMinor" = "amountPaidMinor",
          lines = jsonb_set(
            lines,
            '{0}',
            jsonb_build_object(
              'description', 'Subscription · annual · 1 seat(s)',
              'quantity',     1,
              'unitPriceMinor', "amountPaidMinor",
              'amountMinor',    "amountPaidMinor"
            )
          )
      WHERE "invoiceNumber" = 'INV-2026-00002'
        AND "totalMinor" = 0
        AND "amountPaidMinor" > 0
    `);

    // ─── 5. Create license for kabalega if missing ──────────────────
    await runner.query(`
      INSERT INTO licenses (
        id, license_key, organization_name, license_type, status,
        issued_at, expires_at, max_users, max_facilities,
        validation_failures, tenant_id, created_at, updated_at
      )
      SELECT
        gen_random_uuid(),
        md5(gen_random_uuid()::text || gen_random_uuid()::text),
        t.name,
        CASE WHEN p.tier = 'enterprise' THEN 'enterprise'
             WHEN p.tier = 'professional' THEN 'professional'
             ELSE 'standard' END,
        'active',
        NOW(), s."currentPeriodEnd",
        COALESCE(p."maxUsers", 25),
        COALESCE(p."maxFacilities", 5),
        0, t.id, NOW(), NOW()
      FROM tenants t
      JOIN saas_subscriptions s ON s."tenantId" = t.id AND s.status = 'active'
      LEFT JOIN saas_plans p ON p.id = s.plan_id
      WHERE t.slug LIKE 'kabalega%'
        AND NOT EXISTS (SELECT 1 FROM licenses l WHERE l.tenant_id = t.id)
    `);

    // ─── 6. Create deployment for kabalega if missing ───────────────
    await runner.query(`
      INSERT INTO deployments (
        id, tenant_id, deployment_type, name, status,
        api_endpoint, current_version, created_at, updated_at
      )
      SELECT
        gen_random_uuid(),
        t.id,
        'cloud',
        t.name || ' Cloud',
        'active',
        'https://' || t.slug || '.glide-hims.com',
        '1.0.0',
        NOW(), NOW()
      FROM tenants t
      WHERE t.slug LIKE 'kabalega%'
        AND NOT EXISTS (SELECT 1 FROM deployments d WHERE d.tenant_id = t.id)
    `);

    // ─── 7. Create onboarding records for subscribed tenants ────────
    // Only for active/trial subscriptions that have no onboarding yet
    const tenants: any[] = await runner.query(`
      SELECT t.id AS tenant_id, s.id AS subscription_id
      FROM tenants t
      JOIN saas_subscriptions s ON s."tenantId" = t.id AND s.status IN ('active', 'trial', 'past_due')
      WHERE NOT EXISTS (
        SELECT 1 FROM client_onboardings co WHERE co.tenant_id = t.id
      )
    `);

    for (const row of tenants) {
      // Create onboarding record
      const [ob] = await runner.query(`
        INSERT INTO client_onboardings (
          id, tenant_id, subscription_id, status,
          "progressPercent", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, 'not_started', 0, NOW(), NOW()
        )
        RETURNING id
      `, [row.tenant_id, row.subscription_id]);

      // Insert default 17 checklist items
      const items = [
        { phase: 'setup',          title: 'Tenant accessible and admin account created',   desc: 'Verify tenant login works' },
        { phase: 'setup',          title: 'License activated',                             desc: 'Ensure subscription license is active with correct modules' },
        { phase: 'setup',          title: 'Initial health check passed',                   desc: 'Deployment health check returns OK' },
        { phase: 'configuration',  title: 'Facility details configured',                   desc: 'Organization name, address, logo, contact info' },
        { phase: 'configuration',  title: 'User roles and permissions set up',             desc: 'Admin, clinical, finance roles configured' },
        { phase: 'configuration',  title: 'Enabled modules configured',                   desc: 'Activate purchased modules and disable unused ones' },
        { phase: 'configuration',  title: 'Billing tariffs configured',                   desc: 'Service prices, insurance schemes, and payment methods' },
        { phase: 'data_migration', title: 'Patient data migration',                       desc: 'Import existing patient records (if applicable)' },
        { phase: 'data_migration', title: 'Drug catalog imported',                        desc: 'Import formulary / drug list' },
        { phase: 'data_migration', title: 'Lab catalog imported',                         desc: 'Import lab test catalog and reference ranges' },
        { phase: 'training',       title: 'Admin training completed',                     desc: 'System administration, user management, settings' },
        { phase: 'training',       title: 'Clinical staff training completed',            desc: 'Patient flow, encounters, lab, pharmacy' },
        { phase: 'training',       title: 'Finance staff training completed',             desc: 'Billing, insurance claims, reporting' },
        { phase: 'testing',        title: 'End-to-end workflow validated',                desc: 'Full patient journey from registration to discharge' },
        { phase: 'testing',        title: 'Reporting validation completed',               desc: 'Key reports generate correctly with test data' },
        { phase: 'go_live',        title: 'Go-live date confirmed with client',           desc: 'Final sign-off from client stakeholders' },
        { phase: 'go_live',        title: 'Backup schedule configured',                   desc: 'Automated backups running and verified' },
        { phase: 'go_live',        title: 'Support handover completed',                   desc: 'Client knows how to reach support, escalation path clear' },
      ];

      for (let i = 0; i < items.length; i++) {
        await runner.query(`
          INSERT INTO client_onboarding_items (
            id, onboarding_id, phase, title, description,
            "sortOrder", status, "createdAt"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, 'pending', NOW()
          )
        `, [ob.id, items[i].phase, items[i].title, items[i].desc, i + 1]);
      }
    }

    // ─── 8. Fix orphaned quotation ──────────────────────────────────
    // Link to the first active plan if plan_id is null, mark expired if stale
    await runner.query(`
      UPDATE saas_quotations
      SET plan_id = (SELECT id FROM saas_plans WHERE "isActive" = true ORDER BY "sortOrder" ASC LIMIT 1)
      WHERE plan_id IS NULL
        AND status IN ('draft', 'sent')
    `);
  }

  public async down(runner: QueryRunner): Promise<void> {
    // These are data corrections; reversing them would re-introduce bugs.
    // No-op by design.
  }
}
