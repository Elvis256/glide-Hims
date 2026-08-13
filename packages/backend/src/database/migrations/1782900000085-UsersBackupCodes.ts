import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add the missing `users.backup_codes` column.
 *
 * User.backupCodes has always been declared (jsonb, name: 'backup_codes',
 * select: false) but no migration ever created the column. Because the column
 * is `select: false` it stayed invisible to ordinary reads — the failure only
 * bites on write: AdminMfaService.enable() assigns `admin.backupCodes` and
 * saves, so admin 2FA enrolment failed with `column "backup_codes" of relation
 * "users" does not exist`, and backup-code verification could never match.
 *
 * Nullable with no default: existing users simply have no codes until they
 * enrol. Values are hashed before storage (AdminMfaService.hashBackupCode).
 */
export class UsersBackupCodes1782900000085 implements MigrationInterface {
  name = 'UsersBackupCodes1782900000085';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "backup_codes" jsonb NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "backup_codes"`);
  }
}
