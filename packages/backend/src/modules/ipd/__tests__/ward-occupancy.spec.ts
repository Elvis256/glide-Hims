import { IpdService } from '../ipd.service';
import { BedStatus } from '../../../database/entities/bed.entity';

/**
 * availableBeds was derived as totalBeds - occupiedBeds, which counts a bed
 * in cleaning, maintenance or reserved as free. On the dev data all three of
 * ICU's unoccupied beds were in cleaning, so the board advertised three free
 * ICU beds when there were none.
 */
describe('getWardOccupancy — availableBeds', () => {
  const TENANT = 'tenant-1';

  const build = (wards: any[], freeRows: any[]) => {
    const wardQb: any = {
      select: jest.fn(() => wardQb),
      addSelect: jest.fn(() => wardQb),
      where: jest.fn(() => wardQb),
      andWhere: jest.fn(() => wardQb),
      getRawMany: jest.fn().mockResolvedValue(wards),
    };
    const bedQb: any = {
      select: jest.fn(() => bedQb),
      addSelect: jest.fn(() => bedQb),
      where: jest.fn(() => bedQb),
      andWhere: jest.fn(() => bedQb),
      groupBy: jest.fn(() => bedQb),
      getRawMany: jest.fn().mockResolvedValue(freeRows),
    };
    const svc = Object.create(IpdService.prototype) as any;
    svc.wardRepo = { createQueryBuilder: jest.fn(() => wardQb) };
    svc.bedRepo = { createQueryBuilder: jest.fn(() => bedQb) };
    return { svc, bedQb };
  };

  it('does not count beds in cleaning as available', async () => {
    // ICU: 6 beds, 3 occupied, 3 in cleaning -> 0 genuinely free
    const { svc } = build(
      [{ id: 'icu', name: 'ICU', totalBeds: 6, occupiedBeds: 3 }],
      [],
    );

    const [icu] = await svc.getWardOccupancy(undefined, TENANT);

    expect(icu.availableBeds).toBe(0);
    expect(icu.occupancyRate).toBe(50);
  });

  it('counts only beds whose status is available', async () => {
    const { svc, bedQb } = build(
      [{ id: 'mwa', name: 'Medical Ward A', totalBeds: 12, occupiedBeds: 3 }],
      [{ wardId: 'mwa', freeBeds: '8' }],
    );

    const [mwa] = await svc.getWardOccupancy(undefined, TENANT);

    // 12 - 3 = 9 by the old arithmetic; one of those is in cleaning
    expect(mwa.availableBeds).toBe(8);
    expect(bedQb.where).toHaveBeenCalledWith('bed.status = :status', {
      status: BedStatus.AVAILABLE,
    });
  });

  it('reports zero for a ward with no bed rows at all', async () => {
    const { svc } = build([{ id: 'w', name: 'New Ward', totalBeds: 0, occupiedBeds: 0 }], []);
    const [w] = await svc.getWardOccupancy(undefined, TENANT);
    expect(w.availableBeds).toBe(0);
    expect(w.occupancyRate).toBe(0);
  });

  it('keeps occupancy rate on total beds, not on available ones', async () => {
    const { svc } = build(
      [{ id: 'icu', name: 'ICU', totalBeds: 6, occupiedBeds: 3 }],
      [{ wardId: 'icu', freeBeds: '1' }],
    );
    const [icu] = await svc.getWardOccupancy(undefined, TENANT);
    expect(icu.availableBeds).toBe(1);
    expect(icu.occupancyRate).toBe(50);
  });
});
