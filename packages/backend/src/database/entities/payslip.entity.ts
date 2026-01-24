import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Employee } from './employee.entity';
import { PayrollRun } from './payroll-run.entity';

@Entity('payslips')
export class Payslip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'payroll_run_id' })
  payrollRunId: string;

  @ManyToOne(() => PayrollRun)
  @JoinColumn({ name: 'payroll_run_id' })
  payrollRun: PayrollRun;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  // Earnings
  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'basic_salary' })
  basicSalary: number;

  @Column({ type: 'jsonb', nullable: true })
  allowances: { name: string; amount: number }[];

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'overtime_pay' })
  overtimePay: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'gross_salary' })
  grossSalary: number;

  // Deductions
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'paye' })
  paye: number; // Pay As You Earn (income tax)

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'nssf_employee' })
  nssfEmployee: number; // Employee contribution

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'nssf_employer' })
  nssfEmployer: number; // Employer contribution

  @Column({ type: 'jsonb', nullable: true, name: 'other_deductions' })
  otherDeductions: { name: string; amount: number }[];

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'total_deductions' })
  totalDeductions: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'net_salary' })
  netSalary: number;

  // Days worked
  @Column({ type: 'int', default: 0, name: 'days_worked' })
  daysWorked: number;

  @Column({ type: 'int', default: 0, name: 'days_absent' })
  daysAbsent: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0, name: 'overtime_hours' })
  overtimeHours: number;

  // Status
  @Column({ type: 'boolean', default: false, name: 'is_paid' })
  isPaid: boolean;

  @Column({ type: 'date', nullable: true, name: 'paid_date' })
  paidDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
