import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum SalaryChangeType {
  INITIAL = 'initial',
  INCREMENT = 'increment',
  PROMOTION = 'promotion',
  ADJUSTMENT = 'adjustment',
  DEMOTION = 'demotion',
}

@Entity('salary_history')
export class SalaryHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'employee_id' })
  employee: User;

  @Column({ name: 'previous_salary', type: 'decimal', precision: 12, scale: 2, nullable: true })
  previousSalary: number;

  @Column({ name: 'new_salary', type: 'decimal', precision: 12, scale: 2 })
  newSalary: number;

  @Column({ name: 'previous_title', nullable: true })
  previousTitle: string;

  @Column({ name: 'new_title', nullable: true })
  newTitle: string;

  @Column({ name: 'previous_department', nullable: true })
  previousDepartment: string;

  @Column({ name: 'new_department', nullable: true })
  newDepartment: string;

  @Column({ type: 'enum', enum: SalaryChangeType, name: 'change_type' })
  changeType: SalaryChangeType;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: string;

  @Column({ nullable: true })
  reason: string;

  @Column({ name: 'approved_by_id', nullable: true })
  approvedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: User;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'facility_id', nullable: true })
  facilityId: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
