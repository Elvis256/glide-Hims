import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SandboxGatewayAdapter } from './sandbox.adapter';
import { PesapalAdapter } from './pesapal.adapter';
import { MtnMomoAdapter } from './mtn-momo.adapter';
import { AirtelMoneyAdapter } from './airtel-money.adapter';
import {
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  NormalisedWebhookEvent,
  PaymentGatewayAdapter,
  GatewayStatus,
} from './payment-gateway.types';
import { BillingService } from '../billing/billing.service';
import { PaymentMethod } from '../../database/entities/invoice.entity';

/**
 * Single entrypoint for payment-gateway orchestration. Picks the right
 * adapter for the requested provider, falls back to sandbox if the
 * provider is not configured, and bridges webhook events into BillingService.
 */
@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);
  private readonly adapters: Map<string, PaymentGatewayAdapter>;
  constructor(
    private readonly config: ConfigService,
    private readonly sandbox: SandboxGatewayAdapter,
    private readonly pesapal: PesapalAdapter,
    private readonly mtn: MtnMomoAdapter,
    private readonly airtel: AirtelMoneyAdapter,
    @Inject(forwardRef(() => BillingService))
    private readonly billing: BillingService,
  ) {
    this.adapters = new Map<string, PaymentGatewayAdapter>([
      [sandbox.providerKey, sandbox],
      [pesapal.providerKey, pesapal],
      [mtn.providerKey, mtn],
      [airtel.providerKey, airtel],
    ]);
  }

  listProviders(): { key: string; name: string; configured: boolean; channels: string[] }[] {
    return Array.from(this.adapters.values()).map((a) => ({
      key: a.providerKey,
      name: a.displayName,
      configured: a.isConfigured(),
      channels: a.supportedChannels,
    }));
  }

  private resolveAdapter(provider?: string): PaymentGatewayAdapter {
    if (provider && this.adapters.has(provider)) {
      const a = this.adapters.get(provider)!;
      if (!a.isConfigured()) {
        this.logger.warn(`Provider ${provider} not configured; falling back to sandbox`);
        return this.sandbox;
      }
      return a;
    }
    // Auto-pick: prefer first configured non-sandbox; else sandbox.
    for (const a of this.adapters.values()) {
      if (a.providerKey !== 'sandbox' && a.isConfigured()) return a;
    }
    return this.sandbox;
  }

  async initiate(
    provider: string | undefined,
    req: InitiatePaymentRequest,
  ): Promise<InitiatePaymentResponse & { provider: string }> {
    const adapter = this.resolveAdapter(provider);
    const result = await adapter.initiate(req);
    return { ...result, provider: adapter.providerKey };
  }

  /**
   * Poll the gateway for the current status of a previously-initiated payment.
   * Used by the front-end to show "waiting for customer to approve" → success/failure.
   */
  async getStatus(
    providerKey: string,
    providerTransactionId: string,
  ): Promise<{ provider: string; status: GatewayStatus }> {
    const adapter = this.adapters.get(providerKey);
    if (!adapter) {
      throw new BadRequestException(`Unknown payment provider: ${providerKey}`);
    }
    const status = await adapter.getStatus(providerTransactionId);
    return { provider: adapter.providerKey, status };
  }

  /**
   * Called by the webhook controller. Normalises the payload via the right
   * adapter and, if the event is a successful payment for a known invoice,
   * records it on the billing side. Returns the normalised event so the
   * provider-side ack can include details for debugging.
   */
  async handleWebhook(
    providerKey: string,
    headers: Record<string, string>,
    body: any,
  ): Promise<NormalisedWebhookEvent> {
    const adapter = this.adapters.get(providerKey);
    if (!adapter) {
      throw new BadRequestException(`Unknown payment provider: ${providerKey}`);
    }
    const event = await adapter.parseWebhook(headers, body);
    this.logger.log(
      `[gateway:${providerKey}] webhook ${event.status} amount=${event.amount} ref=${event.providerTransactionId}`,
    );

    if (event.status !== 'success') {
      return event;
    }
    // If the gateway gave us back the internalReference (our INV-... or idempotencyKey),
    // we can settle the invoice here. We require either invoiceId or internalReference.
    const invoiceId = event.invoiceId || this.parseInvoiceIdFromInternalRef(event.internalReference);
    if (!invoiceId) {
      this.logger.warn(`Webhook accepted but no invoiceId found in payload`);
      return event;
    }
    try {
      await this.billing.recordPayment(
        {
          invoiceId,
          amount: event.amount,
          method:
            event.channel === 'card'
              ? PaymentMethod.CARD
              : event.channel === 'bank_transfer'
                ? PaymentMethod.BANK_TRANSFER
                : PaymentMethod.MOBILE_MONEY,
          transactionReference:
            event.externalReference || event.providerTransactionId,
          receivedById: 'gateway',
          notes: `Auto-recorded via ${providerKey} webhook`,
        } as any,
        'gateway',
        // Tenant must be derived inside billing; webhook payload may not carry it.
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to record gateway payment for invoice ${invoiceId}: ${err.message}`,
      );
    }
    return event;
  }

  private parseInvoiceIdFromInternalRef(ref?: string): string | undefined {
    if (!ref) return undefined;
    const m = ref.match(/^INV-([0-9a-fA-F-]{36})/);
    return m?.[1];
  }
}
