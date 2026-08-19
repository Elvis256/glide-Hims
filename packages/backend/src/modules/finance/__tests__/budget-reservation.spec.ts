import { BudgetService } from '../budget.service';
import { ReservationStatus } from '../../../database/entities/budget-reservation.entity';

describe('reserveBudget', () => {
  const TENANT = 'tenant-1';

  const build = ({
    allocation = 1_000_000 as number | null,
    reservations = [] as any[],
    existing = null as any,
  }) => {
    const saved: any[] = [];
    const budgetQb: any = {
      setLock: jest.fn(() => budgetQb),
      where: jest.fn(() => budgetQb),
      andWhere: jest.fn(() => budgetQb),
      orderBy: jest.fn(() => budgetQb),
      getOne: jest.fn().mockResolvedValue(
        allocation === null ? null : { id: 'b-1', totalBudgetAllocation: allocation },
      ),
    };
    const manager: any = {
      getRepository: (entity: any) => {
        if (entity?.name === 'FacilityBudget') {
          return { createQueryBuilder: jest.fn(() => budgetQb) };
        }
        return {
          findOne: jest.fn().mockResolvedValue(existing),
          // Honour the status filter the service asks for, so these tests
          // exercise which statuses it counts rather than assuming them.
          find: jest.fn(async ({ where }: any) => {
            const wanted: string[] = where?.status?.value ?? [];
            return wanted.length
              ? reservations.filter((r: any) => wanted.includes(r.status))
              : reservations;
          }),
          create: jest.fn((x: any) => x),
          save: jest.fn(async (x: any) => {
            saved.push(x);
            return { ...x, id: 'res-1' };
          }),
        };
      },
    };
    const svc = Object.create(BudgetService.prototype) as any;
    svc.dataSource = { transaction: async (cb: any) => cb(manager) };
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    return { svc, saved };
  };

  const res = (amount: number, status: ReservationStatus) => ({
    reservedAmount: amount,
    status,
  });

  it('counts money already spent against the allocation', async () => {
    // 900k of the 1m allocation has been received and marked SPENT. Before,
    // SPENT was excluded, so the allocation replenished itself on delivery and
    // this 200k order would have sailed through.
    const { svc } = build({
      allocation: 1_000_000,
      reservations: [res(900_000, ReservationStatus.SPENT)],
    });

    await expect(svc.reserveBudget('fac-1', 'po-2', 'PO', 200_000, TENANT)).rejects.toThrow(
      /exceeds remaining budget capacity 100000/,
    );
  });

  it('frees capacity again when a commitment is released', async () => {
    const { svc, saved } = build({
      allocation: 1_000_000,
      reservations: [res(900_000, ReservationStatus.RELEASED)],
    });

    await svc.reserveBudget('fac-1', 'po-2', 'PO', 200_000, TENANT);
    expect(saved[0].reservedAmount).toBe(200_000);
  });

  it('counts outstanding commitments', async () => {
    const { svc } = build({
      allocation: 1_000_000,
      reservations: [res(600_000, ReservationStatus.PENDING), res(300_000, ReservationStatus.APPROVED)],
    });

    await expect(svc.reserveBudget('fac-1', 'po-2', 'PO', 200_000, TENANT)).rejects.toThrow(
      /capacity 100000/,
    );
  });

  it('does not encumber the same document twice', async () => {
    const already = { id: 'res-existing', status: ReservationStatus.PENDING, reservedAmount: 500 };
    const { svc, saved } = build({ existing: already });

    const out = await svc.reserveBudget('fac-1', 'po-1', 'PO', 500, TENANT);

    expect(out).toBe(already);
    expect(saved).toHaveLength(0);
  });

  it('treats an already-spent document as still encumbered', async () => {
    const already = { id: 'res-existing', status: ReservationStatus.SPENT, reservedAmount: 500 };
    const { svc, saved } = build({ existing: already });

    await svc.reserveBudget('fac-1', 'po-1', 'PO', 500, TENANT);
    expect(saved).toHaveLength(0);
  });

  it('still refuses a non-positive amount', async () => {
    const { svc } = build({});
    await expect(svc.reserveBudget('fac-1', 'po-1', 'PO', 0, TENANT)).rejects.toThrow(
      /must be positive/,
    );
  });

  it('refuses when the facility has no active budget', async () => {
    const { svc } = build({ allocation: null });
    await expect(svc.reserveBudget('fac-1', 'po-1', 'PO', 100, TENANT)).rejects.toThrow(
      /No active budget/,
    );
  });
});
