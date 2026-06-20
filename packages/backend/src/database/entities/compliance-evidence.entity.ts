import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('compliance_evidence')
@Index(['framework'])
@Index(['controlId'])
@Index(['status'])
@Index(['collectedAt'])
export class ComplianceEvidence extends BaseEntity {
  @Column({ type: 'varchar', length: 30 })
  framework: string; // 'SOC2' | 'ISO27001' | 'HIPAA' | 'INTERNAL'

  @Column({ type: 'varchar', length: 50, name: 'control_id' })
  controlId: string; // e.g. 'CC6.1', 'A.12.3.1'

  @Column({ type: 'varchar', length: 200, name: 'control_name' })
  controlName: string;

  @Column({ type: 'varchar', length: 20, name: 'evidence_type' })
  evidenceType: string; // 'automated' | 'manual' | 'hybrid'

  @Column({ type: 'varchar', length: 20, default: 'not_assessed' })
  status: string; // 'compliant' | 'non_compliant' | 'partial' | 'not_assessed'

  @Column({ type: 'timestamp', name: 'collected_at' })
  collectedAt: Date;

  @Column({ type: 'varchar', length: 100, name: 'collected_by' })
  collectedBy: string; // 'system' or userId

  @Column({ type: 'jsonb' })
  data: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'next_review_at' })
  nextReviewAt: Date | null;

  @Column({ type: 'varchar', length: 64 })
  hash: string; // SHA-256 of data for immutability verification
}
