import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';
import { Supplier } from './supplier.entity';

export enum ContractStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  EXPIRING_SOON = 'expiring_soon',
  EXPIRED = 'expired',
  RENEWED = 'renewed',
  TERMINATED = 'terminated',
}

@Entity('vendor_contracts')
@Index(['contractNumber'], { unique: true })
@Index(['status'])
@Index(['endDate'])
export class VendorContract extends BaseEntity {
  @Column({ name: 'contract_number', unique: true })
  contractNumber: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  value: number;

  @Column({ type: 'text', nullable: true })
  terms: string;

  @Column({
    type: 'enum',
    enum: ContractStatus,
    default: ContractStatus.DRAFT,
  })
  status: ContractStatus;

  @Column({ name: 'auto_renew', default: false })
  autoRenew: boolean;

  @Column({ name: 'renewal_notice_days', default: 30 })
  renewalNoticeDays: number;

  @Column({ type: 'jsonb', nullable: true })
  documents: { name: string; url: string; uploadedAt: string }[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => VendorContract, { nullable: true })
  @JoinColumn({ name: 'renewed_from_id' })
  renewedFrom?: VendorContract;

  @Column({ name: 'renewed_from_id', nullable: true })
  renewedFromId?: string;

  @OneToMany(() => ContractAmendment, (a) => a.contract, { cascade: true })
  amendments: ContractAmendment[];
}

@Entity('contract_amendments')
@Index(['contract'])
export class ContractAmendment extends BaseEntity {
  @ManyToOne(() => VendorContract, (c) => c.amendments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: VendorContract;

  @Column({ name: 'contract_id' })
  contractId: string;

  @Column({ name: 'amendment_number' })
  amendmentNumber: number;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, { old: any; new: any }>;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id' })
  createdById: string;
}
