import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum DoctorEmploymentType {
  EMPLOYED = 'employed',
  VISITING_CONSULTANT = 'visiting_consultant',
  LOCUM = 'locum',
}

export enum DoctorFeeMode {
  /** Flat fee — `flatFee` is charged regardless of specialty */
  FLAT = 'flat',
  /** Multiplier on the specialty rate — `percentOfSpecialty` (e.g. 150 = 1.5×) */
  PERCENT_OF_SPECIALTY = 'percent_of_specialty',
  /**
   * Patient is charged the specialty rate as normal; revenue is split between
   * doctor (`doctorSharePercent`) and hospital (`hospitalSharePercent`).
   * The split is recorded on the invoice item for finance/payroll reconciliation.
   */
  SPLIT = 'split',
}

@Entity('doctor_fee_profiles')
@Index(['doctorId'])
@Unique(['doctorId'])
export class DoctorFeeProfile extends BaseEntity {
  @Column({ type: 'uuid', name: 'doctor_id' })
  doctorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @Column({
    type: 'enum',
    enum: DoctorEmploymentType,
    default: DoctorEmploymentType.EMPLOYED,
    name: 'employment_type',
  })
  employmentType: DoctorEmploymentType;

  @Column({ type: 'enum', enum: DoctorFeeMode, default: DoctorFeeMode.FLAT, name: 'fee_mode' })
  feeMode: DoctorFeeMode;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, name: 'flat_fee' })
  flatFee: number | null;

  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
    name: 'percent_of_specialty',
  })
  percentOfSpecialty: number | null;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    name: 'doctor_share_percent',
  })
  doctorSharePercent: number | null;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    name: 'hospital_share_percent',
  })
  hospitalSharePercent: number | null;

  /** ISO weekday numbers, Monday=1 … Sunday=7. NULL = available every day. */
  @Column({ type: 'int', array: true, nullable: true, name: 'working_days' })
  workingDays: number[] | null;

  /** Re-charge the consultation if patient returns within this window? 0 = free follow-up. */
  @Column({ type: 'int', nullable: true, name: 'follow_up_window_days' })
  followUpWindowDays: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, name: 'follow_up_fee' })
  followUpFee: number | null;

  @Column({ type: 'date', nullable: true, name: 'effective_from' })
  effectiveFrom: string | null;

  @Column({ type: 'date', nullable: true, name: 'effective_to' })
  effectiveTo: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
