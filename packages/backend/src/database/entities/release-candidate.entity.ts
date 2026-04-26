import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AppVersion } from './app-version.entity';
import { UpdateRollout } from './update-rollout.entity';

export enum ReleaseCandidateStage {
  ALPHA = 'alpha',
  BETA = 'beta',
  RELEASE_CANDIDATE = 'rc',
  STABLE = 'stable',
  HOTFIX = 'hotfix',
}

@Entity('release_candidates')
@Index(['appVersionId', 'stage'])
@Index(['stage', 'createdAt'])
export class ReleaseCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  appVersionId: string;

  @ManyToOne(() => AppVersion, (av) => av.id, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'app_version_id' })
  appVersion: AppVersion;

  @Column({
    type: 'enum',
    enum: ReleaseCandidateStage,
    default: ReleaseCandidateStage.ALPHA,
  })
  stage: ReleaseCandidateStage;

  @Column({ type: 'text', nullable: true })
  releaseNotes: string;

  @Column({ type: 'text', nullable: true })
  testingNotes: string;

  @Column({ type: 'integer', default: 0 })
  testersCount: number;

  @Column({ type: 'integer', default: 0 })
  deploymentCountRisk: number;

  @Column({ type: 'jsonb', nullable: true })
  knownIssues: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  performanceMetrics: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  approvedForRollout: boolean;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @OneToMany(() => UpdateRollout, (ur) => ur.releaseCandidate)
  rollouts: UpdateRollout[];
}
