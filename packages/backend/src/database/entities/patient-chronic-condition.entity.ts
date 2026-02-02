import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Patient } from './patient.entity';
import { Diagnosis } from './diagnosis.entity';

export enum ChronicStatus {
  ACTIVE = 'active',
  CONTROLLED = 'controlled',
  UNCONTROLLED = 'uncontrolled',
  IN_REMISSION = 'in_remission',
  RESOLVED = 'resolved',
}

@Entity('patient_chronic_conditions')
@Index(['patientId', 'diagnosisId'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['facilityId', 'status'])
export class PatientChronicCondition extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid', name: 'diagnosis_id' })
  diagnosisId: string;

  @ManyToOne(() => Diagnosis, { eager: true })
  @JoinColumn({ name: 'diagnosis_id' })
  diagnosis: Diagnosis;

  @Column({
    type: 'enum',
    enum: ChronicStatus,
    default: ChronicStatus.ACTIVE,
  })
  status: ChronicStatus;

  @Column({ type: 'date', name: 'diagnosed_date' })
  diagnosedDate: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'date', nullable: true, name: 'next_follow_up' })
  nextFollowUp?: Date;

  @Column({ type: 'int', default: 30, name: 'follow_up_interval_days' })
  followUpIntervalDays: number;

  @Column({ type: 'boolean', default: true, name: 'reminder_enabled' })
  reminderEnabled: boolean;

  @Column({ type: 'int', default: 3, name: 'reminder_days_before' })
  reminderDaysBefore: number;

  @Column({ type: 'uuid', nullable: true, name: 'primary_doctor_id' })
  primaryDoctorId?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'current_medications' })
  currentMedications?: string[];

  @Column({ type: 'timestamp', nullable: true, name: 'last_visit' })
  lastVisit?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'registered_by' })
  registeredById?: string;
}
