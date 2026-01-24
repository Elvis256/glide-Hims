import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { Department } from './department.entity';
import { User } from './user.entity';

export enum AssetCategory {
  MEDICAL_EQUIPMENT = 'medical_equipment',
  LABORATORY_EQUIPMENT = 'laboratory_equipment',
  IMAGING_EQUIPMENT = 'imaging_equipment',
  SURGICAL_EQUIPMENT = 'surgical_equipment',
  FURNITURE = 'furniture',
  IT_EQUIPMENT = 'it_equipment',
  VEHICLES = 'vehicles',
  BUILDINGS = 'buildings',
  LAND = 'land',
  OFFICE_EQUIPMENT = 'office_equipment',
  ELECTRICAL_EQUIPMENT = 'electrical_equipment',
  HVAC = 'hvac',
  OTHER = 'other',
}

export enum AssetStatus {
  ACTIVE = 'active',
  UNDER_MAINTENANCE = 'under_maintenance',
  DISPOSED = 'disposed',
  WRITTEN_OFF = 'written_off',
  TRANSFERRED = 'transferred',
  STOLEN = 'stolen',
  DAMAGED = 'damaged',
}

export enum DepreciationMethod {
  STRAIGHT_LINE = 'straight_line',
  DECLINING_BALANCE = 'declining_balance',
  DOUBLE_DECLINING = 'double_declining',
  SUM_OF_YEARS = 'sum_of_years',
  UNITS_OF_PRODUCTION = 'units_of_production',
}

export enum AssetCondition {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  NON_FUNCTIONAL = 'non_functional',
}

@Entity('fixed_assets')
@Index(['assetCode'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['serialNumber'], { unique: true, where: 'deleted_at IS NULL AND serial_number IS NOT NULL' })
export class FixedAsset extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'uuid', nullable: true, name: 'department_id' })
  departmentId?: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department?: Department;

  @Column({ type: 'varchar', length: 50, name: 'asset_code' })
  assetCode: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: AssetCategory,
  })
  category: AssetCategory;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'sub_category' })
  subCategory?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'serial_number' })
  serialNumber?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  manufacturer?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  supplier?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'purchase_order_number' })
  purchaseOrderNumber?: string;

  @Column({ type: 'date', name: 'acquisition_date' })
  acquisitionDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'acquisition_cost' })
  acquisitionCost: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'installation_cost' })
  installationCost: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'total_cost' })
  totalCost: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'salvage_value' })
  salvageValue: number;

  @Column({ type: 'int', name: 'useful_life_months' })
  usefulLifeMonths: number;

  @Column({
    type: 'enum',
    enum: DepreciationMethod,
    default: DepreciationMethod.STRAIGHT_LINE,
    name: 'depreciation_method',
  })
  depreciationMethod: DepreciationMethod;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'depreciation_rate' })
  depreciationRate?: number;

  @Column({ type: 'date', name: 'depreciation_start_date' })
  depreciationStartDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'accumulated_depreciation' })
  accumulatedDepreciation: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'book_value' })
  bookValue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'current_market_value' })
  currentMarketValue?: number;

  @Column({ type: 'date', nullable: true, name: 'last_valuation_date' })
  lastValuationDate?: Date;

  @Column({
    type: 'enum',
    enum: AssetStatus,
    default: AssetStatus.ACTIVE,
  })
  status: AssetStatus;

  @Column({
    type: 'enum',
    enum: AssetCondition,
    default: AssetCondition.GOOD,
  })
  condition: AssetCondition;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string;

  @Column({ type: 'uuid', nullable: true, name: 'custodian_id' })
  custodianId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'custodian_id' })
  custodian?: User;

  @Column({ type: 'date', nullable: true, name: 'warranty_expiry' })
  warrantyExpiry?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'warranty_provider' })
  warrantyProvider?: string;

  @Column({ type: 'date', nullable: true, name: 'next_maintenance_date' })
  nextMaintenanceDate?: Date;

  @Column({ type: 'int', nullable: true, name: 'maintenance_interval_days' })
  maintenanceIntervalDays?: number;

  @Column({ type: 'boolean', default: false, name: 'is_insured' })
  isInsured: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'insurance_policy_number' })
  insurancePolicyNumber?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'insured_value' })
  insuredValue?: number;

  @Column({ type: 'date', nullable: true, name: 'insurance_expiry' })
  insuranceExpiry?: Date;

  @Column({ type: 'date', nullable: true, name: 'disposal_date' })
  disposalDate?: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'disposal_value' })
  disposalValue?: number;

  @Column({ type: 'text', nullable: true, name: 'disposal_reason' })
  disposalReason?: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'image_url' })
  imageUrl?: string;

  @Column({ type: 'jsonb', nullable: true })
  specifications?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => AssetDepreciation, dep => dep.asset)
  depreciationRecords: AssetDepreciation[];

  @OneToMany(() => AssetMaintenance, maint => maint.asset)
  maintenanceRecords: AssetMaintenance[];

  @OneToMany(() => AssetTransfer, transfer => transfer.asset)
  transferHistory: AssetTransfer[];
}

@Entity('asset_depreciations')
@Index(['assetId', 'periodYear', 'periodMonth'], { unique: true })
export class AssetDepreciation extends BaseEntity {
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId: string;

  @ManyToOne(() => FixedAsset, asset => asset.depreciationRecords)
  @JoinColumn({ name: 'asset_id' })
  asset: FixedAsset;

  @Column({ type: 'int', name: 'period_year' })
  periodYear: number;

  @Column({ type: 'int', name: 'period_month' })
  periodMonth: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'opening_book_value' })
  openingBookValue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'depreciation_amount' })
  depreciationAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'accumulated_depreciation' })
  accumulatedDepreciation: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'closing_book_value' })
  closingBookValue: number;

  @Column({ type: 'boolean', default: false, name: 'is_posted' })
  isPosted: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'journal_entry_id' })
  journalEntryId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'posted_by' })
  postedBy?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'posted_at' })
  postedAt?: Date;
}

@Entity('asset_maintenances')
export class AssetMaintenance extends BaseEntity {
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId: string;

  @ManyToOne(() => FixedAsset, asset => asset.maintenanceRecords)
  @JoinColumn({ name: 'asset_id' })
  asset: FixedAsset;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'varchar', length: 50 })
  type: string; // preventive, corrective, calibration

  @Column({ type: 'date', name: 'maintenance_date' })
  maintenanceDate: Date;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'performed_by' })
  performedBy?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'service_provider' })
  serviceProvider?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  cost: number;

  @Column({ type: 'date', nullable: true, name: 'next_due_date' })
  nextDueDate?: Date;

  @Column({ type: 'text', nullable: true })
  findings?: string;

  @Column({ type: 'text', nullable: true })
  recommendations?: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments?: string[];
}

@Entity('asset_transfers')
export class AssetTransfer extends BaseEntity {
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId: string;

  @ManyToOne(() => FixedAsset, asset => asset.transferHistory)
  @JoinColumn({ name: 'asset_id' })
  asset: FixedAsset;

  @Column({ type: 'uuid', name: 'from_facility_id' })
  fromFacilityId: string;

  @Column({ type: 'uuid', nullable: true, name: 'from_department_id' })
  fromDepartmentId?: string;

  @Column({ type: 'uuid', name: 'to_facility_id' })
  toFacilityId: string;

  @Column({ type: 'uuid', nullable: true, name: 'to_department_id' })
  toDepartmentId?: string;

  @Column({ type: 'date', name: 'transfer_date' })
  transferDate: Date;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'uuid', name: 'transferred_by' })
  transferredBy: string;

  @Column({ type: 'uuid', nullable: true, name: 'received_by' })
  receivedBy?: string;

  @Column({ type: 'date', nullable: true, name: 'received_date' })
  receivedDate?: Date;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string;
}
