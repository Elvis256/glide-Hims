import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInsuranceFieldsToInvoice1774952000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Invoice-level insurance fields
    await queryRunner.query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS insurance_amount DECIMAL(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS copay_amount DECIMAL(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS patient_responsibility DECIMAL(12,2) DEFAULT 0
    `);

    // InvoiceItem-level insurance fields
    await queryRunner.query(`
      ALTER TABLE invoice_items
      ADD COLUMN IF NOT EXISTS insurance_covered BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS insurance_amount DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS copay_amount DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS coverage_note TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE invoices 
      DROP COLUMN IF EXISTS insurance_amount,
      DROP COLUMN IF EXISTS copay_amount,
      DROP COLUMN IF EXISTS patient_responsibility
    `);
    await queryRunner.query(`
      ALTER TABLE invoice_items
      DROP COLUMN IF EXISTS insurance_covered,
      DROP COLUMN IF EXISTS insurance_amount,
      DROP COLUMN IF EXISTS copay_amount,
      DROP COLUMN IF EXISTS coverage_note
    `);
  }
}
