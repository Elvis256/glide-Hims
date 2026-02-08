import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserRole } from './user-role.entity';
import { Facility } from './facility.entity';
import { Department } from './department.entity';

// Staff category enum (for HR classification)
export enum StaffCategory {
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  CONSULTANT = 'consultant',
  SPECIALIST = 'specialist',
  LAB_TECHNICIAN = 'lab_technician',
  PHARMACIST = 'pharmacist',
  RADIOLOGIST = 'radiologist',
  RECEPTIONIST = 'receptionist',
  CASHIER = 'cashier',
  ADMINISTRATOR = 'administrator',
  HR_MANAGER = 'hr_manager',
  STORE_KEEPER = 'store_keeper',
  ACCOUNTANT = 'accountant',
  IT_SUPPORT = 'it_support',
  CLINICAL = 'clinical',
  NURSING = 'nursing',
  ADMINISTRATIVE = 'administrative',
  SUPPORT = 'support',
  TECHNICAL = 'technical',
  MANAGEMENT = 'management',
  OTHER = 'other',
}

// Employment type enum
export enum EmploymentType {
  PERMANENT = 'permanent',
  CONTRACT = 'contract',
  TEMPORARY = 'temporary',
  INTERN = 'intern',
  CONSULTANT = 'consultant',
  PART_TIME = 'part-time',
  FULL_TIME = 'full-time',
}

@Entity('users')
@Index(['email'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['username'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['employeeNumber'], { unique: true, where: 'employee_number IS NOT NULL AND deleted_at IS NULL' })
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @Column({ type: 'boolean', default: false, name: 'mfa_enabled' })
  mfaEnabled: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'mfa_secret' })
  mfaSecret?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'last_login_at' })
  lastLoginAt?: Date;

  @Column({ type: 'int', default: 0, name: 'failed_login_attempts' })
  failedLoginAttempts: number;

  @Column({ type: 'timestamp', nullable: true, name: 'locked_until' })
  lockedUntil?: Date;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles?: UserRole[];

  // ========== HR/Employee Fields ==========
  
  @Column({ type: 'varchar', length: 20, nullable: true, name: 'employee_number' })
  employeeNumber?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'job_title' })
  jobTitle?: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'staff_category' })
  staffCategory?: StaffCategory;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'employment_type' })
  employmentType?: EmploymentType;

  @Column({ type: 'date', nullable: true, name: 'date_of_birth' })
  dateOfBirth?: Date;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender?: string;

  @Column({ type: 'date', nullable: true, name: 'hire_date' })
  hireDate?: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'basic_salary' })
  basicSalary?: number;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'national_id' })
  nationalId?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  // Emergency contact
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'emergency_contact_name' })
  emergencyContactName?: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'emergency_contact_phone' })
  emergencyContactPhone?: string;

  // Bank details for payroll
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'bank_name' })
  bankName?: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'bank_account_number' })
  bankAccountNumber?: string;

  // Leave balances
  @Column({ type: 'int', default: 21, name: 'annual_leave_balance' })
  annualLeaveBalance: number;

  @Column({ type: 'int', default: 10, name: 'sick_leave_balance' })
  sickLeaveBalance: number;

  // Facility/Department assignment
  @Column({ type: 'uuid', nullable: true, name: 'facility_id' })
  facilityId?: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility?: Facility;

  @Column({ type: 'uuid', nullable: true, name: 'department_id' })
  departmentId?: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department?: Department;
}
