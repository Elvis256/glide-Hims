import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Facility } from './facility.entity';
import { User } from './user.entity';

export enum PayrollStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

@Entity('payroll_runs')
export class PayrollRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true, name: 'payroll_number' })
  payrollNumber: string;

  @Column({ type: 'int' })
  month: number; // 1-12

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'date', name: 'pay_period_start' })
  payPeriodStart: Date;

  @Column({ type: 'date', name: 'pay_period_end' })
  payPeriodEnd: Date;

  @Column({ type: 'date', nullable: true, name: 'payment_date' })
  paymentDate: Date;

  @Column({ type: 'enum', enum: PayrollStatus, default: PayrollStatus.DRAFT })
  status: PayrollStatus;

  @Column({ type: 'int', default: 0, name: 'employee_count' })
  employeeCount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'total_gross' })
  totalGross: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'total_deductions' })
  totalDeductions: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'total_net' })
  totalNet: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'total_paye' })
  totalPaye: number; // Pay As You Earn tax

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'total_nssf' })
  totalNssf: number;

  // Facility
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  // Created by
  @Column({ type: 'uuid', nullable: true, name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
