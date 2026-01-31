import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Item } from './inventory.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';

export enum DisposalMethod {
  INCINERATION = 'incineration',
  CHEMICAL = 'chemical',
  LANDFILL = 'landfill',
  RETURN_TO_MANUFACTURER = 'return_to_manufacturer',
}

export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  PENDING_REVIEW = 'pending_review',
  NON_COMPLIANT = 'non_compliant',
}

@Entity('disposal_records')
@Index(['facilityId', 'createdAt'])
@Index(['complianceStatus'])
export class DisposalRecord extends BaseEntity {
  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'batch_number', nullable: true })
  batchNumber: string;

  @Column()
  quantity: number;

  @Column({ name: 'unit_value', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitValue: number;

  @Column({ name: 'total_value', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalValue: number;

  @Column({ name: 'disposal_date', type: 'date' })
  disposalDate: Date;

  @Column({
    name: 'disposal_method',
    type: 'enum',
    enum: DisposalMethod,
    default: DisposalMethod.INCINERATION,
  })
  disposalMethod: DisposalMethod;

  @Column({ nullable: true })
  witness: string;

  @Column({ name: 'certificate_number', nullable: true })
  certificateNumber: string;

  @Column({
    name: 'compliance_status',
    type: 'enum',
    enum: ComplianceStatus,
    default: ComplianceStatus.PENDING_REVIEW,
  })
  complianceStatus: ComplianceStatus;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'disposed_by_id' })
  disposedBy: User;

  @Column({ name: 'disposed_by_id' })
  disposedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: User;

  @Column({ name: 'approved_by_id', nullable: true })
  approvedById: string;
}
