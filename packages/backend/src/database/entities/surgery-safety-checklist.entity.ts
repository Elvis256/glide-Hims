import { Entity, Column, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { SurgeryCase } from './surgery-case.entity';

/**
 * WHO Surgical Safety Checklist (2009) — three phases:
 *   sign_in  : before anesthesia induction
 *   time_out : before skin incision
 *   sign_out : before the patient leaves the operating room
 *
 * One row per surgery case. Each phase stores its item responses as JSONB
 * and is completed exactly once (completedBy/At stamped). Enforcement of
 * the phases against the surgery workflow is controlled by the tenant
 * setting `surgery.who_checklist.enforce`.
 */
export type WhoChecklistPhase = 'sign_in' | 'time_out' | 'sign_out';

@Entity('surgery_safety_checklists')
@Index(['tenantId'])
export class SurgerySafetyChecklist extends BaseEntity {
  @Column({ type: 'uuid', name: 'surgery_case_id', unique: true })
  surgeryCaseId: string;

  @OneToOne(() => SurgeryCase)
  @JoinColumn({ name: 'surgery_case_id' })
  surgeryCase?: SurgeryCase;

  @Column({ type: 'uuid', name: 'facility_id', nullable: true })
  facilityId?: string;

  // ── Sign-in (before induction) ────────────────────────────────────────────
  @Column({ type: 'jsonb', name: 'sign_in', nullable: true })
  signIn?: Record<string, unknown> | null;

  @Column({ type: 'uuid', name: 'sign_in_completed_by_id', nullable: true })
  signInCompletedById?: string | null;

  @Column({ type: 'timestamptz', name: 'sign_in_completed_at', nullable: true })
  signInCompletedAt?: Date | null;

  // ── Time-out (before incision) ────────────────────────────────────────────
  @Column({ type: 'jsonb', name: 'time_out', nullable: true })
  timeOut?: Record<string, unknown> | null;

  @Column({ type: 'uuid', name: 'time_out_completed_by_id', nullable: true })
  timeOutCompletedById?: string | null;

  @Column({ type: 'timestamptz', name: 'time_out_completed_at', nullable: true })
  timeOutCompletedAt?: Date | null;

  // ── Sign-out (before leaving the OR) ──────────────────────────────────────
  @Column({ type: 'jsonb', name: 'sign_out', nullable: true })
  signOut?: Record<string, unknown> | null;

  @Column({ type: 'uuid', name: 'sign_out_completed_by_id', nullable: true })
  signOutCompletedById?: string | null;

  @Column({ type: 'timestamptz', name: 'sign_out_completed_at', nullable: true })
  signOutCompletedAt?: Date | null;
}
