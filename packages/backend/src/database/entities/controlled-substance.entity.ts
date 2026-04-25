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
export class ControlledSubstanceLog extends BaseEntity {
  @Column({ name: 'prescription_item_id' })
  prescriptionItemId: string;

  @ManyToOne(() => PrescriptionItem)
  @JoinColumn({ name: 'prescription_item_id' })
  prescriptionItem: PrescriptionItem;

  @Column({ name: 'dispensation_id' })
  dispensationId: string;

  @ManyToOne(() => Dispensation)
  @JoinColumn({ name: 'dispensation_id' })
  dispensation: Dispensation;

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
}
