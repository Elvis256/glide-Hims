import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { UpdateRollout } from './update-rollout.entity';
import { License } from './license.entity';

export enum DeploymentReportStatus {
  STARTED = 'started',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

/**
 * Per-instance update report for a rollout. Tenant agents POST one of these
 * each time they pick up, succeed, or fail an update so the platform can
 * compute success/failure rates and trigger auto-rollback when needed.
 *
 * Keyed by (rolloutId, licenseId) so re-submissions overwrite the latest
 * status for that instance instead of double-counting.
 */
@Entity('deployment_reports')
@Unique('uq_deployment_report_rollout_license', ['rolloutId', 'licenseId'])
@Index(['rolloutId', 'status'])
@Index(['licenseId'])
export class DeploymentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'rollout_id' })
  rolloutId: string;

  @ManyToOne(() => UpdateRollout, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rollout_id' })
  rollout: UpdateRollout;

  @Column({ type: 'uuid', name: 'license_id' })
  licenseId: string;

  @ManyToOne(() => License, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'license_id' })
  license: License;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: true })
  tenantId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'hardware_id', nullable: true })
  hardwareId: string | null;

  @Column({ type: 'varchar', length: 50, name: 'from_version', nullable: true })
  fromVersion: string | null;

  @Column({ type: 'varchar', length: 50, name: 'to_version', nullable: true })
  toVersion: string | null;

  @Column({ type: 'enum', enum: DeploymentReportStatus, default: DeploymentReportStatus.STARTED })
  status: DeploymentReportStatus;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'varchar', length: 45, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
