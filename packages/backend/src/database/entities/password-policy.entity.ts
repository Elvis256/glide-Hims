import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';

@Entity('password_policies')
export class PasswordPolicy extends BaseEntity {
  @Column({ type: 'uuid', nullable: true, name: 'facility_id' })
  facilityId?: string;

  @ManyToOne(() => Facility, { nullable: true })
  @JoinColumn({ name: 'facility_id' })
  facility?: Facility;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'boolean', default: true, name: 'is_default' })
  isDefault: boolean;

  @Column({ type: 'int', default: 8, name: 'min_length' })
  minLength: number;

  @Column({ type: 'int', default: 128, name: 'max_length' })
  maxLength: number;

  @Column({ type: 'boolean', default: true, name: 'require_uppercase' })
  requireUppercase: boolean;

  @Column({ type: 'boolean', default: true, name: 'require_lowercase' })
  requireLowercase: boolean;

  @Column({ type: 'boolean', default: true, name: 'require_numbers' })
  requireNumbers: boolean;

  @Column({ type: 'boolean', default: true, name: 'require_special_chars' })
  requireSpecialChars: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'allowed_special_chars' })
  allowedSpecialChars?: string;

  @Column({ type: 'int', default: 90, name: 'expiry_days' })
  expiryDays: number;

  @Column({ type: 'int', default: 5, name: 'password_history_count' })
  passwordHistoryCount: number;

  @Column({ type: 'int', default: 5, name: 'max_failed_attempts' })
  maxFailedAttempts: number;

  @Column({ type: 'int', default: 30, name: 'lockout_duration_minutes' })
  lockoutDurationMinutes: number;

  @Column({ type: 'boolean', default: false, name: 'require_mfa' })
  requireMfa: boolean;

  @Column({ type: 'int', default: 0, name: 'min_age_days' })
  minAgeDays: number;

  @Column({ type: 'jsonb', nullable: true, name: 'common_passwords_blacklist' })
  commonPasswordsBlacklist?: string[];

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;
}

@Entity('password_history')
export class PasswordHistory extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'timestamp', name: 'changed_at' })
  changedAt: Date;
}
