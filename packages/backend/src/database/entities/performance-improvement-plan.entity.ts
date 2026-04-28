import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PipStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  EXTENDED = 'extended',
  TERMINATED = 'terminated',
  CLOSED = 'closed',
}

@Entity('performance_improvement_plans')
export class PerformanceImprovementPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId: string;

  @Column({ type: 'uuid', nullable: true, name: 'review_id' })
  reviewId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'manager_id' })
  managerId?: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', name: 'goals' })
  goals: string;

  @Column({ type: 'text', nullable: true, name: 'support_provided' })
  supportProvided?: string;

  @Column({ type: 'date', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'date', name: 'end_date' })
  endDate: Date;

  @Column({ type: 'enum', enum: PipStatus, default: PipStatus.ACTIVE })
  status: PipStatus;

  @Column({ type: 'text', nullable: true, name: 'outcome_notes' })
  outcomeNotes?: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  tenantId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
