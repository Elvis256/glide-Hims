import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('tax_exemptions')
export class TaxExemption extends BaseEntity {
  @Column({ length: 100 })
  category: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ name: 'applicable_taxes', type: 'simple-array', nullable: true })
  applicableTaxes: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
