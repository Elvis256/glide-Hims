import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum GoalStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  AT_RISK = 'at_risk',
  ACHIEVED = 'achieved',
  CANCELLED = 'cancelled',
}

@Entity('employee_goals')
export class EmployeeGoal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'key_results' })
  keyResults?: Array<{ description: string; target: string; current?: string; achieved?: boolean }>;

  @Column({ type: 'date', name: 'target_date', nullable: true })
  targetDate?: Date;

  @Column({ type: 'int', default: 0, name: 'progress_percent' })
  progressPercent: number;

  @Column({ type: 'enum', enum: GoalStatus, default: GoalStatus.DRAFT })
  status: GoalStatus;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  tenantId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'parent_goal_id' })
  parentGoalId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
