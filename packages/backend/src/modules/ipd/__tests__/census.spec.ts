import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BedBoardService } from '../bed-board.service';
import { Ward } from '../../../database/entities/ward.entity';
import { Bed } from '../../../database/entities/bed.entity';
import { Admission } from '../../../database/entities/admission.entity';
import { BedTransfer } from '../../../database/entities/bed-transfer.entity';

const uuid = (tag: string) => `00000000-0000-0000-0000-${tag.padStart(12, '0')}`;
const TENANT_ID = uuid('tenant1');
const FACILITY_ID = uuid('fac1');
const WARD_A = uuid('wardA');
const WARD_B = uuid('wardB');

describe('BedBoardService.getCensus', () => {
  let service: BedBoardService;
  let wardRepo: { find: jest.Mock };
  let bedRepo: { count: jest.Mock };
  let admissionRepo: { find: jest.Mock };

  beforeEach(async () => {
    wardRepo = { find: jest.fn().mockResolvedValue([{ id: WARD_A }, { id: WARD_B }]) };
    bedRepo = { count: jest.fn().mockResolvedValue(10) };
    admissionRepo = { find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BedBoardService,
        { provide: getRepositoryToken(Ward), useValue: wardRepo },
        { provide: getRepositoryToken(Bed), useValue: bedRepo },
        { provide: getRepositoryToken(Admission), useValue: admissionRepo },
        { provide: getRepositoryToken(BedTransfer), useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<BedBoardService>(BedBoardService);
  });

  describe('scoping', () => {
    it("counts only admissions in the requested facility's wards", async () => {
      // totalBeds is facility-scoped, so an unscoped head-count divides every
      // other facility's inpatients by this facility's beds.
      await service.getCensus(FACILITY_ID, '2026-08-10', '2026-08-12', TENANT_ID);

      for (const call of admissionRepo.find.mock.calls) {
        const where = call[0].where;
        const clauses = Array.isArray(where) ? where : [where];
        for (const clause of clauses) {
          expect(clause.wardId).toBeDefined();
        }
      }
    });

    it('reports an empty census for a facility with no wards, without querying admissions', async () => {
      wardRepo.find.mockResolvedValue([]);

      const result = await service.getCensus(FACILITY_ID, '2026-08-10', '2026-08-12', TENANT_ID);

      expect(result.wardCount).toBe(0);
      expect(result.daily).toEqual([]);
      expect(admissionRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('the reporting window', () => {
    it("bounds the window by the hospital's day, not the server's", async () => {
      await service.getCensus(FACILITY_ID, '2026-08-10', '2026-08-12', TENANT_ID);

      const dischargeQuery = admissionRepo.find.mock.calls[0][0];
      const between = dischargeQuery.where.dischargeDate;
      // TypeORM's Between carries its bounds in _value.
      const [from, to] = (between as any)._value as Date[];
      expect(from.toISOString()).toBe('2026-08-09T21:00:00.000Z');
      expect(to.toISOString()).toBe('2026-08-12T20:59:59.999Z');
    });

    it('echoes the days that were asked for', async () => {
      const result = await service.getCensus(FACILITY_ID, '2026-08-10', '2026-08-12', TENANT_ID);

      expect(result.window).toEqual({ from: '2026-08-10', to: '2026-08-12' });
      expect(result.daily.map((d) => d.date)).toEqual(['2026-08-10', '2026-08-11', '2026-08-12']);
    });

    it('rejects a window that runs backwards', async () => {
      await expect(
        service.getCensus(FACILITY_ID, '2026-08-12', '2026-08-10', TENANT_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a window too large to sweep in memory', async () => {
      await expect(
        service.getCensus(FACILITY_ID, '2020-01-01', '2026-08-12', TENANT_ID),
      ).rejects.toThrow(/limited to/);
    });
  });

  describe('occupancy', () => {
    it('counts a patient present at midday local time', async () => {
      admissionRepo.find
        .mockResolvedValueOnce([]) // discharges
        .mockResolvedValueOnce([
          {
            id: uuid('a1'),
            // Admitted 14:00 Kampala on the 10th, still in.
            admissionDate: new Date('2026-08-10T11:00:00Z'),
            dischargeDate: null,
            wardId: WARD_A,
          },
        ]);

      const result = await service.getCensus(FACILITY_ID, '2026-08-10', '2026-08-11', TENANT_ID);

      // Not yet in the bed at midday on the 10th; in it at midday on the 11th.
      expect(result.daily[0].occupied).toBe(0);
      expect(result.daily[1].occupied).toBe(1);
      expect(result.daily[1].occupancyPct).toBe(10);
    });
  });
});
