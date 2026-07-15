import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Admission } from './admission.entity';
import { User } from './user.entity';

@Entity('neuro_observations')
@Index(['admissionId', 'createdAt'])
@Index(['tenantId'])
export class NeuroObservation extends BaseEntity {
  @Column({ type: 'uuid', name: 'admission_id' })
  admissionId: string;

  @ManyToOne(() => Admission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admission_id' })
  admission?: Admission;

  @Column({ type: 'varchar', length: 10 })
  avpu: string; // A, V, P, U

  @Column({ type: 'smallint', name: 'gcs_eye', nullable: true })
  gcsEye?: number;

  @Column({ type: 'smallint', name: 'gcs_verbal', nullable: true })
  gcsVerbal?: number;

  @Column({ type: 'smallint', name: 'gcs_motor', nullable: true })
  gcsMotor?: number;

  @Column({ type: 'smallint', name: 'gcs_total', nullable: true })
  gcsTotal?: number;

  @Column({ type: 'varchar', length: 30, name: 'pupil_left_size', nullable: true })
  pupilLeftSize?: string;

  @Column({ type: 'varchar', length: 30, name: 'pupil_left_reaction', nullable: true })
  pupilLeftReaction?: string;

  @Column({ type: 'varchar', length: 30, name: 'pupil_right_size', nullable: true })
  pupilRightSize?: string;

  @Column({ type: 'varchar', length: 30, name: 'pupil_right_reaction', nullable: true })
  pupilRightReaction?: string;

  @Column({ type: 'varchar', length: 30, name: 'limb_left_arm', nullable: true })
  limbLeftArm?: string;

  @Column({ type: 'varchar', length: 30, name: 'limb_right_arm', nullable: true })
  limbRightArm?: string;

  @Column({ type: 'varchar', length: 30, name: 'limb_left_leg', nullable: true })
  limbLeftLeg?: string;

  @Column({ type: 'varchar', length: 30, name: 'limb_right_leg', nullable: true })
  limbRightLeg?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'uuid', name: 'assessed_by_id', nullable: true })
  assessedById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assessed_by_id' })
  assessedBy?: User;
}
