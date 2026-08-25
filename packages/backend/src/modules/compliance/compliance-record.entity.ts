import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';

/**
 * One runtime source, with the type derived from it. It was a bare union, so
 * nothing existed at runtime to validate a request against and
 * POST /compliance/:type accepted any string — which then hit the
 * varchar(30) column and surfaced as a 500 rather than a 400.
 */
export const COMPLIANCE_RECORD_TYPES = [
  'vulnerability',
  'incident',
  'backup',
  'access_review',
  'sla',
] as const;

export type ComplianceRecordType = (typeof COMPLIANCE_RECORD_TYPES)[number];

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
