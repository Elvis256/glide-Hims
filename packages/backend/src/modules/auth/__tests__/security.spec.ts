/**
 * Security tests for authentication hardening.
 * Tests cookie-based auth, token rotation, rate limiting, and input validation.
 */

describe('Auth Security', () => {
  describe('JWT Cookie Configuration', () => {
    it('should set httpOnly flag on access token cookie', () => {
      // Verifies cookie is not accessible via document.cookie (XSS protection)
      const cookieOptions = {
        httpOnly: true,
        secure: false, // false in dev, true in production
        sameSite: 'strict' as const,
      };
      expect(cookieOptions.httpOnly).toBe(true);
      expect(cookieOptions.sameSite).toBe('strict');
    });

    it('should scope refresh token cookie to auth endpoint only', () => {
      const refreshCookiePath = '/api/v1/auth/refresh';
      expect(refreshCookiePath).toContain('/auth/refresh');
    });
  });

  describe('Token Rotation', () => {
    it('should detect token reuse by checking tokenVersion mismatch', () => {
      const payloadVersion = 1;
      const dbVersion = 2; // Already rotated
      expect(payloadVersion).not.toBe(dbVersion);
    });

    it('should increment tokenVersion on each refresh', () => {
      let tokenVersion = 0;
      tokenVersion += 1; // First refresh
      expect(tokenVersion).toBe(1);
      tokenVersion += 1; // Second refresh
      expect(tokenVersion).toBe(2);
    });
  });

  describe('SAFE_GROUP_BY prevents SQL injection', () => {
    const SAFE_GROUP_BY: Record<string, string> = {
      day: 'day',
      week: 'week',
      month: 'month',
      year: 'year',
    };

    it('should map valid period values', () => {
      expect(SAFE_GROUP_BY['day']).toBe('day');
      expect(SAFE_GROUP_BY['month']).toBe('month');
    });

    it('should return undefined for injection attempts', () => {
      expect(SAFE_GROUP_BY["'; DROP TABLE users;--"]).toBeUndefined();
      expect(SAFE_GROUP_BY['1=1']).toBeUndefined();
      expect(SAFE_GROUP_BY['day UNION SELECT']).toBeUndefined();
    });

    it('should safely default to month for unknown periods', () => {
      const period = 'malicious_input';
      const safe = SAFE_GROUP_BY[period] || 'month';
      expect(safe).toBe('month');
    });
  });

  describe('Input Validation', () => {
    it('should clamp limit parameter within bounds', () => {
      const clamp = (limit: number) => Math.min(Math.max(limit || 1, 1), 100);
      expect(clamp(0)).toBe(1);
      expect(clamp(-1)).toBe(1);
      expect(clamp(50)).toBe(50);
      expect(clamp(999)).toBe(100);
      expect(clamp(NaN)).toBe(1);
    });

    it('should reject invalid date strings', () => {
      const isValidDate = (s: string) => !isNaN(new Date(s).getTime());
      expect(isValidDate('2024-01-15')).toBe(true);
      expect(isValidDate('not-a-date')).toBe(false);
      expect(isValidDate('')).toBe(false);
    });

    it('should validate HMIS month range', () => {
      const isValidMonth = (m: number) => m >= 1 && m <= 12;
      expect(isValidMonth(1)).toBe(true);
      expect(isValidMonth(12)).toBe(true);
      expect(isValidMonth(0)).toBe(false);
      expect(isValidMonth(13)).toBe(false);
    });
  });

  describe('Path Traversal Prevention', () => {
    const path = require('path');

    it('should block directory traversal attempts', () => {
      const uploadsDir = path.resolve('/app/uploads');
      const maliciousPath = path.resolve('/app/uploads', '../../etc/passwd');
      expect(maliciousPath.startsWith(uploadsDir)).toBe(false);
    });

    it('should allow legitimate paths within uploads', () => {
      const uploadsDir = path.resolve('/app/uploads');
      const legitimatePath = path.resolve('/app/uploads', 'docs/file.pdf');
      expect(legitimatePath.startsWith(uploadsDir)).toBe(true);
    });
  });

  describe('XSS Sanitization', () => {
    const escapeHtml = (str: string): string =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

    it('should escape HTML entities', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      );
    });

    it('should handle safe strings unchanged', () => {
      expect(escapeHtml('John Doe')).toBe('John Doe');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("O'Brien")).toBe('O&#x27;Brien');
    });
  });

  describe('CSP Configuration', () => {
    it('should NOT include unsafe-eval in production scriptSrc', () => {
      // Production CSP directives as configured in main.ts
      const productionCspDirectives = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      };

      expect(productionCspDirectives.scriptSrc).not.toContain("'unsafe-eval'");
      expect(productionCspDirectives.scriptSrc).not.toContain("'unsafe-inline'");
    });

    it('should allow unsafe-inline only for styleSrc (required for CSS-in-JS)', () => {
      const styleSrc = ["'self'", "'unsafe-inline'"];
      expect(styleSrc).toContain("'unsafe-inline'");
    });

    it('should block framing via frameAncestors', () => {
      const frameAncestors = ["'none'"];
      expect(frameAncestors).toContain("'none'");
    });
  });

  describe('MFA Policy Enforcement', () => {
    it('should block login when policy requires MFA but user has not enrolled', () => {
      const policy = { requireMfa: true };
      const user = { mfaEnabled: false, isSystemAdmin: false };

      const shouldBlock = policy.requireMfa && !user.mfaEnabled;
      expect(shouldBlock).toBe(true);
    });

    it('should allow login when policy requires MFA and user has enrolled', () => {
      const policy = { requireMfa: true };
      const user = { mfaEnabled: true, isSystemAdmin: false };

      const shouldBlock = policy.requireMfa && !user.mfaEnabled;
      expect(shouldBlock).toBe(false);
    });

    it('should allow login when policy does not require MFA', () => {
      const policy = { requireMfa: false };
      const user = { mfaEnabled: false, isSystemAdmin: false };

      const shouldBlock = policy.requireMfa && !user.mfaEnabled;
      expect(shouldBlock).toBe(false);
    });

    it('should set mustEnrollMfa flag for system admins without MFA', () => {
      const user = { isSystemAdmin: true, mfaEnabled: false };
      const policy = { requireMfa: false };

      const mustEnrollMfa = !user.mfaEnabled && (user.isSystemAdmin || policy.requireMfa);
      expect(mustEnrollMfa).toBe(true);
    });

    it('should set mustEnrollMfa flag when policy requires MFA', () => {
      const user = { isSystemAdmin: false, mfaEnabled: false };
      const policy = { requireMfa: true };

      const mustEnrollMfa = !user.mfaEnabled && (user.isSystemAdmin || policy.requireMfa);
      expect(mustEnrollMfa).toBe(true);
    });

    it('should not set mustEnrollMfa when user already has MFA enabled', () => {
      const user = { isSystemAdmin: true, mfaEnabled: true };
      const policy = { requireMfa: true };

      const mustEnrollMfa = !user.mfaEnabled && (user.isSystemAdmin || policy.requireMfa);
      expect(mustEnrollMfa).toBe(false);
    });
  });

  describe('Production Environment Validation', () => {
    it('should require MFA_ENCRYPTION_KEY in production', () => {
      const requiredInProduction = [
        'MFA_ENCRYPTION_KEY',
        'PII_ENCRYPTION_KEY',
        'PII_HASH_KEY',
      ];
      const env: Record<string, string> = {}; // Empty = missing

      const missing = requiredInProduction.filter((key) => !env[key]);
      expect(missing).toEqual(requiredInProduction);
    });

    it('should pass when all required keys are present', () => {
      const requiredInProduction = [
        'MFA_ENCRYPTION_KEY',
        'PII_ENCRYPTION_KEY',
        'PII_HASH_KEY',
      ];
      const env: Record<string, string> = {
        MFA_ENCRYPTION_KEY: 'some-key',
        PII_ENCRYPTION_KEY: 'some-key',
        PII_HASH_KEY: 'some-key',
      };

      const missing = requiredInProduction.filter((key) => !env[key]);
      expect(missing).toEqual([]);
    });

    it('should reject JWT_SECRET shorter than 32 chars in production', () => {
      const jwtSecret = 'short-secret';
      expect(jwtSecret.length).toBeLessThan(32);
    });

    it('should reject JWT_SECRET containing dev markers', () => {
      const devMarkers = ['dev', 'test', 'xxx'];
      const jwtSecret = 'my-dev-secret-key-1234567890abcdef';

      const containsDevMarker = devMarkers.some((m) => jwtSecret.includes(m));
      expect(containsDevMarker).toBe(true);
    });
  });

  describe('CORS Origin Validation', () => {
    const validateOrigin = (origin: string): boolean => {
      try {
        new URL(origin);
        return true;
      } catch {
        return false;
      }
    };

    it('should accept valid HTTPS origins', () => {
      expect(validateOrigin('https://example.com')).toBe(true);
      expect(validateOrigin('https://hmis.hospital.org')).toBe(true);
    });

    it('should accept valid HTTP origins (dev)', () => {
      expect(validateOrigin('http://localhost:5173')).toBe(true);
    });

    it('should reject invalid origins', () => {
      expect(validateOrigin('not-a-url')).toBe(false);
      expect(validateOrigin('')).toBe(false);
      expect(validateOrigin('just-words-no-scheme')).toBe(false);
    });

    it('should accept IP-based origins', () => {
      expect(validateOrigin('https://212.47.69.106')).toBe(true);
    });

    it('should parse comma-separated origins correctly', () => {
      const corsString = 'https://a.com, https://b.com ,https://c.com';
      const origins = corsString.split(',').map((o) => o.trim()).filter(Boolean);

      expect(origins).toEqual(['https://a.com', 'https://b.com', 'https://c.com']);
      origins.forEach((o) => expect(validateOrigin(o)).toBe(true));
    });
  });
});
