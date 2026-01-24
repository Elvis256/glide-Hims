import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LabSample } from './lab-sample.entity';
import { User } from './user.entity';

export enum ResultStatus {
  PENDING = 'pending',
  ENTERED = 'entered',
  VALIDATED = 'validated',
  RELEASED = 'released',
  AMENDED = 'amended',
}

export enum AbnormalFlag {
  NORMAL = 'normal',
  LOW = 'low',
  HIGH = 'high',
  CRITICAL_LOW = 'critical_low',
  CRITICAL_HIGH = 'critical_high',
  ABNORMAL = 'abnormal',
}

@Entity('lab_results')
export class LabResult extends BaseEntity {
  @Column()
  parameter: string;

  @Column({ type: 'text', nullable: true })
  value: string;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  numericValue: number;

  @Column({ nullable: true })
  unit: string;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  referenceMin: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  referenceMax: number;

  @Column({ nullable: true })
  referenceRange: string;

  @Column({ type: 'enum', enum: AbnormalFlag, default: AbnormalFlag.NORMAL })
  abnormalFlag: AbnormalFlag;

  @Column({ type: 'enum', enum: ResultStatus, default: ResultStatus.PENDING })
  status: ResultStatus;

  @Column({ type: 'text', nullable: true })
  interpretation: string;

  @Column({ type: 'text', nullable: true })
  comments: string;

  @Column({ type: 'timestamp', nullable: true })
  validatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  releasedAt: Date;

  @Column({ type: 'text', nullable: true })
  amendmentReason: string;

  @Column({ type: 'jsonb', nullable: true })
  previousValues: {
    value: string;
    date: Date;
    amendedBy: string;
    reason: string;
  }[];

  // Relations
  @Column({ type: 'uuid' })
  sampleId: string;

  @ManyToOne(() => LabSample, sample => sample.results)
  @JoinColumn({ name: 'sampleId' })
  sample: LabSample;

  @Column({ type: 'uuid', nullable: true })
  enteredById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'enteredById' })
  enteredBy: User;

  @Column({ type: 'uuid', nullable: true })
  validatedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'validatedById' })
  validatedBy: User;

  @Column({ type: 'uuid', nullable: true })
  releasedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'releasedById' })
  releasedBy: User;
}
