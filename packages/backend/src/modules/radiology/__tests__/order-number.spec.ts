import { RadiologyService } from '../radiology.service';

/**
 * createOrder generated its number with setLock('pessimistic_write') on a
 * getCount(). TypeORM carries the lock into the aggregate query as FOR UPDATE,
 * and Postgres rejects "FOR UPDATE is not allowed with aggregate functions" —
 * so creating an imaging order failed every single time, in every deployment.
 *
 * These pin the replacement: an advisory lock plus MAX+1, scoped to the tenant
 * that order_number is actually unique within, prefixed with the hospital's
 * month.
 */
describe('createOrder — order number generation', () => {
  const TENANT = '11111111-1111-1111-1111-111111111111';

  const build = (lastOrderNumber: string | null) => {
    const queries: any[][] = [];
    const qb: any = {
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      setLock: jest.fn(() => qb),
      getOne: jest.fn().mockResolvedValue(
        lastOrderNumber ? { orderNumber: lastOrderNumber } : null,
      ),
      getCount: jest.fn(() => {
        throw new Error('getCount must not be used for numbering');
      }),
    };
    const saved: any[] = [];
    const manager: any = {
      query: jest.fn(async (sql: string, params: any[]) => {
        queries.push([sql, params]);
        return [];
      }),
      createQueryBuilder: jest.fn(() => qb),
      create: jest.fn((_e: any, x: any) => x),
      save: jest.fn(async (x: any) => {
        saved.push(x);
        return { ...x, id: 'img-1' };
      }),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    };

    const svc = Object.create(RadiologyService.prototype) as any;
    svc.dataSource = { transaction: async (cb: any) => cb(manager) };
    svc.auditLogService = { log: jest.fn().mockResolvedValue(undefined) };
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    svc.inAppNotificationsService = { create: jest.fn() };
    return { svc, manager, qb, saved, queries };
  };

  const dto: any = {
    facilityId: 'fac-1',
    patientId: 'pat-1',
    studyType: 'xray',
    modalityId: 'mod-1',
  };

  it('takes an advisory lock instead of locking an aggregate query', async () => {
    const { svc, qb, queries } = build(null);

    await svc.createOrder(dto, 'user-1', TENANT);

    expect(queries[0][0]).toContain('pg_advisory_xact_lock');
    expect(qb.setLock).not.toHaveBeenCalled();
    expect(qb.getCount).not.toHaveBeenCalled();
  });

  it('starts at 1 when the month has no orders yet', async () => {
    const { svc, saved } = build(null);

    await svc.createOrder(dto, 'user-1', TENANT);

    expect(saved[0].orderNumber).toMatch(/^IMG\d{6}00001$/);
  });

  it('continues from the highest existing number, not the row count', async () => {
    const { svc, saved, queries } = build(null);
    await svc.createOrder(dto, 'user-1', TENANT);
    const prefix = saved[0].orderNumber.slice(0, 9);

    const second = build(`${prefix}00042`);
    await second.svc.createOrder(dto, 'user-1', TENANT);

    // 43, not 2 — a deleted row cannot make the sequence reuse a number.
    expect(second.saved[0].orderNumber).toBe(`${prefix}00043`);
    expect(queries.length).toBeGreaterThan(0);
  });

  it('scopes the lookup by tenant, which is what the number is unique within', async () => {
    const { svc, qb } = build(null);

    await svc.createOrder(dto, 'user-1', TENANT);

    const tenantClause = qb.andWhere.mock.calls.find((c: any[]) =>
      String(c[0]).includes('tenant_id'),
    );
    expect(tenantClause).toBeDefined();
    expect(tenantClause[1]).toMatchObject({ tid: TENANT });
  });

  it('keys the advisory lock on tenant and month so tenants do not serialise on each other', async () => {
    const { svc, queries } = build(null);

    await svc.createOrder(dto, 'user-1', TENANT);

    expect(queries[0][1][0]).toContain(TENANT);
    expect(queries[0][1][0]).toMatch(/IMG\d{6}/);
  });
});
