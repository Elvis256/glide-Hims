import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Order } from './order.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { LabTest, SampleType } from './lab-test.entity';
import { Facility } from './facility.entity';

export enum SampleStatus {
  PENDING_COLLECTION = 'pending_collection',
  COLLECTED = 'collected',
  RECEIVED = 'received',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

export enum SamplePriority {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  STAT = 'stat',
}

@Entity('lab_samples')
export class LabSample extends BaseEntity {
  @Column({ unique: true })
  sampleNumber: string;

  @Column({ nullable: true })
  barcode: string;

  @Column({ type: 'enum', enum: SampleType })
  sampleType: SampleType;

  @Column({ type: 'enum', enum: SampleStatus, default: SampleStatus.PENDING_COLLECTION })
  status: SampleStatus;

  @Column({ type: 'enum', enum: SamplePriority, default: SamplePriority.ROUTINE })
  priority: SamplePriority;

  @Column({ type: 'timestamp', nullable: true })
  collectionTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  receivedTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedTime: Date;

  @Column({ type: 'text', nullable: true })
  collectionNotes: string;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // Relations
  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid' })
  labTestId: string;

  @ManyToOne(() => LabTest, test => test.samples)
  @JoinColumn({ name: 'labTestId' })
  labTest: LabTest;

  @Column({ type: 'uuid' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facilityId' })
  facility: Facility;

  @Column({ type: 'uuid', nullable: true })
  collectedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'collectedById' })
  collectedBy: User;

  @Column({ type: 'uuid', nullable: true })
  processedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'processedById' })
  processedBy: User;

  @OneToMany('LabResult', 'sample')
  results: any[];
}
