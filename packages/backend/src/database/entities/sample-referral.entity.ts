import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LabSample } from './lab-sample.entity';
import { Patient } from './patient.entity';
import { Facility } from './facility.entity';

export enum ReferralStage {
  COLLECTED = 'collected',
  PACKAGED = 'packaged',
  IN_TRANSIT = 'in_transit',
  RECEIVED_AT_HUB = 'received_at_hub',
  PROCESSING = 'processing',
  RESULT_READY = 'result_ready',
  RESULT_DELIVERED = 'result_delivered',
  REJECTED = 'rejected',
}

export enum ReferralPriority {
  STAT = 'STAT',
  URGENT = 'URGENT',
  ROUTINE = 'ROUTINE',
}

@Entity('sample_referrals')
@Index(['stage', 'createdAt'])
@Index(['fromFacilityId', 'stage'])
@Index(['toFacilityId', 'stage'])
export class SampleReferral extends BaseEntity {
  @Column({ unique: true })
  referralNumber: string;

  @Column({ type: 'uuid' })
  sampleId: string;

  @ManyToOne(() => LabSample)
  @JoinColumn({ name: 'sampleId' })
  sample: LabSample;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid' })
  fromFacilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'fromFacilityId' })
  fromFacility: Facility;

  @Column({ type: 'uuid' })
  toFacilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'toFacilityId' })
  toFacility: Facility;

  @Column({
    type: 'enum',
    enum: ReferralStage,
    default: ReferralStage.COLLECTED,
  })
  stage: ReferralStage;

  @Column({ nullable: true })
  testRequested: string;

  @Column({ type: 'text', nullable: true })
  clinicalInfo: string;

  @Column({
    type: 'enum',
    enum: ReferralPriority,
    default: ReferralPriority.ROUTINE,
  })
  priority: ReferralPriority;

  // Stage timestamps for TAT tracking
  @Column({ type: 'timestamptz', nullable: true })
  collectedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  packagedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  shippedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  receivedAtHubAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processingStartedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resultReadyAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resultDeliveredAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  rejectedAt: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  // Transport info
  @Column({ nullable: true })
  transportMethod: string;

  @Column({ nullable: true })
  transporterName: string;

  @Column({ nullable: true })
  transporterPhone: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  temperatureOnArrival: number;

  @Column({ nullable: true })
  sampleConditionOnArrival: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Users
  @Column({ type: 'uuid', nullable: true })
  collectedById: string;

  @Column({ type: 'uuid', nullable: true })
  receivedById: string;
}
