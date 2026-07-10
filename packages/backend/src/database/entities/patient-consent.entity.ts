import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

export enum ConsentType {
  DATA_PROCESSING = 'data_processing',
  TREATMENT = 'treatment',
  RESEARCH = 'research',
  COMMUNICATION = 'communication',
  DATA_SHARING = 'data_sharing',
  PHOTOGRAPHY = 'photography',
  TELEMEDICINE = 'telemedicine',
}

@Entity('patient_consents')
@Index(['patientId', 'consentType'], {
  where: '"deleted_at" IS NULL AND "withdrawn_at" IS NULL',
})
export class PatientConsent extends BaseEntity {
  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'enum', enum: ConsentType, name: 'consent_type' })
  consentType: ConsentType;

  @Column({ type: 'varchar', length: 50, default: '1.0' })
  version: string;

  @Column({ type: 'boolean', default: true })
  accepted: boolean;

  @Column({ type: 'timestamptz', name: 'accepted_at', default: () => 'now()' })
  acceptedAt: Date;

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'recorded_by_id' })
  recordedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'recorded_by_id' })
  recordedBy: User;

  @Column({ type: 'uuid', nullable: true, name: 'witnessed_by_id' })
  witnessedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'witnessed_by_id' })
  witnessedBy: User;

  @Column({ type: 'timestamptz', nullable: true, name: 'withdrawn_at' })
  withdrawnAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'withdrawn_reason' })
  withdrawnReason: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'withdrawn_by_id' })
  withdrawnById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'withdrawn_by_id' })
  withdrawnBy: User;
}
