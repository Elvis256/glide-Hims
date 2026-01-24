import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Store } from './store.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

export enum SaleType {
  PRESCRIPTION = 'prescription',
  OTC = 'otc', // Over the counter (walk-in)
  INTERNAL = 'internal', // Internal consumption
}

export enum SaleStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

@Entity('pharmacy_sales')
@Index(['saleNumber'], { unique: true })
@Index(['store', 'createdAt'])
@Index(['patient'])
export class PharmacySale extends BaseEntity {
  @Column({ name: 'sale_number', unique: true })
  saleNumber: string;

  @Column({
    name: 'sale_type',
    type: 'enum',
    enum: SaleType,
    default: SaleType.OTC,
  })
  saleType: SaleType;

  @Column({
    type: 'enum',
    enum: SaleStatus,
    default: SaleStatus.PENDING,
  })
  status: SaleStatus;

  @Column({ name: 'subtotal', type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 12, scale: 2, default: 0 })
  amountPaid: number;

  @Column({ name: 'payment_method', default: 'cash' })
  paymentMethod: string; // cash, mobile_money, card, credit

  @Column({ name: 'transaction_reference', nullable: true })
  transactionReference: string;

  @Column({ name: 'customer_name', nullable: true })
  customerName: string; // For walk-in without patient record

  @Column({ name: 'customer_phone', nullable: true })
  customerPhone: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'prescription_id', nullable: true })
  prescriptionId: string; // If from prescription

  // Relationships
  @ManyToOne(() => Store)
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ name: 'store_id' })
  storeId: string;

  @ManyToOne(() => Patient, { nullable: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', nullable: true })
  patientId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sold_by_id' })
  soldBy: User;

  @Column({ name: 'sold_by_id' })
  soldById: string;

  @OneToMany(() => PharmacySaleItem, (item) => item.sale, { cascade: true })
  items: PharmacySaleItem[];
}

@Entity('pharmacy_sale_items')
@Index(['sale'])
export class PharmacySaleItem extends BaseEntity {
  @ManyToOne(() => PharmacySale, (sale) => sale.items)
  @JoinColumn({ name: 'sale_id' })
  sale: PharmacySale;

  @Column({ name: 'sale_id' })
  saleId: string;

  @Column({ name: 'item_id' })
  itemId: string; // Reference to inventory

  @Column({ name: 'item_code' })
  itemCode: string;

  @Column({ name: 'item_name' })
  itemName: string;

  @Column({ name: 'batch_number', nullable: true })
  batchNumber: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date;

  @Column()
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ name: 'discount_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  instructions: string;
}
