import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Facility } from './facility.entity';
import { User } from './user.entity';

export enum EmploymentType {
  PERMANENT = 'permanent',
  CONTRACT = 'contract',
  TEMPORARY = 'temporary',
  INTERN = 'intern',
  CONSULTANT = 'consultant',
}

export enum EmploymentStatus {
  ACTIVE = 'active',
  ON_LEAVE = 'on_leave',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
  RESIGNED = 'resigned',
  RETIRED = 'retired',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum MaritalStatus {
  SINGLE = 'single',
  MARRIED = 'married',
  DIVORCED = 'divorced',
  WIDOWED = 'widowed',
}

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true, name: 'employee_number' })
  employeeNumber: string;

  // Link to user account (optional)
  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Personal information
  @Column({ length: 100, name: 'first_name' })
  firstName: string;

  @Column({ length: 100, name: 'last_name' })
  lastName: string;

  @Column({ length: 100, nullable: true, name: 'other_names' })
  otherNames: string;

  @Column({ type: 'date', name: 'date_of_birth' })
  dateOfBirth: Date;

  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @Column({ type: 'enum', enum: MaritalStatus, nullable: true, name: 'marital_status' })
  maritalStatus: MaritalStatus;

  @Column({ length: 50, nullable: true, name: 'national_id' })
  nationalId: string;

  @Column({ length: 50, nullable: true, name: 'nssf_number' })
  nssfNumber: string; // National Social Security Fund

  @Column({ length: 50, nullable: true, name: 'tin_number' })
  tinNumber: string; // Tax Identification Number

  // Contact
  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  // Emergency contact
  @Column({ length: 100, nullable: true, name: 'emergency_contact_name' })
  emergencyContactName: string;

  @Column({ length: 20, nullable: true, name: 'emergency_contact_phone' })
  emergencyContactPhone: string;

  @Column({ length: 50, nullable: true, name: 'emergency_contact_relationship' })
  emergencyContactRelationship: string;

  // Employment details
  @Column({ length: 100, name: 'job_title' })
  jobTitle: string;

  @Column({ length: 100, nullable: true })
  department: string;

  @Column({ type: 'enum', enum: EmploymentType, default: EmploymentType.PERMANENT, name: 'employment_type' })
  employmentType: EmploymentType;

  @Column({ type: 'enum', enum: EmploymentStatus, default: EmploymentStatus.ACTIVE, name: 'status' })
  status: EmploymentStatus;

  @Column({ type: 'date', name: 'hire_date' })
  hireDate: Date;

  @Column({ type: 'date', nullable: true, name: 'termination_date' })
  terminationDate: Date;

  @Column({ type: 'text', nullable: true, name: 'termination_reason' })
  terminationReason: string;

  // Salary information
  @Column({ length: 20, nullable: true, name: 'salary_grade' })
  salaryGrade: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'basic_salary' })
  basicSalary: number;

  @Column({ type: 'jsonb', nullable: true })
  allowances: { name: string; amount: number; taxable: boolean }[];

  @Column({ type: 'jsonb', nullable: true })
  deductions: { name: string; amount: number; type: 'fixed' | 'percentage' }[];

  // Bank details
  @Column({ length: 100, nullable: true, name: 'bank_name' })
  bankName: string;

  @Column({ length: 50, nullable: true, name: 'bank_account_number' })
  bankAccountNumber: string;

  @Column({ length: 20, nullable: true, name: 'bank_branch' })
  bankBranch: string;

  // Leave balances
  @Column({ type: 'int', default: 21, name: 'annual_leave_balance' })
  annualLeaveBalance: number;

  @Column({ type: 'int', default: 10, name: 'sick_leave_balance' })
  sickLeaveBalance: number;

  // Facility
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
