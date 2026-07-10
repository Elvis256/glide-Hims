import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';
export type OnboardingItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';
export type OnboardingPhase =
  | 'setup'
  | 'configuration'
  | 'data_migration'
  | 'training'
  | 'testing'
  | 'go_live';

@Entity('client_onboardings')
export class ClientOnboarding {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' }) @Index() tenantId: string | null;
  @Column({ type: 'uuid', nullable: true, name: 'deployment_id' }) deploymentId: string | null;
  @Column({ type: 'uuid', nullable: true, name: 'quotation_id' }) quotationId: string | null;
  @Column({ type: 'uuid', nullable: true, name: 'subscription_id' }) subscriptionId: string | null;

  @Column({ type: 'varchar', length: 30, default: 'not_started' })
  @Index()
  status: OnboardingStatus;
  @Column({ type: 'integer', default: 0 }) progressPercent: number;

  @Column({ type: 'timestamp', nullable: true }) targetGoLiveDate: Date | null;
  @Column({ type: 'timestamp', nullable: true }) actualGoLiveDate: Date | null;

  @Column({ type: 'uuid', nullable: true }) assignedTo: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, any> | null;

  @OneToMany(() => ClientOnboardingItem, (i) => i.onboarding)
  items: ClientOnboardingItem[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('client_onboarding_items')
export class ClientOnboardingItem {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid', name: 'onboarding_id' }) @Index() onboardingId: string;
  @ManyToOne(() => ClientOnboarding, (o) => o.items)
  @JoinColumn({ name: 'onboarding_id' })
  onboarding: ClientOnboarding;

  @Column({ type: 'varchar', length: 30 }) phase: OnboardingPhase;
  @Column({ length: 200 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'integer', default: 0 }) sortOrder: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: OnboardingItemStatus;
  @Column({ type: 'uuid', nullable: true }) assignedTo: string | null;
  @Column({ type: 'timestamp', nullable: true }) dueDate: Date | null;
  @Column({ type: 'timestamp', nullable: true }) completedAt: Date | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;

  @CreateDateColumn() createdAt: Date;
}
