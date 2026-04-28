import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';

export type ComplianceRecordType =
  | 'vulnerability'
  | 'incident'
  | 'backup'
  | 'access_review'
  | 'sla';

@Entity('compliance_records')
@Index(['recordType'])
@Index(['createdAt'])
export class ComplianceRecord extends BaseEntity {
  @Column({ type: 'varchar', length: 30, name: 'record_type' })
  recordType: ComplianceRecordType;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;
}
