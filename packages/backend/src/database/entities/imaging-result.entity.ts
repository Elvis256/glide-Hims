import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ImagingOrder } from './imaging-order.entity';
import { User } from './user.entity';

export enum FindingCategory {
  NORMAL = 'normal',
  ABNORMAL = 'abnormal',
  CRITICAL = 'critical',
  INDETERMINATE = 'indeterminate',
}

@Entity('imaging_results')
export class ImagingResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'imaging_order_id' })
  imagingOrderId: string;

  @OneToOne(() => ImagingOrder)
  @JoinColumn({ name: 'imaging_order_id' })
  imagingOrder: ImagingOrder;

  // Radiologist report
  @Column({ type: 'text', nullable: true })
  findings: string;

  @Column({ type: 'text', nullable: true })
  impression: string;

  @Column({ type: 'text', nullable: true })
  recommendations: string;

  @Column({ type: 'enum', enum: FindingCategory, nullable: true, name: 'finding_category' })
  findingCategory: FindingCategory;

  // Reporting radiologist
  @Column({ type: 'uuid', name: 'reported_by_id' })
  reportedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reported_by_id' })
  reportedBy: User;

  @Column({ type: 'timestamp', name: 'reported_at' })
  reportedAt: Date;

  // Verification (if applicable)
  @Column({ type: 'uuid', nullable: true, name: 'verified_by_id' })
  verifiedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'verified_by_id' })
  verifiedBy: User;

  @Column({ type: 'timestamp', nullable: true, name: 'verified_at' })
  verifiedAt: Date;

  @Column({ type: 'boolean', default: false, name: 'is_critical' })
  isCritical: boolean;

  @Column({ type: 'boolean', default: false, name: 'critical_notified' })
  criticalNotified: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'critical_notified_at' })
  criticalNotifiedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
