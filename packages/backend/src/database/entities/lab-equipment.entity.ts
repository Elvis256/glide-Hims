import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { Department } from './department.entity';
import { User } from './user.entity';

export enum EquipmentCategory {
  ANALYZER = 'analyzer',
  CENTRIFUGE = 'centrifuge',
  MICROSCOPE = 'microscope',
  INCUBATOR = 'incubator',
  REFRIGERATOR = 'refrigerator',
  FREEZER = 'freezer',
  AUTOCLAVE = 'autoclave',
  WATER_BATH = 'water_bath',
  PIPETTE = 'pipette',
  BALANCE = 'balance',
  PH_METER = 'ph_meter',
  SPECTROPHOTOMETER = 'spectrophotometer',
  ELECTROPHORESIS = 'electrophoresis',
  PCR_MACHINE = 'pcr_machine',
  BLOOD_GAS_ANALYZER = 'blood_gas_analyzer',
  HEMATOLOGY_ANALYZER = 'hematology_analyzer',
  CHEMISTRY_ANALYZER = 'chemistry_analyzer',
  COAGULATION_ANALYZER = 'coagulation_analyzer',
  IMMUNOASSAY_ANALYZER = 'immunoassay_analyzer',
  URINALYSIS_ANALYZER = 'urinalysis_analyzer',
  BLOOD_BANK_EQUIPMENT = 'blood_bank_equipment',
  SAFETY_CABINET = 'safety_cabinet',
  OTHER = 'other',
}

export enum EquipmentStatus {
  OPERATIONAL = 'operational',
  UNDER_MAINTENANCE = 'under_maintenance',
  OUT_OF_SERVICE = 'out_of_service',
  CALIBRATION_DUE = 'calibration_due',
  DECOMMISSIONED = 'decommissioned',
}

export enum CalibrationStatus {
  CURRENT = 'current',
  DUE_SOON = 'due_soon',
  OVERDUE = 'overdue',
  NOT_REQUIRED = 'not_required',
}

@Entity('lab_equipment')
@Index(['assetCode'], { unique: true, where: 'deleted_at IS NULL' })
export class LabEquipment extends BaseEntity {
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
    enum: EquipmentCategory,
  })
  category: EquipmentCategory;

  @Column({ type: 'varchar', length: 100, nullable: true })
  manufacturer?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'serial_number' })
  serialNumber?: string;

  @Column({ type: 'date', nullable: true, name: 'installation_date' })
  installationDate?: Date;

  @Column({ type: 'date', nullable: true, name: 'warranty_expiry' })
  warrantyExpiry?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string;

  @Column({
    type: 'enum',
    enum: EquipmentStatus,
    default: EquipmentStatus.OPERATIONAL,
  })
  status: EquipmentStatus;

  @Column({ type: 'boolean', default: true, name: 'requires_calibration' })
  requiresCalibration: boolean;

  @Column({ type: 'int', nullable: true, name: 'calibration_frequency_days' })
  calibrationFrequencyDays?: number;

  @Column({ type: 'date', nullable: true, name: 'last_calibration_date' })
  lastCalibrationDate?: Date;

  @Column({ type: 'date', nullable: true, name: 'next_calibration_date' })
  nextCalibrationDate?: Date;

  @Column({
    type: 'enum',
    enum: CalibrationStatus,
    default: CalibrationStatus.NOT_REQUIRED,
    name: 'calibration_status',
  })
  calibrationStatus: CalibrationStatus;

  @Column({ type: 'boolean', default: true, name: 'requires_maintenance' })
  requiresMaintenance: boolean;

  @Column({ type: 'int', nullable: true, name: 'maintenance_frequency_days' })
  maintenanceFrequencyDays?: number;

  @Column({ type: 'date', nullable: true, name: 'last_maintenance_date' })
  lastMaintenanceDate?: Date;

  @Column({ type: 'date', nullable: true, name: 'next_maintenance_date' })
  nextMaintenanceDate?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'responsible_person_id' })
  responsiblePersonId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'responsible_person_id' })
  responsiblePerson?: User;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'service_provider' })
  serviceProvider?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'service_contract_number' })
  serviceContractNumber?: string;

  @Column({ type: 'date', nullable: true, name: 'service_contract_expiry' })
  serviceContractExpiry?: Date;

  @Column({ type: 'jsonb', nullable: true, name: 'supported_tests' })
  supportedTests?: string[];

  @Column({ type: 'jsonb', nullable: true, name: 'compatible_reagents' })
  compatibleReagents?: string[];

  @Column({ type: 'int', nullable: true, name: 'daily_capacity' })
  dailyCapacity?: number;

  @Column({ type: 'jsonb', nullable: true })
  specifications?: Record<string, any>;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'manual_url' })
  manualUrl?: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => EquipmentCalibration, cal => cal.equipment)
  calibrations: EquipmentCalibration[];

  @OneToMany(() => EquipmentMaintenance, maint => maint.equipment)
  maintenances: EquipmentMaintenance[];
}

@Entity('equipment_calibrations')
export class EquipmentCalibration extends BaseEntity {
  @Column({ type: 'uuid', name: 'equipment_id' })
  equipmentId: string;

  @ManyToOne(() => LabEquipment, eq => eq.calibrations)
  @JoinColumn({ name: 'equipment_id' })
  equipment: LabEquipment;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'date', name: 'calibration_date' })
  calibrationDate: Date;

  @Column({ type: 'varchar', length: 50 })
  type: string; // internal, external, verification

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'performed_by' })
  performedBy?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'external_provider' })
  externalProvider?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'certificate_number' })
  certificateNumber?: string;

  @Column({ type: 'jsonb', nullable: true })
  results?: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  passed: boolean;

  @Column({ type: 'text', nullable: true })
  comments?: string;

  @Column({ type: 'date', nullable: true, name: 'next_due_date' })
  nextDueDate?: Date;

  @Column({ type: 'jsonb', nullable: true })
  attachments?: string[];
}

@Entity('equipment_maintenances')
export class EquipmentMaintenance extends BaseEntity {
  @Column({ type: 'uuid', name: 'equipment_id' })
  equipmentId: string;

  @ManyToOne(() => LabEquipment, eq => eq.maintenances)
  @JoinColumn({ name: 'equipment_id' })
  equipment: LabEquipment;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'date', name: 'maintenance_date' })
  maintenanceDate: Date;

  @Column({ type: 'varchar', length: 50 })
  type: string; // preventive, corrective, emergency

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'performed_by' })
  performedBy?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'service_provider' })
  serviceProvider?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  cost: number;

  @Column({ type: 'text', nullable: true, name: 'parts_replaced' })
  partsReplaced?: string;

  @Column({ type: 'text', nullable: true })
  findings?: string;

  @Column({ type: 'text', nullable: true })
  recommendations?: string;

  @Column({ type: 'date', nullable: true, name: 'next_due_date' })
  nextDueDate?: Date;

  @Column({ type: 'jsonb', nullable: true })
  attachments?: string[];
}
