import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentGatewayAdapter,
  GatewayChannel,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  NormalisedWebhookEvent,
  GatewayStatus,
} from './payment-gateway.types';

/**
 * Sandbox / mock adapter. Always available (no credentials). Useful for
 * development and demo environments. In production, a real provider
 * (Pesapal, MTN MoMo, Airtel Money) is plugged in via PaymentGatewayService.
 *
 * Behaviour:
 *  - initiate(): returns "pending" immediately, with a synthetic id.
 *  - getStatus(): always returns "success" (sandbox is optimistic).
 *  - parseWebhook(): expects the body shape we emit ourselves in tests.
 */
@Injectable()
export class SandboxGatewayAdapter implements PaymentGatewayAdapter {
  private readonly logger = new Logger(SandboxGatewayAdapter.name);

  readonly providerKey = 'sandbox';
  readonly displayName = 'Sandbox (test)';
  readonly supportedChannels: GatewayChannel[] = ['card', 'mobile_money', 'bank_transfer'];

  isConfigured(): boolean {
    return true;
  }

  async initiate(req: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
    const providerTransactionId = `SBX-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.logger.log(
      `[sandbox] initiate ${req.channel} ${req.amount} ${req.currency} for invoice=${req.invoiceNumber}`,
    );
    return {
      providerTransactionId,
      status: 'pending',
      redirectUrl:
        req.channel === 'card'
          ? `${req.callbackUrl || ''}?providerTxn=${providerTransactionId}&status=success`
          : undefined,
      message:
        req.channel === 'mobile_money'
          ? `Sandbox: STK push simulated to ${req.msisdn || 'unknown'}. Webhook will fire shortly.`
          : 'Sandbox redirect URL ready',
    };
  }

  async getStatus(_providerTransactionId: string): Promise<GatewayStatus> {
    return 'success';
  }

  async parseWebhook(
    _headers: Record<string, string>,
    body: any,
  ): Promise<NormalisedWebhookEvent> {
    return {
      providerTransactionId: body?.providerTransactionId || `SBX-${Date.now()}`,
      invoiceId: body?.invoiceId,
      internalReference: body?.internalReference,
      amount: Number(body?.amount || 0),
      currency: body?.currency || 'UGX',
      status: (body?.status || 'success') as GatewayStatus,
      channel: (body?.channel || 'mobile_money') as GatewayChannel,
      externalReference: body?.externalReference,
      customerPhone: body?.customerPhone,
      customerEmail: body?.customerEmail,
      occurredAt: new Date(body?.occurredAt || Date.now()),
      raw: body,
    };
  }
}
