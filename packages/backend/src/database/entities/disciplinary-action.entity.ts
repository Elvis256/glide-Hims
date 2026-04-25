import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum DisciplinaryType {
  VERBAL_WARNING = 'verbal_warning',
  FIRST_WRITTEN = 'first_written',
  SECOND_WRITTEN = 'second_written',
  FINAL_WARNING = 'final_warning',
  SUSPENSION = 'suspension',
  TERMINATION = 'termination',
}

export enum DisciplinaryStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
  EXPIRED = 'expired',
  APPEALED = 'appealed',
}

@Entity('disciplinary_actions')
export class DisciplinaryAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'employee_id' })
  employee: User;

  @Column({ type: 'enum', enum: DisciplinaryType })
  type: DisciplinaryType;

  @Column({ type: 'enum', enum: DisciplinaryStatus, default: DisciplinaryStatus.ACTIVE })
  status: DisciplinaryStatus;

  @Column()
  reason: string;

  @Column({ name: 'incident_date', type: 'date' })
  incidentDate: string;

  @Column({ type: 'text', nullable: true })
  details: string;

  @Column({ name: 'expected_improvement', type: 'text', nullable: true })
  expectedImprovement: string;

  @Column({ type: 'text', nullable: true })
  consequences: string;

  @Column({ name: 'issued_by_id', nullable: true })
  issuedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'issued_by_id' })
  issuedBy: User;

  @Column({ name: 'acknowledged_at', type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string;

  @Column({ name: 'resolution_date', type: 'date', nullable: true })
  resolutionDate: string;

  @Column({ name: 'appeal_notes', type: 'text', nullable: true })
  appealNotes: string;

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate: string;

  @Column({ name: 'facility_id', nullable: true })
  facilityId: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
