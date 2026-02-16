import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserIdToPatients1771277200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add user_id column to patients table
    await queryRunner.query(`
      ALTER TABLE patients 
      ADD COLUMN IF NOT EXISTS user_id UUID NULL;
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE patients 
      ADD CONSTRAINT fk_patients_user 
      FOREIGN KEY (user_id) REFERENCES users(id) 
      ON DELETE SET NULL;
    `);

    // Add index for performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_user_id 
      ON patients(user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patients_user_id;`);
    await queryRunner.query(`ALTER TABLE patients DROP CONSTRAINT IF EXISTS fk_patients_user;`);
    await queryRunner.query(`ALTER TABLE patients DROP COLUMN IF EXISTS user_id;`);
  }
}
