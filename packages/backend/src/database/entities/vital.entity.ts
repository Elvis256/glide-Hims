import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Encounter } from './encounter.entity';
import { User } from './user.entity';

@Entity('vitals')
@Index(['encounter', 'recordedAt'])
export class Vital extends BaseEntity {
  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  temperature: number; // Celsius

  @Column({ nullable: true })
  pulse: number; // beats per minute

  @Column({ name: 'bp_systolic', nullable: true })
  bpSystolic: number; // mmHg

  @Column({ name: 'bp_diastolic', nullable: true })
  bpDiastolic: number; // mmHg

  @Column({ name: 'respiratory_rate', nullable: true })
  respiratoryRate: number; // breaths per minute

  @Column({ name: 'oxygen_saturation', type: 'decimal', precision: 5, scale: 2, nullable: true })
  oxygenSaturation: number; // SpO2 %

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  weight: number; // kg

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  height: number; // cm

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  bmi: number; // calculated

  @Column({ name: 'blood_glucose', type: 'decimal', precision: 6, scale: 2, nullable: true })
  bloodGlucose: number; // mg/dL

  @Column({ name: 'pain_scale', nullable: true })
  painScale: number; // 0-10

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  recordedAt: Date;

  // Relationships
  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @Column({ name: 'encounter_id' })
  encounterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recorded_by_id' })
  recordedBy: User;

  @Column({ name: 'recorded_by_id' })
  recordedById: string;
}
