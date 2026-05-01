import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export interface OverrideWarning {
  severity: string;
  drug1Id: string;
  drug1Name: string;
  drug2Id: string;
  drug2Name: string;
  drug2Source: 'cart' | 'history';
  mechanism: string;
  recommendation: string;
}

/**
 * Audit record for every "severe" drug-interaction warning that a manager
 * overrides during POS sale completion.
 */
@Entity('drug_interaction_overrides')
@Index(['tenantId', 'saleId'])
@Index(['tenantId', 'patientId'])
export class DrugInteractionOverride extends BaseEntity {
  @Column({ name: 'sale_id', type: 'uuid', nullable: true })
  saleId: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string;

  @Column({ type: 'jsonb' })
  warnings: OverrideWarning[];

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'overridden_by_id', type: 'uuid' })
  overriddenById: string;

  @Column({ name: 'overridden_at', type: 'timestamptz', default: () => 'now()' })
  overriddenAt: Date;

  @Column({ name: 'manager_approver_id', type: 'uuid', nullable: true })
  managerApproverId: string;
}
