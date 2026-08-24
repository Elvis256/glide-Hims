import { ProcurementService } from '../procurement.service';

/**
 * getApprovalThreshold lazily creates the facility's default threshold row.
 * (facilityId, tenantId) is UNIQUE, so two approvals racing on a facility
 * that has no row yet both try to insert and one loses. Before the fix the
 * loser's ForbiddenException-or-approve decision died on a 23505 instead.
 */
describe('getApprovalThreshold — lazy bootstrap', () => {
  const TENANT = 'tenant-1';
  const FACILITY = 'facility-1';

  const build = (repo: any) => {
    const svc = Object.create(ProcurementService.prototype) as any;
    svc.approvalThresholdRepo = repo;
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    return svc;
  };

  const call = (svc: any) => svc.getApprovalThreshold(FACILITY, TENANT);

  it('returns the existing row without writing when one is configured', async () => {
    const existing = { id: 't1', level1MaxAmount: 750000 };
    const repo = {
      findOne: jest.fn().mockResolvedValue(existing),
      create: jest.fn(),
      save: jest.fn(),
    };

    await expect(call(build(repo))).resolves.toBe(existing);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('creates UGX defaults when the facility has none', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };

    const result = await call(build(repo));

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      facilityId: FACILITY,
      tenantId: TENANT,
      level1MaxAmount: 500000,
      level2MaxAmount: 5000000,
      level3MaxAmount: 50000000,
      isActive: true,
    });
  });

  it('adopts the winner’s row when a concurrent insert wins the race', async () => {
    const winner = { id: 'winner', level1MaxAmount: 500000 };
    const repo = {
      // first read: nothing yet. second read (after 23505): the winner's row.
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(winner),
      create: jest.fn((x) => x),
      save: jest.fn().mockRejectedValue(
        Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: '23505',
        }),
      ),
    };

    await expect(call(build(repo))).resolves.toBe(winner);
    expect(repo.findOne).toHaveBeenCalledTimes(2);
  });

  it('rethrows a non-unique failure rather than silently continuing', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x) => x),
      save: jest.fn().mockRejectedValue(
        Object.assign(new Error('permission denied for table'), { code: '42501' }),
      ),
    };

    await expect(call(build(repo))).rejects.toThrow('permission denied');
    expect(repo.findOne).toHaveBeenCalledTimes(1);
  });

  it('rethrows if the unique violation leaves nothing to adopt', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x) => x),
      save: jest.fn().mockRejectedValue(
        Object.assign(new Error('duplicate key value'), { code: '23505' }),
      ),
    };

    await expect(call(build(repo))).rejects.toThrow('duplicate key');
  });
});
