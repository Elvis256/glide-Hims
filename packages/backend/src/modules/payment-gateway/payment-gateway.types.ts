/**
 * Payment-gateway adapter contract.
 *
 * Implementations bridge our internal `recordPayment` flow to external
 * providers (Pesapal, Flutterwave, MTN MoMo, Airtel Money, etc.).
 *
 * The lifecycle is two-phase:
 *  1. `initiate(...)` is called when a cashier or patient kicks off a
 *     non-cash payment. It returns either a redirect URL (card) or a
 *     pending transactionId (mobile money STK push).
 *  2. The provider eventually calls our webhook (`/payment-gateway/webhook/:provider`).
 *     The adapter's `parseWebhook` normalises the payload, then we record
 *     the payment in the billing service.
 */

export type GatewayChannel = 'card' | 'mobile_money' | 'bank_transfer';

export type GatewayStatus = 'pending' | 'success' | 'failed' | 'cancelled';

export interface InitiatePaymentRequest {
  channel: GatewayChannel;
  amount: number;
  currency: string;
  invoiceId: string;
  invoiceNumber: string;
  description?: string;
  // Customer details
  customer: {
    name?: string;
    email?: string;
    phone?: string;
  };
  // Mobile-money specific
  msisdn?: string;
  mobileProvider?: 'mtn' | 'airtel' | 'orange' | 'mpesa';
  // Used to redirect back after card flow
  callbackUrl?: string;
  // Tenant context
  tenantId?: string;
  // Idempotency
  idempotencyKey?: string;
}

export interface InitiatePaymentResponse {
  /** Provider-side transaction id we'll use to look up status */
  providerTransactionId: string;
  status: GatewayStatus;
  /** For card flows: the URL to redirect the user to */
  redirectUrl?: string;
  /** Human-readable message we can show to the user */
  message?: string;
  raw?: unknown;
}

export interface NormalisedWebhookEvent {
  providerTransactionId: string;
  invoiceId?: string;
  /** Original transactionReference we passed to the gateway */
  internalReference?: string;
  amount: number;
  currency: string;
  status: GatewayStatus;
  channel: GatewayChannel;
  /** Provider-issued reference (e.g. MTN financial transaction id) */
  externalReference?: string;
  customerPhone?: string;
  customerEmail?: string;
  occurredAt: Date;
  raw: unknown;
}

export interface PaymentGatewayAdapter {
  readonly providerKey: string;
  readonly displayName: string;
  readonly supportedChannels: GatewayChannel[];
  isConfigured(): boolean;

  initiate(req: InitiatePaymentRequest): Promise<InitiatePaymentResponse>;
  getStatus(providerTransactionId: string): Promise<GatewayStatus>;
  parseWebhook(headers: Record<string, string>, body: any): Promise<NormalisedWebhookEvent>;
}
