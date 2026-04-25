import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PrescriptionItem } from './prescription.entity';

export enum AdherenceStatus {
  PENDING = 'pending',
  TAKEN = 'taken',
  SKIPPED = 'skipped',
  MISSED = 'missed',
}

@Entity('medication_adherence_records')
@Index(['patientId', 'scheduledDate'])
@Index(['prescriptionItemId'])
@Index(['status', 'scheduledDate'])
export class MedicationAdherenceRecord extends BaseEntity {
  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'prescription_item_id' })
  prescriptionItemId: string;

  @ManyToOne(() => PrescriptionItem)
  @JoinColumn({ name: 'prescription_item_id' })
  prescriptionItem: PrescriptionItem;

  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate: Date;

  @Column({ name: 'scheduled_time', type: 'varchar', length: 10 })
  scheduledTime: string;

  @Column({ name: 'taken_at', type: 'timestamptz', nullable: true })
  takenAt?: Date;

  @Column({ name: 'skipped_at', type: 'timestamptz', nullable: true })
  skippedAt?: Date;

  @Column({ name: 'skip_reason', type: 'text', nullable: true })
  skipReason?: string;

  @Column({
    type: 'enum',
    enum: AdherenceStatus,
    default: AdherenceStatus.PENDING,
  })
  status: AdherenceStatus;
}
