import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { InsuranceClaim } from './insurance-claim.entity';

export enum ClaimItemType {
  CONSULTATION = 'consultation',
  PROCEDURE = 'procedure',
  LABORATORY = 'laboratory',
  RADIOLOGY = 'radiology',
  PHARMACY = 'pharmacy',
  SUPPLIES = 'supplies',
  BED_CHARGES = 'bed_charges',
  NURSING = 'nursing',
  THEATRE = 'theatre',
  ICU = 'icu',
  OTHER = 'other',
}

export enum ClaimItemStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  PARTIALLY_APPROVED = 'partially_approved',
  REJECTED = 'rejected',
}

@Entity('claim_items')
export class ClaimItem extends BaseEntity {
  @Column({ name: 'claim_id' })
  claimId: string;

  @ManyToOne(() => InsuranceClaim, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'claim_id' })
  claim: InsuranceClaim;

  @Column({ name: 'item_type', type: 'enum', enum: ClaimItemType })
  itemType: ClaimItemType;

  @Column({ name: 'service_code', nullable: true })
  serviceCode?: string;

  @Column()
  description: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 15, scale: 2 })
  unitPrice: number;

  @Column({ name: 'claimed_amount', type: 'decimal', precision: 15, scale: 2 })
  claimedAmount: number;

  @Column({ name: 'approved_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  approvedAmount: number;

  @Column({ type: 'enum', enum: ClaimItemStatus, default: ClaimItemStatus.PENDING })
  status: ClaimItemStatus;

  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason?: string;

  @Column({ name: 'service_date', type: 'date' })
  serviceDate: Date;

  @Column({ name: 'provider_notes', nullable: true })
  providerNotes?: string;

  @Column({ name: 'insurer_notes', nullable: true })
  insurerNotes?: string;
}
