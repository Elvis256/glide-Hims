import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserEmployeeEnhancements1774200000000 implements MigrationInterface {
  name = 'UserEmployeeEnhancements1774200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- 1. Add new columns to users table ---
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "reports_to_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD CONSTRAINT "FK_users_reports_to"
        FOREIGN KEY ("reports_to_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // --- 2. Create login_history table ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "login_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "user_id" uuid NOT NULL,
        "ip_address" varchar(45),
        "user_agent" varchar(500),
        "success" boolean NOT NULL DEFAULT true,
        "failure_reason" varchar(255),
        "login_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_login_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_login_history_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_login_history_user_id" ON "login_history" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_login_history_login_at" ON "login_history" ("login_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_login_history_tenant" ON "login_history" ("tenant_id")`,
    );

    // --- 3. Create delegations table ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "delegations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "delegator_id" uuid NOT NULL,
        "delegate_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "reason" text,
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_delegations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_delegations_delegator" FOREIGN KEY ("delegator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_delegations_delegate" FOREIGN KEY ("delegate_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_delegations_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_delegations_delegate_status" ON "delegations" ("delegate_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_delegations_delegator" ON "delegations" ("delegator_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_delegations_tenant" ON "delegations" ("tenant_id")`,
    );

    // --- 4. Create approval_requests table ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "approval_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "operation_type" varchar(50) NOT NULL,
        "requested_by_id" uuid NOT NULL,
        "operation_data" jsonb,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "approved_by_id" uuid,
        "approved_at" TIMESTAMP,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_approval_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_approval_requests_requested_by" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_approval_requests_approved_by" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_approval_requests_tenant" ON "approval_requests" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_approval_requests_status" ON "approval_requests" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_approval_requests_requested_by" ON "approval_requests" ("requested_by_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "approval_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "delegations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "login_history"`);

    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_reports_to"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "reports_to_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "token_version"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "must_change_password"`);
  }
}
