import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

export enum OnboardingCategory {
  DOCUMENTATION = 'documentation',
  IT_SETUP = 'it_setup',
  ORIENTATION = 'orientation',
  TRAINING = 'training',
  COMPLIANCE = 'compliance',
  EQUIPMENT = 'equipment',
  ACCESS = 'access',
  OTHER = 'other',
}

export enum OnboardingTaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  OVERDUE = 'overdue',
}

@Entity('onboarding_tasks')
export class OnboardingTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'employee_id' })
  employee: User;

  @Column({ name: 'task_name' })
  taskName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: OnboardingCategory, default: OnboardingCategory.OTHER })
  category: OnboardingCategory;

  @Column({ type: 'enum', enum: OnboardingTaskStatus, default: OnboardingTaskStatus.PENDING })
  status: OnboardingTaskStatus;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ name: 'completed_by_id', nullable: true })
  completedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'completed_by_id' })
  completedBy: User;

  @Column({ name: 'assigned_to_id', nullable: true })
  assignedToId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to_id' })
  assignedTo: User;

  @Column({ type: 'int', default: 0, name: 'sort_order' })
  sortOrder: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'facility_id', nullable: true })
  facilityId: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
