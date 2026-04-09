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

// ============ EYE EXAM ============

@Entity('eye_exams')
@Index(['tenantId', 'patientId'])
export class EyeExam extends BaseEntity {
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

  @Column({ type: 'timestamp', default: () => 'NOW()', name: 'exam_date' })
  examDate: Date;

  @Column({ type: 'varchar', length: 30, name: 'exam_type' })
  examType: string;

  @Column({ type: 'text', nullable: true, name: 'chief_complaint' })
  chiefComplaint: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'visual_acuity' })
  visualAcuity: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  autorefraction: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'intraocular_pressure' })
  intraocularPressure: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'anterior_segment' })
  anteriorSegment: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'posterior_segment' })
  posteriorSegment: Record<string, any> | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'pupil_reaction' })
  pupilReaction: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'color_vision' })
  colorVision: string | null;

  @Column({ type: 'jsonb', nullable: true })
  diagnosis: Array<{ code: string; description: string }> | null;

  @Column({ type: 'text', nullable: true })
  recommendations: string | null;

  @Column({ type: 'date', nullable: true, name: 'next_exam_date' })
  nextExamDate: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => OpticalPrescription, (rx) => rx.exam)
  prescriptions: OpticalPrescription[];
}

// ============ OPTICAL PRESCRIPTION ============

@Entity('optical_prescriptions')
@Index(['tenantId', 'patientId'])
export class OpticalPrescription extends BaseEntity {
  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid', name: 'prescriber_id' })
  prescriberId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'prescriber_id' })
  prescriber: User;

  @Column({ type: 'uuid', nullable: true, name: 'exam_id' })
  examId: string | null;

  @ManyToOne(() => EyeExam, (exam) => exam.prescriptions, { nullable: true })
  @JoinColumn({ name: 'exam_id' })
  exam: EyeExam | null;

  @Column({ type: 'varchar', length: 20, name: 'prescription_type' })
  prescriptionType: string;

  @Column({ type: 'timestamp', default: () => 'NOW()', name: 'prescription_date' })
  prescriptionDate: Date;

  @Column({ type: 'date', nullable: true, name: 'expiry_date' })
  expiryDate: Date | null;

  // Right eye (OD)
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'od_sphere' })
  odSphere: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'od_cylinder' })
  odCylinder: number | null;

  @Column({ type: 'int', nullable: true, name: 'od_axis' })
  odAxis: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true, name: 'od_add' })
  odAdd: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true, name: 'od_prism' })
  odPrism: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'od_prism_base' })
  odPrismBase: string | null;

  // Left eye (OS)
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'os_sphere' })
  osSphere: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'os_cylinder' })
  osCylinder: number | null;

  @Column({ type: 'int', nullable: true, name: 'os_axis' })
  osAxis: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true, name: 'os_add' })
  osAdd: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true, name: 'os_prism' })
  osPrism: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'os_prism_base' })
  osPrismBase: string | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  pd: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true, name: 'pd_near' })
  pdNear: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true, name: 'segment_height' })
  segmentHeight: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @OneToMany(() => ContactLensPrescription, (cl) => cl.prescription)
  contactLensPrescriptions: ContactLensPrescription[];
}

// ============ CONTACT LENS PRESCRIPTION ============

@Entity('contact_lens_prescriptions')
@Index(['tenantId', 'prescriptionId'])
export class ContactLensPrescription extends BaseEntity {
  @Column({ type: 'uuid', name: 'prescription_id' })
  prescriptionId: string;

  @ManyToOne(() => OpticalPrescription, (rx) => rx.contactLensPrescriptions)
  @JoinColumn({ name: 'prescription_id' })
  prescription: OpticalPrescription;

  // Right eye (OD)
  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true, name: 'od_base_curve' })
  odBaseCurve: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true, name: 'od_diameter' })
  odDiameter: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'od_brand' })
  odBrand: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'od_model' })
  odModel: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'od_color' })
  odColor: string | null;

  // Left eye (OS)
  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true, name: 'os_base_curve' })
  osBaseCurve: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true, name: 'os_diameter' })
  osDiameter: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'os_brand' })
  osBrand: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'os_model' })
  osModel: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'os_color' })
  osColor: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'wear_schedule' })
  wearSchedule: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'replacement_schedule' })
  replacementSchedule: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  solution: string | null;

  @Column({ type: 'text', nullable: true, name: 'trial_lens_notes' })
  trialLensNotes: string | null;
}

// ============ FRAME ============

@Entity('frames')
@Index(['tenantId', 'sku'])
export class Frame extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  brand: string;

  @Column({ type: 'varchar', length: 100 })
  model: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sku: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  size: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  material: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'frame_type' })
  frameType: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'wholesale_price' })
  wholesalePrice: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'retail_price' })
  retailPrice: number | null;

  @Column({ type: 'int', default: 0, name: 'current_stock' })
  currentStock: number;

  @Column({ type: 'int', default: 5, name: 'reorder_level' })
  reorderLevel: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  supplier: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'image_url' })
  imageUrl: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;
}

// ============ LENS PRODUCT ============

@Entity('lens_products')
@Index(['tenantId', 'sku'])
export class LensProduct extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sku: string | null;

  @Column({ type: 'varchar', length: 30, name: 'lens_type' })
  lensType: string;

  @Column({ type: 'varchar', length: 50 })
  material: string;

  @Column({ type: 'jsonb', nullable: true })
  coating: string[] | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  index: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'wholesale_price' })
  wholesalePrice: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'retail_price' })
  retailPrice: number | null;

  @Column({ type: 'int', default: 0, name: 'current_stock' })
  currentStock: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  supplier: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;
}

// ============ SPECTACLE ORDER ============

@Entity('spectacle_orders')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'orderNumber'])
@Index(['tenantId', 'status'])
export class SpectacleOrder extends BaseEntity {
  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid', name: 'prescription_id' })
  prescriptionId: string;

  @ManyToOne(() => OpticalPrescription)
  @JoinColumn({ name: 'prescription_id' })
  prescription: OpticalPrescription;

  @Column({ type: 'uuid', nullable: true, name: 'frame_id' })
  frameId: string | null;

  @ManyToOne(() => Frame, { nullable: true })
  @JoinColumn({ name: 'frame_id' })
  frame: Frame | null;

  @Column({ type: 'uuid', nullable: true, name: 'lens_id' })
  lensId: string | null;

  @ManyToOne(() => LensProduct, { nullable: true })
  @JoinColumn({ name: 'lens_id' })
  lens: LensProduct | null;

  @Column({ type: 'varchar', length: 50, name: 'order_number' })
  orderNumber: string;

  @Column({ type: 'timestamp', default: () => 'NOW()', name: 'order_date' })
  orderDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'frame_price' })
  framePrice: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'lens_price' })
  lensPrice: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'coating_price' })
  coatingPrice: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'fitting_charge' })
  fittingCharge: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'total_amount' })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'paid_amount' })
  paidAmount: number;

  @Column({ type: 'jsonb', nullable: true, name: 'selected_coatings' })
  selectedCoatings: string[] | null;

  @Column({ type: 'text', nullable: true, name: 'fitting_notes' })
  fittingNotes: string | null;

  @Column({ type: 'text', nullable: true, name: 'lab_notes' })
  labNotes: string | null;

  @Column({ type: 'varchar', length: 30, default: 'ordered' })
  status: string;

  @Column({ type: 'date', nullable: true, name: 'estimated_ready' })
  estimatedReady: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'delivered_at' })
  deliveredAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}

// ============ VISUAL FIELD TEST ============

@Entity('visual_field_tests')
@Index(['tenantId', 'patientId'])
export class VisualFieldTest extends BaseEntity {
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

  @Column({ type: 'timestamp', default: () => 'NOW()', name: 'test_date' })
  testDate: Date;

  @Column({ type: 'varchar', length: 30, name: 'test_type' })
  testType: string;

  @Column({ type: 'varchar', length: 5 })
  eye: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  strategy: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  pattern: string | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'mean_deviation' })
  meanDeviation: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'pattern_standard_deviation' })
  patternStandardDeviation: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  vfi: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'false_positives' })
  falsePositives: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'false_negatives' })
  falseNegatives: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'fixation_losses' })
  fixationLosses: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  reliability: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'result_file_path' })
  resultFilePath: string | null;

  @Column({ type: 'text', nullable: true })
  interpretation: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
