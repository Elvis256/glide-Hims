import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ChronicCareService } from '../chronic-care.service';
import {
  RegisterChronicConditionDto,
  UpdateChronicConditionDto,
  ChronicPatientsQueryDto,
  SendBulkReminderDto,
  RecordVisitDto,
} from '../dto/chronic-care.dto';
import {
  PatientChronicCondition,
  ChronicStatus,
} from '../../../database/entities/patient-chronic-condition.entity';
import { Patient } from '../../../database/entities/patient.entity';
import { Diagnosis } from '../../../database/entities/diagnosis.entity';
import { NotificationsService } from '../../notifications/notifications.service';

/**
 * Validation-hardening contract for the chronic-care module:
 *
 * 1. DTOs reject malformed/oversized inputs (notes, medications, search,
 *    bulk reminder payloads, interval/days bounds, channel enum).
 * 2. ChronicCareService rejects calls missing tenantId.
 * 3. registerCondition rejects patient/diagnosis UUIDs from a different
 *    tenant, and rejects non-chronic diagnoses.
 * 4. recordVisit / updateCondition / getPatientConditions raise
 *    NotFoundException for cross-tenant entities (not generic 500s).
 * 5. sendBulkReminders refuses if any patientId is outside the tenant.
 */
describe('ChronicCare validation', () => {
  const TENANT = 'd13b5d82-27f8-44b9-a428-e582d380b16f';
  const OTHER_TENANT = 'a1b2c3d4-e5f6-4789-9abc-def012345678';
  const FACILITY = '11111111-2222-4333-8444-555555555555';
  const PATIENT = '22222222-3333-4444-8555-666666666666';
  const DIAGNOSIS = '33333333-4444-4555-8666-777777777777';
  const CONDITION = '44444444-5555-4666-8777-888888888888';

  // ---------- DTO validation -------------------------------------------------
  describe('DTOs', () => {
    async function violations(dtoClass: any, payload: any) {
      const obj = plainToInstance(dtoClass, payload);
      const errs = await validate(obj as object, { whitelist: false });
      return errs.flatMap((e) => Object.values(e.constraints || {}));
    }

    it('RegisterChronicConditionDto accepts a minimal valid payload', async () => {
      const msgs = await violations(RegisterChronicConditionDto, {
        patientId: PATIENT,
        diagnosisId: DIAGNOSIS,
        diagnosedDate: '2025-01-01',
      });
      expect(msgs).toEqual([]);
    });

    it('RegisterChronicConditionDto rejects notes > 2000 chars', async () => {
      const msgs = await violations(RegisterChronicConditionDto, {
        patientId: PATIENT,
        diagnosisId: DIAGNOSIS,
        diagnosedDate: '2025-01-01',
        notes: 'x'.repeat(2001),
      });
      expect(msgs.join('|')).toMatch(/shorter than or equal to 2000/);
    });

    it('RegisterChronicConditionDto rejects > 50 medications', async () => {
      const msgs = await violations(RegisterChronicConditionDto, {
        patientId: PATIENT,
        diagnosisId: DIAGNOSIS,
        diagnosedDate: '2025-01-01',
        currentMedications: Array(51).fill('Aspirin'),
      });
      expect(msgs.join('|')).toMatch(/contain no more than 50 elements/);
    });

    it('RegisterChronicConditionDto rejects out-of-range followUpIntervalDays', async () => {
      const msgs = await violations(RegisterChronicConditionDto, {
        patientId: PATIENT,
        diagnosisId: DIAGNOSIS,
        diagnosedDate: '2025-01-01',
        followUpIntervalDays: 9999,
      });
      expect(msgs.join('|')).toMatch(/must not be greater than 365/);
    });

    it('RegisterChronicConditionDto rejects out-of-range reminderDaysBefore', async () => {
      const msgs = await violations(RegisterChronicConditionDto, {
        patientId: PATIENT,
        diagnosisId: DIAGNOSIS,
        diagnosedDate: '2025-01-01',
        reminderDaysBefore: 999,
      });
      expect(msgs.join('|')).toMatch(/must not be greater than 60/);
    });

    it('ChronicPatientsQueryDto rejects search > 120 chars', async () => {
      const msgs = await violations(ChronicPatientsQueryDto, {
        search: 'x'.repeat(121),
      });
      expect(msgs.join('|')).toMatch(/shorter than or equal to 120/);
    });

    it('ChronicPatientsQueryDto caps limit at 200', async () => {
      const msgs = await violations(ChronicPatientsQueryDto, {
        limit: 9999,
      });
      expect(msgs.join('|')).toMatch(/must not be greater than 200/);
    });

    it('SendBulkReminderDto requires at least one patientId', async () => {
      const msgs = await violations(SendBulkReminderDto, {
        patientIds: [],
        subject: 'Hi',
        message: 'Reminder',
      });
      expect(msgs.join('|')).toMatch(/should not be empty/);
    });

    it('SendBulkReminderDto rejects > 500 patientIds', async () => {
      const msgs = await violations(SendBulkReminderDto, {
        patientIds: Array(501).fill(PATIENT),
        subject: 'Hi',
        message: 'Reminder',
      });
      expect(msgs.join('|')).toMatch(/contain no more than 500 elements/);
    });

    it('SendBulkReminderDto rejects unknown channel', async () => {
      const msgs = await violations(SendBulkReminderDto, {
        patientIds: [PATIENT],
        subject: 'Hi',
        message: 'Reminder',
        channel: 'pager',
      });
      expect(msgs.join('|')).toMatch(/channel must be one of/);
    });

    it('SendBulkReminderDto rejects message > 2000 chars', async () => {
      const msgs = await violations(SendBulkReminderDto, {
        patientIds: [PATIENT],
        subject: 'Hi',
        message: 'x'.repeat(2001),
      });
      expect(msgs.join('|')).toMatch(/shorter than or equal to 2000/);
    });

    it('RecordVisitDto accepts an ISO date or empty body', async () => {
      expect(await violations(RecordVisitDto, {})).toEqual([]);
      expect(await violations(RecordVisitDto, { nextFollowUpDate: '2025-06-01' })).toEqual([]);
    });
  });

  // ---------- Service-level tenant guards -----------------------------------
  describe('Service tenant isolation', () => {
    let service: ChronicCareService;
    let chronicRepo: any;
    let patientRepo: any;
    let diagnosisRepo: any;
    let notifications: any;

    beforeEach(async () => {
      chronicRepo = {
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn((x) => x),
        save: jest.fn(async (x) => ({ id: CONDITION, ...x })),
        count: jest.fn().mockResolvedValue(0),
        createQueryBuilder: jest.fn(),
      };
      patientRepo = { findOne: jest.fn(), find: jest.fn() };
      diagnosisRepo = { findOne: jest.fn(), find: jest.fn() };
      notifications = {
        sendImmediateReminder: jest.fn(),
        scheduleReminder: jest.fn(),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ChronicCareService,
          { provide: getRepositoryToken(PatientChronicCondition), useValue: chronicRepo },
          { provide: getRepositoryToken(Patient), useValue: patientRepo },
          { provide: getRepositoryToken(Diagnosis), useValue: diagnosisRepo },
          { provide: NotificationsService, useValue: notifications },
        ],
      }).compile();
      service = module.get(ChronicCareService);
    });

    it('registerCondition throws ForbiddenException when tenantId missing', async () => {
      await expect(
        service.registerCondition(
          FACILITY,
          {
            patientId: PATIENT,
            diagnosisId: DIAGNOSIS,
            diagnosedDate: new Date(),
          } as any,
          'user-1',
          undefined,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('registerCondition throws BadRequestException when facilityId missing', async () => {
      await expect(
        service.registerCondition(
          '',
          {
            patientId: PATIENT,
            diagnosisId: DIAGNOSIS,
            diagnosedDate: new Date(),
          } as any,
          'user-1',
          TENANT,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('registerCondition rejects patient from another tenant', async () => {
      patientRepo.findOne.mockResolvedValueOnce(null); // patient not in tenant
      await expect(
        service.registerCondition(
          FACILITY,
          {
            patientId: PATIENT,
            diagnosisId: DIAGNOSIS,
            diagnosedDate: new Date(),
          } as any,
          'user-1',
          TENANT,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(patientRepo.findOne).toHaveBeenCalledWith({
        where: { id: PATIENT, tenantId: TENANT },
      });
    });

    it('registerCondition rejects non-chronic diagnosis', async () => {
      patientRepo.findOne.mockResolvedValueOnce({ id: PATIENT });
      diagnosisRepo.findOne.mockResolvedValueOnce({ id: DIAGNOSIS, isChronic: false });
      await expect(
        service.registerCondition(
          FACILITY,
          {
            patientId: PATIENT,
            diagnosisId: DIAGNOSIS,
            diagnosedDate: new Date(),
          } as any,
          'user-1',
          TENANT,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updateCondition returns NotFoundException (not Error) for cross-tenant id', async () => {
      chronicRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.updateCondition(CONDITION, { notes: 'x' } as any, TENANT),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('recordVisit rejects invalid nextFollowUpDate', async () => {
      chronicRepo.findOne.mockResolvedValueOnce({ id: CONDITION, followUpIntervalDays: 30 });
      await expect(
        service.recordVisit(CONDITION, new Date('not-a-date'), TENANT),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('sendBulkReminders rejects when any patientId is outside the tenant', async () => {
      patientRepo.find.mockResolvedValueOnce([{ id: PATIENT }]); // only one of the two known
      const other = '99999999-aaaa-4bbb-8ccc-dddddddddddd';
      await expect(
        service.sendBulkReminders(
          FACILITY,
          {
            patientIds: [PATIENT, other],
            subject: 'Hi',
            message: 'Reminder',
          } as any,
          'user-1',
          TENANT,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(notifications.sendImmediateReminder).not.toHaveBeenCalled();
    });

    it('getOverduePatients caps limit at 500', async () => {
      chronicRepo.find.mockResolvedValueOnce([]);
      await service.getOverduePatients(FACILITY, 99999, TENANT);
      const args = chronicRepo.find.mock.calls[0][0];
      expect(args.take).toBe(500);
    });
  });
});
