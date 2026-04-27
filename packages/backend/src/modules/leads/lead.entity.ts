import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost' | 'spam';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
