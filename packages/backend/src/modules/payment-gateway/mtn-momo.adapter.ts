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
 * MTN Mobile Money Collections API adapter.
 * Activation env vars:
 *   MTN_MOMO_BASE_URL          (default https://sandbox.momodeveloper.mtn.com)
 *   MTN_MOMO_PRIMARY_KEY       (subscription key)
 *   MTN_MOMO_API_USER_ID       (UUID)
 *   MTN_MOMO_API_KEY           (token)
 *   MTN_MOMO_TARGET_ENV        (sandbox | mtnuganda | mtn ... )
 *
 * Skeleton calls follow the public spec; live calls only happen when
 * isConfigured() returns true.
 */
@Injectable()
export class MtnMomoAdapter implements PaymentGatewayAdapter {
  private readonly logger = new Logger(MtnMomoAdapter.name);

  readonly providerKey = 'mtn-momo';
  readonly displayName = 'MTN Mobile Money';
  readonly supportedChannels: GatewayChannel[] = ['mobile_money'];

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get('MTN_MOMO_PRIMARY_KEY') &&
      this.config.get('MTN_MOMO_API_USER_ID') &&
      this.config.get('MTN_MOMO_API_KEY'),
    );
  }

  private get baseUrl(): string {
    return this.config.get<string>('MTN_MOMO_BASE_URL') || 'https://sandbox.momodeveloper.mtn.com';
  }

  private async getToken(): Promise<string> {
    const userId = this.config.get<string>('MTN_MOMO_API_USER_ID')!;
    const apiKey = this.config.get<string>('MTN_MOMO_API_KEY')!;
    const basic = Buffer.from(`${userId}:${apiKey}`).toString('base64');
    const res = await fetch(`${this.baseUrl}/collection/token/`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Ocp-Apim-Subscription-Key': this.config.get<string>('MTN_MOMO_PRIMARY_KEY')!,
      },
    });
    if (!res.ok) throw new BadRequestException(`MTN MoMo token failed: ${res.status}`);
    const data: any = await res.json();
    return data.access_token;
  }

  async initiate(req: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
    if (!this.isConfigured()) {
      throw new BadRequestException('MTN MoMo is not configured on this server');
    }
    if (!req.msisdn) {
      throw new BadRequestException('msisdn is required for MTN MoMo collections');
    }

    const token = await this.getToken();
    const referenceId = randomUUID();

    const res = await fetch(`${this.baseUrl}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': this.config.get<string>('MTN_MOMO_TARGET_ENV') || 'sandbox',
        'Ocp-Apim-Subscription-Key': this.config.get<string>('MTN_MOMO_PRIMARY_KEY')!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(req.amount),
        currency: req.currency,
        externalId: req.idempotencyKey || `INV-${req.invoiceId}-${Date.now()}`,
        payer: { partyIdType: 'MSISDN', partyId: req.msisdn },
        payerMessage: `Payment for invoice ${req.invoiceNumber}`,
        payeeNote: req.description || 'Hospital invoice',
      }),
    });
    if (!(res.status === 202 || res.ok)) {
      const text = await res.text();
      this.logger.error(`MTN MoMo requesttopay failed: ${res.status} ${text}`);
      throw new BadRequestException(`MTN MoMo initiate failed: ${res.status}`);
    }
    return {
      providerTransactionId: referenceId,
      status: 'pending',
      message: `STK push sent to ${req.msisdn}. Customer must approve on their phone.`,
    };
  }

  async getStatus(providerTransactionId: string): Promise<GatewayStatus> {
    if (!this.isConfigured()) return 'pending';
    const token = await this.getToken();
    const res = await fetch(
      `${this.baseUrl}/collection/v1_0/requesttopay/${providerTransactionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Target-Environment': this.config.get<string>('MTN_MOMO_TARGET_ENV') || 'sandbox',
          'Ocp-Apim-Subscription-Key': this.config.get<string>('MTN_MOMO_PRIMARY_KEY')!,
        },
      },
    );
    if (!res.ok) return 'pending';
    const data: any = await res.json();
    const status = String(data?.status || '').toUpperCase();
    if (status === 'SUCCESSFUL') return 'success';
    if (status === 'FAILED') return 'failed';
    if (status === 'PENDING') return 'pending';
    return 'pending';
  }

  async parseWebhook(_headers: Record<string, string>, body: any): Promise<NormalisedWebhookEvent> {
    const status = String(body?.status || '').toUpperCase();
    return {
      providerTransactionId: body?.referenceId || body?.financialTransactionId,
      internalReference: body?.externalId,
      amount: Number(body?.amount || 0),
      currency: body?.currency || 'UGX',
      status: status === 'SUCCESSFUL' ? 'success' : status === 'FAILED' ? 'failed' : 'pending',
      channel: 'mobile_money',
      externalReference: body?.financialTransactionId,
      customerPhone: body?.payer?.partyId,
      occurredAt: new Date(),
      raw: body,
    };
  }
}
