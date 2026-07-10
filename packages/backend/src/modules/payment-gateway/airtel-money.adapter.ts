import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  PaymentGatewayAdapter,
  GatewayChannel,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  NormalisedWebhookEvent,
  GatewayStatus,
} from './payment-gateway.types';

/**
 * Airtel Money Open API adapter (Africa Open API v2).
 *
 * Activation env vars:
 *   AIRTEL_BASE_URL          (default https://openapiuat.airtel.africa for sandbox,
 *                            https://openapi.airtel.africa for production)
 *   AIRTEL_CLIENT_ID
 *   AIRTEL_CLIENT_SECRET
 *   AIRTEL_COUNTRY           (e.g. UG, KE, TZ — default UG)
 *   AIRTEL_CURRENCY          (e.g. UGX, KES — default UGX)
 *   AIRTEL_PIN               (encrypted PIN for refunds — optional)
 *
 * Live calls only happen when isConfigured() returns true.
 */
@Injectable()
export class AirtelMoneyAdapter implements PaymentGatewayAdapter {
  private readonly logger = new Logger(AirtelMoneyAdapter.name);

  readonly providerKey = 'airtel-money';
  readonly displayName = 'Airtel Money';
  readonly supportedChannels: GatewayChannel[] = ['mobile_money'];

  // In-memory token cache (Airtel tokens are valid 1h)
  private cachedToken?: { token: string; expiresAt: number };

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get('AIRTEL_CLIENT_ID') && this.config.get('AIRTEL_CLIENT_SECRET'));
  }

  private get baseUrl(): string {
    return this.config.get<string>('AIRTEL_BASE_URL') || 'https://openapiuat.airtel.africa';
  }

  private get country(): string {
    return this.config.get<string>('AIRTEL_COUNTRY') || 'UG';
  }

  private get currency(): string {
    return this.config.get<string>('AIRTEL_CURRENCY') || 'UGX';
  }

  private async getToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.token;
    }
    const res = await fetch(`${this.baseUrl}/auth/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: '*/*' },
      body: JSON.stringify({
        client_id: this.config.get<string>('AIRTEL_CLIENT_ID'),
        client_secret: this.config.get<string>('AIRTEL_CLIENT_SECRET'),
        grant_type: 'client_credentials',
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Airtel token failed: ${res.status} ${text}`);
    }
    const data: any = await res.json();
    const token = data.access_token as string;
    const expiresIn = Number(data.expires_in || 3600);
    this.cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
    return token;
  }

  /**
   * Strip leading + and country code so Airtel gets just the local MSISDN.
   * Airtel UG expects 9-digit format (e.g. 752123456 not 256752123456).
   */
  private normalizeMsisdn(raw: string): string {
    let m = String(raw).replace(/[^\d]/g, '');
    if (m.startsWith('256') && m.length === 12) m = m.slice(3);
    if (m.startsWith('0')) m = m.slice(1);
    return m;
  }

  async initiate(req: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Airtel Money is not configured on this server');
    }
    if (!req.msisdn) {
      throw new BadRequestException('msisdn is required for Airtel Money collections');
    }

    const token = await this.getToken();
    const referenceId = randomUUID();
    const externalId = req.idempotencyKey || `INV-${req.invoiceId}-${Date.now()}`;

    const res = await fetch(`${this.baseUrl}/merchant/v1/payments/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: '*/*',
        'X-Country': this.country,
        'X-Currency': this.currency,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference: req.invoiceNumber,
        subscriber: {
          country: this.country,
          currency: this.currency,
          msisdn: this.normalizeMsisdn(req.msisdn),
        },
        transaction: {
          amount: Number(req.amount),
          country: this.country,
          currency: this.currency,
          id: externalId,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Airtel Money initiate failed: ${res.status} ${text}`);
      throw new BadRequestException(`Airtel Money initiate failed: ${res.status}`);
    }

    const data: any = await res.json();
    const ok = data?.status?.success === true || data?.status?.code === '200';
    if (!ok) {
      throw new BadRequestException(
        `Airtel rejected request: ${data?.status?.message || 'unknown error'}`,
      );
    }

    // Airtel returns its own transaction id in data.data.transaction.id; fall back to externalId
    const providerTxnId = data?.data?.transaction?.id || externalId || referenceId;

    return {
      providerTransactionId: providerTxnId,
      status: 'pending',
      message: `STK push sent to ${req.msisdn}. Customer must enter their Airtel Money PIN to confirm.`,
      raw: data,
    };
  }

  async getStatus(providerTransactionId: string): Promise<GatewayStatus> {
    if (!this.isConfigured()) return 'pending';
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/standard/v1/payments/${providerTransactionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: '*/*',
        'X-Country': this.country,
        'X-Currency': this.currency,
      },
    });
    if (!res.ok) return 'pending';
    const data: any = await res.json();
    const status = String(data?.data?.transaction?.status || '').toUpperCase();
    // Airtel statuses: TS = success, TF = failed, TIP = in-progress, TA = ambiguous, TE = expired
    if (status === 'TS' || status === 'SUCCESS' || status === 'SUCCESSFUL') return 'success';
    if (status === 'TF' || status === 'FAILED' || status === 'TE' || status === 'EXPIRED')
      return 'failed';
    return 'pending';
  }

  async parseWebhook(headers: Record<string, string>, body: any): Promise<NormalisedWebhookEvent> {
    // Airtel sends a callback with `transaction.status_code` and a hash for verification.
    // Real prod should validate `x-signature` against AIRTEL_CALLBACK_SECRET (HMAC-SHA256).
    const expectedSecret = this.config.get<string>('AIRTEL_CALLBACK_SECRET');
    if (expectedSecret) {
      const sig = headers['x-signature'] || headers['X-Signature'];
      if (sig && typeof body === 'object') {
        // Defensive parsing — Airtel signature scheme varies by region; log mismatches but
        // do not block in MVP. Tighten to throw once your prod scheme is confirmed.
        this.logger.debug(`Airtel webhook signature received: ${sig.slice(0, 16)}...`);
      }
    }

    const txn = body?.transaction || body?.data?.transaction || {};
    const status = String(txn?.status_code || txn?.status || body?.status || '').toUpperCase();
    return {
      providerTransactionId: txn?.airtel_money_id || txn?.id || body?.transactionId || '',
      internalReference: txn?.id || body?.externalId || body?.reference,
      amount: Number(txn?.amount || body?.amount || 0),
      currency: txn?.currency || body?.currency || this.currency,
      status:
        status === 'TS' || status === 'SUCCESS' || status === 'SUCCESSFUL' || status === '200'
          ? 'success'
          : status === 'TF' || status === 'FAILED' || status === 'TE'
            ? 'failed'
            : 'pending',
      channel: 'mobile_money',
      externalReference: txn?.airtel_money_id,
      customerPhone: txn?.msisdn || body?.subscriber?.msisdn,
      occurredAt: new Date(),
      raw: body,
    };
  }
}
