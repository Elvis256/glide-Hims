import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAssignedToOrder1707408000000 implements MigrationInterface {
    name = 'AddAssignedToOrder1707408000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "assigned_to" varchar`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "assigned_to"`);
    }
}
