import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('patients')
@Index(['mrn'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['nationalId'], { unique: true, where: 'national_id IS NOT NULL AND deleted_at IS NULL' })
export class Patient extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  mrn: string; // Medical Record Number

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'national_id' })
  nationalId?: string;

  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 20 })
  gender: string;

  @Column({ type: 'date', name: 'date_of_birth' })
  dateOfBirth: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'blood_group' })
  bloodGroup?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'next_of_kin' })
  nextOfKin?: Record<string, any>;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>; // Store additional custom fields
}
