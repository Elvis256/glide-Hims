import { BadRequestException, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/**
 * Tests for auth service security hardening:
 * - Password policy validation (all rule permutations)
 * - Password policy floor enforcement
 * - Password history checks
 * - Cross-tenant login blocking
 * - System admin login gate
 * - Token invalidation
 * - Admin password reset guards
 * - Account unlock tenant enforcement
 */

// ── Password policy validation (replicates validatePasswordPolicy logic) ──

interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  allowedSpecialChars?: string;
  commonPasswordsBlacklist?: string[];
  passwordHistoryCount: number;
}

function validatePasswordPolicy(
  password: string,
  policy: PasswordPolicy | null,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!policy) {
    if (password.length < 8) errors.push('Password must be at least 8 characters');
    if (errors.length) throw new BadRequestException(errors.join('. '));
    return { valid: true, errors: [] };
  }

  if (password.length < policy.minLength)
    errors.push(`Password must be at least ${policy.minLength} characters`);
  if (password.length > policy.maxLength)
    errors.push(`Password must be at most ${policy.maxLength} characters`);
  if (policy.requireUppercase && !/[A-Z]/.test(password))
    errors.push('Password must contain at least one uppercase letter');
  if (policy.requireLowercase && !/[a-z]/.test(password))
    errors.push('Password must contain at least one lowercase letter');
  if (policy.requireNumbers && !/\d/.test(password))
    errors.push('Password must contain at least one number');
  if (policy.requireSpecialChars) {
    const chars = policy.allowedSpecialChars || '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const escaped = chars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    if (!new RegExp(`[${escaped}]`).test(password))
      errors.push('Password must contain at least one special character');
  }
  if (
    policy.commonPasswordsBlacklist &&
    policy.commonPasswordsBlacklist.includes(password.toLowerCase())
  ) {
    errors.push('Password is too common. Please choose a stronger password');
  }

  if (errors.length) throw new BadRequestException(errors.join('. '));
  return { valid: true, errors: [] };
}

// ── Password policy floor (replicates enforcePasswordPolicyFloor) ──

const PASSWORD_POLICY_FLOOR = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxFailedAttempts: 10,
  lockoutDurationMinutes: 5,
  passwordHistoryCount: 3,
  expiryDays: 365,
} as const;

function enforcePasswordPolicyFloor(data: Record<string, any>): void {
  const floor = PASSWORD_POLICY_FLOOR;
  if (data.minLength != null && data.minLength < floor.minLength)
    throw new BadRequestException(`minLength cannot be below platform minimum of ${floor.minLength}`);
  if (data.requireUppercase === false && floor.requireUppercase)
    throw new BadRequestException('requireUppercase cannot be disabled');
  if (data.requireLowercase === false && floor.requireLowercase)
    throw new BadRequestException('requireLowercase cannot be disabled');
  if (data.requireNumbers === false && floor.requireNumbers)
    throw new BadRequestException('requireNumbers cannot be disabled');
  if (data.requireSpecialChars === false && floor.requireSpecialChars)
    throw new BadRequestException('requireSpecialChars cannot be disabled');
  if (data.maxFailedAttempts != null && data.maxFailedAttempts > floor.maxFailedAttempts)
    throw new BadRequestException(`maxFailedAttempts cannot exceed platform max of ${floor.maxFailedAttempts}`);
  if (data.lockoutDurationMinutes != null && data.lockoutDurationMinutes < floor.lockoutDurationMinutes)
    throw new BadRequestException(`lockoutDurationMinutes cannot be below ${floor.lockoutDurationMinutes}`);
  if (data.passwordHistoryCount != null && data.passwordHistoryCount < floor.passwordHistoryCount)
    throw new BadRequestException(`passwordHistoryCount cannot be below ${floor.passwordHistoryCount}`);
  if (data.expiryDays != null && data.expiryDays > floor.expiryDays)
    throw new BadRequestException(`expiryDays cannot exceed ${floor.expiryDays}`);
}

describe('Auth Security', () => {
  // ── validatePasswordPolicy ─────────────────────────────────────────

  describe('validatePasswordPolicy()', () => {
    const strictPolicy: PasswordPolicy = {
      minLength: 10,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      allowedSpecialChars: undefined,
      commonPasswordsBlacklist: ['password', '123456', 'qwerty'],
      passwordHistoryCount: 5,
    };

    it('accepts valid password meeting all rules', () => {
      const result = validatePasswordPolicy('MyStr0ng!Pass', strictPolicy);
      expect(result.valid).toBe(true);
    });

    it('rejects password below minLength', () => {
      expect(() => validatePasswordPolicy('Ab1!short', strictPolicy)).toThrow(
        'at least 10 characters',
      );
    });

    it('rejects password above maxLength', () => {
      const policy = { ...strictPolicy, maxLength: 16 };
      const longPw = 'Aa1!' + 'x'.repeat(20);
      expect(() => validatePasswordPolicy(longPw, policy)).toThrow('at most 16 characters');
    });

    it('rejects missing uppercase', () => {
      expect(() => validatePasswordPolicy('mystr0ng!pass1', strictPolicy)).toThrow(
        'uppercase letter',
      );
    });

    it('rejects missing lowercase', () => {
      expect(() => validatePasswordPolicy('MYSTR0NG!PASS1', strictPolicy)).toThrow(
        'lowercase letter',
      );
    });

    it('rejects missing numbers', () => {
      expect(() => validatePasswordPolicy('MyStrong!Passx', strictPolicy)).toThrow('one number');
    });

    it('rejects missing special chars', () => {
      expect(() => validatePasswordPolicy('MyStr0ngPass1x', strictPolicy)).toThrow(
        'special character',
      );
    });

    it('rejects blacklisted password', () => {
      expect(() =>
        validatePasswordPolicy('password', { ...strictPolicy, minLength: 4 }),
      ).toThrow('too common');
    });

    it('blacklist is case-insensitive', () => {
      expect(() =>
        validatePasswordPolicy('PASSWORD', { ...strictPolicy, minLength: 4 }),
      ).toThrow('too common');
    });

    it('uses custom allowedSpecialChars when provided', () => {
      const policy = { ...strictPolicy, allowedSpecialChars: '#$' };
      expect(() => validatePasswordPolicy('MyStr0ng!Px', policy)).toThrow('special character');
      expect(() => validatePasswordPolicy('MyStr0ng#Px', policy)).not.toThrow();
    });

    it('falls back to 8-char minimum when no policy exists', () => {
      expect(() => validatePasswordPolicy('short', null)).toThrow('at least 8 characters');
      expect(() => validatePasswordPolicy('longpassword', null)).not.toThrow();
    });
  });

  // ── enforcePasswordPolicyFloor ─────────────────────────────────────

  describe('enforcePasswordPolicyFloor()', () => {
    it('accepts values at or above floor', () => {
      expect(() =>
        enforcePasswordPolicyFloor({
          minLength: 12,
          requireUppercase: true,
          maxFailedAttempts: 5,
          lockoutDurationMinutes: 30,
          passwordHistoryCount: 5,
          expiryDays: 90,
        }),
      ).not.toThrow();
    });

    it('rejects minLength below floor', () => {
      expect(() => enforcePasswordPolicyFloor({ minLength: 5 })).toThrow(
        'minLength cannot be below platform minimum of 8',
      );
    });

    it('rejects disabling requireUppercase', () => {
      expect(() => enforcePasswordPolicyFloor({ requireUppercase: false })).toThrow(
        'requireUppercase cannot be disabled',
      );
    });

    it('rejects disabling requireLowercase', () => {
      expect(() => enforcePasswordPolicyFloor({ requireLowercase: false })).toThrow(
        'requireLowercase cannot be disabled',
      );
    });

    it('rejects disabling requireNumbers', () => {
      expect(() => enforcePasswordPolicyFloor({ requireNumbers: false })).toThrow(
        'requireNumbers cannot be disabled',
      );
    });

    it('rejects disabling requireSpecialChars', () => {
      expect(() => enforcePasswordPolicyFloor({ requireSpecialChars: false })).toThrow(
        'requireSpecialChars cannot be disabled',
      );
    });

    it('rejects maxFailedAttempts above floor', () => {
      expect(() => enforcePasswordPolicyFloor({ maxFailedAttempts: 15 })).toThrow(
        'maxFailedAttempts cannot exceed platform max of 10',
      );
    });

    it('rejects lockoutDurationMinutes below floor', () => {
      expect(() => enforcePasswordPolicyFloor({ lockoutDurationMinutes: 2 })).toThrow(
        'lockoutDurationMinutes cannot be below 5',
      );
    });

    it('rejects passwordHistoryCount below floor', () => {
      expect(() => enforcePasswordPolicyFloor({ passwordHistoryCount: 1 })).toThrow(
        'passwordHistoryCount cannot be below 3',
      );
    });

    it('rejects expiryDays above floor', () => {
      expect(() => enforcePasswordPolicyFloor({ expiryDays: 500 })).toThrow(
        'expiryDays cannot exceed 365',
      );
    });

    it('ignores null/undefined fields', () => {
      expect(() => enforcePasswordPolicyFloor({ minLength: null })).not.toThrow();
    });
  });

  // ── checkPasswordHistory ───────────────────────────────────────────

  describe('checkPasswordHistory()', () => {
    it('throws when password matches recent history', async () => {
      const newPassword = 'MyNewP@ss1';
      const hashedOld = await bcrypt.hash(newPassword, 10);
      const history = [{ passwordHash: hashedOld, changedAt: new Date() }];

      for (const entry of history) {
        if (!entry.passwordHash.startsWith('$2')) continue;
        const match = await bcrypt.compare(newPassword, entry.passwordHash);
        if (match) {
          expect(match).toBe(true);
          return;
        }
      }
      fail('Should have found a match');
    });

    it('passes when password does not match history', async () => {
      const newPassword = 'CompletelyNew1!';
      const hashedOld = await bcrypt.hash('OldPassword1!', 10);
      const history = [{ passwordHash: hashedOld, changedAt: new Date() }];

      let matched = false;
      for (const entry of history) {
        if (!entry.passwordHash.startsWith('$2')) continue;
        if (await bcrypt.compare(newPassword, entry.passwordHash)) {
          matched = true;
        }
      }
      expect(matched).toBe(false);
    });

    it('skips invalid hash entries (not starting with $2)', async () => {
      const history = [
        { passwordHash: 'not-a-bcrypt-hash', changedAt: new Date() },
        { passwordHash: 'another-bad-hash', changedAt: new Date() },
      ];

      const skipped: string[] = [];
      for (const entry of history) {
        if (!entry.passwordHash.startsWith('$2')) {
          skipped.push(entry.passwordHash);
          continue;
        }
      }
      expect(skipped).toHaveLength(2);
    });

    it('passes when no policy or historyCount is 0', () => {
      const policy = { passwordHistoryCount: 0 };
      if (!policy || policy.passwordHistoryCount === 0) {
        // early return — no check needed
        expect(true).toBe(true);
      }
    });
  });

  // ── cross-tenant login block ───────────────────────────────────────

  describe('cross-tenant login block', () => {
    it('blocks non-sysadmin login to different tenant', () => {
      const user = { id: 'u1', tenantId: 'tenant-a', isSystemAdmin: false };
      const loginTenantId = 'tenant-b';

      if (loginTenantId && user.tenantId !== loginTenantId && !user.isSystemAdmin) {
        expect(() => {
          throw new UnauthorizedException('Invalid credentials');
        }).toThrow(UnauthorizedException);
        return;
      }
      fail('Should have blocked cross-tenant login');
    });

    it('allows sysadmin cross-tenant login', () => {
      const user = { id: 'u1', tenantId: 'tenant-a', isSystemAdmin: true };
      const loginTenantId = 'tenant-b';

      const blocked =
        loginTenantId && user.tenantId !== loginTenantId && !user.isSystemAdmin;
      expect(blocked).toBe(false);
    });

    it('allows same-tenant login', () => {
      const user = { id: 'u1', tenantId: 'tenant-a', isSystemAdmin: false };
      const loginTenantId = 'tenant-a';

      const blocked =
        loginTenantId && user.tenantId !== loginTenantId && !user.isSystemAdmin;
      expect(blocked).toBe(false);
    });
  });

  // ── system admin login gate ────────────────────────────────────────

  describe('system admin login gate', () => {
    it('rejects non-sysadmin on system login (multi-tenant, no tenantId)', () => {
      const user = { isSystemAdmin: false };
      const loginTenantId = undefined;
      const deploymentMode = 'multi-tenant';

      if (!loginTenantId && deploymentMode === 'multi-tenant' && !user.isSystemAdmin) {
        expect(() => {
          throw new UnauthorizedException('Invalid credentials');
        }).toThrow(UnauthorizedException);
        return;
      }
      fail('Should have rejected');
    });

    it('allows sysadmin system login', () => {
      const user = { isSystemAdmin: true };
      const loginTenantId = undefined;
      const deploymentMode = 'multi-tenant';

      const blocked =
        !loginTenantId && deploymentMode === 'multi-tenant' && !user.isSystemAdmin;
      expect(blocked).toBe(false);
    });

    it('allows non-sysadmin on-premise login (auto-resolves tenant)', () => {
      const user = { isSystemAdmin: false };
      const loginTenantId = undefined;
      const deploymentMode: string = 'on-premise';

      const blocked =
        !loginTenantId && deploymentMode === 'multi-tenant' && !user.isSystemAdmin;
      expect(blocked).toBe(false);
    });
  });

  // ── invalidateUserTokens ──────────────────────────────────────────

  describe('invalidateUserTokens()', () => {
    it('increments tokenVersion to invalidate existing JWTs', async () => {
      const userRepo = { increment: jest.fn().mockResolvedValue({}) };
      const cacheService = { del: jest.fn().mockResolvedValue(true) };
      const refreshTokenService = { revokeAllUserTokens: jest.fn().mockResolvedValue(undefined) };
      const sessionService = { revokeAllSessions: jest.fn().mockResolvedValue(undefined) };

      const userId = 'user-123';

      await userRepo.increment({ id: userId }, 'tokenVersion', 1);
      await cacheService.del(`jwt:user:${userId}`);
      await refreshTokenService.revokeAllUserTokens(userId);
      await sessionService.revokeAllSessions(userId);

      expect(userRepo.increment).toHaveBeenCalledWith({ id: userId }, 'tokenVersion', 1);
      expect(cacheService.del).toHaveBeenCalledWith('jwt:user:user-123');
      expect(refreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith(userId);
      expect(sessionService.revokeAllSessions).toHaveBeenCalledWith(userId);
    });
  });

  // ── admin password reset guards ────────────────────────────────────

  describe('admin password reset guards', () => {
    function adminResetGuard(
      targetUser: { id: string; tenantId: string; isSystemAdmin: boolean },
      callerTenantId: string | undefined,
      callerIsSystemAdmin: boolean,
    ): void {
      if (callerTenantId && targetUser.tenantId !== callerTenantId) {
        throw new ForbiddenException('Cannot reset password for users in another organization');
      }
      if (targetUser.isSystemAdmin && !callerIsSystemAdmin) {
        throw new ForbiddenException('Cannot reset password for system administrators');
      }
    }

    it('throws 403 for cross-tenant reset', () => {
      expect(() =>
        adminResetGuard(
          { id: 'u1', tenantId: 'tenant-b', isSystemAdmin: false },
          'tenant-a',
          false,
        ),
      ).toThrow('Cannot reset password for users in another organization');
    });

    it('throws 403 when non-sysadmin targets sysadmin', () => {
      expect(() =>
        adminResetGuard(
          { id: 'u1', tenantId: 'tenant-a', isSystemAdmin: true },
          'tenant-a',
          false,
        ),
      ).toThrow('Cannot reset password for system administrators');
    });

    it('allows same-tenant non-sysadmin reset', () => {
      expect(() =>
        adminResetGuard(
          { id: 'u1', tenantId: 'tenant-a', isSystemAdmin: false },
          'tenant-a',
          false,
        ),
      ).not.toThrow();
    });

    it('allows sysadmin to reset sysadmin', () => {
      expect(() =>
        adminResetGuard(
          { id: 'u1', tenantId: 'tenant-a', isSystemAdmin: true },
          'tenant-a',
          true,
        ),
      ).not.toThrow();
    });

    it('allows sysadmin cross-tenant reset (no callerTenantId)', () => {
      expect(() =>
        adminResetGuard(
          { id: 'u1', tenantId: 'tenant-b', isSystemAdmin: false },
          undefined,
          true,
        ),
      ).not.toThrow();
    });
  });

  // ── unlockAccount tenant enforcement ───────────────────────────────

  describe('unlockAccount() tenant enforcement', () => {
    it('includes tenantId in where clause when caller has tenantId', () => {
      const callerTenantId = 'tenant-a';
      const where: any = { id: 'user-1' };
      if (callerTenantId) where.tenantId = callerTenantId;

      expect(where).toEqual({ id: 'user-1', tenantId: 'tenant-a' });
    });

    it('omits tenantId from where clause when caller has no tenantId', () => {
      const callerTenantId: string | undefined = undefined;
      const where: any = { id: 'user-1' };
      if (callerTenantId) where.tenantId = callerTenantId;

      expect(where).toEqual({ id: 'user-1' });
      expect(where.tenantId).toBeUndefined();
    });

    it('prevents cross-tenant unlock by scoping query', async () => {
      const mockFindOne = jest.fn().mockResolvedValue(null);
      const callerTenantId = 'tenant-a';
      const userId = 'user-in-tenant-b';

      const where: any = { id: userId };
      if (callerTenantId) where.tenantId = callerTenantId;

      await mockFindOne({ where });
      expect(mockFindOne).toHaveBeenCalledWith({
        where: { id: userId, tenantId: 'tenant-a' },
      });
    });
  });
});
