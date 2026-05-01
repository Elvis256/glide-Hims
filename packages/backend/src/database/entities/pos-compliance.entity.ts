import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { PosShift, PosRegister } from './pos.entity';
import { PharmacySale } from './pharmacy-sale.entity';

// ─── EFRIS ───────────────────────────────────────────────────────────────────

export enum EfrisDocumentType {
  INVOICE = 'invoice',
  CREDIT_NOTE = 'credit_note',
  DEBIT_NOTE = 'debit_note',
}

export enum EfrisDocumentStatus {
  PENDING_SUBMISSION = 'pending_submission',
  SUBMITTING = 'submitting',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  RETRYING = 'retrying',
  FAILED_REQUIRES_ATTENTION = 'failed_requires_attention',
  CANCELLED = 'cancelled',
}

export enum EfrisEnvironment {
  SANDBOX = 'sandbox',
  PRODUCTION = 'production',
}

@Entity('efris_documents')
@Index(['tenantId', 'status'])
@Index(['saleId'])
@Unique('UQ_efris_idempotency', ['tenantId', 'idempotencyKey'])
export class EfrisDocument extends BaseEntity {
  @Column({
    type: 'enum',
    enum: EfrisDocumentType,
    default: EfrisDocumentType.INVOICE,
    name: 'document_type',
  })
  documentType: EfrisDocumentType;

  @Column({
    type: 'enum',
    enum: EfrisDocumentStatus,
    default: EfrisDocumentStatus.PENDING_SUBMISSION,
  })
  status: EfrisDocumentStatus;

  @Column({ type: 'uuid', name: 'sale_id' })
  saleId: string;

  @ManyToOne(() => PharmacySale)
  @JoinColumn({ name: 'sale_id' })
  sale: PharmacySale;

  @Column({ type: 'uuid', name: 'original_document_id', nullable: true })
  originalDocumentId: string;

  @Column({ name: 'idempotency_key' })
  idempotencyKey: string;

  // URA-side identifiers (populated on acceptance)
  @Column({ name: 'fiscal_invoice_number', nullable: true })
  fiscalInvoiceNumber: string;

  @Column({ name: 'fiscal_serial_number', nullable: true })
  fiscalSerialNumber: string;

  @Column({ name: 'qr_code', type: 'text', nullable: true })
  qrCode: string;

  @Column({ name: 'verification_url', type: 'text', nullable: true })
  verificationUrl: string;

  @Column({ name: 'device_serial', nullable: true })
  deviceSerial: string;

  @Column({ name: 'taxpayer_tin', nullable: true })
  taxpayerTin: string;

  // Payload + response
  @Column({ name: 'request_payload', type: 'jsonb', nullable: true })
  requestPayload: any;

  @Column({ name: 'response_payload', type: 'jsonb', nullable: true })
  responsePayload: any;

  @Column({ name: 'error_code', nullable: true })
  errorCode: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  // Retry control
  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date;

  @Column({
    type: 'enum',
    enum: EfrisEnvironment,
    default: EfrisEnvironment.SANDBOX,
    name: 'environment',
  })
  environment: EfrisEnvironment;
}

@Entity('efris_configs')
@Unique('UQ_efris_config_tenant', ['tenantId'])
export class EfrisConfig extends BaseEntity {
  @Column({ name: 'taxpayer_tin' })
  taxpayerTin: string;

  @Column({ name: 'taxpayer_name' })
  taxpayerName: string;

  @Column({ name: 'device_serial' })
  deviceSerial: string;

  @Column({
    type: 'enum',
    enum: EfrisEnvironment,
    default: EfrisEnvironment.SANDBOX,
  })
  environment: EfrisEnvironment;

  @Column({ name: 'sandbox_url', nullable: true })
  sandboxUrl: string;

  @Column({ name: 'production_url', nullable: true })
  productionUrl: string;

  @Column({ name: 'api_key_encrypted', type: 'text', nullable: true })
  apiKeyEncrypted: string;

  @Column({ name: 'is_enabled', default: false })
  isEnabled: boolean;

  @Column({ name: 'submit_on_completion', default: true })
  submitOnCompletion: boolean;

  @Column({ name: 'max_retries', type: 'int', default: 5 })
  maxRetries: number;

  @Column({ name: 'retry_backoff_seconds', type: 'int', default: 60 })
  retryBackoffSeconds: number;

  // Receipt printing behaviour when URA is offline
  @Column({ name: 'allow_offline_receipts', default: true })
  allowOfflineReceipts: boolean;
}

// ─── Cash Drawer Events ──────────────────────────────────────────────────────

export enum CashDrawerEventType {
  NO_SALE = 'no_sale',
  PAID_IN = 'paid_in',
  PAID_OUT = 'paid_out',
  CASH_DROP = 'cash_drop',
  OPENING_FLOAT = 'opening_float',
}

@Entity('pos_cash_drawer_events')
@Index(['tenantId', 'shiftId'])
export class PosCashDrawerEvent extends BaseEntity {
  @Column({ type: 'uuid', name: 'shift_id' })
  shiftId: string;

  @ManyToOne(() => PosShift)
  @JoinColumn({ name: 'shift_id' })
  shift: PosShift;

  @Column({
    type: 'enum',
    enum: CashDrawerEventType,
    name: 'event_type',
  })
  eventType: CashDrawerEventType;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ type: 'uuid', name: 'approved_by_id', nullable: true })
  approvedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: User;

  // Cached: derived from event_type. paid_in increases expected; paid_out/cash_drop decrease;
  // no_sale and opening_float (separately accounted) do not.
  @Column({ name: 'affects_expected_cash', default: true })
  affectsExpectedCash: boolean;

  @Column({ name: 'reference', nullable: true })
  reference: string;
}

// ─── Z-Report (immutable) ────────────────────────────────────────────────────

@Entity('pos_z_reports')
@Unique('UQ_z_report_shift', ['shiftId'])
@Index(['tenantId', 'generatedAt'])
export class PosZReport extends BaseEntity {
  @Column({ type: 'uuid', name: 'shift_id' })
  shiftId: string;

  @ManyToOne(() => PosShift)
  @JoinColumn({ name: 'shift_id' })
  shift: PosShift;

  @Column({ type: 'uuid', name: 'register_id' })
  registerId: string;

  @ManyToOne(() => PosRegister)
  @JoinColumn({ name: 'register_id' })
  register: PosRegister;

  @Column({ name: 'report_number', unique: true })
  reportNumber: string;

  @Column({ name: 'generated_at', type: 'timestamptz' })
  generatedAt: Date;

  @Column({ type: 'uuid', name: 'generated_by_id' })
  generatedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'generated_by_id' })
  generatedBy: User;

  // Cash flow
  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'opening_cash', default: 0 })
  openingCash: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'cash_sales', default: 0 })
  cashSales: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'cash_refunds', default: 0 })
  cashRefunds: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'paid_in_total', default: 0 })
  paidInTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'paid_out_total', default: 0 })
  paidOutTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'cash_drop_total', default: 0 })
  cashDropTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'expected_cash', default: 0 })
  expectedCash: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'counted_cash', default: 0 })
  countedCash: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'cash_variance', default: 0 })
  cashVariance: number;

  // Sales by payment method (full breakdown)
  @Column({ name: 'payment_method_breakdown', type: 'jsonb', nullable: true })
  paymentMethodBreakdown: Record<string, number>;

  // Denomination count {note_50000: 10, note_20000: 5, ...}
  @Column({ name: 'denomination_count', type: 'jsonb', nullable: true })
  denominationCount: Record<string, number>;

  // Number of sales / returns
  @Column({ name: 'transaction_count', type: 'int', default: 0 })
  transactionCount: number;

  @Column({ name: 'return_count', type: 'int', default: 0 })
  returnCount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'gross_sales', default: 0 })
  grossSales: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'returns_total', default: 0 })
  returnsTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'net_sales', default: 0 })
  netSales: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'tax_total', default: 0 })
  taxTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'discount_total', default: 0 })
  discountTotal: number;

  // Fiscal summary at time of Z
  @Column({ name: 'efris_summary', type: 'jsonb', nullable: true })
  efrisSummary: any;

  // Cashier notes / variance explanation
  @Column({ type: 'text', nullable: true })
  notes: string;

  // Hash of full report payload (tamper detection)
  @Column({ name: 'payload_hash', length: 128 })
  payloadHash: string;
}

// ─── Outbox (transactional event publishing) ─────────────────────────────────

export enum OutboxEventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

@Entity('outbox_events')
@Index(['status', 'nextAttemptAt'])
@Index(['tenantId', 'aggregateType', 'aggregateId'])
export class OutboxEvent extends BaseEntity {
  @Column({ name: 'event_type', length: 100 })
  eventType: string; // e.g. SaleCompleted, ReturnCreated, EfrisSubmissionRequested

  @Column({ name: 'aggregate_type', length: 100 })
  aggregateType: string; // e.g. PharmacySale

  @Column({ type: 'uuid', name: 'aggregate_id' })
  aggregateId: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({
    type: 'enum',
    enum: OutboxEventStatus,
    default: OutboxEventStatus.PENDING,
  })
  status: OutboxEventStatus;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number;

  @Column({ name: 'max_attempts', type: 'int', default: 10 })
  maxAttempts: number;

  @Column({ name: 'next_attempt_at', type: 'timestamptz', nullable: true })
  nextAttemptAt: Date;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date;
}
