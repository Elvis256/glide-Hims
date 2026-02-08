import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { InsuranceProvider } from './insurance-provider.entity';
import { Service } from './service-category.entity';
import { LabTest } from './lab-test.entity';
import { User } from './user.entity';

@Entity('insurance_price_lists')
@Index(['insuranceProviderId', 'serviceId'], { unique: true, where: '"service_id" IS NOT NULL' })
@Index(['insuranceProviderId', 'labTestId'], { unique: true, where: '"lab_test_id" IS NOT NULL' })
export class InsurancePriceList extends BaseEntity {
  @ManyToOne(() => InsuranceProvider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'insurance_provider_id' })
  insuranceProvider: InsuranceProvider;

  @Column({ name: 'insurance_provider_id' })
  insuranceProviderId: string;

  @ManyToOne(() => Service, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ name: 'service_id', nullable: true })
  serviceId: string;

  @ManyToOne(() => LabTest, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_test_id' })
  labTest: LabTest;

  @Column({ name: 'lab_test_id', nullable: true })
  labTestId: string;

  @Column({ name: 'agreed_price', type: 'decimal', precision: 12, scale: 2 })
  agreedPrice: number;

  @Column({ name: 'discount_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column({ name: 'effective_from', type: 'date', default: () => 'CURRENT_DATE' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;
}
