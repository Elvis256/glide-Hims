import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * Tests for trash controller permission filtering and restore guards.
 * The trash controller maps entity types to required permissions and
 * filters listing results based on the caller's permission set.
 */

const TRASH_TYPES: Record<string, { entity: string; label: string; permission: string }> = {
  users: { entity: 'User', label: 'User', permission: 'users.delete' },
  patients: { entity: 'Patient', label: 'Patient', permission: 'patients.delete' },
  roles: { entity: 'Role', label: 'Role', permission: 'roles.delete' },
};

// Simulates the listing filter logic from the trash controller
function filterAllowedTypes(
  requestedType: string | undefined,
  userPerms: string[],
): string[] {
  const types = requestedType ? [requestedType] : Object.keys(TRASH_TYPES);
  const allowed: string[] = [];
  for (const t of types) {
    const meta = TRASH_TYPES[t];
    if (!meta) continue;
    if (userPerms.length > 0 && !userPerms.includes(meta.permission)) continue;
    allowed.push(t);
  }
  return allowed;
}

// Simulates restore permission check
function assertRestorePermission(
  type: string,
  userPerms: string[],
): void {
  const meta = TRASH_TYPES[type];
  if (!meta) throw new BadRequestException(`Unsupported trash type: ${type}`);
  if (userPerms.length > 0 && !userPerms.includes(meta.permission)) {
    throw new ForbiddenException(`Missing permission: ${meta.permission}`);
  }
}

describe('Trash Permissions', () => {
  describe('type-specific permission filtering on list', () => {
    it('returns all types when user has all permissions', () => {
      const allowed = filterAllowedTypes(undefined, [
        'users.delete',
        'patients.delete',
        'roles.delete',
      ]);
      expect(allowed).toEqual(['users', 'patients', 'roles']);
    });

    it('returns only permitted types for partial permissions', () => {
      const allowed = filterAllowedTypes(undefined, ['users.delete']);
      expect(allowed).toEqual(['users']);
    });

    it('returns empty when user has no matching permissions', () => {
      const allowed = filterAllowedTypes(undefined, ['inventory.delete']);
      expect(allowed).toEqual([]);
    });

    it('returns all types when permissions array is empty (no RBAC)', () => {
      const allowed = filterAllowedTypes(undefined, []);
      expect(allowed).toEqual(['users', 'patients', 'roles']);
    });

    it('filters single requested type by permission', () => {
      const allowed = filterAllowedTypes('patients', ['users.delete']);
      expect(allowed).toEqual([]);
    });

    it('allows single requested type when permission matches', () => {
      const allowed = filterAllowedTypes('patients', ['patients.delete']);
      expect(allowed).toEqual(['patients']);
    });

    it('skips unknown type in list', () => {
      const allowed = filterAllowedTypes('unknown', ['users.delete']);
      expect(allowed).toEqual([]);
    });
  });

  describe('restore without matching permission', () => {
    it('throws ForbiddenException when permission missing', () => {
      expect(() => assertRestorePermission('patients', ['users.delete'])).toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException with correct permission in message', () => {
      expect(() => assertRestorePermission('roles', ['users.delete'])).toThrow(
        'Missing permission: roles.delete',
      );
    });

    it('does not throw when permission matches', () => {
      expect(() =>
        assertRestorePermission('users', ['users.delete']),
      ).not.toThrow();
    });

    it('does not throw when permissions array is empty (no RBAC enforcement)', () => {
      expect(() => assertRestorePermission('users', [])).not.toThrow();
    });
  });

  describe('unknown type handling', () => {
    it('throws BadRequestException for unknown type', () => {
      expect(() => assertRestorePermission('invoices', ['users.delete'])).toThrow(
        BadRequestException,
      );
    });

    it('includes type name in error message', () => {
      expect(() => assertRestorePermission('widgets', [])).toThrow(
        'Unsupported trash type: widgets',
      );
    });
  });

  describe('type → permission mapping', () => {
    it.each([
      ['users', 'users.delete'],
      ['patients', 'patients.delete'],
      ['roles', 'roles.delete'],
    ])('maps %s → %s', (type, permission) => {
      expect(TRASH_TYPES[type].permission).toBe(permission);
    });
  });
});
