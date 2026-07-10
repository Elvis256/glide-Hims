import { ForbiddenException } from '@nestjs/common';
import { TenantContextGuard } from '../guards/tenant-context.guard';

function ctx(user: any) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

describe('TenantContextGuard', () => {
  const guard = new TenantContextGuard();

  it('allows a regular user with tenantId', () => {
    expect(guard.canActivate(ctx({ id: 'u1', tenantId: 't1', isSystemAdmin: false }))).toBe(true);
  });

  it('allows a system admin without tenantId', () => {
    expect(guard.canActivate(ctx({ id: 'a1', tenantId: undefined, isSystemAdmin: true }))).toBe(
      true,
    );
  });

  it('rejects a non-admin user with no tenantId', () => {
    expect(() =>
      guard.canActivate(ctx({ id: 'u1', tenantId: undefined, isSystemAdmin: false })),
    ).toThrow(ForbiddenException);
  });

  it('rejects when req.user is missing entirely', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });

  it('rejects a non-admin user with empty-string tenantId', () => {
    expect(() => guard.canActivate(ctx({ id: 'u1', tenantId: '', isSystemAdmin: false }))).toThrow(
      ForbiddenException,
    );
  });
});
