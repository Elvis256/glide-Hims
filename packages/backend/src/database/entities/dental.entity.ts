import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

// ============ DENTAL CHART ============

@Entity('dental_charts')
@Index(['tenantId', 'patientId'], { unique: true, where: 'deleted_at IS NULL' })
export class DentalChart extends BaseEntity {
  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @OneToMany(() => ToothRecord, (tooth) => tooth.chart)
  teeth: ToothRecord[];
}

// ============ TOOTH RECORD ============

@Entity('tooth_records')
@Index(['tenantId', 'chartId'])
@Index(['chartId', 'toothNumber'], { unique: true, where: 'deleted_at IS NULL' })
export class ToothRecord extends BaseEntity {
  @Column({ type: 'uuid', name: 'chart_id' })
  chartId: string;

  @ManyToOne(() => DentalChart, (chart) => chart.teeth)
  @JoinColumn({ name: 'chart_id' })
  chart: DentalChart;

  @Column({ type: 'varchar', length: 5, name: 'tooth_number' })
  toothNumber: string;

  @Column({ type: 'varchar', length: 20, default: 'universal', name: 'tooth_system' })
  toothSystem: string;

  @Column({ type: 'varchar', length: 30, default: 'healthy' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  conditions: Array<{ surface: string; condition: string; severity: string }> | null;

  @Column({ type: 'int', nullable: true })
  mobility: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}

// ============ DENTAL PROCEDURE ============

@Entity('dental_procedures')
@Index(['tenantId', 'code'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['tenantId', 'category'])
export class DentalProcedure extends BaseEntity {
  @Column({ type: 'varchar', length: 10 })
  code: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'default_fee' })
  defaultFee: number | null;

  @Column({ type: 'int', nullable: true })
  duration: number | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;
}

// ============ DENTAL TREATMENT PLAN ============

@Entity('dental_treatment_plans')
@Index(['tenantId', 'patientId'])
export class DentalTreatmentPlan extends BaseEntity {
  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid', name: 'dentist_id' })
  dentistId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'dentist_id' })
  dentist: User;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 30, default: 'proposed' })
  status: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'total_estimated' })
  totalEstimated: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'total_insurance' })
  totalInsurance: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'total_patient' })
  totalPatient: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'accepted_at' })
  acceptedAt: Date | null;

  @OneToMany(() => TreatmentPlanItem, (item) => item.treatmentPlan)
  items: TreatmentPlanItem[];
}

// ============ TREATMENT PLAN ITEM ============

@Entity('treatment_plan_items')
@Index(['tenantId', 'treatmentPlanId'])
export class TreatmentPlanItem extends BaseEntity {
  @Column({ type: 'uuid', name: 'treatment_plan_id' })
  treatmentPlanId: string;

  @ManyToOne(() => DentalTreatmentPlan, (plan) => plan.items)
  @JoinColumn({ name: 'treatment_plan_id' })
  treatmentPlan: DentalTreatmentPlan;

  @Column({ type: 'varchar', length: 5, nullable: true, name: 'tooth_number' })
  toothNumber: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  surface: string | null;

  @Column({ type: 'uuid', name: 'procedure_id' })
  procedureId: string;

  @ManyToOne(() => DentalProcedure)
  @JoinColumn({ name: 'procedure_id' })
  procedure: DentalProcedure;

  @Column({ type: 'uuid', name: 'dentist_id' })
  dentistId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'dentist_id' })
  dentist: User;

  @Column({ type: 'varchar', length: 20, default: 'routine' })
  priority: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'estimated_cost' })
  estimatedCost: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'insurance_coverage' })
  insuranceCoverage: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'patient_cost' })
  patientCost: number | null;

  @Column({ type: 'varchar', length: 30, default: 'planned' })
  status: string;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}

// ============ DENTAL IMAGE ============

@Entity('dental_images')
@Index(['tenantId', 'patientId'])
export class DentalImage extends BaseEntity {
  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'varchar', length: 5, nullable: true, name: 'tooth_number' })
  toothNumber: string | null;

  @Column({ type: 'varchar', length: 30, name: 'image_type' })
  imageType: string;

  @Column({ type: 'varchar', length: 500, name: 'file_path' })
  filePath: string;

  @Column({ type: 'varchar', length: 255, name: 'file_name' })
  fileName: string;

  @Column({ type: 'int', nullable: true, name: 'file_size' })
  fileSize: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'taken_at' })
  takenAt: Date;

  @Column({ type: 'uuid', nullable: true, name: 'taken_by_id' })
  takenById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'taken_by_id' })
  takenBy: User | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}

// ============ DENTAL LAB ORDER ============

@Entity('dental_lab_orders')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'status'])
export class DentalLabOrder extends BaseEntity {
  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid', name: 'dentist_id' })
  dentistId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'dentist_id' })
  dentist: User;

  @Column({ type: 'varchar', length: 255, name: 'lab_name' })
  labName: string;

  @Column({ type: 'varchar', length: 50, name: 'order_type' })
  orderType: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'tooth_number' })
  toothNumber: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  shade: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  material: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'impression_type' })
  impressionType: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'sent_at' })
  sentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'expected_at' })
  expectedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'received_at' })
  receivedAt: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cost: number | null;

  @Column({ type: 'varchar', length: 30, default: 'draft' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}

// ============ ORTHODONTIC CASE ============

@Entity('orthodontic_cases')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'status'])
export class OrthodonticCase extends BaseEntity {
  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid', name: 'orthodontist_id' })
  orthodontistId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'orthodontist_id' })
  orthodontist: User;

  @Column({ type: 'varchar', length: 50, name: 'case_type' })
  caseType: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  malocclusion: string | null;

  @Column({ type: 'date', nullable: true, name: 'start_date' })
  startDate: Date | null;

  @Column({ type: 'date', nullable: true, name: 'estimated_end_date' })
  estimatedEndDate: Date | null;

  @Column({ type: 'date', nullable: true, name: 'actual_end_date' })
  actualEndDate: Date | null;

  @Column({ type: 'int', nullable: true, name: 'total_aligners' })
  totalAligners: number | null;

  @Column({ type: 'int', nullable: true, name: 'current_aligner' })
  currentAligner: number | null;

  @Column({ type: 'int', default: 4, name: 'adjustment_interval' })
  adjustmentInterval: number;

  @Column({ type: 'date', nullable: true, name: 'last_adjustment_date' })
  lastAdjustmentDate: Date | null;

  @Column({ type: 'date', nullable: true, name: 'next_adjustment_date' })
  nextAdjustmentDate: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'estimated_cost' })
  estimatedCost: number | null;

  @Column({ type: 'varchar', length: 30, default: 'planning' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}

// ============ PERIODONTAL CHART ============

@Entity('periodontal_charts')
@Index(['tenantId', 'patientId'])
export class PeriodontalChart extends BaseEntity {
  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid', name: 'examiner_id' })
  examinerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'examiner_id' })
  examiner: User;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'exam_date' })
  examDate: Date;

  @Column({ type: 'jsonb' })
  measurements: Array<{
    tooth: string;
    buccal: number[];
    lingual: number[];
    recession: number[];
    bleeding: boolean[];
    suppuration: boolean[];
  }>;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'plaque_score' })
  plaqueScore: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'bleeding_on_probing' })
  bleedingOnProbing: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
