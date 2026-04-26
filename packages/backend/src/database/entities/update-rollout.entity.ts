import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Deployment } from './deployment.entity';
import { ReleaseCandidate } from './release-candidate.entity';

export enum UpdateRolloutPhase {
  PHASE_1 = 'phase_1', // 10% of deployments
  PHASE_2 = 'phase_2', // 50% of deployments
  PHASE_3 = 'phase_3', // 100% of deployments
}

export enum UpdateRolloutStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ROLLED_BACK = 'rolled_back',
  FAILED = 'failed',
}

@Entity('update_rollouts')
@Index(['releaseCandidateId', 'status'])
@Index(['status', 'currentPhase'])
@Index(['startDate', 'endDate'])
export class UpdateRollout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  releaseCandidateId: string;

  @ManyToOne(() => ReleaseCandidate, (rc) => rc.rollouts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'release_candidate_id' })
  releaseCandidate: ReleaseCandidate;

  @Column({
    type: 'enum',
    enum: UpdateRolloutStatus,
    default: UpdateRolloutStatus.SCHEDULED,
  })
  status: UpdateRolloutStatus;

  @Column({
    type: 'enum',
    enum: UpdateRolloutPhase,
    default: UpdateRolloutPhase.PHASE_1,
  })
  currentPhase: UpdateRolloutPhase;

  @Column({ type: 'timestamp', nullable: false })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({ type: 'integer', default: 10 })
  phase1PercentageTarget: number;

  @Column({ type: 'integer', default: 50 })
  phase2PercentageTarget: number;

  @Column({ type: 'integer', default: 100 })
  phase3PercentageTarget: number;

  @Column({ type: 'integer', default: 5 })
  errorThresholdPercentage: number;

  @Column({ type: 'boolean', default: false })
  autoRollbackOnError: boolean;

  @Column({ type: 'integer', default: 0 })
  deploymentsTotalCount: number;

  @Column({ type: 'integer', default: 0 })
  deploymentsSuccessCount: number;

  @Column({ type: 'integer', default: 0 })
  deploymentsFailedCount: number;

  @Column({ type: 'integer', default: 0 })
  deploymentsRolledBackCount: number;

  @Column({ type: 'jsonb', nullable: true })
  rollbackReason: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  rolledBackAt: Date;

  @Column({ type: 'uuid', nullable: true })
  scheduledBy: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
