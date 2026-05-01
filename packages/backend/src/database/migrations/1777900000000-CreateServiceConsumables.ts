import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateServiceConsumables1777900000000 implements MigrationInterface {
  name = 'CreateServiceConsumables1777900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "service_consumables" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        "service_id" uuid NOT NULL,
        "item_id" uuid NOT NULL,
        "quantity" numeric(12,3) NOT NULL DEFAULT 1,
        "is_optional" boolean NOT NULL DEFAULT false,
        "notes" text,
        CONSTRAINT "PK_service_consumables" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_service_consumable" UNIQUE ("service_id","item_id"),
        CONSTRAINT "FK_service_consumables_service" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_service_consumables_item" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_service_consumables_service" ON "service_consumables" ("service_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_service_consumables_item" ON "service_consumables" ("item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_service_consumables_tenant" ON "service_consumables" ("tenant_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "service_consumables"`);
  }
}
