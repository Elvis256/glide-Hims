import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';

export enum PricingRuleType {
  INSURANCE = 'insurance',
  MEMBERSHIP = 'membership',
  LOYALTY = 'loyalty',
  CORPORATE = 'corporate',
  PROMOTION = 'promotion',
  VOLUME = 'volume',
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  PRICE_LIST = 'price_list',
  FORMULA = 'formula',
}

export enum AppliesTo {
  ALL = 'all',
  SERVICES = 'services',
  LAB = 'lab',
  PHARMACY = 'pharmacy',
  RADIOLOGY = 'radiology',
}

@Entity('pricing_rules')
@Index(['ruleType', 'isActive'])
@Index(['priority'])
export class PricingRule extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    name: 'rule_type',
    type: 'enum',
    enum: PricingRuleType,
  })
  ruleType: PricingRuleType;

  @Column({ type: 'int', default: 100 })
  priority: number;

  @Column({
    name: 'discount_type',
    type: 'enum',
    enum: DiscountType,
  })
  discountType: DiscountType;

  @Column({ name: 'discount_value', type: 'decimal', precision: 12, scale: 2, nullable: true })
  discountValue: number;

  @Column({ name: 'min_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  minAmount: number;

  @Column({ name: 'max_discount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  maxDiscount: number;

  @Column({ name: 'can_stack', default: false })
  canStack: boolean;

  @Column({ name: 'stack_with_types', length: 200, nullable: true })
  stackWithTypes: string;

  @Column({
    name: 'applies_to',
    type: 'enum',
    enum: AppliesTo,
    default: AppliesTo.ALL,
  })
  appliesTo: AppliesTo;

  @Column({ type: 'jsonb', nullable: true })
  conditions: Record<string, any>;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom: Date;

  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo: Date;

  @ManyToOne(() => Facility, { nullable: true })
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id', nullable: true })
  facilityId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;
}
