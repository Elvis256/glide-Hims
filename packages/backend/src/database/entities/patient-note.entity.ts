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

export type NoteType = 'clinical' | 'administrative';

@Entity('patient_notes')
@Index(['patientId', 'createdAt'])
export class PatientNote extends BaseEntity {
  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ 
    type: 'varchar', 
    length: 50,
    default: 'administrative' 
  })
  type: NoteType;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'created_by' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;
}
