import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { minorToMajor, majorToMinor } from './currency-utils';

export interface PesapalInitArgs {
  txRef: string;
  amount: number; // minor units (cents)
  currency: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  callbackUrl: string;
  description?: string;
  /** When provided, Pesapal links the order to a recurring subscription token tied to this account_number. */
  accountNumber?: string;
  /** When provided alongside accountNumber, Pesapal will auto-debit on cycle (DAILY|WEEKLY|MONTHLY|YEARLY). */
  subscription?: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    startDate?: string;
    endDate?: string;
  };
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

@Injectable()
export class PesapalService {
  private readonly logger = new Logger(PesapalService.name);
  private consumerKey = process.env.PESAPAL_CONSUMER_KEY;
  private consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
  private base =
    process.env.PESAPAL_BASE_URL ||
    (process.env.PESAPAL_ENV === 'production'
      ? 'https://pay.pesapal.com/v3'
      : 'https://cybqa.pesapal.com/pesapalv3');
  private ipnUrlOverride = process.env.PESAPAL_IPN_URL;
  private cachedIpnId: string | null = process.env.PESAPAL_IPN_ID || null;
  private cachedToken: CachedToken | null = null;

  isConfigured(): boolean {
    return !!(this.consumerKey && this.consumerSecret);
  }

  status() {
    return {
      configured: this.isConfigured(),
      env: process.env.PESAPAL_ENV === 'production' ? 'production' : 'sandbox',
      base: this.base,
      ipnRegistered: !!this.cachedIpnId,
    };
  }

  private async authToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000)
      return this.cachedToken.token;
    const res = await fetch(`${this.base}/api/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret,
      }),
    });
    const json: any = await res.json();
    if (!res.ok || !json.token) {
      this.logger.error(`Pesapal auth failed: ${JSON.stringify(json)}`);
      throw new BadRequestException(json.error?.message || json.message || 'Pesapal auth failed');
    }
    this.cachedToken = { token: json.token, expiresAt: Date.now() + 4 * 60_000 };
    return json.token;
  }

  private async ensureIpnId(token: string, fallbackOriginUrl?: string): Promise<string> {
    if (this.cachedIpnId) return this.cachedIpnId;
    const url =
      this.ipnUrlOverride ||
      (fallbackOriginUrl
        ? `${fallbackOriginUrl.replace(/\/+$/, '')}/api/v1/saas-revenue/webhooks/pesapal`
        : null);
    if (!url)
      throw new BadRequestException(
        'PESAPAL_IPN_URL not set and no origin available to register IPN',
      );
    const res = await fetch(`${this.base}/api/URLSetup/RegisterIPN`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url, ipn_notification_type: 'GET' }),
    });
    const json: any = await res.json();
    if (!res.ok || !json.ipn_id) {
      this.logger.error(`Pesapal IPN register failed: ${JSON.stringify(json)}`);
      throw new BadRequestException(json.error?.message || 'Failed to register Pesapal IPN');
    }
    this.cachedIpnId = json.ipn_id;
    return this.cachedIpnId!;
  }

  async initCheckout(
    args: PesapalInitArgs,
    originUrl?: string,
  ): Promise<{ link: string; provider: 'pesapal' | 'mock'; orderTrackingId?: string }> {
    if (!this.isConfigured()) {
      this.logger.warn('PESAPAL_CONSUMER_KEY not set — returning mock checkout link for dev');
      const link = `${args.callbackUrl}?status=COMPLETED&OrderTrackingId=MOCK-${Date.now()}&OrderMerchantReference=${encodeURIComponent(args.txRef)}`;
      return { link, provider: 'mock', orderTrackingId: `MOCK-${Date.now()}` };
    }
    const token = await this.authToken();
    const ipnId = await this.ensureIpnId(token, originUrl);
    const [first, ...rest] = (args.customerName || '').trim().split(/\s+/);
    const body: any = {
      id: args.txRef,
      currency: args.currency,
      amount: minorToMajor(args.amount, args.currency),
      description: (args.description || 'Glide-HIMS subscription').slice(0, 100),
      callback_url: args.callbackUrl,
      notification_id: ipnId,
      billing_address: {
        email_address: args.customerEmail,
        phone_number: args.customerPhone || '',
        first_name: first || 'Customer',
        last_name: rest.join(' ') || '',
      },
    };
    if (args.accountNumber) {
      // Pesapal token-binding identifier; future orders with the same account_number
      // get charged against the same saved card / mobile money wallet.
      body.account_number = args.accountNumber;
      body.billing_address.account_number = args.accountNumber;
    }
    if (args.subscription && args.accountNumber) {
      const fmt = (d: Date) =>
        `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      const start = args.subscription.startDate
        ? new Date(args.subscription.startDate)
        : new Date();
      const end = args.subscription.endDate
        ? new Date(args.subscription.endDate)
        : new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000);
      body.account_number = args.accountNumber;
      body.subscription_details = {
        start_date: fmt(start),
        end_date: fmt(end),
        frequency: args.subscription.frequency,
      };
    }
    const res = await fetch(`${this.base}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json: any = await res.json();
    if (!res.ok || !json.redirect_url) {
      this.logger.error(`Pesapal SubmitOrder failed: ${JSON.stringify(json)}`);
      throw new BadRequestException(
        json.error?.message || json.message || 'Failed to initiate Pesapal checkout',
      );
    }
    return {
      link: json.redirect_url,
      provider: 'pesapal',
      orderTrackingId: json.order_tracking_id,
    };
  }

  async verifyTransaction(orderTrackingId: string): Promise<{
    ok: boolean;
    amount?: number;
    currency?: string;
    status?: string;
    merchantReference?: string;
    raw?: any;
  }> {
    if (!this.isConfigured() && String(orderTrackingId).startsWith('MOCK-')) {
      return { ok: true, status: 'COMPLETED', raw: { mock: true } };
    }
    if (!this.isConfigured()) {
      return { ok: false, status: 'NOT_CONFIGURED', raw: { error: 'Pesapal not configured' } };
    }
    const token = await this.authToken();
    const res = await fetch(
      `${this.base}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      },
    );
    const json: any = await res.json();
    if (!res.ok) return { ok: false, raw: json };
    // status_code: 0=INVALID, 1=COMPLETED, 2=FAILED, 3=REVERSED
    const completed = json.status_code === 1 || json.payment_status_description === 'Completed';
    return {
      ok: completed,
      status: json.payment_status_description,
      amount:
        typeof json.amount === 'number'
          ? majorToMinor(json.amount, json.currency || json.currency_code || '')
          : undefined,
      currency: json.currency || json.currency_code,
      merchantReference: json.merchant_reference,
      raw: json,
    };
  }
}
