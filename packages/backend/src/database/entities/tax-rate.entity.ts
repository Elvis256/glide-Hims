import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum TaxType {
  VAT = 'vat',
  SERVICE_TAX = 'service_tax',
  EXCISE = 'excise',
  CUSTOM = 'custom',
}

@Entity('tax_rates')
@Unique(['tenantId', 'code'])
export class TaxRate extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 20 })
  code: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  rate: number;

  @Column({ type: 'enum', enum: TaxType, default: TaxType.VAT })
  type: TaxType;

  @Column({ name: 'applicable_services', type: 'simple-array', nullable: true })
  applicableServices: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom: Date;
}
