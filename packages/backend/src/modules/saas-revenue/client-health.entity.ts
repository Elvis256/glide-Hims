import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type HealthStatus = 'healthy' | 'at_risk' | 'critical';

@Entity('client_health_scores')
export class ClientHealthScore {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid', name: 'tenant_id' }) @Index({ unique: true }) tenantId: string;
  @Column({ type: 'uuid', nullable: true, name: 'subscription_id' }) subscriptionId: string | null;

  @Column({ type: 'integer', default: 0 }) overallScore: number;
  @Column({ type: 'varchar', length: 20, default: 'healthy' }) @Index() healthStatus: HealthStatus;

  // Component scores (0-100)
  @Column({ type: 'integer', default: 0 }) usageScore: number;
  @Column({ type: 'integer', default: 0 }) paymentScore: number;
  @Column({ type: 'integer', default: 0 }) supportScore: number;
  @Column({ type: 'integer', default: 0 }) adoptionScore: number;
  @Column({ type: 'integer', default: 0 }) deploymentScore: number;

  @Column({ type: 'jsonb', nullable: true }) componentDetails: Record<string, any> | null;
  @Column({ type: 'jsonb', nullable: true }) alerts: Array<{
    level: string;
    message: string;
    createdAt: string;
  }> | null;

  @Column({ type: 'timestamp', nullable: true }) lastCalculatedAt: Date | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
