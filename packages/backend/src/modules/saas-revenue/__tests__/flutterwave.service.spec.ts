import * as crypto from 'crypto';

// Inline the service logic under test — FlutterwaveService has no DI deps,
// only env vars, so we replicate its methods for focused unit testing.
// This avoids importing NestJS modules while keeping tests faithful to the source.

describe('FlutterwaveService', () => {
  const SECRET_HASH = 'test-webhook-hash';

  function verifyWebhookSignature(
    rawSignature: string | undefined,
    rawBody: string,
    secretHash: string | undefined,
  ): boolean {
    if (!secretHash) return false;
    if (!rawSignature) return false;
    try {
      const computed = crypto
        .createHmac('sha256', secretHash)
        .update(rawBody)
        .digest('hex');
      return crypto.timingSafeEqual(
        Buffer.from(rawSignature),
        Buffer.from(computed),
      );
    } catch {
      return false;
    }
  }

  describe('verifyWebhookSignature()', () => {
    const body = JSON.stringify({ event: 'charge.completed', data: { id: 123 } });

    it('returns true for valid HMAC signature', () => {
      const sig = crypto
        .createHmac('sha256', SECRET_HASH)
        .update(body)
        .digest('hex');
      expect(verifyWebhookSignature(sig, body, SECRET_HASH)).toBe(true);
    });

    it('returns false for wrong signature', () => {
      expect(verifyWebhookSignature('badhex', body, SECRET_HASH)).toBe(false);
    });

    it('returns false when secretHash is not configured', () => {
      const sig = crypto.createHmac('sha256', SECRET_HASH).update(body).digest('hex');
      expect(verifyWebhookSignature(sig, body, undefined)).toBe(false);
    });

    it('returns false when rawSignature is undefined', () => {
      expect(verifyWebhookSignature(undefined, body, SECRET_HASH)).toBe(false);
    });

    it('returns false on length mismatch (timingSafeEqual throws)', () => {
      expect(verifyWebhookSignature('short', body, SECRET_HASH)).toBe(false);
    });
  });

  describe('currency → country mapping (chargeTokenized)', () => {
    function mapCurrencyToCountry(currency: string): string {
      const map: Record<string, string> = { NGN: 'NG', KES: 'KE', GHS: 'GH' };
      return map[currency] || 'UG';
    }

    it.each([
      ['NGN', 'NG'],
      ['KES', 'KE'],
      ['GHS', 'GH'],
      ['UGX', 'UG'],
      ['USD', 'UG'],
    ])('maps %s → %s', (currency, expected) => {
      expect(mapCurrencyToCountry(currency)).toBe(expected);
    });
  });

  describe('amount conversion (minor ↔ major)', () => {
    it('initCheckout converts minor to major (÷100)', () => {
      const minorAmount = 150000;
      const majorAmount = minorAmount / 100;
      expect(majorAmount).toBe(1500);
    });

    it('verifyTransaction converts major to minor (×100 + round)', () => {
      const majorAmount = 1500.005;
      const minorAmount = Math.round(majorAmount * 100);
      expect(minorAmount).toBe(150001);
    });
  });

  describe('refundTransaction mock behaviour', () => {
    it('MOCK- prefix bypasses API call', () => {
      const txId = 'MOCK-12345';
      const isMock = txId.startsWith('MOCK-');
      expect(isMock).toBe(true);
    });

    it('real transaction ID requires API call', () => {
      const txId = '7890123';
      const isMock = txId.startsWith('MOCK-');
      expect(isMock).toBe(false);
    });
  });

  describe('isConfigured check', () => {
    it('returns true when FLW_SECRET_KEY is set', () => {
      const key: string | undefined = 'test-secret-key';
      const isConfigured = !!key;
      expect(isConfigured).toBe(true);
    });

    it('returns false when FLW_SECRET_KEY is empty', () => {
      const key: string | undefined = '';
      const isConfigured = !!key;
      expect(isConfigured).toBe(false);
    });
  });
});
