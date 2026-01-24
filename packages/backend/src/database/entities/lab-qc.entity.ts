import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';

export enum QCLevel {
  LEVEL_1 = 'level_1',  // Low
  LEVEL_2 = 'level_2',  // Normal
  LEVEL_3 = 'level_3',  // High
}

export enum QCStatus {
  IN_CONTROL = 'in_control',
  OUT_OF_CONTROL = 'out_of_control',
  WARNING = 'warning',
  NOT_EVALUATED = 'not_evaluated',
}

export enum WestgardRule {
  RULE_1_2S = '1:2s',     // Warning rule
  RULE_1_3S = '1:3s',     // Reject
  RULE_2_2S = '2:2s',     // Reject
  RULE_R_4S = 'R:4s',     // Reject
  RULE_4_1S = '4:1s',     // Reject
  RULE_10X = '10x',       // Reject
}

@Entity('qc_materials')
@Index(['code'], { unique: true, where: 'deleted_at IS NULL' })
export class QCMaterial extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  manufacturer?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'lot_number' })
  lotNumber?: string;

  @Column({ type: 'date', nullable: true, name: 'expiry_date' })
  expiryDate?: Date;

  @Column({
    type: 'enum',
    enum: QCLevel,
  })
  level: QCLevel;

  @Column({ type: 'varchar', length: 100, name: 'test_code' })
  testCode: string;

  @Column({ type: 'varchar', length: 255, name: 'test_name' })
  testName: string;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'target_mean' })
  targetMean: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'target_sd' })
  targetSd: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true, name: 'target_cv' })
  targetCv?: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true, name: 'acceptable_range_low' })
  acceptableRangeLow?: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true, name: 'acceptable_range_high' })
  acceptableRangeHigh?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit?: string;

  @Column({ type: 'uuid', nullable: true, name: 'equipment_id' })
  equipmentId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'storage_temperature' })
  storageTemperature?: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}

@Entity('qc_results')
@Index(['facilityId', 'testCode', 'runDate'])
export class QCResult extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'uuid', name: 'qc_material_id' })
  qcMaterialId: string;

  @ManyToOne(() => QCMaterial)
  @JoinColumn({ name: 'qc_material_id' })
  qcMaterial: QCMaterial;

  @Column({ type: 'uuid', nullable: true, name: 'equipment_id' })
  equipmentId?: string;

  @Column({ type: 'varchar', length: 100, name: 'test_code' })
  testCode: string;

  @Column({ type: 'timestamp', name: 'run_date' })
  runDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'result_value' })
  resultValue: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit?: string;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'target_mean' })
  targetMean: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'target_sd' })
  targetSd: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'z_score' })
  zScore: number;

  @Column({
    type: 'enum',
    enum: QCStatus,
    default: QCStatus.NOT_EVALUATED,
  })
  status: QCStatus;

  @Column({ type: 'simple-array', nullable: true, name: 'violated_rules' })
  violatedRules?: string[];

  @Column({ type: 'uuid', name: 'performed_by' })
  performedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'performed_by' })
  performedByUser: User;

  @Column({ type: 'uuid', nullable: true, name: 'reviewed_by' })
  reviewedBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedByUser?: User;

  @Column({ type: 'timestamp', nullable: true, name: 'reviewed_at' })
  reviewedAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'corrective_action' })
  correctiveAction?: string;

  @Column({ type: 'boolean', default: false, name: 'is_repeat' })
  isRepeat: boolean;

  @Column({ type: 'text', nullable: true })
  comments?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'reagent_lot' })
  reagentLot?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'calibrator_lot' })
  calibratorLot?: string;
}

@Entity('qc_levey_jennings_data')
@Index(['qcMaterialId', 'dataDate'])
export class QCLeveyJenningsData extends BaseEntity {
  @Column({ type: 'uuid', name: 'qc_material_id' })
  qcMaterialId: string;

  @ManyToOne(() => QCMaterial)
  @JoinColumn({ name: 'qc_material_id' })
  qcMaterial: QCMaterial;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'date', name: 'data_date' })
  dataDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'calculated_mean' })
  calculatedMean: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'calculated_sd' })
  calculatedSd: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'calculated_cv' })
  calculatedCv: number;

  @Column({ type: 'int', name: 'data_points' })
  dataPoints: number;

  @Column({ type: 'int', default: 0, name: 'in_control_count' })
  inControlCount: number;

  @Column({ type: 'int', default: 0, name: 'out_of_control_count' })
  outOfControlCount: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'plus_1sd' })
  plus1Sd: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'plus_2sd' })
  plus2Sd: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'plus_3sd' })
  plus3Sd: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'minus_1sd' })
  minus1Sd: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'minus_2sd' })
  minus2Sd: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'minus_3sd' })
  minus3Sd: number;
}

// Westgard Rules implementation helper
export function evaluateWestgardRules(
  currentValue: number,
  mean: number,
  sd: number,
  previousResults: number[] = []
): { status: QCStatus; violatedRules: WestgardRule[] } {
  const zScore = (currentValue - mean) / sd;
  const violatedRules: WestgardRule[] = [];
  let status = QCStatus.IN_CONTROL;

  // 1:3s - Single result > 3SD from mean (REJECT)
  if (Math.abs(zScore) > 3) {
    violatedRules.push(WestgardRule.RULE_1_3S);
    status = QCStatus.OUT_OF_CONTROL;
  }

  // 1:2s - Warning rule
  if (Math.abs(zScore) > 2 && Math.abs(zScore) <= 3) {
    violatedRules.push(WestgardRule.RULE_1_2S);
    status = QCStatus.WARNING;
  }

  if (previousResults.length > 0) {
    const prevZScore = (previousResults[0] - mean) / sd;

    // 2:2s - Two consecutive results > 2SD on same side
    if (Math.abs(zScore) > 2 && Math.abs(prevZScore) > 2) {
      if ((zScore > 0 && prevZScore > 0) || (zScore < 0 && prevZScore < 0)) {
        violatedRules.push(WestgardRule.RULE_2_2S);
        status = QCStatus.OUT_OF_CONTROL;
      }
    }

    // R:4s - Range of 4SD between two consecutive results
    if (Math.abs(zScore - prevZScore) > 4) {
      violatedRules.push(WestgardRule.RULE_R_4S);
      status = QCStatus.OUT_OF_CONTROL;
    }
  }

  if (previousResults.length >= 3) {
    const recentZScores = [zScore, ...previousResults.slice(0, 3).map(v => (v - mean) / sd)];

    // 4:1s - Four consecutive results > 1SD on same side
    const allPositive = recentZScores.every(z => z > 1);
    const allNegative = recentZScores.every(z => z < -1);
    if (allPositive || allNegative) {
      violatedRules.push(WestgardRule.RULE_4_1S);
      status = QCStatus.OUT_OF_CONTROL;
    }
  }

  if (previousResults.length >= 9) {
    const recentZScores = [zScore, ...previousResults.slice(0, 9).map(v => (v - mean) / sd)];

    // 10x - Ten consecutive results on same side of mean
    const allAboveMean = recentZScores.every(z => z > 0);
    const allBelowMean = recentZScores.every(z => z < 0);
    if (allAboveMean || allBelowMean) {
      violatedRules.push(WestgardRule.RULE_10X);
      status = QCStatus.OUT_OF_CONTROL;
    }
  }

  return { status, violatedRules };
}
