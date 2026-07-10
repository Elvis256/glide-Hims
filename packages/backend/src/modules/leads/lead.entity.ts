import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost' | 'spam';
export type LeadPriority = 'low' | 'medium' | 'high';
export type LeadActivityType =
  | 'note'
  | 'email'
  | 'call'
  | 'meeting'
  | 'status_change'
  | 'quotation_created'
  | 'quotation_sent'
  | 'quotation_accepted'
  | 'quotation_rejected';

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  fullName: string;

  @Column({ length: 200 })
  organization: string;

  @Column({ length: 200 })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 50, default: 'hospital' })
  facilityType: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  estimatedUsers: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  deploymentInterest: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  utmCampaign: string | null;

  @Column({ type: 'varchar', length: 50, default: 'new' })
  @Index()
  status: LeadStatus;

  @Column({ type: 'text', nullable: true })
  internalNotes: string | null;

  @Column({ type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  // Phase 2: Pipeline fields
  @Column({ type: 'uuid', nullable: true })
  assignedTo: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  priority: LeadPriority | null;

  @Column({ type: 'timestamp', nullable: true })
  lastContactedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  nextFollowUpAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  estimatedArrMinor: number;

  @Column({ type: 'varchar', length: 3, default: 'UGX' })
  estimatedArrCurrency: string;

  @OneToMany(() => LeadActivity, (a) => a.lead)
  activities: LeadActivity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('lead_activities')
export class LeadActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'lead_id' })
  @Index()
  leadId: string;

  @Column({ type: 'varchar', length: 50 })
  type: LeadActivityType;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @ManyToOne(() => Lead, (l) => l.activities)
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @CreateDateColumn()
  createdAt: Date;
}
