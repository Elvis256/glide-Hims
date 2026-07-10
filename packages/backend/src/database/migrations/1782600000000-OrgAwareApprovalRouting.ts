import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Org-aware approval routing — schema layer.
 *
 * Adds:
 *   - employees.manager_id   (direct supervisor FK)
 *   - employees.position_id  (link to positions catalog)
 *   - positions              (job-title catalog with rank for org-aware policies)
 *   - procurement_approval_policies      (scoped, prioritised policy headers)
 *   - procurement_approval_policy_steps  (ordered approval steps inside a policy)
 *   - approver_groups + approver_group_members (M-of-N committees)
 *   - approval_delegations   (per-document-type OOO stand-ins)
 *
 * All tables enforce tenant_id NOT NULL where the parent business data is
 * tenant-scoped, matching the platform convention.
 */
export class OrgAwareApprovalRouting1782600000000 implements MigrationInterface {
  name = 'OrgAwareApprovalRouting1782600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -----------------------------------------------------------------
    // positions catalog
    // -----------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "positions" (
        "id"           uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"    uuid NOT NULL,
        "created_at"   TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMP NULL,
        "name"         varchar(120) NOT NULL,
        "code"         varchar(50)  NULL,
        "rank"         int NOT NULL DEFAULT 0,
        "description"  text NULL,
        "is_active"    boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_positions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_positions_tenant_code" UNIQUE ("tenant_id","code")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_positions_tenant" ON "positions" ("tenant_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_positions_rank"   ON "positions" ("rank");`,
    );

    // -----------------------------------------------------------------
    // employees.manager_id, employees.position_id
    // -----------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "employees"
        ADD COLUMN IF NOT EXISTS "manager_id"  uuid NULL,
        ADD COLUMN IF NOT EXISTS "position_id" uuid NULL;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE constraint_name = 'FK_employees_manager') THEN
          ALTER TABLE "employees"
            ADD CONSTRAINT "FK_employees_manager"
            FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE constraint_name = 'FK_employees_position') THEN
          ALTER TABLE "employees"
            ADD CONSTRAINT "FK_employees_position"
            FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_employees_manager"  ON "employees" ("manager_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_employees_position" ON "employees" ("position_id");`,
    );

    // -----------------------------------------------------------------
    // approver_groups + members
    // -----------------------------------------------------------------
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "approver_groups_quorum_enum" AS ENUM ('any','all','majority','m_of_n');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "approver_groups" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"   uuid NOT NULL,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"  TIMESTAMP NULL,
        "name"        varchar(120) NOT NULL,
        "description" text NULL,
        "quorum_type" "approver_groups_quorum_enum" NOT NULL DEFAULT 'any',
        "quorum_count" int NULL,
        "is_active"   boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_approver_groups" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_approver_groups_tenant_name" UNIQUE ("tenant_id","name")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_approver_groups_tenant" ON "approver_groups" ("tenant_id");`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "approver_group_members" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"   uuid NOT NULL,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"  TIMESTAMP NULL,
        "group_id"    uuid NOT NULL,
        "user_id"     uuid NOT NULL,
        CONSTRAINT "PK_approver_group_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_agm_group_user" UNIQUE ("group_id","user_id"),
        CONSTRAINT "FK_agm_group" FOREIGN KEY ("group_id") REFERENCES "approver_groups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_agm_user"  FOREIGN KEY ("user_id")  REFERENCES "users"("id")          ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agm_tenant" ON "approver_group_members" ("tenant_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agm_group"  ON "approver_group_members" ("group_id");`,
    );

    // -----------------------------------------------------------------
    // procurement_approval_policies + steps
    // -----------------------------------------------------------------
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "approval_policy_doctype_enum" AS ENUM ('PR','PO','RFQ','ANY');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "approval_policy_step_type_enum" AS ENUM (
          'direct_manager','department_head','parent_department_head',
          'role','position','specific_user','group'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "procurement_approval_policies" (
        "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"     uuid NOT NULL,
        "created_at"    TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"    TIMESTAMP NULL,
        "name"          varchar(150) NOT NULL,
        "description"   text NULL,
        "document_type" "approval_policy_doctype_enum" NOT NULL DEFAULT 'PR',
        "facility_id"   uuid NULL,
        "department_id" uuid NULL,
        "category"      varchar(50) NULL,
        "amount_min"    numeric(14,2) NULL,
        "amount_max"    numeric(14,2) NULL,
        "priority"      int NOT NULL DEFAULT 0,
        "is_active"     boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_procurement_approval_policies" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pap_tenant"   ON "procurement_approval_policies" ("tenant_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pap_doctype"  ON "procurement_approval_policies" ("document_type");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pap_priority" ON "procurement_approval_policies" ("priority");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "procurement_approval_policy_steps" (
        "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"      uuid NOT NULL,
        "created_at"     TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"     TIMESTAMP NULL,
        "policy_id"      uuid NOT NULL,
        "step_order"     int  NOT NULL,
        "approver_type"  "approval_policy_step_type_enum" NOT NULL,
        "role_name"      varchar(80) NULL,
        "position_id"    uuid NULL,
        "user_id"        uuid NULL,
        "group_id"       uuid NULL,
        "levels_up"      int NOT NULL DEFAULT 1,
        "escalate_to_parent" boolean NOT NULL DEFAULT false,
        "is_optional"    boolean NOT NULL DEFAULT false,
        "skip_if_self"   boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_procurement_approval_policy_steps" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_paps_policy_order" UNIQUE ("policy_id","step_order"),
        CONSTRAINT "FK_paps_policy"   FOREIGN KEY ("policy_id")   REFERENCES "procurement_approval_policies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_paps_position" FOREIGN KEY ("position_id") REFERENCES "positions"("id")        ON DELETE SET NULL,
        CONSTRAINT "FK_paps_user"     FOREIGN KEY ("user_id")     REFERENCES "users"("id")            ON DELETE SET NULL,
        CONSTRAINT "FK_paps_group"    FOREIGN KEY ("group_id")    REFERENCES "approver_groups"("id")  ON DELETE SET NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_paps_tenant" ON "procurement_approval_policy_steps" ("tenant_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_paps_policy" ON "procurement_approval_policy_steps" ("policy_id");`,
    );

    // -----------------------------------------------------------------
    // approval_delegations (per-document-type OOO substitution)
    // -----------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "approval_delegations" (
        "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"      uuid NOT NULL,
        "created_at"     TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"     TIMESTAMP NULL,
        "from_user_id"   uuid NOT NULL,
        "to_user_id"     uuid NOT NULL,
        "document_types" varchar(20)[] NOT NULL DEFAULT '{ANY}',
        "valid_from"     TIMESTAMP NOT NULL DEFAULT now(),
        "valid_to"       TIMESTAMP NULL,
        "reason"         text NULL,
        "is_active"      boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_approval_delegations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ad_from" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ad_to"   FOREIGN KEY ("to_user_id")   REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ad_tenant_from" ON "approval_delegations" ("tenant_id","from_user_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ad_validity"    ON "approval_delegations" ("valid_from","valid_to");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "approval_delegations";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "procurement_approval_policy_steps";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "procurement_approval_policies";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "approver_group_members";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "approver_groups";`);
    await queryRunner.query(
      `ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "FK_employees_position";`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "FK_employees_manager";`,
    );
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN IF EXISTS "position_id";`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN IF EXISTS "manager_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "positions";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "approval_policy_step_type_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "approval_policy_doctype_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "approver_groups_quorum_enum";`);
  }
}
