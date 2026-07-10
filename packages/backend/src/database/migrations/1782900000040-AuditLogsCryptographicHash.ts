import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AuditLogsCryptographicHash1782900000040 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('audit_logs', [
      new TableColumn({
        name: 'hash',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({
        name: 'previous_hash',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    ]);

    await queryRunner.addColumns('admin_audit_log', [
      new TableColumn({
        name: 'hash',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({
        name: 'previous_hash',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('admin_audit_log', 'previous_hash');
    await queryRunner.dropColumn('admin_audit_log', 'hash');
    await queryRunner.dropColumn('audit_logs', 'previous_hash');
    await queryRunner.dropColumn('audit_logs', 'hash');
  }
}
