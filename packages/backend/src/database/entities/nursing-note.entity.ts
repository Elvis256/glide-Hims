import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Admission } from './admission.entity';
import { User } from './user.entity';

export enum NursingNoteType {
  ASSESSMENT = 'assessment',
  INTERVENTION = 'intervention',
  OBSERVATION = 'observation',
  PROGRESS = 'progress',
  HANDOFF = 'handoff',
  INCIDENT = 'incident',
}

@Entity('nursing_notes')
export class NursingNote extends BaseEntity {
  @Column({ type: 'enum', enum: NursingNoteType, default: NursingNoteType.OBSERVATION })
  type: NursingNoteType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  noteTime: Date;

  @Column({ nullable: true })
  shift: string; // morning, afternoon, night

  @Column({ type: 'jsonb', nullable: true })
  vitals: {
    temperature?: number;
    pulse?: number;
    bpSystolic?: number;
    bpDiastolic?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    painLevel?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  intakeOutput: {
    oralIntake?: number;
    ivFluids?: number;
    urineOutput?: number;
    otherOutput?: number;
  };

  @Column({ type: 'uuid' })
  admissionId: string;

  @ManyToOne(() => Admission, admission => admission.nursingNotes)
  @JoinColumn({ name: 'admissionId' })
  admission: Admission;

  @Column({ type: 'uuid' })
  nurseId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'nurseId' })
  nurse: User;
}
