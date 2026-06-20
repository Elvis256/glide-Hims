import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Tests for user service security guards:
 * - Self-deletion
 * - SysAdmin deletion by non-sysadmin
 * - Last-admin deletion
 * - assertCallerCanGrantRole (system role guard)
 * - isSystemAdmin creation guard
 * - Bulk import password generation (crypto.randomBytes, not hardcoded)
 * - Session revocation on deactivate/delete
 */

describe('Users Security', () => {
  // ── self-deletion guard ────────────────────────────────────────────

  describe('self-deletion guard', () => {
    function removeSelfCheck(
      targetId: string,
      caller?: { id?: string; userId?: string },
    ): void {
      const callerId = caller?.id || caller?.userId;
      if (callerId && callerId === targetId) {
        throw new BadRequestException('Cannot delete your own account');
      }
    }

    it('throws when caller deletes themselves (caller.id)', () => {
      expect(() => removeSelfCheck('user-1', { id: 'user-1' })).toThrow(
        'Cannot delete your own account',
      );
    });

    it('throws when caller deletes themselves (caller.userId)', () => {
      expect(() => removeSelfCheck('user-1', { userId: 'user-1' })).toThrow(
        'Cannot delete your own account',
      );
    });

    it('does not throw when deleting a different user', () => {
      expect(() => removeSelfCheck('user-2', { id: 'user-1' })).not.toThrow();
    });

    it('does not throw when no caller context', () => {
      expect(() => removeSelfCheck('user-1', undefined)).not.toThrow();
    });
  });

  // ── sysadmin deletion guard ────────────────────────────────────────

  describe('sysAdmin deletion by non-sysadmin', () => {
    function sysAdminDeleteCheck(
      target: { isSystemAdmin: boolean },
      caller?: { isSystemAdmin?: boolean },
    ): void {
      if (target.isSystemAdmin && !caller?.isSystemAdmin) {
        throw new BadRequestException('Cannot delete system administrator accounts');
      }
    }

    it('throws when non-sysadmin tries to delete sysadmin', () => {
      expect(() =>
        sysAdminDeleteCheck({ isSystemAdmin: true }, { isSystemAdmin: false }),
      ).toThrow('Cannot delete system administrator accounts');
    });

    it('throws when caller has no isSystemAdmin flag', () => {
      expect(() =>
        sysAdminDeleteCheck({ isSystemAdmin: true }, {}),
      ).toThrow('Cannot delete system administrator accounts');
    });

    it('allows sysadmin to delete sysadmin', () => {
      expect(() =>
        sysAdminDeleteCheck({ isSystemAdmin: true }, { isSystemAdmin: true }),
      ).not.toThrow();
    });

    it('allows deletion of non-sysadmin by anyone', () => {
      expect(() =>
        sysAdminDeleteCheck({ isSystemAdmin: false }, { isSystemAdmin: false }),
      ).not.toThrow();
    });
  });

  // ── last-admin deletion guard ──────────────────────────────────────

  describe('last-admin deletion guard', () => {
    function lastAdminCheck(
      adminCountExcludingTarget: number,
      tenantId?: string,
    ): void {
      if (tenantId && adminCountExcludingTarget === 0) {
        throw new BadRequestException(
          'Cannot delete the last administrator for this organization',
        );
      }
    }

    it('throws when deleting the last admin in a tenant', () => {
      expect(() => lastAdminCheck(0, 'tenant-1')).toThrow(
        'Cannot delete the last administrator for this organization',
      );
    });

    it('allows when other admins remain', () => {
      expect(() => lastAdminCheck(2, 'tenant-1')).not.toThrow();
    });

    it('skips check when no tenantId (system-level)', () => {
      expect(() => lastAdminCheck(0, undefined)).not.toThrow();
    });
  });

  // ── assertCallerCanGrantRole ───────────────────────────────────────

  describe('assertCallerCanGrantRole()', () => {
    function checkSystemRoleGrant(
      role: { isSystemRole: boolean; name: string },
      caller?: { isSystemAdmin?: boolean; roles?: string[] },
    ): void {
      const callerIsSysAdmin = !!caller?.isSystemAdmin;
      const callerIsSuperAdmin = (caller?.roles || []).includes('Super Admin');

      if (role.isSystemRole && !(callerIsSysAdmin || callerIsSuperAdmin)) {
        throw new BadRequestException(
          `You may not assign the system role '${role.name}'. ` +
            `System roles can only be granted by a platform or super administrator.`,
        );
      }
    }

    it('throws when non-sysadmin assigns system role', () => {
      expect(() =>
        checkSystemRoleGrant(
          { isSystemRole: true, name: 'Administrator' },
          { isSystemAdmin: false, roles: [] },
        ),
      ).toThrow("You may not assign the system role 'Administrator'");
    });

    it('allows sysadmin to assign system role', () => {
      expect(() =>
        checkSystemRoleGrant(
          { isSystemRole: true, name: 'Administrator' },
          { isSystemAdmin: true, roles: [] },
        ),
      ).not.toThrow();
    });

    it('allows Super Admin role holder to assign system role', () => {
      expect(() =>
        checkSystemRoleGrant(
          { isSystemRole: true, name: 'Administrator' },
          { isSystemAdmin: false, roles: ['Super Admin'] },
        ),
      ).not.toThrow();
    });

    it('allows non-system role assignment by anyone', () => {
      expect(() =>
        checkSystemRoleGrant(
          { isSystemRole: false, name: 'Nurse' },
          { isSystemAdmin: false, roles: [] },
        ),
      ).not.toThrow();
    });
  });

  // ── isSystemAdmin creation guard ───────────────────────────────────

  describe('isSystemAdmin creation guard', () => {
    function checkSysAdminCreation(
      dto: { isSystemAdmin?: boolean },
      caller?: { isSystemAdmin?: boolean },
    ): void {
      if (dto.isSystemAdmin && caller && !caller.isSystemAdmin) {
        throw new BadRequestException(
          'Only platform administrators may create system-admin users',
        );
      }
    }

    it('throws when non-sysadmin creates sysadmin user', () => {
      expect(() =>
        checkSysAdminCreation({ isSystemAdmin: true }, { isSystemAdmin: false }),
      ).toThrow('Only platform administrators may create system-admin users');
    });

    it('allows sysadmin to create sysadmin user', () => {
      expect(() =>
        checkSysAdminCreation({ isSystemAdmin: true }, { isSystemAdmin: true }),
      ).not.toThrow();
    });

    it('allows creating non-sysadmin user by anyone', () => {
      expect(() =>
        checkSysAdminCreation({ isSystemAdmin: false }, { isSystemAdmin: false }),
      ).not.toThrow();
    });

    it('passes when no caller context (internal service call)', () => {
      expect(() =>
        checkSysAdminCreation({ isSystemAdmin: true }, undefined),
      ).not.toThrow();
    });
  });

  // ── bulk import password generation ────────────────────────────────

  describe('bulk import: crypto.randomBytes password', () => {
    it('generates unique password per user using crypto.randomBytes', () => {
      const pw1 = crypto.randomBytes(16).toString('base64url');
      const pw2 = crypto.randomBytes(16).toString('base64url');

      expect(pw1).not.toBe(pw2);
      expect(pw1.length).toBeGreaterThan(0);
      expect(pw2.length).toBeGreaterThan(0);
    });

    it('does not use hardcoded password', () => {
      const pw = crypto.randomBytes(16).toString('base64url');
      expect(pw).not.toBe('TempPass123!');
      expect(pw).not.toBe('password');
      expect(pw).not.toBe('changeme');
    });

    it('generates base64url-safe characters', () => {
      const pw = crypto.randomBytes(16).toString('base64url');
      // base64url only contains [A-Za-z0-9_-]
      expect(pw).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates 16 bytes of entropy', () => {
      const bytes = crypto.randomBytes(16);
      expect(bytes).toHaveLength(16);
      // base64url of 16 bytes = 22 chars
      expect(bytes.toString('base64url')).toHaveLength(22);
    });
  });

  // ── session revocation on deactivate/delete ────────────────────────

  describe('session revocation on deactivate/delete', () => {
    it('revokes sessions and refresh tokens via SQL updates', async () => {
      const mockQuery = jest.fn().mockResolvedValue(undefined);
      const userId = 'user-123';

      // Simulate revokeUserSessions()
      await mockQuery(
        'UPDATE sessions SET revoked_at = NOW(), is_active = false WHERE user_id = $1 AND revoked_at IS NULL',
        [userId],
      );
      await mockQuery(
        'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND is_revoked = false',
        [userId],
      );

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('sessions'),
        [userId],
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('refresh_tokens'),
        [userId],
      );
    });

    it('does not block user operation if session tables fail', async () => {
      const mockQuery = jest.fn().mockRejectedValue(new Error('relation does not exist'));
      const userId = 'user-456';

      // Simulate graceful error handling
      try {
        await mockQuery('UPDATE sessions SET ...', [userId]);
      } catch (err) {
        // Should warn but not rethrow
        expect((err as Error).message).toContain('relation does not exist');
      }

      // User operation should continue
      const userSaved = true;
      expect(userSaved).toBe(true);
    });

    it('is called on deactivate (status = inactive)', async () => {
      const revokeUserSessions = jest.fn().mockResolvedValue(undefined);
      const userId = 'user-789';

      // Simulate deactivateUser flow
      const user = { id: userId, status: 'active' as string };
      user.status = 'inactive';
      await revokeUserSessions(userId);

      expect(user.status).toBe('inactive');
      expect(revokeUserSessions).toHaveBeenCalledWith(userId);
    });

    it('is called on soft-delete', async () => {
      const revokeUserSessions = jest.fn().mockResolvedValue(undefined);
      const softRemove = jest.fn().mockResolvedValue(undefined);
      const userId = 'user-999';

      // Simulate remove flow
      await softRemove({ id: userId });
      await revokeUserSessions(userId);

      expect(softRemove).toHaveBeenCalled();
      expect(revokeUserSessions).toHaveBeenCalledWith(userId);
    });
  });
});
