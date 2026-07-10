import { Entity, Column, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum ReconciliationStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  COMPLETED = 'completed',
  SIGNED = 'signed',
}

export enum ReconciliationSourceType {
  ACTIVE_MEDICATION = 'active_medication',
  ENCOUNTER_PRESCRIPTION = 'encounter_prescription',
  MANUAL = 'manual',
}

export enum ReconciliationItemStatus {
  PENDING_REVIEW = 'pending_review',
  CONTINUED_UNCHANGED = 'continued_unchanged',
  CONTINUED_MODIFIED = 'continued_modified',
  DISCONTINUED = 'discontinued',
  NEW_AT_DISCHARGE = 'new_at_discharge',
}

@Entity('medication_reconciliations')
@Index(['encounterId'])
export class MedicationReconciliation extends BaseEntity {
  @Column({ type: 'uuid', name: 'encounter_id' })
  encounterId: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', name: 'discharge_summary_id', nullable: true })
  dischargeSummaryId: string | null;

  @Column({
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.DRAFT,
  })
  status: ReconciliationStatus;

  @Column({ name: 'completed_by_id', type: 'uuid', nullable: true })
  completedById: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'signed_by_id', type: 'uuid', nullable: true })
  signedById: string | null;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => MedicationReconciliationItem, (item) => item.reconciliation, { cascade: true })
  items: MedicationReconciliationItem[];
}

@Entity('medication_reconciliation_items')
@Index(['reconciliationId'])
export class MedicationReconciliationItem extends BaseEntity {
  @Column({ type: 'uuid', name: 'reconciliation_id' })
  reconciliationId: string;

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: ReconciliationSourceType,
  })
  sourceType: ReconciliationSourceType;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'drug_name' })
  drugName: string;

  @Column({ type: 'varchar', length: 255, name: 'generic_name', nullable: true })
  genericName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  dose: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  frequency: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  route: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  duration: string | null;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({
    name: 'reconciliation_status',
    type: 'enum',
    enum: ReconciliationItemStatus,
    default: ReconciliationItemStatus.PENDING_REVIEW,
  })
  reconciliationStatus: ReconciliationItemStatus;

  @Column({ type: 'varchar', length: 100, name: 'discharge_dose', nullable: true })
  dischargeDose: string | null;

  @Column({ type: 'varchar', length: 100, name: 'discharge_frequency', nullable: true })
  dischargeFrequency: string | null;

  @Column({ type: 'varchar', length: 100, name: 'discharge_duration', nullable: true })
  dischargeDuration: string | null;

  @Column({ name: 'discharge_instructions', type: 'text', nullable: true })
  dischargeInstructions: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'reviewed_by_id', type: 'uuid', nullable: true })
  reviewedById: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @ManyToOne(() => MedicationReconciliation, (rec) => rec.items)
  reconciliation: MedicationReconciliation;
}
