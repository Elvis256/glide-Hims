import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a 'processing' claim state to patient reminder status so concurrent
 * "process pending" runs can atomically claim a reminder before dispatching
 * SMS/email — without it, overlapping runs double-send to patients.
 * (PG enum values cannot be removed; down is a no-op.)
 */
export class ReminderProcessingStatus1782900000068 implements MigrationInterface {
  name = 'ReminderProcessingStatus1782900000068';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "patient_reminders_status_enum" ADD VALUE IF NOT EXISTS 'processing'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL cannot drop enum values; leaving 'processing' in place is harmless.
  }
}
