import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixQueueTicketUniqueIndex1774950000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old unique index on (ticket_number, queue_date) which doesn't account for facility
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_63b0207525954952d82164b0d9"`);

    // Create new unique index scoped to facility
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_queue_facility_ticket_date" ON "queues" ("facility_id", "ticket_number", "queue_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_queue_facility_ticket_date"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_63b0207525954952d82164b0d9" ON "queues" ("ticket_number", "queue_date")`,
    );
  }
}
