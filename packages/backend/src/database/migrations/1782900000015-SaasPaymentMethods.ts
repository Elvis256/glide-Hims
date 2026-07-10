import { MigrationInterface, QueryRunner } from 'typeorm';

export class SaasPaymentMethods1782900000015 implements MigrationInterface {
  name = 'SaasPaymentMethods1782900000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saas_payment_methods" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "kind" character varying(30) NOT NULL,
        "label" character varying(100) NOT NULL,
        "brand" character varying(30),
        "last4" character varying(8),
        "expMonth" integer,
        "expYear" integer,
        "holderName" character varying(150),
        "isDefault" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saas_payment_methods" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_saas_pm_tenant" ON "saas_payment_methods" ("tenantId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_saas_pm_default" ON "saas_payment_methods" ("isDefault");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "saas_payment_methods";`);
  }
}
