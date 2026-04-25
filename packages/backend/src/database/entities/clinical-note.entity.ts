import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Encounter } from './encounter.entity';
import { User } from './user.entity';

@Entity('clinical_notes')
@Index(['encounter', 'createdAt'])
export class ClinicalNote extends BaseEntity {
  // SOAP Note structure
  @Column({ type: 'text', nullable: true })
  subjective: string; // Patient's symptoms, history

  @Column({ type: 'text', nullable: true })
  objective: string; // Examination findings

  @Column({ type: 'text', nullable: true })
  assessment: string; // Diagnosis/impression

  @Column({ type: 'text', nullable: true })
  plan: string; // Treatment plan

  // Diagnosis (ICD-10)
  @Column({ type: 'jsonb', nullable: true })
  diagnoses: {
    code: string;
    description: string;
    type: 'primary' | 'secondary' | 'differential';
  }[];

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate: Date;

  @Column({ name: 'follow_up_notes', type: 'text', nullable: true })
  followUpNotes: string;

  // Relationships
  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @Column({ name: 'encounter_id' })
  encounterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'provider_id' })
  provider: User;

  @Column({ name: 'provider_id' })
  providerId: string;

  // Audit trail for edits
  @Column({ type: 'jsonb', nullable: true, name: 'edit_history' })
  editHistory: Array<{
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    diagnoses?: any;
    editedAt: string;
    editedById: string;
  }>;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'last_edited_by_id' })
  lastEditedBy: User;

  @Column({ name: 'last_edited_by_id', type: 'uuid', nullable: true })
  lastEditedById: string;

  @Column({ name: 'last_edited_at', type: 'timestamptz', nullable: true })
  lastEditedAt: Date;
}
