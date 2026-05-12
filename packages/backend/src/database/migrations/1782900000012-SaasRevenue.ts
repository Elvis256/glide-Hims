import { MigrationInterface, QueryRunner } from 'typeorm';

export class SaasRevenue1782900000012 implements MigrationInterface {
  name = 'SaasRevenue1782900000012';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "saas_plans" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" varchar(100) NOT NULL UNIQUE,
        "name" varchar(200) NOT NULL,
        "description" text,
        "tier" varchar(50) NOT NULL DEFAULT 'professional',
        "priceMonthlyMinor" integer NOT NULL DEFAULT 0,
        "priceAnnualMinor" integer NOT NULL DEFAULT 0,
        "currency" varchar(3) NOT NULL DEFAULT 'UGX',
        "annualDiscountPercent" integer NOT NULL DEFAULT 0,
        "trialDays" integer NOT NULL DEFAULT 0,
        "maxUsers" integer,
        "maxFacilities" integer,
        "enabledModules" jsonb,
        "features" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "isPublic" boolean NOT NULL DEFAULT false,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "saas_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "deploymentId" uuid,
        "leadId" uuid,
        "plan_id" uuid NOT NULL REFERENCES "saas_plans"("id"),
        "status" varchar(30) NOT NULL DEFAULT 'trial',
        "billingInterval" varchar(20) NOT NULL DEFAULT 'monthly',
        "currency" varchar(3) NOT NULL DEFAULT 'UGX',
        "unitPriceMinor" integer NOT NULL DEFAULT 0,
        "seats" integer NOT NULL DEFAULT 1,
        "couponId" uuid,
        "discountPercent" integer NOT NULL DEFAULT 0,
        "discountFixedMinor" integer NOT NULL DEFAULT 0,
        "startDate" timestamp NOT NULL,
        "trialEndsAt" timestamp,
        "currentPeriodStart" timestamp,
        "currentPeriodEnd" timestamp,
        "nextRenewalAt" timestamp,
        "cancelledAt" timestamp,
        "churnedAt" timestamp,
        "lastInvoicedAt" timestamp,
        "autoRenew" boolean NOT NULL DEFAULT true,
        "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false,
        "notes" text,
        "metadata" jsonb,
        "failedPaymentAttempts" integer NOT NULL DEFAULT 0,
        "lastDunningAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_saas_subs_tenant" ON "saas_subscriptions"("tenantId");
      CREATE INDEX IF NOT EXISTS "idx_saas_subs_status" ON "saas_subscriptions"("status");
      CREATE INDEX IF NOT EXISTS "idx_saas_subs_renew" ON "saas_subscriptions"("nextRenewalAt");
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "saas_invoices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "invoiceNumber" varchar(50) NOT NULL UNIQUE,
        "subscription_id" uuid NOT NULL REFERENCES "saas_subscriptions"("id") ON DELETE CASCADE,
        "tenantId" uuid NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'draft',
        "currency" varchar(3) NOT NULL DEFAULT 'UGX',
        "subtotalMinor" integer NOT NULL DEFAULT 0,
        "discountMinor" integer NOT NULL DEFAULT 0,
        "taxMinor" integer NOT NULL DEFAULT 0,
        "totalMinor" integer NOT NULL DEFAULT 0,
        "amountPaidMinor" integer NOT NULL DEFAULT 0,
        "issuedAt" timestamp NOT NULL,
        "dueAt" timestamp NOT NULL,
        "paidAt" timestamp,
        "periodStart" timestamp,
        "periodEnd" timestamp,
        "memo" text,
        "lines" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_saas_inv_sub" ON "saas_invoices"("subscription_id");
      CREATE INDEX IF NOT EXISTS "idx_saas_inv_status" ON "saas_invoices"("status");
      CREATE INDEX IF NOT EXISTS "idx_saas_inv_due" ON "saas_invoices"("dueAt");
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "saas_payments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "invoiceId" uuid NOT NULL,
        "subscriptionId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'UGX',
        "amountMinor" integer NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'succeeded',
        "gateway" varchar(50) NOT NULL DEFAULT 'manual',
        "gatewayRef" varchar(200),
        "method" varchar(50),
        "gatewayPayload" jsonb,
        "paidAt" timestamp NOT NULL,
        "recordedBy" uuid,
        "notes" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_saas_pay_inv" ON "saas_payments"("invoiceId");
      CREATE INDEX IF NOT EXISTS "idx_saas_pay_status" ON "saas_payments"("status");
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "saas_coupons" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" varchar(50) NOT NULL UNIQUE,
        "discountType" varchar(20) NOT NULL DEFAULT 'percent',
        "amount" integer NOT NULL DEFAULT 0,
        "currency" varchar(3) NOT NULL DEFAULT 'UGX',
        "maxRedemptions" integer,
        "timesRedeemed" integer NOT NULL DEFAULT 0,
        "durationMonths" integer,
        "expiresAt" timestamp,
        "appliesToPlanIds" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "notes" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "saas_subscription_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "subscriptionId" uuid NOT NULL,
        "type" varchar(50) NOT NULL,
        "message" text,
        "payload" jsonb,
        "actorId" uuid,
        "createdAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_saas_evt_sub" ON "saas_subscription_events"("subscriptionId");
      CREATE INDEX IF NOT EXISTS "idx_saas_evt_type" ON "saas_subscription_events"("type");
    `);

    // Seed default plan catalog (idempotent).
    await q.query(`
      INSERT INTO "saas_plans" (code, name, description, tier, "priceMonthlyMinor", "priceAnnualMinor", currency, "annualDiscountPercent", "trialDays", "maxUsers", "maxFacilities", "enabledModules", features, "isActive", "isPublic", "sortOrder")
      VALUES
        ('community', 'Community', 'Free for very small clinics, single facility, basic modules.', 'community', 0, 0, 'UGX', 0, 0, 5, 1,
          '["patients","encounters","prescriptions","billing"]'::jsonb,
          '{"support":"community","sla":null,"backups":"weekly"}'::jsonb, true, true, 1),
        ('professional', 'Professional', 'Mid-sized facilities, full clinical + finance modules.', 'professional', 1500000, 15000000, 'UGX', 17, 14, 50, 1,
          '["patients","encounters","prescriptions","billing","lab","pharmacy","inventory","finance","insurance","analytics"]'::jsonb,
          '{"support":"email","sla":"next-business-day","backups":"daily"}'::jsonb, true, true, 2),
        ('enterprise', 'Enterprise', 'Hospital chains, all modules, multi-facility, dedicated support.', 'enterprise', 4500000, 45000000, 'UGX', 17, 30, 250, 10,
          '["all"]'::jsonb,
          '{"support":"24x7","sla":"4-hour","backups":"hourly","dedicated_csm":true,"on_prem_option":true}'::jsonb, true, true, 3)
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "saas_subscription_events";`);
    await q.query(`DROP TABLE IF EXISTS "saas_payments";`);
    await q.query(`DROP TABLE IF EXISTS "saas_invoices";`);
    await q.query(`DROP TABLE IF EXISTS "saas_subscriptions";`);
    await q.query(`DROP TABLE IF EXISTS "saas_coupons";`);
    await q.query(`DROP TABLE IF EXISTS "saas_plans";`);
  }
}
