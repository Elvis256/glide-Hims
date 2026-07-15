import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Admission } from './admission.entity';
import { User } from './user.entity';

@Entity('wound_assessments')
@Index(['admissionId', 'createdAt'])
@Index(['tenantId'])
export class WoundAssessment extends BaseEntity {
  @Column({ type: 'uuid', name: 'admission_id' })
  admissionId: string;

  @ManyToOne(() => Admission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admission_id' })
  admission?: Admission;

  @Column({ type: 'varchar', length: 100 })
  location: string;

  @Column({ type: 'varchar', length: 50, name: 'wound_type' })
  woundType: string; // surgical, pressure, traumatic, diabetic, venous, arterial

  @Column({ type: 'varchar', length: 20, nullable: true })
  stage?: string; // stage_1, stage_2, stage_3, stage_4, unstageable

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  length?: number;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  width?: number;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  depth?: number;

  @Column({ type: 'jsonb', name: 'wound_bed', nullable: true })
  woundBed?: { granulation?: number; slough?: number; necrotic?: number; epithelial?: number };

  @Column({ type: 'jsonb', nullable: true })
  exudate?: { amount: string; type: string; color?: string };

  @Column({ type: 'varchar', length: 200, name: 'periwound_skin', nullable: true })
  periwoundSkin?: string;

  @Column({ type: 'text', nullable: true })
  treatment?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'uuid', name: 'assessed_by_id', nullable: true })
  assessedById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assessed_by_id' })
  assessedBy?: User;
}
