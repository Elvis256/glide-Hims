import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateOrdersTable1700000000000 implements MigrationInterface {
  name = 'CreateOrdersTable1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'orders',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'order_number',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'order_type',
            type: 'enum',
            enum: ['lab', 'radiology', 'pharmacy', 'procedure'],
            default: "'lab'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'in_progress', 'completed', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'priority',
            type: 'enum',
            enum: ['routine', 'urgent', 'stat'],
            default: "'routine'",
          },
          {
            name: 'instructions',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'clinical_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'test_codes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'assigned_to',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'encounter_id',
            type: 'uuid',
          },
          {
            name: 'ordered_by_id',
            type: 'uuid',
          },
          {
            name: 'completed_by_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reviewed_by_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reviewed_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        columnNames: ['encounter_id', 'order_type'],
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        columnNames: ['status', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        columnNames: ['tenant_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('orders');
  }
}
