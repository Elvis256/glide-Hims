import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PrescriptionItem, Dispensation } from './prescription.entity';
import { User } from './user.entity';
import { DrugSchedule } from './drug-classification.entity';

@Entity('controlled_substance_logs')
@Index(['prescriptionItemId'])
@Index(['dispensationId'])
@Index(['drugSchedule', 'createdAt'])
@Index(['facilityId', 'createdAt'])
@Index(['facilityId', 'drugSchedule'])
@Index(['pharmacySaleItemId'])
export class ControlledSubstanceLog extends BaseEntity {
  @Column({ name: 'prescription_item_id', nullable: true })
  prescriptionItemId: string;

  @ManyToOne(() => PrescriptionItem, { nullable: true })
  @JoinColumn({ name: 'prescription_item_id' })
  prescriptionItem: PrescriptionItem;

  @Column({ name: 'dispensation_id', nullable: true })
  dispensationId: string;

  @ManyToOne(() => Dispensation, { nullable: true })
  @JoinColumn({ name: 'dispensation_id' })
  dispensation: Dispensation;

  // Phase A: link to retail/POS sale items (no prescription path)
  @Column({ name: 'pharmacy_sale_item_id', type: 'uuid', nullable: true })
  pharmacySaleItemId: string;

  @Column({
    type: 'enum',
    enum: DrugSchedule,
    name: 'drug_schedule',
  })
  drugSchedule: DrugSchedule;

  @Column({ name: 'quantity_dispensed', type: 'decimal', precision: 10, scale: 2 })
  quantityDispensed: number;

  @Column({ name: 'running_balance', type: 'decimal', precision: 10, scale: 2 })
  runningBalance: number;

  @Column({ name: 'dispensed_by_id' })
  dispensedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'dispensed_by_id' })
  dispensedBy: User;

  @Column({ name: 'witness_id', nullable: true })
  witnessId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'witness_id' })
  witness: User;

  @Column({ name: 'witness_name', length: 255, nullable: true })
  witnessName: string;

  @Column({ name: 'witness_signature', type: 'text', nullable: true })
  witnessSignature: string;

  @Column({ name: 'witnessed_at', type: 'timestamptz', nullable: true })
  witnessedAt: Date;

  @Column({ name: 'double_check_by_id', nullable: true })
  doubleCheckById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'double_check_by_id' })
  doubleCheckBy: User;

  @Column({ name: 'double_checked_at', type: 'timestamptz', nullable: true })
  doubleCheckedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'facility_id', type: 'uuid', nullable: true })
  @Index()
  facilityId: string;

  // Phase A: OTC / retail-counter dispensing fields. When prescription_item_id
  // is null, the sale must populate these for any schedule II–V dispensing.
  @Column({ name: 'buyer_name', nullable: true })
  buyerName: string;

  @Column({ name: 'buyer_id_type', length: 30, nullable: true })
  buyerIdType: string; // national_id, passport, drivers_license, refugee_id, etc.

  @Column({ name: 'buyer_id_number', length: 60, nullable: true })
  buyerIdNumber: string;

  @Column({ name: 'buyer_phone', length: 30, nullable: true })
  buyerPhone: string;

  @Column({ name: 'prescriber_name', nullable: true })
  prescriberName: string;

  @Column({ name: 'prescriber_license', length: 60, nullable: true })
  prescriberLicense: string;

  @Column({ name: 'pharmacist_id', type: 'uuid', nullable: true })
  pharmacistId: string;

  // True if this dispense was made under an OTC-permitted classification
  // (vs a prescription-required dispense). Schedule II is never OTC-permitted.
  @Column({ name: 'is_otc_permitted', default: false })
  isOtcPermitted: boolean;
}
