import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Encounter } from './encounter.entity';
import { User } from './user.entity';

export enum PrescriptionStatus {
  PENDING = 'pending',
  PARTIALLY_DISPENSED = 'partially_dispensed',
  DISPENSED = 'dispensed',
  CANCELLED = 'cancelled',
}

@Entity('prescriptions')
@Index(['encounter'])
@Index(['status', 'createdAt'])
export class Prescription extends BaseEntity {
  @Column({ name: 'prescription_number', unique: true })
  prescriptionNumber: string;

  @Column({
    type: 'enum',
    enum: PrescriptionStatus,
    default: PrescriptionStatus.PENDING,
  })
  status: PrescriptionStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relationships
  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @Column({ name: 'encounter_id' })
  encounterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'prescribed_by_id' })
  prescribedBy: User;

  @Column({ name: 'prescribed_by_id' })
  prescribedById: string;

  @OneToMany(() => PrescriptionItem, (item) => item.prescription, { cascade: true })
  items: PrescriptionItem[];
}

@Entity('prescription_items')
@Index(['prescription'])
export class PrescriptionItem extends BaseEntity {
  @Column({ name: 'drug_code' })
  drugCode: string;

  @Column({ name: 'drug_name' })
  drugName: string;

  @Column()
  dose: string; // e.g., "500mg"

  @Column()
  frequency: string; // e.g., "TDS" (three times daily)

  @Column()
  duration: string; // e.g., "5 days"

  @Column()
  quantity: number;

  @Column({ name: 'quantity_dispensed', default: 0 })
  quantityDispensed: number;

  @Column({ type: 'text', nullable: true })
  instructions: string; // e.g., "Take after meals"

  @Column({ name: 'is_dispensed', default: false })
  isDispensed: boolean;

  // Relationships
  @ManyToOne(() => Prescription, (prescription) => prescription.items)
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @Column({ name: 'prescription_id' })
  prescriptionId: string;
}

@Entity('dispensations')
@Index(['prescription'])
@Index(['dispensedAt'])
export class Dispensation extends BaseEntity {
  @Column({ name: 'batch_number', nullable: true })
  batchNumber: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date;

  @Column()
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalPrice: number;

  @Column({ name: 'dispensed_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  dispensedAt: Date;

  // Relationships
  @ManyToOne(() => Prescription)
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @Column({ name: 'prescription_id' })
  prescriptionId: string;

  @ManyToOne(() => PrescriptionItem)
  @JoinColumn({ name: 'prescription_item_id' })
  prescriptionItem: PrescriptionItem;

  @Column({ name: 'prescription_item_id' })
  prescriptionItemId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'dispensed_by_id' })
  dispensedBy: User;

  @Column({ name: 'dispensed_by_id' })
  dispensedById: string;
}
