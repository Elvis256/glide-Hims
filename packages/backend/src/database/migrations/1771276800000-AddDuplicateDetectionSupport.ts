import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDuplicateDetectionSupport1771276800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pg_trgm extension for fuzzy text matching (SIMILARITY function)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // Add indexes for duplicate detection performance
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_patients_full_name ON patients (full_name);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_patients_date_of_birth ON patients (date_of_birth);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients (phone);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_patients_full_name_dob ON patients (full_name, date_of_birth);`);
    
    // GIN index for trigram similarity search on full_name
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_patients_full_name_trgm ON patients USING gin (full_name gin_trgm_ops);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patients_full_name_trgm;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patients_full_name_dob;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patients_phone;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patients_date_of_birth;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patients_full_name;`);
    // Note: We don't drop the extension as other parts might use it
  }
}
