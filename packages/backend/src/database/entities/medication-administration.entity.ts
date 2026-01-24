import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Admission } from './admission.entity';
import { User } from './user.entity';
import { PrescriptionItem } from './prescription.entity';

export enum MedicationStatus {
  SCHEDULED = 'scheduled',
  ADMINISTERED = 'administered',
  HELD = 'held',
  REFUSED = 'refused',
  MISSED = 'missed',
}

@Entity('medication_administrations')
export class MedicationAdministration extends BaseEntity {
  @Column({ type: 'enum', enum: MedicationStatus, default: MedicationStatus.SCHEDULED })
  status: MedicationStatus;

  @Column({ type: 'timestamp' })
  scheduledTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  administeredTime: Date;

  @Column()
  drugName: string;

  @Column()
  dose: string;

  @Column()
  route: string; // oral, IV, IM, SC, etc.

  @Column({ nullable: true })
  batchNumber: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  reason: string; // For held/refused status

  @Column({ type: 'uuid' })
  admissionId: string;

  @ManyToOne(() => Admission, admission => admission.medicationAdministrations)
  @JoinColumn({ name: 'admissionId' })
  admission: Admission;

  @Column({ type: 'uuid', nullable: true })
  prescriptionItemId: string;

  @ManyToOne(() => PrescriptionItem)
  @JoinColumn({ name: 'prescriptionItemId' })
  prescriptionItem: PrescriptionItem;

  @Column({ type: 'uuid', nullable: true })
  administeredById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'administeredById' })
  administeredBy: User;

  @Column({ type: 'uuid', nullable: true })
  verifiedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'verifiedById' })
  verifiedBy: User;
}
