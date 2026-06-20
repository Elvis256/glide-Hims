import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackupSchedules1782900000044 implements MigrationInterface {
  name = 'BackupSchedules1782900000044';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "backup_schedules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "frequency" varchar(20) NOT NULL,
        "time_of_day" varchar(5) NOT NULL,
        "day_of_week" int,
        "day_of_month" int,
        "retention_days" int NOT NULL DEFAULT 30,
        "enabled" boolean NOT NULL DEFAULT true,
        "last_run_at" TIMESTAMP,
        "last_run_status" varchar(20),
        "next_run_at" TIMESTAMP,
        CONSTRAINT "PK_backup_schedules" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "backup_schedules"`);
  }
}
