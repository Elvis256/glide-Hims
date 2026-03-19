import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('patient_merges')
@Index(['primaryPatientId'])
@Index(['secondaryPatientId'])
export class PatientMerge extends BaseEntity {
  @Column({ name: 'primary_patient_id', type: 'uuid' })
  primaryPatientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'primary_patient_id' })
  primaryPatient: Patient;

  @Column({ name: 'secondary_patient_id', type: 'uuid' })
  secondaryPatientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'secondary_patient_id' })
  secondaryPatient: Patient;

  @Column({ name: 'merged_by_id', type: 'uuid' })
  mergedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'merged_by_id' })
  mergedBy: User;

  @Column({ type: 'jsonb', nullable: true, name: 'secondary_patient_snapshot' })
  secondaryPatientSnapshot: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'merged_data_summary' })
  mergedDataSummary: {
    encountersMoved: number;
    documentsMoved: number;
    notesMoved: number;
  };

  @Column({ type: 'text', nullable: true })
  reason: string;
}
