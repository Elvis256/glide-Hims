import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Admission } from './admission.entity';
import { Ward } from './ward.entity';
import { Bed } from './bed.entity';
import { User } from './user.entity';

export enum TransferReason {
  CLINICAL = 'clinical',
  PATIENT_REQUEST = 'patient_request',
  BED_MANAGEMENT = 'bed_management',
  ISOLATION = 'isolation',
  STEP_DOWN = 'step_down',
  STEP_UP = 'step_up',
}

@Entity('bed_transfers')
export class BedTransfer extends BaseEntity {
  @Column({ type: 'enum', enum: TransferReason })
  reason: TransferReason;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  transferTime: Date;

  @Column({ type: 'uuid' })
  admissionId: string;

  @ManyToOne(() => Admission, admission => admission.bedTransfers)
  @JoinColumn({ name: 'admissionId' })
  admission: Admission;

  @Column({ type: 'uuid' })
  fromWardId: string;

  @ManyToOne(() => Ward)
  @JoinColumn({ name: 'fromWardId' })
  fromWard: Ward;

  @Column({ type: 'uuid' })
  fromBedId: string;

  @ManyToOne(() => Bed)
  @JoinColumn({ name: 'fromBedId' })
  fromBed: Bed;

  @Column({ type: 'uuid' })
  toWardId: string;

  @ManyToOne(() => Ward)
  @JoinColumn({ name: 'toWardId' })
  toWard: Ward;

  @Column({ type: 'uuid' })
  toBedId: string;

  @ManyToOne(() => Bed)
  @JoinColumn({ name: 'toBedId' })
  toBed: Bed;

  @Column({ type: 'uuid' })
  transferredById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'transferredById' })
  transferredBy: User;
}
