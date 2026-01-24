import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Facility } from './facility.entity';
import { Patient } from './patient.entity';
import { Encounter } from './encounter.entity';
import { User } from './user.entity';
import { ImagingModality } from './imaging-modality.entity';

export enum ImagingOrderStatus {
  ORDERED = 'ordered',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REPORTED = 'reported',
  CANCELLED = 'cancelled',
}

export enum ImagingPriority {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  STAT = 'stat',
}

@Entity('imaging_orders')
export class ImagingOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ length: 20, unique: true, name: 'order_number' })
  orderNumber: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true, name: 'encounter_id' })
  encounterId: string;

  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @Column({ type: 'uuid', name: 'modality_id' })
  modalityId: string;

  @ManyToOne(() => ImagingModality)
  @JoinColumn({ name: 'modality_id' })
  modality: ImagingModality;

  @Column({ length: 200, name: 'study_type' })
  studyType: string; // e.g., "Chest X-Ray PA", "Abdominal Ultrasound"

  @Column({ length: 100, nullable: true, name: 'body_part' })
  bodyPart: string;

  @Column({ type: 'text', nullable: true, name: 'clinical_history' })
  clinicalHistory: string;

  @Column({ type: 'text', nullable: true, name: 'clinical_indication' })
  clinicalIndication: string;

  @Column({ type: 'enum', enum: ImagingPriority, default: ImagingPriority.ROUTINE })
  priority: ImagingPriority;

  @Column({ type: 'enum', enum: ImagingOrderStatus, default: ImagingOrderStatus.ORDERED })
  status: ImagingOrderStatus;

  // Ordering clinician
  @Column({ type: 'uuid', name: 'ordered_by_id' })
  orderedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ordered_by_id' })
  orderedBy: User;

  @Column({ type: 'timestamp', name: 'ordered_at' })
  orderedAt: Date;

  // Scheduling
  @Column({ type: 'timestamp', nullable: true, name: 'scheduled_at' })
  scheduledAt: Date;

  // Technologist performing
  @Column({ type: 'uuid', nullable: true, name: 'performed_by_id' })
  performedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'performed_by_id' })
  performedBy: User;

  @Column({ type: 'timestamp', nullable: true, name: 'performed_at' })
  performedAt: Date;

  @Column({ type: 'text', nullable: true, name: 'technologist_notes' })
  technologistNotes: string;

  // PACS/Image info
  @Column({ length: 100, nullable: true, name: 'accession_number' })
  accessionNumber: string;

  @Column({ type: 'int', default: 0, name: 'image_count' })
  imageCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
