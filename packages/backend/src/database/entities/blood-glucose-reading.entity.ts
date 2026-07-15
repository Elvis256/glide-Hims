import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Admission } from './admission.entity';
import { User } from './user.entity';

@Entity('blood_glucose_readings')
@Index(['admissionId', 'createdAt'])
@Index(['tenantId'])
export class BloodGlucoseReading extends BaseEntity {
  @Column({ type: 'uuid', name: 'admission_id' })
  admissionId: string;

  @ManyToOne(() => Admission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admission_id' })
  admission?: Admission;

  @Column({ type: 'numeric', precision: 6, scale: 2 })
  value: number;

  @Column({ type: 'varchar', length: 30 })
  timing: string; // fasting, pre-meal, post-meal, bedtime, random

  @Column({ type: 'jsonb', nullable: true })
  insulinGiven?: { type: string; dose: number; unit: string };

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'uuid', name: 'recorded_by_id', nullable: true })
  recordedById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recorded_by_id' })
  recordedBy?: User;
}
