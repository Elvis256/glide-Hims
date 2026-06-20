import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
} from 'typeorm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CatalogItemCategory =
  | 'module'
  | 'hardware'
  | 'training'
  | 'implementation'
  | 'support'
  | 'other';

export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'superseded';

export interface QuotationLineItem {
  catalogItemId?: string | null;
  moduleId?: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
  category: CatalogItemCategory;
}

// ---------------------------------------------------------------------------
// SaasPriceCatalogItem — the price list
// ---------------------------------------------------------------------------

@Entity('saas_price_catalog')
export class SaasPriceCatalogItem {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ length: 100 }) @Index({ unique: true }) code: string;
  @Column({ length: 200 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;

  @Column({ type: 'varchar', length: 30, default: 'module' })
  category: CatalogItemCategory;

  @Column({ type: 'integer', default: 0 }) unitPriceMinor: number;
  @Column({ type: 'varchar', length: 3, default: 'UGX' }) currency: string;

  @Column({ default: true }) isActive: boolean;
  @Column({ type: 'integer', default: 0 }) sortOrder: number;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, any> | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

// ---------------------------------------------------------------------------
// SaasQuotation — the parent quotation
// ---------------------------------------------------------------------------

@Entity('saas_quotations')
export class SaasQuotation {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ length: 30 }) @Index({ unique: true }) quotationNumber: string;

  // Links
  @Column({ type: 'uuid', nullable: true, name: 'lead_id' }) @Index() leadId: string | null;
  @Column({ type: 'uuid', nullable: true, name: 'plan_id' }) planId: string | null;

  // Client info
  @Column({ length: 200 }) clientName: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) clientOrganization: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) clientEmail: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) clientPhone: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) clientCountry: string | null;

  // Pricing
  @Column({ type: 'varchar', length: 3, default: 'UGX' }) currency: string;
  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1, name: 'fx_rate_to_base' }) fxRateToBase: string;
  @Column({ type: 'varchar', length: 20, default: 'monthly' }) billingInterval: string;
  @Column({ type: 'integer', default: 1 }) seats: number;

  // Tax
  @Column({ default: true }) includeVat: boolean;
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 18 }) vatRatePercent: string;
  @Column({ default: false }) deductWht: boolean;
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 6 }) whtRatePercent: string;

  // Discount
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 }) discountPercent: string;
  @Column({ type: 'integer', default: 0 }) discountFixedMinor: number;

  // Dates
  @Column({ type: 'timestamp' }) issueDate: Date;
  @Column({ type: 'timestamp', nullable: true }) validUntil: Date | null;
  @Column({ type: 'timestamp', nullable: true }) sentAt: Date | null;
  @Column({ type: 'timestamp', nullable: true }) acceptedAt: Date | null;
  @Column({ type: 'timestamp', nullable: true }) rejectedAt: Date | null;

  // Versioning
  @Column({ type: 'integer', default: 1 }) currentRevisionNumber: number;

  // Status
  @Column({ type: 'varchar', length: 20, default: 'draft' }) @Index() status: QuotationStatus;

  // Conversion links (set after auto-provision)
  @Column({ type: 'uuid', nullable: true, name: 'subscription_id' }) subscriptionId: string | null;
  @Column({ type: 'uuid', nullable: true, name: 'contract_id' }) contractId: string | null;

  // Notes
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'text', nullable: true }) internalNotes: string | null;
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, any> | null;

  @OneToMany(() => SaasQuotationRevision, (r) => r.quotation)
  revisions: SaasQuotationRevision[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

// ---------------------------------------------------------------------------
// SaasQuotationRevision — immutable versioned snapshot
// ---------------------------------------------------------------------------

@Entity('saas_quotation_revisions')
@Unique(['quotationId', 'revisionNumber'])
export class SaasQuotationRevision {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid', name: 'quotation_id' }) @Index() quotationId: string;
  @ManyToOne(() => SaasQuotation, (q) => q.revisions)
  @JoinColumn({ name: 'quotation_id' })
  quotation: SaasQuotation;

  @Column({ type: 'integer' }) revisionNumber: number;

  // Totals (integer minor units)
  @Column({ type: 'integer', default: 0 }) subtotalMinor: number;
  @Column({ type: 'integer', default: 0 }) discountMinor: number;
  @Column({ type: 'integer', default: 0 }) taxMinor: number;
  @Column({ type: 'integer', default: 0 }) totalMinor: number;

  // Line items snapshot
  @Column({ type: 'jsonb', default: '[]' }) lineItems: QuotationLineItem[];

  @Column({ type: 'text', nullable: true }) changeNotes: string | null;
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null;
  @CreateDateColumn() createdAt: Date;
}
