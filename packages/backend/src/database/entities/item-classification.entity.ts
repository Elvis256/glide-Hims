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

/**
 * Hospital-defined item categories (e.g., Medications, Equipment, Reagents, Supplies)
 * Fully customizable by each hospital
 */
@Entity('item_categories')
@Index(['facilityId', 'code'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['facilityId', 'name'])
export class ItemCategory extends BaseEntity {
  @Column({ length: 50 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string; // Hex color for UI display (e.g., #FF5733)

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string; // Icon name for UI display

  @Column({ name: 'is_drug_category', default: false })
  isDrugCategory: boolean; // Whether items in this category are drugs

  @Column({ name: 'requires_prescription', default: false })
  requiresPrescription: boolean; // Default for items in this category

  @Column({ name: 'requires_batch_tracking', default: false })
  requiresBatchTracking: boolean;

  @Column({ name: 'requires_expiry_tracking', default: true })
  requiresExpiryTracking: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @OneToMany(() => ItemSubcategory, (sub) => sub.category)
  subcategories: ItemSubcategory[];
}

/**
 * Subcategories within a category (e.g., Antibiotics under Medications)
 */
@Entity('item_subcategories')
@Index(['categoryId', 'code'], { unique: true, where: 'deleted_at IS NULL' })
export class ItemSubcategory extends BaseEntity {
  @Column({ length: 50 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relationships
  @ManyToOne(() => ItemCategory, (cat) => cat.subcategories)
  @JoinColumn({ name: 'category_id' })
  category: ItemCategory;

  @Column({ name: 'category_id' })
  categoryId: string;
}

/**
 * Manufacturers/Brands (e.g., Pfizer, Cipla, Abbott)
 */
@Entity('item_brands')
@Index(['facilityId', 'code'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['facilityId', 'name'])
export class ItemBrand extends BaseEntity {
  @Column({ length: 50 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 100, nullable: true })
  country: string; // Country of origin

  @Column({ length: 255, nullable: true })
  website: string;

  @Column({ name: 'contact_email', length: 255, nullable: true })
  contactEmail: string;

  @Column({ name: 'contact_phone', length: 50, nullable: true })
  contactPhone: string;

  @Column({ name: 'is_preferred', default: false })
  isPreferred: boolean; // Hospital preferred brand

  @Column({ name: 'quality_rating', type: 'int', nullable: true })
  qualityRating: number; // 1-5 rating

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;
}

/**
 * Custom classification tags (e.g., High-Alert, Controlled, Refrigerated)
 * Flexible tagging system for any item attribute
 */
@Entity('item_tags')
@Index(['facilityId', 'code'], { unique: true, where: 'deleted_at IS NULL' })
export class ItemTag extends BaseEntity {
  @Column({ length: 50 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string; // Hex color for badge display

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string;

  @Column({ name: 'tag_type', length: 50, default: 'general' })
  tagType: string; // 'safety', 'storage', 'regulatory', 'general', etc.

  @Column({ name: 'is_warning', default: false })
  isWarning: boolean; // Show as warning badge

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;
}

/**
 * Units of measure (e.g., Tablet, Bottle, Box, Piece)
 */
@Entity('item_units')
@Index(['facilityId', 'code'], { unique: true, where: 'deleted_at IS NULL' })
export class ItemUnit extends BaseEntity {
  @Column({ length: 20 })
  code: string;

  @Column({ length: 50 })
  name: string;

  @Column({ length: 10, nullable: true })
  abbreviation: string; // e.g., 'pcs', 'btl', 'tab'

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_base_unit', default: false })
  isBaseUnit: boolean; // Is this a base unit (not a pack)

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;
}

/**
 * Formulations/Dosage forms (e.g., Tablet, Syrup, Injection)
 */
@Entity('item_formulations')
@Index(['facilityId', 'code'], { unique: true, where: 'deleted_at IS NULL' })
export class ItemFormulation extends BaseEntity {
  @Column({ length: 50 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'route_of_admin', length: 50, nullable: true })
  routeOfAdmin: string; // oral, iv, im, topical, etc.

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;
}

/**
 * Storage conditions (e.g., Room Temperature, Refrigerated, Frozen)
 */
@Entity('storage_conditions')
@Index(['facilityId', 'code'], { unique: true, where: 'deleted_at IS NULL' })
export class StorageCondition extends BaseEntity {
  @Column({ length: 50 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'min_temp', type: 'decimal', precision: 5, scale: 2, nullable: true })
  minTemp: number; // Minimum temperature in Celsius

  @Column({ name: 'max_temp', type: 'decimal', precision: 5, scale: 2, nullable: true })
  maxTemp: number; // Maximum temperature in Celsius

  @Column({ type: 'text', nullable: true })
  instructions: string; // Special handling instructions

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;
}

/**
 * Junction table for item tags (many-to-many)
 */
@Entity('item_tag_assignments')
@Index(['itemId', 'tagId'], { unique: true, where: 'deleted_at IS NULL' })
export class ItemTagAssignment extends BaseEntity {
  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'tag_id', type: 'uuid' })
  tagId: string;

  @ManyToOne(() => ItemTag)
  @JoinColumn({ name: 'tag_id' })
  tag: ItemTag;
}
