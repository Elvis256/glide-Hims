import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReportsService } from '../reports.service';
import {
  DashboardQueryDto,
  HmisMonthlyDto,
  HmisWeeklyDto,
  ExpiryQueryDto,
  CollectionsQueryDto,
} from '../reports.dto';

/**
 * Validation-hardening contract for the reports module:
 *
 * 1. DTOs reject malformed inputs (non-ISO dates, out-of-range periods,
 *    oversize daysAhead, oversize free-text filters).
 * 2. ReportsService rejects facility/department UUIDs that don't belong
 *    to the caller's tenant (multi-tenant isolation).
 * 3. resolveRange rejects inverted and over-wide windows.
 * 4. parsePeriodMonth / parsePeriodWeek reject out-of-range periods.
 */
describe('Reports validation', () => {
  const FACILITY = 'd13b5d82-27f8-44b9-a428-e582d380b16f';
  const DEPT = 'a1b2c3d4-e5f6-4789-9abc-def012345678';
  const TENANT = 'tenant-A';

  // ---------- DTO validation --------------------------------------------
  describe('DTOs', () => {
    async function violations(dtoClass: any, payload: any) {
      const obj = plainToInstance(dtoClass, payload);
      const errs = await validate(obj as object);
      return errs.flatMap((e) => Object.values(e.constraints || {}));
    }

    it('DashboardQueryDto rejects a non-ISO startDate', async () => {
      const msgs = await violations(DashboardQueryDto, {
        facilityId: FACILITY,
        startDate: 'last-monday',
        endDate: '2025-01-01',
      });
      expect(msgs.join('|')).toMatch(/startDate must be an ISO 8601 date/);
    });

    it('DashboardQueryDto accepts well-formed ISO dates', async () => {
      const msgs = await violations(DashboardQueryDto, {
        facilityId: FACILITY,
        startDate: '2025-01-01',
        endDate: '2025-02-01T00:00:00Z',
      });
      expect(msgs).toEqual([]);
    });

    it('CollectionsQueryDto rejects paymentMethod > 64 chars', async () => {
      const msgs = await violations(CollectionsQueryDto, {
        facilityId: FACILITY,
        paymentMethod: 'x'.repeat(65),
      });
      expect(msgs.join('|')).toMatch(/shorter than or equal to 64/);
    });

    it('ExpiryQueryDto rejects daysAhead > 1825', async () => {
      const msgs = await violations(ExpiryQueryDto, {
        facilityId: FACILITY,
        daysAhead: 100000,
      });
      expect(msgs.join('|')).toMatch(/must not be greater than 1825/);
    });

    it('ExpiryQueryDto coerces string daysAhead via @Transform', async () => {
      const msgs = await violations(ExpiryQueryDto, {
        facilityId: FACILITY,
        daysAhead: '30',
      });
      expect(msgs).toEqual([]);
    });

    it('HmisMonthlyDto rejects pre-2000 / post-2099 years', async () => {
      const tooOld = await violations(HmisMonthlyDto, { facilityId: FACILITY, period: '1999-12' });
      const tooNew = await violations(HmisMonthlyDto, { facilityId: FACILITY, period: '2100-01' });
      expect(tooOld.join('|')).toMatch(/year between 2000 and 2099/);
      expect(tooNew.join('|')).toMatch(/year between 2000 and 2099/);
    });

    it('HmisMonthlyDto accepts a valid period', async () => {
      const msgs = await violations(HmisMonthlyDto, { facilityId: FACILITY, period: '2025-03' });
      expect(msgs).toEqual([]);
    });

    it('HmisWeeklyDto rejects week 54', async () => {
      const msgs = await violations(HmisWeeklyDto, { facilityId: FACILITY, week: '2025-54' });
      expect(msgs.length).toBeGreaterThan(0);
    });
  });

  // ---------- Service-level checks --------------------------------------
  describe('ReportsService.requireFacility / requireDepartment / resolveRange', () => {
    let svc: ReportsService;
    let dsQueryMock: jest.Mock;

    beforeEach(async () => {
      dsQueryMock = jest.fn();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          {
            provide: getDataSourceToken(),
            useValue: { query: dsQueryMock } as Partial<DataSource>,
          },
        ],
      }).compile();
      svc = module.get(ReportsService);
    });

    it('rejects a facility that does not belong to the tenant', async () => {
      dsQueryMock.mockResolvedValueOnce([]); // requireFacility → no row
      await expect(svc.getDashboard({ facilityId: FACILITY } as any, TENANT)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('accepts a facility that belongs to the tenant and proceeds to query', async () => {
      dsQueryMock
        .mockResolvedValueOnce([{ ok: 1 }]) // requireFacility
        .mockResolvedValue([]); // all report sub-queries
      const res = await svc.getDashboard(
        { facilityId: FACILITY, startDate: '2025-01-01', endDate: '2025-02-01' } as any,
        TENANT,
      );
      expect(res).toMatchObject({ visits: 0, revenue: 0 });
      expect(dsQueryMock.mock.calls[0][0]).toContain('FROM facilities');
    });

    it('rejects a department that does not belong to the facility', async () => {
      dsQueryMock
        .mockResolvedValueOnce([{ ok: 1 }]) // requireFacility ok
        .mockResolvedValueOnce([]); // requireDepartment empty
      await expect(
        svc.getDashboard({ facilityId: FACILITY, departmentId: DEPT } as any, TENANT),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an inverted date range (start > end)', async () => {
      dsQueryMock.mockResolvedValueOnce([{ ok: 1 }]);
      await expect(
        svc.getDashboard(
          { facilityId: FACILITY, startDate: '2025-12-01', endDate: '2025-01-01' } as any,
          TENANT,
        ),
      ).rejects.toThrow(/startDate must be on or before endDate/);
    });

    it('rejects a date range wider than MAX_RANGE_DAYS', async () => {
      dsQueryMock.mockResolvedValueOnce([{ ok: 1 }]);
      await expect(
        svc.getDashboard(
          { facilityId: FACILITY, startDate: '2010-01-01', endDate: '2025-01-01' } as any,
          TENANT,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a missing tenant context', async () => {
      await expect(svc.getDashboard({ facilityId: FACILITY } as any, undefined)).rejects.toThrow(
        /Missing tenant context/,
      );
    });

    it('getStock rejects a store that does not belong to facility/tenant', async () => {
      const STORE = 'b1b2c3d4-e5f6-4789-9abc-def012345678';
      dsQueryMock
        .mockResolvedValueOnce([{ ok: 1 }]) // requireFacility
        .mockResolvedValueOnce([]); // requireStore -> empty
      await expect(
        svc.getStock({ facilityId: FACILITY, storeId: STORE } as any, TENANT),
      ).rejects.toThrow(NotFoundException);
      // Confirm the second call was the store check (not an accidental skip).
      expect(dsQueryMock.mock.calls[1][0]).toMatch(/FROM stores/);
    });

    it('getStock accepts when both facility and store belong to the tenant', async () => {
      const STORE = 'b1b2c3d4-e5f6-4789-9abc-def012345678';
      dsQueryMock
        .mockResolvedValueOnce([{ ok: 1 }]) // requireFacility
        .mockResolvedValueOnce([{ ok: 1 }]) // requireStore
        .mockResolvedValueOnce([]); // stock query
      const res = await svc.getStock({ facilityId: FACILITY, storeId: STORE } as any, TENANT);
      expect(res).toMatchObject({ totalItems: 0, totalValue: 0, lowStock: 0 });
    });

    it('getConsumption rejects an item that does not belong to the tenant', async () => {
      const ITEM = 'c1c2c3d4-e5f6-4789-9abc-def012345678';
      dsQueryMock
        .mockResolvedValueOnce([{ ok: 1 }]) // requireFacility
        .mockResolvedValueOnce([]); // requireItem -> empty
      await expect(
        svc.getConsumption(
          {
            facilityId: FACILITY,
            itemId: ITEM,
            startDate: '2025-01-01',
            endDate: '2025-02-01',
          } as any,
          TENANT,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(dsQueryMock.mock.calls[1][0]).toMatch(/FROM items/);
    });

    it('getConsumption accepts when both facility and item belong to the tenant', async () => {
      const ITEM = 'c1c2c3d4-e5f6-4789-9abc-def012345678';
      dsQueryMock
        .mockResolvedValueOnce([{ ok: 1 }]) // requireFacility
        .mockResolvedValueOnce([{ ok: 1 }]) // requireItem
        .mockResolvedValue([]); // consumption sub-queries
      const res = await svc.getConsumption(
        {
          facilityId: FACILITY,
          itemId: ITEM,
          startDate: '2025-01-01',
          endDate: '2025-02-01',
        } as any,
        TENANT,
      );
      expect(res).toHaveProperty('byItem');
    });
  });

  // ---------- parsePeriod* ----------------------------------------------
  describe('parsePeriodMonth / parsePeriodWeek bounds', () => {
    let svc: ReportsService;
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          {
            provide: getDataSourceToken(),
            useValue: { query: jest.fn() } as Partial<DataSource>,
          },
        ],
      }).compile();
      svc = module.get(ReportsService);
    });

    it('parsePeriodMonth rejects year 1999', () => {
      expect(() => (svc as any).parsePeriodMonth('1999-12')).toThrow(BadRequestException);
    });

    it('parsePeriodMonth accepts year 2025', () => {
      const { start, end } = (svc as any).parsePeriodMonth('2025-03');
      expect(start.toISOString()).toBe('2025-03-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2025-04-01T00:00:00.000Z');
    });

    it('parsePeriodWeek rejects week 0 and week 54', () => {
      expect(() => (svc as any).parsePeriodWeek('2025-00')).toThrow(BadRequestException);
      expect(() => (svc as any).parsePeriodWeek('2025-54')).toThrow(BadRequestException);
    });
  });
});
