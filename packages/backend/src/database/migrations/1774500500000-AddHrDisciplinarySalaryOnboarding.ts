import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHrDisciplinarySalaryOnboarding1774500500000 implements MigrationInterface {
  name = 'AddHrDisciplinarySalaryOnboarding1774500500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE disciplinary_type AS ENUM ('verbal_warning', 'first_written', 'second_written', 'final_warning', 'suspension', 'termination');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE disciplinary_status AS ENUM ('active', 'resolved', 'escalated', 'expired', 'appealed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE salary_change_type AS ENUM ('initial', 'increment', 'promotion', 'adjustment', 'demotion');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE onboarding_category AS ENUM ('documentation', 'it_setup', 'orientation', 'training', 'compliance', 'equipment', 'access', 'other');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE onboarding_task_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped', 'overdue');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create disciplinary_actions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS disciplinary_actions (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        employee_id UUID NOT NULL REFERENCES users(id),
        type disciplinary_type NOT NULL,
        status disciplinary_status NOT NULL DEFAULT 'active',
        reason VARCHAR NOT NULL,
        incident_date DATE NOT NULL,
        details TEXT,
        expected_improvement TEXT,
        consequences TEXT,
        issued_by_id UUID REFERENCES users(id),
        acknowledged_at TIMESTAMP,
        resolution_notes TEXT,
        resolution_date DATE,
        appeal_notes TEXT,
        follow_up_date DATE,
        facility_id UUID,
        tenant_id UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_disciplinary_employee ON disciplinary_actions(employee_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_disciplinary_tenant ON disciplinary_actions(tenant_id);`);

    // Create salary_history table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS salary_history (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        employee_id UUID NOT NULL REFERENCES users(id),
        previous_salary DECIMAL(12,2),
        new_salary DECIMAL(12,2) NOT NULL,
        previous_title VARCHAR,
        new_title VARCHAR,
        previous_department VARCHAR,
        new_department VARCHAR,
        change_type salary_change_type NOT NULL,
        effective_date DATE NOT NULL,
        reason VARCHAR,
        approved_by_id UUID REFERENCES users(id),
        notes TEXT,
        facility_id UUID,
        tenant_id UUID,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_salary_history_employee ON salary_history(employee_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_salary_history_tenant ON salary_history(tenant_id);`);

    // Create onboarding_tasks table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS onboarding_tasks (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        employee_id UUID NOT NULL REFERENCES users(id),
        task_name VARCHAR NOT NULL,
        description TEXT,
        category onboarding_category DEFAULT 'other',
        status onboarding_task_status DEFAULT 'pending',
        due_date DATE,
        completed_at TIMESTAMP,
        completed_by_id UUID REFERENCES users(id),
        assigned_to_id UUID REFERENCES users(id),
        sort_order INT DEFAULT 0,
        notes TEXT,
        facility_id UUID,
        tenant_id UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_onboarding_employee ON onboarding_tasks(employee_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_onboarding_tenant ON onboarding_tasks(tenant_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS onboarding_tasks;`);
    await queryRunner.query(`DROP TABLE IF EXISTS salary_history;`);
    await queryRunner.query(`DROP TABLE IF EXISTS disciplinary_actions;`);
    await queryRunner.query(`DROP TYPE IF EXISTS onboarding_task_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS onboarding_category;`);
    await queryRunner.query(`DROP TYPE IF EXISTS salary_change_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS disciplinary_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS disciplinary_type;`);
  }
}
