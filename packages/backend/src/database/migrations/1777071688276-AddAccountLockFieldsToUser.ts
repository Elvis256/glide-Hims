import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAccountLockFieldsToUser1777071688276 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'failedLoginAttempts',
        type: 'int',
        default: 0,
      }),
    );
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'lockedUntil',
        type: 'timestamp',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'failedLoginAttempts');
    await queryRunner.dropColumn('users', 'lockedUntil');
  }
}
