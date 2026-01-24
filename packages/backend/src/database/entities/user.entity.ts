import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('users')
@Index(['email'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['username'], { unique: true, where: 'deleted_at IS NULL' })
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
}
