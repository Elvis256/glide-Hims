import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SchedulesService.delete() uses softRemove(), but the entity/table had no
 * delete-date column — DELETE /schedules/:id threw
 * MissingDeleteDateColumnError (500) since inception.
 */
export class DoctorSchedulesDeletedAt1782900000078 implements MigrationInterface {
  name = 'DoctorSchedulesDeletedAt1782900000078';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "doctor_schedules" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "doctor_schedules" DROP COLUMN IF EXISTS "deleted_at"`,
    );
  }
}
