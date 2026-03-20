import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddItemStrengths1774700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create item_strengths table (following same pattern as item_formulations)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS item_strengths (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        value VARCHAR(50),
        unit VARCHAR(20),
        description TEXT,
        sort_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        facility_id UUID,
        tenant_id UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      )
    `);

    // Unique index per facility
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_item_strengths_facility_code
      ON item_strengths (facility_id, code)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_item_strengths_facility_name
      ON item_strengths (facility_id, name)
    `);

    // Add strength_id FK to items table
    await queryRunner.query(`
      ALTER TABLE items ADD COLUMN IF NOT EXISTS strength_id UUID
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_items_strength_id ON items (strength_id)
    `);

    // Seed common pharmaceutical strengths
    // We insert without facility_id so they're available as system-wide defaults
    // The frontend will filter by facility; these serve as a starting seed
    const strengths = [
      ['5MG', '5mg', '5', 'mg'],
      ['10MG', '10mg', '10', 'mg'],
      ['20MG', '20mg', '20', 'mg'],
      ['25MG', '25mg', '25', 'mg'],
      ['50MG', '50mg', '50', 'mg'],
      ['100MG', '100mg', '100', 'mg'],
      ['125MG', '125mg', '125', 'mg'],
      ['200MG', '200mg', '200', 'mg'],
      ['250MG', '250mg', '250', 'mg'],
      ['400MG', '400mg', '400', 'mg'],
      ['500MG', '500mg', '500', 'mg'],
      ['1G', '1g', '1000', 'mg'],
      ['2G', '2g', '2000', 'mg'],
      ['5ML', '5ml', '5', 'ml'],
      ['10ML', '10ml', '10', 'ml'],
      ['50ML', '50ml', '50', 'ml'],
      ['100ML', '100ml', '100', 'ml'],
      ['250ML', '250ml', '250', 'ml'],
      ['500ML', '500ml', '500', 'ml'],
      ['1L', '1L', '1000', 'ml'],
      ['1PCT', '1%', '1', '%'],
      ['2PCT', '2%', '2', '%'],
      ['5PCT', '5%', '5', '%'],
      ['10PCT', '10%', '10', '%'],
      ['5MG_ML', '5mg/ml', '5', 'mg/ml'],
      ['10MG_ML', '10mg/ml', '10', 'mg/ml'],
      ['50MG_ML', '50mg/ml', '50', 'mg/ml'],
      ['100MG_ML', '100mg/ml', '100', 'mg/ml'],
    ];

    // Get all facilities with their tenant IDs for seeding
    const facilities = await queryRunner.query(
      `SELECT DISTINCT f.id AS facility_id, f.tenant_id
       FROM facilities f
       WHERE f.tenant_id IS NOT NULL`
    );

    for (const { facility_id, tenant_id } of facilities) {
      for (const [code, name, value, unit] of strengths) {
        await queryRunner.query(
          `INSERT INTO item_strengths (code, name, value, unit, facility_id, tenant_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [code, name, value, unit, facility_id, tenant_id]
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE items DROP COLUMN IF EXISTS strength_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS item_strengths`);
  }
}
