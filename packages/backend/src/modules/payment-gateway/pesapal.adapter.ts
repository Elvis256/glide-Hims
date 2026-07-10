import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentGatewayAdapter,
  GatewayChannel,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  NormalisedWebhookEvent,
  GatewayStatus,
} from './payment-gateway.types';

/**
 * Pesapal v3 adapter (Uganda / Kenya / Tanzania card + mobile money).
 *
 * Activation: set PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET,
 * PESAPAL_CALLBACK_URL, optional PESAPAL_NOTIFICATION_ID and PESAPAL_BASE_URL.
 * When unset, isConfigured() returns false and PaymentGatewayService falls
 * back to the sandbox adapter.
 *
 * The HTTP calls are kept skeletal: a real deployment plugs in fetch/axios
 * with the API tokens. We avoid making live requests when not configured
 * to keep CI deterministic.
 */
@Injectable()
export class PesapalAdapter implements PaymentGatewayAdapter {
  private readonly logger = new Logger(PesapalAdapter.name);

  readonly providerKey = 'pesapal';
  readonly displayName = 'Pesapal';
  readonly supportedChannels: GatewayChannel[] = ['card', 'mobile_money'];

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get('PESAPAL_CONSUMER_KEY') && this.config.get('PESAPAL_CONSUMER_SECRET'),
    );
  }

  private get baseUrl(): string {
    return this.config.get<string>('PESAPAL_BASE_URL') || 'https://pay.pesapal.com/v3/api';
  }

  private async getAuthToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        consumer_key: this.config.get('PESAPAL_CONSUMER_KEY'),
        consumer_secret: this.config.get('PESAPAL_CONSUMER_SECRET'),
      }),
    });
    if (!res.ok) {
      throw new BadRequestException(`Pesapal auth failed: ${res.status}`);
    }
    const data: any = await res.json();
    if (!data?.token) throw new BadRequestException('Pesapal auth: no token returned');
    return data.token;
  }

  async initiate(req: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Pesapal is not configured on this server');
    }
    const token = await this.getAuthToken();
    const merchantReference = req.idempotencyKey || `INV-${req.invoiceId}-${Date.now()}`;
    const callbackUrl = req.callbackUrl || this.config.get<string>('PESAPAL_CALLBACK_URL') || '';

    const res = await fetch(`${this.baseUrl}/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: merchantReference,
        currency: req.currency,
        amount: req.amount,
        description: req.description || `Invoice ${req.invoiceNumber}`,
        callback_url: callbackUrl,
        notification_id: this.config.get('PESAPAL_NOTIFICATION_ID'),
        billing_address: {
          email_address: req.customer.email,
          phone_number: req.customer.phone || req.msisdn,
          first_name: req.customer.name,
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Pesapal SubmitOrderRequest failed: ${res.status} ${text}`);
      throw new BadRequestException(`Pesapal initiate failed: ${res.status}`);
    }
    const data: any = await res.json();
    return {
      providerTransactionId: data?.order_tracking_id || merchantReference,
      status: 'pending',
      redirectUrl: data?.redirect_url,
      message: 'Redirect customer to Pesapal',
      raw: data,
    };
  }

  async getStatus(providerTransactionId: string): Promise<GatewayStatus> {
    if (!this.isConfigured()) return 'pending';
    const token = await this.getAuthToken();
    const res = await fetch(
      `${this.baseUrl}/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(
        providerTransactionId,
      )}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    if (!res.ok) return 'pending';
    const data: any = await res.json();
    const code = String(data?.status_code ?? data?.payment_status_description ?? '').toUpperCase();
    if (code.includes('COMPLETED') || code === '1') return 'success';
    if (code.includes('FAILED') || code === '2') return 'failed';
    if (code.includes('REVERSED') || code === '3') return 'cancelled';
    return 'pending';
  }

  async parseWebhook(_headers: Record<string, string>, body: any): Promise<NormalisedWebhookEvent> {
    // Pesapal IPN gives orderTrackingId + orderMerchantReference; we re-fetch status.
    const trackingId = body?.OrderTrackingId || body?.orderTrackingId;
    const status = trackingId ? await this.getStatus(trackingId) : 'pending';
    return {
      providerTransactionId: trackingId,
      internalReference: body?.OrderMerchantReference || body?.orderMerchantReference,
      amount: Number(body?.amount || 0),
      currency: body?.currency || 'UGX',
      status,
      channel: 'card',
      externalReference: body?.confirmationCode || body?.payment_method,
      occurredAt: new Date(),
      raw: body,
    };
  }
}
