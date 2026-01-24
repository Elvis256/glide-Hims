import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';

export enum ReagentCategory {
  CHEMISTRY = 'chemistry',
  HEMATOLOGY = 'hematology',
  MICROBIOLOGY = 'microbiology',
  SEROLOGY = 'serology',
  URINALYSIS = 'urinalysis',
  COAGULATION = 'coagulation',
  IMMUNOLOGY = 'immunology',
  MOLECULAR = 'molecular',
  BLOOD_BANK = 'blood_bank',
  HISTOPATHOLOGY = 'histopathology',
  CYTOLOGY = 'cytology',
  OTHER = 'other',
}

export enum ReagentStatus {
  ACTIVE = 'active',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  EXPIRED = 'expired',
  DISCONTINUED = 'discontinued',
}

@Entity('lab_reagents')
@Index(['code'], { unique: true, where: 'deleted_at IS NULL' })
export class LabReagent extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ReagentCategory,
  })
  category: ReagentCategory;

  @Column({ type: 'varchar', length: 100, nullable: true })
  manufacturer?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'catalog_number' })
  catalogNumber?: string;

  @Column({ type: 'varchar', length: 50 })
  unit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'unit_size' })
  unitSize: number;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'unit_size_unit' })
  unitSizeUnit?: string;

  @Column({ type: 'int', default: 0, name: 'stock_quantity' })
  stockQuantity: number;

  @Column({ type: 'int', default: 0, name: 'reorder_level' })
  reorderLevel: number;

  @Column({ type: 'int', nullable: true, name: 'max_stock_level' })
  maxStockLevel?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'unit_cost' })
  unitCost?: number;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'storage_temperature' })
  storageTemperature?: string;

  @Column({ type: 'text', nullable: true, name: 'storage_conditions' })
  storageConditions?: string;

  @Column({ type: 'int', nullable: true, name: 'stability_days_after_opening' })
  stabilityDaysAfterOpening?: number;

  @Column({ type: 'boolean', default: false, name: 'requires_calibration' })
  requiresCalibration: boolean;

  @Column({ type: 'int', nullable: true, name: 'calibration_frequency_days' })
  calibrationFrequencyDays?: number;

  @Column({ type: 'jsonb', nullable: true, name: 'compatible_analyzers' })
  compatibleAnalyzers?: string[];

  @Column({ type: 'jsonb', nullable: true, name: 'test_codes' })
  testCodes?: string[];

  @Column({ type: 'int', nullable: true, name: 'tests_per_unit' })
  testsPerUnit?: number;

  @Column({
    type: 'enum',
    enum: ReagentStatus,
    default: ReagentStatus.ACTIVE,
  })
  status: ReagentStatus;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => ReagentLot, lot => lot.reagent)
  lots: ReagentLot[];
}

@Entity('reagent_lots')
@Index(['reagentId', 'lotNumber'], { unique: true, where: 'deleted_at IS NULL' })
export class ReagentLot extends BaseEntity {
  @Column({ type: 'uuid', name: 'reagent_id' })
  reagentId: string;

  @ManyToOne(() => LabReagent, reagent => reagent.lots)
  @JoinColumn({ name: 'reagent_id' })
  reagent: LabReagent;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'varchar', length: 100, name: 'lot_number' })
  lotNumber: string;

  @Column({ type: 'date', name: 'expiry_date' })
  expiryDate: Date;

  @Column({ type: 'date', name: 'received_date' })
  receivedDate: Date;

  @Column({ type: 'date', nullable: true, name: 'opened_date' })
  openedDate?: Date;

  @Column({ type: 'int', name: 'initial_quantity' })
  initialQuantity: number;

  @Column({ type: 'int', name: 'current_quantity' })
  currentQuantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'unit_cost' })
  unitCost?: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'supplier_name' })
  supplierName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'po_number' })
  poNumber?: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_qc_passed' })
  isQcPassed: boolean;

  @Column({ type: 'date', nullable: true, name: 'qc_date' })
  qcDate?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => ReagentConsumption, consumption => consumption.lot)
  consumptions: ReagentConsumption[];
}

@Entity('reagent_consumptions')
export class ReagentConsumption extends BaseEntity {
  @Column({ type: 'uuid', name: 'lot_id' })
  lotId: string;

  @ManyToOne(() => ReagentLot, lot => lot.consumptions)
  @JoinColumn({ name: 'lot_id' })
  lot: ReagentLot;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', nullable: true, name: 'lab_order_id' })
  labOrderId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'test_code' })
  testCode?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'quantity_used' })
  quantityUsed: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit?: string;

  @Column({ type: 'timestamp', name: 'consumed_at' })
  consumedAt: Date;

  @Column({ type: 'uuid', nullable: true, name: 'consumed_by' })
  consumedBy?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
