import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Admission } from './admission.entity';
import { User } from './user.entity';
import { Prescription, PrescriptionItem } from './prescription.entity';

export enum MedicationStatus {
  SCHEDULED = 'scheduled',
  ADMINISTERED = 'administered',
  HELD = 'held',
  REFUSED = 'refused',
  MISSED = 'missed',
}

@Entity('medication_administrations')
@Index(['prescriptionItemId'])
@Index(['administeredAt'])
export class MedicationAdministration extends BaseEntity {
  @Column({ type: 'enum', enum: MedicationStatus, default: MedicationStatus.SCHEDULED })
  status: MedicationStatus;

  // ── IPD fields (camelCase auto-named columns) ──

  @Column({ type: 'timestamp', nullable: true })
  scheduledTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  administeredTime: Date;

  @Column({ nullable: true })
  drugName: string;

  @Column({ nullable: true })
  dose: string;

  @Column({ nullable: true })
  route: string;

  @Column({ nullable: true })
  batchNumber: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'uuid', nullable: true })
  admissionId: string;

  @ManyToOne(() => Admission, admission => admission.medicationAdministrations)
  @JoinColumn({ name: 'admissionId' })
  admission: Admission;

  @Column({ type: 'uuid', nullable: true })
  verifiedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'verifiedById' })
  verifiedBy: User;

  // ── Prescription fields (explicit snake_case columns) ──

  @Column({ name: 'prescription_id', type: 'uuid', nullable: true })
  prescriptionId: string;

  @ManyToOne(() => Prescription)
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @Column({ name: 'prescription_item_id', type: 'uuid', nullable: true })
  prescriptionItemId: string;

  @ManyToOne(() => PrescriptionItem)
  @JoinColumn({ name: 'prescription_item_id' })
  prescriptionItem: PrescriptionItem;

  @Column({ name: 'administered_by_id', type: 'uuid', nullable: true })
  administeredById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'administered_by_id' })
  administeredBy: User;

  @Column({ name: 'witness_id', nullable: true })
  witnessId: string;

  @Column({ name: 'administered_at', type: 'timestamptz', nullable: true })
  administeredAt: Date;

  @Column({ name: 'dose_given', type: 'decimal', precision: 10, scale: 4, nullable: true })
  doseGiven: number;

  @Column({ name: 'route_of_administration', nullable: true })
  routeOfAdministration: string;

  @Column({ name: 'is_controlled_substance', default: false })
  isControlledSubstance: boolean;

  // ── Legacy IPD columns (camelCase duplicates of snake_case columns above) ──

  @Column({ name: 'prescriptionItemId', type: 'uuid', nullable: true })
  ipdPrescriptionItemId: string;

  @Column({ name: 'administeredById', type: 'uuid', nullable: true })
  ipdAdministeredById: string;
}
