import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type ContractStatus = 'draft' | 'pending_signature' | 'active' | 'expired' | 'terminated';

export interface ContractSignatory {
  name: string;
  title: string;
  email: string;
  signedAt: string | null;
}

@Entity('saas_contracts')
export class SaasContract {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ length: 30 }) @Index({ unique: true }) contractNumber: string;

  // FKs
  @Column({ type: 'uuid', nullable: true, name: 'quotation_id' }) @Index() quotationId: string | null;
  @Column({ type: 'uuid', nullable: true, name: 'subscription_id' }) subscriptionId: string | null;
  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' }) @Index() tenantId: string | null;

  // Client
  @Column({ length: 200 }) clientName: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) clientOrganization: string | null;

  // Status
  @Column({ type: 'varchar', length: 30, default: 'draft' }) @Index() status: ContractStatus;
  @Column({ type: 'varchar', length: 50, default: 'saas_subscription' }) contractType: string;

  // Dates & value
  @Column({ type: 'timestamp' }) startDate: Date;
  @Column({ type: 'timestamp', nullable: true }) endDate: Date | null;
  @Column({ type: 'integer', default: 0 }) totalValueMinor: number;
  @Column({ type: 'varchar', length: 3, default: 'UGX' }) currency: string;

  // Renewal
  @Column({ default: true }) autoRenew: boolean;
  @Column({ type: 'integer', default: 30 }) renewalNoticeDays: number;

  // Terms
  @Column({ type: 'text', nullable: true }) termsText: string | null;
  @Column({ type: 'jsonb', nullable: true }) signatories: ContractSignatory[] | null;

  // Meta
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, any> | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
