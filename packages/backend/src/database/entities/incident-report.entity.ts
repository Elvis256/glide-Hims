import { Entity, Column, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('incident_reports')
@Unique(['tenantId', 'reportNumber'])
@Index(['tenantId'])
@Index(['status'])
export class IncidentReport extends BaseEntity {
  @Column({ type: 'varchar', length: 50, name: 'report_number' })
  reportNumber: string;

  @Column({ type: 'uuid', name: 'patient_id', nullable: true })
  patientId?: string;

  @ManyToOne(() => Patient, { nullable: true })
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient;

  @Column({ type: 'varchar', length: 50 })
  type: string; // fall, medication_error, equipment_failure, near_miss, etc.

  @Column({ type: 'varchar', length: 20 })
  severity: string; // minor, moderate, major, sentinel

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: string; // draft, submitted, investigating, closed

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location?: string;

  @Column({ type: 'timestamptz', name: 'incident_date' })
  incidentDate: Date;

  @Column({ type: 'text', name: 'immediate_action', nullable: true })
  immediateAction?: string;

  @Column({ type: 'text', name: 'root_cause', nullable: true })
  rootCause?: string;

  @Column({ type: 'text', name: 'corrective_action', nullable: true })
  correctiveAction?: string;

  @Column({ type: 'jsonb', nullable: true })
  witnesses?: { name: string; role?: string }[];

  @Column({ type: 'uuid', name: 'reported_by_id', nullable: true })
  reportedById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reported_by_id' })
  reportedBy?: User;
}
