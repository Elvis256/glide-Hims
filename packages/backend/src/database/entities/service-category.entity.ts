import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';

export enum ServiceTier {
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium',
  VIP = 'vip',
}

@Entity('service_categories')
@Index(['code'], { unique: true })
export class ServiceCategory extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string;

  @ManyToOne(() => ServiceCategory, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: ServiceCategory;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;
}

@Entity('services')
@Index(['code'], { unique: true })
@Index(['category'])
export class Service extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => ServiceCategory)
  @JoinColumn({ name: 'category_id' })
  category: ServiceCategory;

  @Column({ name: 'category_id' })
  categoryId: string;

  @Column({
    type: 'enum',
    enum: ServiceTier,
    default: ServiceTier.STANDARD,
  })
  tier: ServiceTier;

  @Column({ name: 'base_price', type: 'decimal', precision: 12, scale: 2 })
  basePrice: number;

  @Column({ name: 'is_package', default: false })
  isPackage: boolean;

  @Column({ name: 'duration_minutes', nullable: true })
  durationMinutes: number;

  @Column({ name: 'requires_appointment', default: false })
  requiresAppointment: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => Facility, { nullable: true })
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id', nullable: true })
  facilityId: string;
}

@Entity('service_prices')
@Index(['service', 'tier'])
export class ServicePrice extends BaseEntity {
  @ManyToOne(() => Service)
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ name: 'service_id' })
  serviceId: string;

  @Column({
    type: 'enum',
    enum: ServiceTier,
  })
  tier: ServiceTier;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: Date;

  @ManyToOne(() => Facility, { nullable: true })
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id', nullable: true })
  facilityId: string;
}

@Entity('service_packages')
@Index(['code'], { unique: true })
export class ServicePackage extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'package_price', type: 'decimal', precision: 12, scale: 2 })
  packagePrice: number;

  @Column({ name: 'valid_days', default: 30 })
  validDays: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  includedServices: { serviceId: string; quantity: number }[];
}
