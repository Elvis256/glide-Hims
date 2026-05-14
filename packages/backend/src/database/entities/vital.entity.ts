import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Encounter } from './encounter.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

export enum VitalSource {
  OPD_ENCOUNTER = 'OPD_ENCOUNTER',
  NURSING_ROUND = 'NURSING_ROUND',
  EMERGENCY_TRIAGE = 'EMERGENCY_TRIAGE',
  IPD_WARD_ROUND = 'IPD_WARD_ROUND',
  DISCHARGE = 'DISCHARGE',
  MATERNITY_ANC = 'MATERNITY_ANC',
  MATERNITY_PNC = 'MATERNITY_PNC',
  MATERNITY_LABOUR = 'MATERNITY_LABOUR',
}

@Entity('vitals')
@Index(['encounter', 'recordedAt'])
@Index(['patientId', 'recordedAt'])
@Index(['source', 'sourceRefId'])
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
  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter | null;

  @Column({ name: 'encounter_id', nullable: true })
  encounterId: string | null;

  @ManyToOne(() => Patient, { nullable: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient | null;

  @Column({ name: 'patient_id', nullable: true })
  patientId: string | null;

  @Column({ type: 'varchar', length: 32, default: VitalSource.OPD_ENCOUNTER })
  source: VitalSource;

  /** UUID of the originating record (e.g. nursing_note id, emergency_case id, discharge_summary id). */
  @Column({ name: 'source_ref_id', type: 'uuid', nullable: true })
  sourceRefId: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recorded_by_id' })
  recordedBy: User;

  @Column({ name: 'recorded_by_id' })
  recordedById: string;
}
