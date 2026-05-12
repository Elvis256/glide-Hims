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
} from 'typeorm';

export type BillingInterval = 'monthly' | 'annual';
export type PlanTier = 'community' | 'standard' | 'professional' | 'enterprise';
export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'churned'
  | 'paused';
export type SaasInvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
export type SaasPaymentStatus = 'succeeded' | 'failed' | 'pending' | 'refunded';
export type CouponDiscountType = 'percent' | 'fixed';
export type SubscriptionEventType =
  | 'created'
  | 'trial_started'
  | 'trial_converted'
  | 'activated'
  | 'plan_changed'
  | 'renewed'
  | 'invoice_issued'
  | 'payment_recorded'
  | 'payment_failed'
  | 'past_due'
  | 'paused'
  | 'resumed'
  | 'cancelled'
  | 'churned'
  | 'note';

@Entity('saas_plans')
export class SaasPlan {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ length: 100 }) @Index({ unique: true }) code: string;
  @Column({ length: 200 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 50, default: 'professional' }) tier: PlanTier;

  // Prices stored as integer minor units (cents) to avoid float math.
  @Column({ type: 'integer', default: 0 }) priceMonthlyMinor: number;
  @Column({ type: 'integer', default: 0 }) priceAnnualMinor: number;
  @Column({ type: 'varchar', length: 3, default: 'UGX' }) currency: string;

  @Column({ type: 'integer', default: 0 }) annualDiscountPercent: number; // marketing display
  @Column({ type: 'integer', default: 0 }) trialDays: number;

  @Column({ type: 'integer', nullable: true }) maxUsers: number | null;
  @Column({ type: 'integer', nullable: true }) maxFacilities: number | null;
  @Column({ type: 'jsonb', nullable: true }) enabledModules: string[] | null;
  @Column({ type: 'jsonb', nullable: true }) features: any | null;

  @Column({ default: true }) isActive: boolean;
  @Column({ default: false }) isPublic: boolean; // surfaced on public pricing page
  @Column({ type: 'integer', default: 0 }) sortOrder: number;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('saas_subscriptions')
export class SaasSubscription {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) @Index() tenantId: string;
  @Column({ type: 'uuid', nullable: true }) deploymentId: string | null;
  @Column({ type: 'uuid', nullable: true }) leadId: string | null;
  @Column({ type: 'uuid', name: 'plan_id' }) planId: string;
  @ManyToOne(() => SaasPlan) @JoinColumn({ name: 'plan_id' }) plan: SaasPlan;

  @Column({ type: 'varchar', length: 30, default: 'trial' }) @Index() status: SubscriptionStatus;
  @Column({ type: 'varchar', length: 20, default: 'monthly' }) billingInterval: BillingInterval;
  @Column({ type: 'varchar', length: 3, default: 'UGX' }) currency: string;
  @Column({ type: 'integer', default: 0 }) unitPriceMinor: number; // snapshot at start
  @Column({ type: 'integer', default: 1 }) seats: number;

  @Column({ type: 'uuid', nullable: true }) couponId: string | null;
  @Column({ type: 'integer', default: 0 }) discountPercent: number;
  @Column({ type: 'integer', default: 0 }) discountFixedMinor: number;

  @Column({ type: 'timestamp' }) startDate: Date;
  @Column({ type: 'timestamp', nullable: true }) trialEndsAt: Date | null;
  @Column({ type: 'timestamp', nullable: true }) currentPeriodStart: Date | null;
  @Column({ type: 'timestamp', nullable: true }) currentPeriodEnd: Date | null;
  @Column({ type: 'timestamp', nullable: true }) nextRenewalAt: Date | null;
  @Column({ type: 'timestamp', nullable: true }) cancelledAt: Date | null;
  @Column({ type: 'timestamp', nullable: true }) churnedAt: Date | null;
  @Column({ type: 'timestamp', nullable: true }) lastInvoicedAt: Date | null;

  @Column({ default: true }) autoRenew: boolean;
  @Column({ default: false }) cancelAtPeriodEnd: boolean;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, any> | null;

  // Operational dunning state.
  @Column({ type: 'integer', default: 0 }) failedPaymentAttempts: number;
  @Column({ type: 'timestamp', nullable: true }) lastDunningAt: Date | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @OneToMany(() => SaasInvoice, (i) => i.subscription) invoices: SaasInvoice[];
}

@Entity('saas_invoices')
export class SaasInvoice {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ length: 50 }) @Index({ unique: true }) invoiceNumber: string;

  @Column({ type: 'uuid', name: 'subscription_id' }) @Index() subscriptionId: string;
  @ManyToOne(() => SaasSubscription, (s) => s.invoices) @JoinColumn({ name: 'subscription_id' }) subscription: SaasSubscription;

  @Column({ type: 'uuid' }) tenantId: string;

  @Column({ type: 'varchar', length: 30, default: 'draft' }) @Index() status: SaasInvoiceStatus;
  @Column({ type: 'varchar', length: 3, default: 'UGX' }) currency: string;

  @Column({ type: 'integer', default: 0 }) subtotalMinor: number;
  @Column({ type: 'integer', default: 0 }) discountMinor: number;
  @Column({ type: 'integer', default: 0 }) taxMinor: number;
  @Column({ type: 'integer', default: 0 }) totalMinor: number;
  @Column({ type: 'integer', default: 0 }) amountPaidMinor: number;

  @Column({ type: 'timestamp' }) issuedAt: Date;
  @Column({ type: 'timestamp' }) dueAt: Date;
  @Column({ type: 'timestamp', nullable: true }) paidAt: Date | null;

  @Column({ type: 'timestamp', nullable: true }) periodStart: Date | null;
  @Column({ type: 'timestamp', nullable: true }) periodEnd: Date | null;

  @Column({ type: 'text', nullable: true }) memo: string | null;
  @Column({ type: 'jsonb', nullable: true }) lines: Array<{
    description: string; quantity: number; unitPriceMinor: number; amountMinor: number;
  }> | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('saas_payments')
export class SaasPayment {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) @Index() invoiceId: string;
  @Column({ type: 'uuid' }) subscriptionId: string;
  @Column({ type: 'uuid' }) tenantId: string;

  @Column({ type: 'varchar', length: 3, default: 'UGX' }) currency: string;
  @Column({ type: 'integer' }) amountMinor: number;
  @Column({ type: 'varchar', length: 30, default: 'succeeded' }) @Index() status: SaasPaymentStatus;

  @Column({ type: 'varchar', length: 50, default: 'manual' }) gateway: string; // manual | flutterwave | stripe | paystack | momo | bank
  @Column({ type: 'varchar', length: 200, nullable: true }) gatewayRef: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) method: string | null; // card / bank / momo / cash
  @Column({ type: 'jsonb', nullable: true }) gatewayPayload: Record<string, any> | null;

  @Column({ type: 'timestamp' }) paidAt: Date;
  @Column({ type: 'uuid', nullable: true }) recordedBy: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('saas_coupons')
export class SaasCoupon {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ length: 50 }) @Index({ unique: true }) code: string;
  @Column({ type: 'varchar', length: 20, default: 'percent' }) discountType: CouponDiscountType;
  @Column({ type: 'integer', default: 0 }) amount: number; // % if percent, minor units if fixed
  @Column({ type: 'varchar', length: 3, default: 'UGX' }) currency: string;

  @Column({ type: 'integer', nullable: true }) maxRedemptions: number | null;
  @Column({ type: 'integer', default: 0 }) timesRedeemed: number;
  @Column({ type: 'integer', nullable: true }) durationMonths: number | null; // null = forever
  @Column({ type: 'timestamp', nullable: true }) expiresAt: Date | null;

  @Column({ type: 'jsonb', nullable: true }) appliesToPlanIds: string[] | null;
  @Column({ default: true }) isActive: boolean;
  @Column({ type: 'text', nullable: true }) notes: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('saas_subscription_events')
export class SaasSubscriptionEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) @Index() subscriptionId: string;
  @Column({ type: 'varchar', length: 50 }) @Index() type: SubscriptionEventType;
  @Column({ type: 'text', nullable: true }) message: string | null;
  @Column({ type: 'jsonb', nullable: true }) payload: Record<string, any> | null;
  @Column({ type: 'uuid', nullable: true }) actorId: string | null;
  @CreateDateColumn() createdAt: Date;
}
