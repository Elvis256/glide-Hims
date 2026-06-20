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
import { SaasPaymentProof } from './payment-proof.entity';

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
export type SaasPaymentVerificationStatus = 'unverified' | 'pending_verification' | 'verified' | 'rejected';
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
  | 'payment_refunded'
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
  @Column({ type: 'uuid', nullable: true, name: 'billing_payer_tenant_id' }) @Index() billingPayerTenantId: string | null;
  @Column({ type: 'uuid', nullable: true }) deploymentId: string | null;
  @Column({ type: 'uuid', nullable: true }) leadId: string | null;
  @Column({ type: 'uuid', nullable: true }) quotationId: string | null;
  @Column({ type: 'uuid', name: 'plan_id' }) planId: string;
  @ManyToOne(() => SaasPlan) @JoinColumn({ name: 'plan_id' }) plan: SaasPlan;

  @Column({ type: 'varchar', length: 30, default: 'trial' }) @Index() status: SubscriptionStatus;
  @Column({ type: 'varchar', length: 20, default: 'monthly' }) billingInterval: BillingInterval;
  @Column({ type: 'varchar', length: 3, default: 'UGX' }) currency: string;
  @Column({ type: 'varchar', length: 3, nullable: true, name: 'billing_currency' }) billingCurrency: string | null;
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
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'billing_email' }) billingEmail: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'billing_name' }) billingName: string | null;
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
  @Column({ type: 'uuid', nullable: true, name: 'billing_payer_tenant_id' }) billingPayerTenantId: string | null;

  @Column({ type: 'varchar', length: 30, default: 'draft' }) @Index() status: SaasInvoiceStatus;
  @Column({ type: 'varchar', length: 3, default: 'UGX' }) currency: string;

  @Column({ type: 'integer', default: 0 }) subtotalMinor: number;
  @Column({ type: 'integer', default: 0 }) discountMinor: number;
  @Column({ type: 'integer', default: 0 }) taxMinor: number;
  @Column({ type: 'integer', default: 0 }) totalMinor: number;
  @Column({ type: 'integer', default: 0 }) amountPaidMinor: number;
  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1, name: 'fx_rate_to_base' }) fxRateToBase: string;

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
  @Column({ type: 'uuid', nullable: true, name: 'billing_payer_tenant_id' }) billingPayerTenantId: string | null;

  @Column({ type: 'varchar', length: 3, default: 'UGX' }) currency: string;
  @Column({ type: 'integer' }) amountMinor: number;
  @Column({ type: 'varchar', length: 30, default: 'succeeded' }) @Index() status: SaasPaymentStatus;

  @Column({ type: 'varchar', length: 50, default: 'manual' }) gateway: string; // manual | flutterwave | stripe | paystack | momo | bank
  @Column({ type: 'varchar', length: 200, nullable: true }) gatewayRef: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) method: string | null; // card / bank / momo / cash
  @Column({ type: 'jsonb', nullable: true }) gatewayPayload: Record<string, any> | null;
  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1, name: 'fx_rate_to_base' }) fxRateToBase: string;

  @Column({ type: 'timestamp' }) paidAt: Date;
  @Column({ type: 'uuid', nullable: true }) recordedBy: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;

  @Column({ type: 'varchar', length: 30, default: 'unverified' }) verificationStatus: SaasPaymentVerificationStatus;
  @Column({ type: 'uuid', nullable: true }) verifiedBy: string | null;
  @Column({ type: 'timestamp', nullable: true }) verifiedAt: Date | null;
  @Column({ type: 'text', nullable: true }) verificationNotes: string | null;

  @OneToMany(() => SaasPaymentProof, (p) => p.payment) proofs: SaasPaymentProof[];

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

export type SaasEmailLogStatus = 'sent' | 'failed' | 'skipped';

@Entity('saas_email_logs')
export class SaasEmailLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) @Index() tenantId: string | null;
  @Column({ type: 'varchar', length: 50 }) @Index() templateKey: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) to: string | null;
  @Column({ type: 'text' }) subject: string;
  @Column({ type: 'varchar', length: 20 }) @Index() status: SaasEmailLogStatus;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @Column({ type: 'uuid', nullable: true }) invoiceId: string | null;
  @Column({ type: 'uuid', nullable: true }) subscriptionId: string | null;
  @Column({ type: 'boolean', default: false }) isTest: boolean;
  @Column({ type: 'text', nullable: true }) bodyPreview: string | null;
  @CreateDateColumn() @Index() createdAt: Date;
}

export type SaasPaymentMethodKind = 'card' | 'mobile_money' | 'bank' | 'other';

@Entity('saas_payment_methods')
export class SaasPaymentMethod {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) @Index() tenantId: string;
  @Column({ type: 'varchar', length: 30 }) kind: SaasPaymentMethodKind;
  @Column({ type: 'varchar', length: 100 }) label: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) brand: string | null;
  @Column({ type: 'varchar', length: 8, nullable: true }) last4: string | null;
  @Column({ type: 'int', nullable: true }) expMonth: number | null;
  @Column({ type: 'int', nullable: true }) expYear: number | null;
  @Column({ type: 'varchar', length: 150, nullable: true }) holderName: string | null;
  @Column({ type: 'boolean', default: false }) @Index() isDefault: boolean;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, any> | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

export type WebhookDeliveryStatus = 'pending' | 'succeeded' | 'failed';

@Entity('saas_webhook_endpoints')
export class SaasWebhookEndpoint {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) @Index() tenantId: string;
  @Column({ type: 'text' }) url: string;
  @Column({ type: 'text' }) secret: string;
  @Column({ type: 'text', array: true, default: '{}' }) events: string[];
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'boolean', default: true }) enabled: boolean;
  @Column({ type: 'int', default: 0 }) consecutiveFailures: number;
  @Column({ type: 'timestamptz', nullable: true }) lastSuccessAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) lastFailureAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) disabledAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('saas_webhook_deliveries')
export class SaasWebhookDelivery {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) @Index() endpointId: string;
  @Column({ type: 'uuid' }) @Index() tenantId: string;
  @Column({ type: 'varchar', length: 64 }) eventType: string;
  @Column({ type: 'uuid' }) eventId: string;
  @Column({ type: 'jsonb' }) payload: Record<string, any>;
  @Column({ type: 'varchar', length: 16, default: 'pending' }) status: WebhookDeliveryStatus;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ type: 'int', nullable: true }) responseCode: number | null;
  @Column({ type: 'text', nullable: true }) responseBody: string | null;
  @Column({ type: 'text', nullable: true }) errorMessage: string | null;
  @Column({ type: 'timestamptz' }) nextAttemptAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) lastAttemptAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) succeededAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}
