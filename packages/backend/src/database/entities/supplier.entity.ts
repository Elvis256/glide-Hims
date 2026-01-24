import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';

export enum SupplierStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum SupplierType {
  PHARMACEUTICAL = 'pharmaceutical',
  MEDICAL_EQUIPMENT = 'medical_equipment',
  CONSUMABLES = 'consumables',
  GENERAL = 'general',
}

@Entity('suppliers')
@Index(['code'], { unique: true })
@Index(['name'])
@Index(['status'])
export class Supplier extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: SupplierType,
    default: SupplierType.GENERAL,
  })
  type: SupplierType;

  @Column({ name: 'contact_person', nullable: true })
  contactPerson: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: 'alt_phone', nullable: true })
  altPhone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  country: string;

  @Column({ name: 'tax_id', nullable: true })
  taxId: string;

  @Column({ name: 'payment_terms', nullable: true })
  paymentTerms: string; // e.g., "Net 30", "COD"

  @Column({ name: 'credit_limit', type: 'decimal', precision: 12, scale: 2, default: 0 })
  creditLimit: number;

  @Column({ name: 'bank_name', nullable: true })
  bankName: string;

  @Column({ name: 'bank_account', nullable: true })
  bankAccount: string;

  @Column({
    type: 'enum',
    enum: SupplierStatus,
    default: SupplierStatus.ACTIVE,
  })
  status: SupplierStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;
}
