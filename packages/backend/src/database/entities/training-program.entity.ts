import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Facility } from './facility.entity';

export enum TrainingStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TrainingType {
  ORIENTATION = 'orientation',
  SKILLS = 'skills',
  COMPLIANCE = 'compliance',
  LEADERSHIP = 'leadership',
  TECHNICAL = 'technical',
  SAFETY = 'safety',
  CERTIFICATION = 'certification',
}

@Entity('training_programs')
export class TrainingProgram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: TrainingType, name: 'training_type' })
  trainingType: TrainingType;

  @Column({ length: 200, nullable: true })
  trainer: string;

  @Column({ length: 200, nullable: true })
  location: string;

  @Column({ type: 'date', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'date', name: 'end_date' })
  endDate: Date;

  @Column({ type: 'int', nullable: true, name: 'duration_hours' })
  durationHours: number;

  @Column({ type: 'int', nullable: true, name: 'max_participants' })
  maxParticipants: number;

  @Column({ type: 'enum', enum: TrainingStatus, default: TrainingStatus.SCHEDULED })
  status: TrainingStatus;

  @Column({ type: 'boolean', default: false, name: 'is_mandatory' })
  isMandatory: boolean;

  @Column({ type: 'boolean', default: false, name: 'provides_certification' })
  providesCertification: boolean;

  @Column({ length: 200, nullable: true, name: 'certification_name' })
  certificationName: string;

  @Column({ type: 'int', nullable: true, name: 'certification_validity_months' })
  certificationValidityMonths: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
