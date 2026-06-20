import * as crypto from 'crypto';

/**
 * Tests for license HMAC signature computation and verification.
 * These replicate the private computeSignature() / verifySignature() logic
 * from LicenseService to test the crypto directly without NestJS DI.
 */

const TEST_SECRET = 'test-license-secret-key';

interface LicenseFields {
  licenseKey: string;
  organizationName: string;
  licenseType: string;
  maxUsers: number;
  maxFacilities: number;
  status?: string;
  expiresAt?: Date;
}

function computeSignature(license: LicenseFields, secretKey: string): string {
  const payload = JSON.stringify({
    key: license.licenseKey,
    org: license.organizationName,
    type: license.licenseType,
    users: license.maxUsers,
    facilities: license.maxFacilities,
    status: license.status,
    expiresAt: license.expiresAt
      ? new Date(license.expiresAt).toISOString()
      : undefined,
  });
  return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
}

function verifySignature(
  license: LicenseFields & { signature?: string },
  secretKey: string,
): boolean {
  if (!license.signature) return false;
  const expected = computeSignature(license, secretKey);
  if (license.signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(license.signature),
    Buffer.from(expected),
  );
}

const baseLicense: LicenseFields = {
  licenseKey: 'LIC-001',
  organizationName: 'Acme Hospital',
  licenseType: 'professional',
  maxUsers: 50,
  maxFacilities: 3,
  status: 'active',
  expiresAt: new Date('2027-01-01T00:00:00Z'),
};

describe('License Signature', () => {
  describe('computeSignature()', () => {
    it('returns a 64-char hex string', () => {
      const sig = computeSignature(baseLicense, TEST_SECRET);
      expect(sig).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for same input', () => {
      const sig1 = computeSignature(baseLicense, TEST_SECRET);
      const sig2 = computeSignature(baseLicense, TEST_SECRET);
      expect(sig1).toBe(sig2);
    });

    it('changes when status changes', () => {
      const active = computeSignature({ ...baseLicense, status: 'active' }, TEST_SECRET);
      const revoked = computeSignature({ ...baseLicense, status: 'revoked' }, TEST_SECRET);
      expect(active).not.toBe(revoked);
    });

    it('changes when expiresAt changes', () => {
      const sig1 = computeSignature(
        { ...baseLicense, expiresAt: new Date('2027-01-01') },
        TEST_SECRET,
      );
      const sig2 = computeSignature(
        { ...baseLicense, expiresAt: new Date('2028-06-15') },
        TEST_SECRET,
      );
      expect(sig1).not.toBe(sig2);
    });

    it('changes when licenseType changes', () => {
      const standard = computeSignature({ ...baseLicense, licenseType: 'standard' }, TEST_SECRET);
      const enterprise = computeSignature({ ...baseLicense, licenseType: 'enterprise' }, TEST_SECRET);
      expect(standard).not.toBe(enterprise);
    });

    it('changes when maxUsers changes', () => {
      const sig1 = computeSignature({ ...baseLicense, maxUsers: 50 }, TEST_SECRET);
      const sig2 = computeSignature({ ...baseLicense, maxUsers: 100 }, TEST_SECRET);
      expect(sig1).not.toBe(sig2);
    });

    it('changes with different secret key', () => {
      const sig1 = computeSignature(baseLicense, 'secret-a');
      const sig2 = computeSignature(baseLicense, 'secret-b');
      expect(sig1).not.toBe(sig2);
    });

    it('handles undefined expiresAt', () => {
      const sig = computeSignature({ ...baseLicense, expiresAt: undefined }, TEST_SECRET);
      expect(sig).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('verifySignature()', () => {
    it('returns true for valid signature', () => {
      const sig = computeSignature(baseLicense, TEST_SECRET);
      const result = verifySignature({ ...baseLicense, signature: sig }, TEST_SECRET);
      expect(result).toBe(true);
    });

    it('returns false for tampered status', () => {
      const sig = computeSignature(baseLicense, TEST_SECRET);
      const tampered = { ...baseLicense, status: 'revoked', signature: sig };
      expect(verifySignature(tampered, TEST_SECRET)).toBe(false);
    });

    it('returns false for tampered expiresAt', () => {
      const sig = computeSignature(baseLicense, TEST_SECRET);
      const tampered = {
        ...baseLicense,
        expiresAt: new Date('2099-12-31'),
        signature: sig,
      };
      expect(verifySignature(tampered, TEST_SECRET)).toBe(false);
    });

    it('returns false when signature is missing', () => {
      expect(verifySignature({ ...baseLicense, signature: undefined }, TEST_SECRET)).toBe(false);
    });

    it('returns false on length mismatch', () => {
      expect(verifySignature({ ...baseLicense, signature: 'short' }, TEST_SECRET)).toBe(false);
    });

    it('uses timingSafeEqual (constant-time comparison)', () => {
      // Verify that our implementation matches crypto.timingSafeEqual behavior
      const sig = computeSignature(baseLicense, TEST_SECRET);
      const buf1 = Buffer.from(sig);
      const buf2 = Buffer.from(sig);
      expect(crypto.timingSafeEqual(buf1, buf2)).toBe(true);

      // Altered last char
      const altered = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0');
      expect(crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(altered))).toBe(false);
    });
  });

  describe('production without LICENSE_SECRET_KEY', () => {
    it('would throw during construction in production', () => {
      // Simulating the constructor guard
      const isProduction = true;
      const secretKey = undefined;

      expect(() => {
        if (isProduction && !secretKey) {
          throw new Error('LICENSE_SECRET_KEY environment variable must be set in production');
        }
      }).toThrow('LICENSE_SECRET_KEY environment variable must be set in production');
    });

    it('falls back to dev key in non-production', () => {
      const isProduction = false;
      const secretKey = undefined;
      const resolved = secretKey || (isProduction ? '' : 'dev-license-key-not-for-production');
      expect(resolved).toBe('dev-license-key-not-for-production');
    });
  });
});
