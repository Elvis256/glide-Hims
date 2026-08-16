import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { BedBoardService } from '../bed-board.service';
import { Ward } from '../../../database/entities/ward.entity';
import { Bed } from '../../../database/entities/bed.entity';
import { Admission } from '../../../database/entities/admission.entity';
import { BedTransfer } from '../../../database/entities/bed-transfer.entity';

/**
 * Bed-day pricing is the whole inpatient bill, and it was reachable only
 * through discharge — where every existing test mocks it out. These exercise
 * the arithmetic directly.
 */

const uuid = (tag: string) => `00000000-0000-0000-0000-${tag.padStart(12, '0')}`;
const TENANT_ID = uuid('tenant1');
const ADMISSION_ID = uuid('adm1');

const bed = (num: string, rate: number) => ({ id: uuid(num), bedNumber: num, dailyRate: rate });
const ward = (name: string) => ({ id: uuid(name), name });

const GENERAL = bed('G01', 20000);
const ICU = bed('ICU1', 150000);
const GEN_WARD = ward('General');
const ICU_WARD = ward('ICU');

describe('BedBoardService.computeBedDayCharges', () => {
  let service: BedBoardService;
  let admissionRepo: { findOne: jest.Mock; query: jest.Mock };
  let transferRepo: { find: jest.Mock };

  beforeEach(async () => {
    admissionRepo = { findOne: jest.fn(), query: jest.fn().mockResolvedValue([]) };
    transferRepo = { find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BedBoardService,
        { provide: getRepositoryToken(Ward), useValue: {} },
        { provide: getRepositoryToken(Bed), useValue: {} },
        { provide: getRepositoryToken(Admission), useValue: admissionRepo },
        { provide: getRepositoryToken(BedTransfer), useValue: transferRepo },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<BedBoardService>(BedBoardService);
  });

  /** An admission with no transfers, sitting in the general bed. */
  const admission = (admissionDate: string, dischargeDate: string | null) => ({
    id: ADMISSION_ID,
    tenantId: TENANT_ID,
    admissionDate: new Date(admissionDate),
    dischargeDate: dischargeDate ? new Date(dischargeDate) : null,
    bed: GENERAL,
    ward: GEN_WARD,
  });

  const transfer = (at: string, from: any, fromW: any, to: any, toW: any) => ({
    transferTime: new Date(at),
    fromBed: from,
    fromWard: fromW,
    toBed: to,
    toWard: toW,
  });

  describe('a simple stay', () => {
    it('bills three nights for a three-day stay', async () => {
      admissionRepo.findOne.mockResolvedValue(
        admission('2026-08-10T09:00:00Z', '2026-08-13T09:00:00Z'),
      );

      const lines = await service.computeBedDayCharges(ADMISSION_ID, TENANT_ID);

      expect(lines).toHaveLength(1);
      expect(lines[0].quantity).toBe(3);
      expect(lines[0].unitPrice).toBe(20000);
    });

    it('bills a minimum of one day for a same-day admission and discharge', async () => {
      admissionRepo.findOne.mockResolvedValue(
        admission('2026-08-10T09:00:00Z', '2026-08-10T15:00:00Z'),
      );

      const lines = await service.computeBedDayCharges(ADMISSION_ID, TENANT_ID);

      expect(lines[0].quantity).toBe(1);
    });
  });

  describe('a stay interrupted by transfers', () => {
    it('prices each segment at its own bed rate, not the final bed rate', async () => {
      admissionRepo.findOne.mockResolvedValue({
        ...admission('2026-08-10T09:00:00Z', '2026-08-14T09:00:00Z'),
        bed: ICU,
        ward: ICU_WARD,
      });
      transferRepo.find.mockResolvedValue([
        transfer('2026-08-12T09:00:00Z', GENERAL, GEN_WARD, ICU, ICU_WARD),
      ]);

      const lines = await service.computeBedDayCharges(ADMISSION_ID, TENANT_ID);

      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatchObject({ unitPrice: 20000, quantity: 2 });
      expect(lines[1]).toMatchObject({ unitPrice: 150000, quantity: 2 });
    });

    it('does not inflate the total when several transfers happen within one day', async () => {
      // Admitted 08:00, moved to ICU at 14:00, moved back at 20:00, home the
      // next morning: about 26 hours in hospital, so two bed-days at most.
      admissionRepo.findOne.mockResolvedValue(
        admission('2026-08-10T08:00:00Z', '2026-08-11T10:00:00Z'),
      );
      transferRepo.find.mockResolvedValue([
        transfer('2026-08-10T14:00:00Z', GENERAL, GEN_WARD, ICU, ICU_WARD),
        transfer('2026-08-10T20:00:00Z', ICU, ICU_WARD, GENERAL, GEN_WARD),
      ]);

      const lines = await service.computeBedDayCharges(ADMISSION_ID, TENANT_ID);
      const totalDays = lines.reduce((n, l) => n + l.quantity, 0);

      expect(totalDays).toBeLessThanOrEqual(2);
    });

    it('bills the same number of days as the identical stay without a transfer', async () => {
      const admitted = '2026-08-10T08:00:00Z';
      const discharged = '2026-08-14T12:00:00Z';

      admissionRepo.findOne.mockResolvedValue(admission(admitted, discharged));
      const untransferred = await service.computeBedDayCharges(ADMISSION_ID, TENANT_ID);

      admissionRepo.findOne.mockResolvedValue(admission(admitted, discharged));
      transferRepo.find.mockResolvedValue([
        transfer('2026-08-11T09:00:00Z', GENERAL, GEN_WARD, ICU, ICU_WARD),
        transfer('2026-08-12T17:00:00Z', ICU, ICU_WARD, GENERAL, GEN_WARD),
      ]);
      const transferred = await service.computeBedDayCharges(ADMISSION_ID, TENANT_ID);

      const days = (ls: { quantity: number }[]) => ls.reduce((n, l) => n + l.quantity, 0);
      expect(days(transferred)).toBe(days(untransferred));
    });
  });

  describe('the first night billed at admission', () => {
    it('is deducted once so the discharge invoice does not bill it again', async () => {
      admissionRepo.findOne.mockResolvedValue(
        admission('2026-08-10T09:00:00Z', '2026-08-13T09:00:00Z'),
      );
      admissionRepo.query.mockResolvedValue([{ '?column?': 1 }]); // a priced admission line exists

      const lines = await service.computeBedDayCharges(ADMISSION_ID, TENANT_ID);

      expect(lines[0].quantity).toBe(2); // 3 days less the pre-billed night
    });

    it('is not double-deducted when the stay has already been invoiced in full', async () => {
      // The discharge invoice's own bed lines carry reference_type 'admission'
      // and reference_id of this admission, exactly like the first-night line.
      admissionRepo.findOne.mockResolvedValue(
        admission('2026-08-10T09:00:00Z', '2026-08-13T09:00:00Z'),
      );
      admissionRepo.query.mockResolvedValue([{ '?column?': 1 }]);

      const first = await service.computeBedDayCharges(ADMISSION_ID, TENANT_ID);
      const second = await service.computeBedDayCharges(ADMISSION_ID, TENANT_ID);

      // Re-running must not silently produce a second full-price stay.
      expect(second.reduce((n, l) => n + l.quantity, 0)).toBe(
        first.reduce((n, l) => n + l.quantity, 0),
      );
    });
  });

  describe('beds with no rate configured', () => {
    it('produces no line rather than a zero-value one', async () => {
      admissionRepo.findOne.mockResolvedValue({
        ...admission('2026-08-10T09:00:00Z', '2026-08-13T09:00:00Z'),
        bed: bed('X01', 0),
      });

      const lines = await service.computeBedDayCharges(ADMISSION_ID, TENANT_ID);

      expect(lines).toHaveLength(0);
    });
  });
});
