import { MigrationInterface, QueryRunner } from 'typeorm';

export class PosResiliencePayments1781000000000 implements MigrationInterface {
  name = 'PosResiliencePayments1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create pos_mobile_money_transactions table
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE pos_momo_status AS ENUM ('pending','success','failed','timeout','cancelled');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pos_mobile_money_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID,
        sale_id UUID NOT NULL REFERENCES pharmacy_sales(id),
        pos_shift_id UUID,
        pos_register_id UUID,
        provider VARCHAR(20) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        external_reference VARCHAR(255),
        status pos_momo_status NOT NULL DEFAULT 'pending',
        failure_reason TEXT,
        requested_by_id UUID NOT NULL,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ,
        retry_count INT NOT NULL DEFAULT 0,
        last_polled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_pos_momo_tenant_status ON pos_mobile_money_transactions(tenant_id, status);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_pos_momo_sale_id ON pos_mobile_money_transactions(sale_id);`,
    );

    // 2. Add offline columns to pharmacy_sales
    await queryRunner.query(`
      ALTER TABLE pharmacy_sales
        ADD COLUMN IF NOT EXISTS client_sale_id UUID,
        ADD COLUMN IF NOT EXISTS client_sequence_number INT,
        ADD COLUMN IF NOT EXISTS was_offline BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS original_offline_timestamp TIMESTAMPTZ;
    `);

    // 3. Unique partial index for offline idempotency
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pharmacy_sales_client_sale_id
        ON pharmacy_sales (tenant_id, client_sale_id)
        WHERE client_sale_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pharmacy_sales_client_sale_id`);
    await queryRunner.query(`ALTER TABLE pharmacy_sales
      DROP COLUMN IF EXISTS client_sale_id,
      DROP COLUMN IF EXISTS client_sequence_number,
      DROP COLUMN IF EXISTS was_offline,
      DROP COLUMN IF EXISTS original_offline_timestamp`);
    await queryRunner.query(`DROP TABLE IF EXISTS pos_mobile_money_transactions`);
    await queryRunner.query(`DROP TYPE IF EXISTS pos_momo_status`);
  }
}
