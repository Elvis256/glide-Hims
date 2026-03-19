import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class AddRoleInheritanceAndPermissionGroups1773700000000 implements MigrationInterface {
  name = 'AddRoleInheritanceAndPermissionGroups1773700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Phase 1: Role Inheritance - add parent_role_id to roles (idempotent)
    await queryRunner.query(
      `ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "parent_role_id" uuid`,
    );

    // Add FK only if it doesn't exist
    const fkExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'FK_roles_parent_role' AND table_name = 'roles'
    `);
    if (fkExists.length === 0) {
      await queryRunner.createForeignKey(
        'roles',
        new TableForeignKey({
          columnNames: ['parent_role_id'],
          referencedTableName: 'roles',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
          name: 'FK_roles_parent_role',
        }),
      );
    }

    // Phase 3: Permission Groups
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permission_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "description" text,
        "tenant_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_permission_groups" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_permission_groups_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "group_permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "group_id" uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_permissions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_group_permission" UNIQUE ("group_id", "permission_id"),
        CONSTRAINT "FK_group_permissions_group" FOREIGN KEY ("group_id") REFERENCES "permission_groups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_group_permissions_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permission_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "role_id" uuid NOT NULL,
        "group_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_role_permission_groups" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_role_permission_group" UNIQUE ("role_id", "group_id"),
        CONSTRAINT "FK_role_permission_groups_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_role_permission_groups_group" FOREIGN KEY ("group_id") REFERENCES "permission_groups"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_roles_parent_role_id" ON "roles" ("parent_role_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_group_permissions_group_id" ON "group_permissions" ("group_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_group_permissions_permission_id" ON "group_permissions" ("permission_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_role_permission_groups_role_id" ON "role_permission_groups" ("role_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_role_permission_groups_group_id" ON "role_permission_groups" ("group_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permission_groups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "group_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permission_groups"`);
    await queryRunner.dropForeignKey('roles', 'FK_roles_parent_role');
    await queryRunner.dropColumn('roles', 'parent_role_id');
  }
}
