import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Encrypt/decrypt MFA secrets at rest so a DB breach doesn't expose TOTP seeds.
const MFA_ENC_KEY = process.env.MFA_ENCRYPTION_KEY;
if (!MFA_ENC_KEY) {
  console.warn('WARNING: MFA_ENCRYPTION_KEY not set — MFA features will be unavailable until configured');
}
const MFA_SALT = process.env.MFA_SALT || randomBytes(16).toString('hex');
const MFA_KEY = MFA_ENC_KEY ? scryptSync(MFA_ENC_KEY, MFA_SALT, 32) : null;

function encryptMfaSecret(plain: string): string {
  if (!MFA_KEY) throw new Error('MFA_ENCRYPTION_KEY must be configured to enable MFA');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', MFA_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptMfaSecret(data: string): string {
  if (!MFA_KEY) throw new Error('MFA_ENCRYPTION_KEY must be configured to enable MFA');
  const [ivHex, encHex] = data.split(':');
  if (!ivHex || !encHex) return data; // plain-text legacy value
  try {
    const decipher = createDecipheriv('aes-256-cbc', MFA_KEY, Buffer.from(ivHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return data; // plain-text legacy value
  }
}
import { UserRole } from './user-role.entity';
import { Tenant } from './tenant.entity';
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
@Index(['email', 'tenantId'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['username', 'tenantId'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['employeeNumber', 'tenantId'], { unique: true, where: 'employee_number IS NOT NULL AND deleted_at IS NULL' })
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @Column({ type: 'boolean', default: false, name: 'is_system_admin' })
  isSystemAdmin: boolean;

  @Column({ type: 'boolean', default: false, name: 'mfa_enabled' })
  mfaEnabled: boolean;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'mfa_secret',
    transformer: {
      to: (value?: string) => (value ? encryptMfaSecret(value) : value),
      from: (value?: string) => (value ? decryptMfaSecret(value) : value),
    },
  })
  mfaSecret?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'last_login_at' })
  lastLoginAt?: Date;

  @Column({ type: 'int', default: 0, name: 'failed_login_attempts' })
  failedLoginAttempts: number;

  @Column({ type: 'timestamp', nullable: true, name: 'locked_until' })
  lockedUntil?: Date;

  @Column({ type: 'boolean', default: false, name: 'must_change_password' })
  mustChangePassword: boolean;

  @Column({ type: 'int', default: 0, name: 'token_version' })
  tokenVersion: number;

  @Column({ type: 'uuid', nullable: true, name: 'reports_to_id' })
  reportsToId?: string;

  @ManyToOne(() => User, (user) => user.directReports, { nullable: true })
  @JoinColumn({ name: 'reports_to_id' })
  reportsTo?: User;

  @OneToMany(() => User, (user) => user.reportsTo)
  directReports?: User[];

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

  @Column({ type: 'jsonb', nullable: true })
  allowances?: { name: string; amount: number; taxable: boolean }[];

  @Column({ type: 'jsonb', nullable: true })
  deductions?: { name: string; amount: number; type: 'fixed' | 'percentage' }[];

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

  // Tenant relation (tenantId column inherited from BaseEntity)
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

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
