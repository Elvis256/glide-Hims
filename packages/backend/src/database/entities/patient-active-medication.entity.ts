import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum ActiveMedicationStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  STOPPED = 'stopped',
  EXPIRED = 'expired',
}

@Entity('patient_active_medications')
@Index(['patientId', 'status'])
@Index(['facilityId', 'status', 'expectedEndDate'])
@Index(['prescriptionItemId'])
export class PatientActiveMedication extends BaseEntity {
  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @Column({ type: 'uuid', name: 'encounter_id' })
  encounterId: string;

  @Column({ type: 'uuid', name: 'prescription_id' })
  prescriptionId: string;

  @Column({ type: 'uuid', name: 'prescription_item_id' })
  prescriptionItemId: string;

  @Column({ type: 'uuid', name: 'drug_id', nullable: true })
  drugId: string | null;

  @Column({ name: 'drug_code' })
  drugCode: string;

  @Column({ name: 'drug_name' })
  drugName: string;

  @Column({ name: 'generic_name', nullable: true })
  genericName: string | null;

  @Column()
  dose: string;

  @Column()
  frequency: string;

  @Column({ nullable: true })
  route: string | null;

  @Column({ nullable: true })
  duration: string | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'expected_end_date', type: 'date', nullable: true })
  expectedEndDate: Date | null;

  @Column({ name: 'actual_end_date', type: 'date', nullable: true })
  actualEndDate: Date | null;

  @Column({
    type: 'enum',
    enum: ActiveMedicationStatus,
    default: ActiveMedicationStatus.ACTIVE,
  })
  status: ActiveMedicationStatus;

  @Column({ name: 'stopped_by_id', type: 'uuid', nullable: true })
  stoppedById: string | null;

  @Column({ name: 'stopped_reason', type: 'text', nullable: true })
  stoppedReason: string | null;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;
}
