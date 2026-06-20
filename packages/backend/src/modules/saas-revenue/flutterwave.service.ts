import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface FlutterwaveInitArgs {
  txRef: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  redirectUrl: string;
  meta?: Record<string, any>;
}

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);
  private secretKey = process.env.FLW_SECRET_KEY;
  private secretHash = process.env.FLW_WEBHOOK_HASH;
  private base = process.env.FLW_BASE_URL || 'https://api.flutterwave.com/v3';

  isConfigured() { return !!this.secretKey; }

  async initCheckout(args: FlutterwaveInitArgs): Promise<{ link: string; provider: 'flutterwave' | 'mock' }> {
    if (!this.isConfigured()) {
      this.logger.warn('FLW_SECRET_KEY not set — returning mock checkout link for dev');
      const link = `${args.redirectUrl}?status=successful&tx_ref=${encodeURIComponent(args.txRef)}&transaction_id=MOCK-${Date.now()}`;
      return { link, provider: 'mock' };
    }
    const body = {
      tx_ref: args.txRef,
      amount: args.amount / 100,
      currency: args.currency,
      redirect_url: args.redirectUrl,
      customer: { email: args.customerEmail, name: args.customerName },
      meta: args.meta || {},
      payment_options: 'card,mobilemoneyuganda,mobilemoneyrwanda,mobilemoneyghana,mpesa,banktransfer',
      customizations: { title: 'Glide-HIMS subscription', description: args.meta?.description ?? 'Subscription payment' },
    };
    const res = await fetch(`${this.base}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: any = await res.json();
    if (!res.ok || json.status !== 'success' || !json.data?.link) {
      this.logger.error(`Flutterwave init failed: ${JSON.stringify(json)}`);
      throw new BadRequestException(json.message || 'Failed to initiate Flutterwave checkout');
    }
    return { link: json.data.link, provider: 'flutterwave' };
  }

  verifyWebhookSignature(rawSignature: string | undefined, rawBody: string): boolean {
    if (!this.secretHash) {
      this.logger.error('FLW_WEBHOOK_HASH not configured — rejecting webhook. Set the env var to accept Flutterwave webhooks.');
      return false;
    }
    if (!rawSignature) return false;
    const computed = crypto.createHmac('sha256', this.secretHash).update(rawBody).digest('hex');
    try { return crypto.timingSafeEqual(Buffer.from(rawSignature), Buffer.from(computed)); }
    catch { return false; }
  }

  async verifyTransaction(transactionId: string | number): Promise<{ ok: boolean; amount?: number; currency?: string; status?: string; tx_ref?: string; raw?: any }> {
    if (!this.isConfigured() || String(transactionId).startsWith('MOCK-')) {
      return { ok: true, status: 'successful', raw: { mock: true } };
    }
    const res = await fetch(`${this.base}/transactions/${transactionId}/verify`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    const json: any = await res.json();
    if (!res.ok || json.status !== 'success') return { ok: false, raw: json };
    const d = json.data;
    return { ok: d?.status === 'successful', amount: Math.round((d?.amount ?? 0) * 100), currency: d?.currency, status: d?.status, tx_ref: d?.tx_ref, raw: d };
  }

  async refundTransaction(transactionId: string, amountMajor: number): Promise<{ ok: boolean; refundId?: string; error?: string }> {
    if (!this.isConfigured() || String(transactionId).startsWith('MOCK-')) {
      this.logger.warn('FLW_SECRET_KEY not set or mock transaction — returning mock refund');
      return { ok: true, refundId: `MOCK-REFUND-${Date.now()}` };
    }
    try {
      const res = await fetch(`${this.base}/transactions/${transactionId}/refund`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountMajor }),
      });
      const json: any = await res.json();
      if (!res.ok || json.status !== 'success') {
        this.logger.error(`Flutterwave refund failed: ${JSON.stringify(json)}`);
        return { ok: false, error: json.message || 'Refund request failed' };
      }
      return { ok: true, refundId: String(json.data?.id ?? '') };
    } catch (e: any) {
      this.logger.error(`Flutterwave refund error: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  /**
   * Charge a previously-saved card token via Flutterwave's /tokenized-charges endpoint.
   * Returns the new transaction id on success so the caller can poll/verify and the
   * webhook (charge.completed) can finalise the payment.
   */
  async chargeTokenized(args: {
    token: string;
    txRef: string;
    amountMinor: number;
    currency: string;
    customerEmail: string;
    customerName?: string;
    narration?: string;
    meta?: Record<string, any>;
  }): Promise<{ ok: boolean; transactionId?: string | number; status?: string; raw?: any }> {
    if (!this.isConfigured()) {
      this.logger.warn('FLW_SECRET_KEY not set — returning mock tokenized charge');
      return { ok: true, transactionId: `MOCK-${Date.now()}`, status: 'successful', raw: { mock: true } };
    }
    const body: any = {
      token: args.token,
      currency: args.currency,
      country: args.currency === 'NGN' ? 'NG' : args.currency === 'KES' ? 'KE' : args.currency === 'GHS' ? 'GH' : 'UG',
      amount: args.amountMinor / 100,
      email: args.customerEmail,
      first_name: (args.customerName || '').split(' ')[0] || 'Customer',
      last_name: (args.customerName || '').split(' ').slice(1).join(' ') || '',
      tx_ref: args.txRef,
      narration: args.narration || 'Subscription auto-renewal',
      meta: args.meta || {},
    };
    const res = await fetch(`${this.base}/tokenized-charges`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: any = await res.json();
    if (!res.ok || json.status !== 'success') {
      this.logger.error(`Flutterwave tokenized charge failed: ${JSON.stringify(json)}`);
      return { ok: false, raw: json };
    }
    return { ok: json.data?.status === 'successful' || json.data?.status === 'pending', transactionId: json.data?.id, status: json.data?.status, raw: json.data };
  }
}
