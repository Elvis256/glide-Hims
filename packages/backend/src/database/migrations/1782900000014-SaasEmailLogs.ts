import { MigrationInterface, QueryRunner } from 'typeorm';

export class SaasEmailLogs1782900000014 implements MigrationInterface {
  name = 'SaasEmailLogs1782900000014';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS saas_email_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NULL,
        "templateKey" varchar(50) NOT NULL,
        "to" varchar(255) NULL,
        subject text NOT NULL,
        status varchar(20) NOT NULL,
        error text NULL,
        "invoiceId" uuid NULL,
        "subscriptionId" uuid NULL,
        "isTest" boolean NOT NULL DEFAULT false,
        "bodyPreview" text NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_saas_email_logs_tenant ON saas_email_logs ("tenantId")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_saas_email_logs_template ON saas_email_logs ("templateKey")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_saas_email_logs_status ON saas_email_logs (status)`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_saas_email_logs_created ON saas_email_logs ("createdAt")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS saas_email_logs`);
  }
}
