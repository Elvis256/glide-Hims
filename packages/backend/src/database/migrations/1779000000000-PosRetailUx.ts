import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase B — Retail UX
 * Additive-only migration. No data backfill. All new columns nullable.
 */
export class PosRetailUx1779000000000 implements MigrationInterface {
  name = 'PosRetailUx1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── B2: void columns on pharmacy_sales ───────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE pharmacy_sales
        ADD COLUMN IF NOT EXISTS voided_at       TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS void_reason     TEXT,
        ADD COLUMN IF NOT EXISTS voided_by_id    UUID
    `);

    // ── B4: discount approval columns on pharmacy_sales ──────────────────────
    await queryRunner.query(`
      ALTER TABLE pharmacy_sales
        ADD COLUMN IF NOT EXISTS discount_approver_id      UUID,
        ADD COLUMN IF NOT EXISTS discount_approval_reason  TEXT
    `);

    // ── B4: per-line discount columns on pharmacy_sale_items ─────────────────
    await queryRunner.query(`
      ALTER TABLE pharmacy_sale_items
        ADD COLUMN IF NOT EXISTS discount_amount  NUMERIC(12,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS discount_reason  TEXT
    `);

    // ── B1: pharmacy_returns table ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pharmacy_returns (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        return_number       VARCHAR     NOT NULL UNIQUE,
        original_sale_id    UUID        NOT NULL REFERENCES pharmacy_sales(id),
        returned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        returned_by_id      UUID        NOT NULL,
        reason              TEXT        NOT NULL,
        total_refund        NUMERIC(12,2) NOT NULL DEFAULT 0,
        payment_method      VARCHAR     NOT NULL DEFAULT 'cash',
        refund_reference    VARCHAR,
        pos_shift_id        UUID,
        pos_register_id     UUID,
        status              VARCHAR     NOT NULL DEFAULT 'completed',
        efris_credit_note_id UUID
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_pharmacy_returns_tenant_sale
        ON pharmacy_returns(tenant_id, original_sale_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_pharmacy_returns_tenant_date
        ON pharmacy_returns(tenant_id, returned_at)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_pharmacy_returns_tenant_shift
        ON pharmacy_returns(tenant_id, pos_shift_id)
    `);

    // ── B1: pharmacy_return_items table ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pharmacy_return_items (
        id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             UUID,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
        return_id             UUID        NOT NULL REFERENCES pharmacy_returns(id) ON DELETE CASCADE,
        original_sale_item_id UUID        NOT NULL REFERENCES pharmacy_sale_items(id),
        item_id               VARCHAR     NOT NULL,
        batch_id              VARCHAR,
        qty_returned          INT         NOT NULL,
        unit_price            NUMERIC(10,2) NOT NULL,
        tax_amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
        net_amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
        gross_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
        restockable           BOOLEAN     NOT NULL DEFAULT TRUE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_return_items_return_id ON pharmacy_return_items(return_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_return_items_sale_item ON pharmacy_return_items(original_sale_item_id)
    `);

    // ── B3: held_sales table ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS held_sales (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        pos_shift_id    UUID,
        pos_register_id UUID,
        cashier_id      UUID        NOT NULL,
        customer_name   VARCHAR,
        customer_phone  VARCHAR,
        cart_snapshot   JSONB       NOT NULL DEFAULT '{}',
        hold_reason     VARCHAR,
        held_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at      TIMESTAMPTZ NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_held_sales_tenant_shift
        ON held_sales(tenant_id, pos_shift_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_held_sales_tenant_register
        ON held_sales(tenant_id, pos_register_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_held_sales_expires_at ON held_sales(expires_at)
    `);

    // ── B4: discount_applications audit log ──────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS discount_applications (
        id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        UUID,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        sale_id          UUID        NOT NULL REFERENCES pharmacy_sales(id),
        sale_item_id     UUID        REFERENCES pharmacy_sale_items(id),
        type             VARCHAR     NOT NULL DEFAULT 'line',
        value            NUMERIC(10,2) NOT NULL,
        value_type       VARCHAR     NOT NULL DEFAULT 'amount',
        reason           TEXT        NOT NULL,
        approver_id      UUID,
        approver_pin_hash VARCHAR,
        applied_by_id    UUID        NOT NULL,
        applied_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_discount_apps_tenant_sale
        ON discount_applications(tenant_id, sale_id)
    `);

    // ── B6: receipt_reprints audit log ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS receipt_reprints (
        id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        UUID,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        sale_id          UUID        NOT NULL REFERENCES pharmacy_sales(id),
        reprinted_by_id  UUID        NOT NULL,
        reprint_count    INT         NOT NULL DEFAULT 1,
        reprinted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_receipt_reprints_tenant_sale
        ON receipt_reprints(tenant_id, sale_id)
    `);

    // ── B7: pos_quick_keys table ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pos_quick_keys (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        register_id     UUID,
        position        INT         NOT NULL,
        item_id         VARCHAR     NOT NULL,
        label           VARCHAR     NOT NULL,
        color           VARCHAR,
        created_by_id   UUID        NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_quick_keys_tenant_register
        ON pos_quick_keys(tenant_id, register_id)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_quick_key_position
        ON pos_quick_keys(tenant_id, register_id, position)
        WHERE register_id IS NOT NULL
    `);

    // ── B8: retail_customers table ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS retail_customers (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        phone           VARCHAR     NOT NULL,
        name            VARCHAR,
        total_visits    INT         NOT NULL DEFAULT 0,
        total_spend     NUMERIC(14,2) NOT NULL DEFAULT 0,
        first_seen_at   TIMESTAMPTZ,
        last_seen_at    TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_retail_customers_tenant_phone
        ON retail_customers(tenant_id, phone)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_retail_customer_tenant_phone
        ON retail_customers(tenant_id, phone)
        WHERE tenant_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS retail_customers`);
    await queryRunner.query(`DROP TABLE IF EXISTS pos_quick_keys`);
    await queryRunner.query(`DROP TABLE IF EXISTS receipt_reprints`);
    await queryRunner.query(`DROP TABLE IF EXISTS discount_applications`);
    await queryRunner.query(`DROP TABLE IF EXISTS held_sales`);
    await queryRunner.query(`DROP TABLE IF EXISTS pharmacy_return_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS pharmacy_returns`);

    await queryRunner.query(`ALTER TABLE pharmacy_sale_items DROP COLUMN IF EXISTS discount_amount, DROP COLUMN IF EXISTS discount_reason`);
    await queryRunner.query(`ALTER TABLE pharmacy_sales DROP COLUMN IF EXISTS voided_at, DROP COLUMN IF EXISTS void_reason, DROP COLUMN IF EXISTS voided_by_id, DROP COLUMN IF EXISTS discount_approver_id, DROP COLUMN IF EXISTS discount_approval_reason`);
  }
}
