import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LabourRecord } from './labour-record.entity';
import { User } from './user.entity';

/**
 * One timed partograph observation during labour. The WHO partograph plots
 * these against the alert line (1 cm/hr from 4 cm, active phase) and the
 * action line (alert line + 4 hours); PartographService computes breaches.
 */
export enum LiquorState {
  MEMBRANES_INTACT = 'intact',
  CLEAR = 'clear',
  MECONIUM = 'meconium',
  BLOOD_STAINED = 'blood_stained',
  ABSENT = 'absent',
}

export enum MouldingGrade {
  NONE = 'none',
  PLUS = '+',
  PLUS_PLUS = '++',
  PLUS_PLUS_PLUS = '+++',
}

@Entity('partograph_observations')
@Index(['labourRecordId', 'observedAt'])
@Index(['tenantId'])
export class PartographObservation extends BaseEntity {
  @Column({ type: 'uuid', name: 'labour_record_id' })
  labourRecordId: string;

  @ManyToOne(() => LabourRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'labour_record_id' })
  labourRecord?: LabourRecord;

  @Column({ type: 'uuid', name: 'facility_id', nullable: true })
  facilityId?: string;

  @Column({ type: 'timestamptz', name: 'observed_at' })
  observedAt: Date;

  // ── Labour progress ───────────────────────────────────────────────────────
  @Column({ type: 'smallint', name: 'cervical_dilation_cm', nullable: true })
  cervicalDilationCm?: number | null; // 0–10

  @Column({ type: 'smallint', name: 'descent_fifths', nullable: true })
  descentFifths?: number | null; // fifths of head palpable, 5 → 0

  @Column({ type: 'smallint', name: 'contractions_per_10min', nullable: true })
  contractionsPer10Min?: number | null;

  @Column({ type: 'smallint', name: 'contraction_duration_seconds', nullable: true })
  contractionDurationSeconds?: number | null;

  // ── Fetal condition ───────────────────────────────────────────────────────
  @Column({ type: 'smallint', name: 'fetal_heart_rate', nullable: true })
  fetalHeartRate?: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  liquor?: LiquorState | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  moulding?: MouldingGrade | null;

  // ── Maternal condition ────────────────────────────────────────────────────
  @Column({ type: 'smallint', nullable: true })
  pulse?: number | null;

  @Column({ type: 'smallint', name: 'bp_systolic', nullable: true })
  bpSystolic?: number | null;

  @Column({ type: 'smallint', name: 'bp_diastolic', nullable: true })
  bpDiastolic?: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  temperature?: number | null;

  @Column({ type: 'varchar', length: 30, name: 'urine_output', nullable: true })
  urineOutput?: string | null;

  @Column({ type: 'varchar', length: 10, name: 'urine_protein', nullable: true })
  urineProtein?: string | null;

  @Column({ type: 'varchar', length: 10, name: 'urine_acetone', nullable: true })
  urineAcetone?: string | null;

  // ── Treatment ─────────────────────────────────────────────────────────────
  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'oxytocin_units_per_litre', nullable: true })
  oxytocinUnitsPerLitre?: number | null;

  @Column({ type: 'smallint', name: 'oxytocin_drops_per_min', nullable: true })
  oxytocinDropsPerMin?: number | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'uuid', name: 'recorded_by_id', nullable: true })
  recordedById?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recorded_by_id' })
  recordedBy?: User | null;
}
