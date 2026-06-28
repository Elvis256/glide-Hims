import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SurgeryService } from '../surgery.service';
import { Theatre, TheatreStatus } from '../../../database/entities/theatre.entity';
import {
  SurgeryCase,
  SurgeryStatus,
  SurgeryPriority,
  SurgeryType,
} from '../../../database/entities/surgery-case.entity';
import { SurgeryConsumable } from '../../../database/entities/surgery-consumable.entity';
import { Item } from '../../../database/entities/inventory.entity';
import { InventoryService } from '../../inventory/inventory.service';
import { AuditLogService } from '../../../common/interceptors/audit-log.service';
import { DataSource } from 'typeorm';

// ---- Mock transaction manager ----
const mockManager = {
  create: jest.fn((entity, data) => ({ id: 'new-id', ...data })),
  save: jest.fn((entity) => Promise.resolve({ id: 'new-id', ...entity })),
  find: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getCount: jest.fn().mockResolvedValue(0),
  })),
};

const mockDataSource = {
  transaction: jest.fn((cb) => cb(mockManager)),
};

// ---- Repo factories ----
const mockTheatreRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};

const mockSurgeryCaseRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  findAndCount: jest.fn(),
};

const mockConsumableRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  softRemove: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockItemRepo = {
  findOne: jest.fn(),
};

const mockInventoryService = {
  deductStock: jest.fn(),
};

const mockAuditLogService = {
  log: jest.fn().mockResolvedValue(undefined),
};

// ---- Helpers ----
function buildScheduleDto(overrides: Partial<any> = {}) {
  return {
    facilityId: 'facility-1',
    patientId: 'patient-1',
    theatreId: 'theatre-1',
    procedureName: 'Appendectomy',
    procedureCode: 'APX-001',
    surgeryType: SurgeryType.MAJOR,
    priority: SurgeryPriority.ELECTIVE,
    scheduledDate: '2026-07-01',
    scheduledTime: '09:00',
    estimatedDurationMinutes: 120,
    leadSurgeonId: 'surgeon-1',
    ...overrides,
  };
}

function buildSurgeryCase(overrides: Partial<SurgeryCase> = {}): Partial<SurgeryCase> {
  return {
    id: 'case-1',
    caseNumber: 'SUR20260701-0001',
    patientId: 'patient-1',
    theatreId: 'theatre-1',
    facilityId: 'facility-1',
    procedureName: 'Appendectomy',
    surgeryType: SurgeryType.MAJOR,
    priority: SurgeryPriority.ELECTIVE,
    status: SurgeryStatus.SCHEDULED,
    scheduledDate: new Date('2026-07-01'),
    scheduledTime: '09:00',
    estimatedDurationMinutes: 120,
    leadSurgeonId: 'surgeon-1',
    consentSigned: false,
    preOpChecklist: null as any,
    preOpNotes: null as any,
    ...overrides,
  };
}

describe('SurgeryService', () => {
  let service: SurgeryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurgeryService,
        { provide: getRepositoryToken(Theatre), useValue: mockTheatreRepo },
        { provide: getRepositoryToken(SurgeryCase), useValue: mockSurgeryCaseRepo },
        { provide: getRepositoryToken(SurgeryConsumable), useValue: mockConsumableRepo },
        { provide: getRepositoryToken(Item), useValue: mockItemRepo },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<SurgeryService>(SurgeryService);
  });

  // ================================================================
  // 1. scheduleSurgery — happy path
  // ================================================================
  describe('scheduleSurgery – happy path', () => {
    it('should schedule a surgery when the theatre has no conflicts', async () => {
      const dto = buildScheduleDto();
      const tenantId = 'tenant-1';
      const userId = 'user-1';

      // Theatre found via pessimistic-lock query
      const qb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'theatre-1', name: 'Theatre A' }),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockManager.createQueryBuilder.mockReturnValue(qb);

      // No existing cases → no conflicts
      mockManager.find.mockResolvedValue([]);

      // generateCaseNumber uses surgeryCaseRepo.count (called outside transaction scope)
      mockSurgeryCaseRepo.count.mockResolvedValue(0);

      // manager.create returns the entity, manager.save resolves it
      mockManager.create.mockImplementation((_entity: any, data: any) => ({
        id: 'new-id',
        ...data,
      }));
      mockManager.save.mockImplementation((entity: any) =>
        Promise.resolve({ ...entity, id: entity.id ?? 'new-id' }),
      );

      const result = await service.scheduleSurgery(dto, userId, tenantId);

      expect(result).toBeDefined();
      expect(result.status).toBe(SurgeryStatus.SCHEDULED);
      expect(result.patientId).toBe('patient-1');
      expect(result.theatreId).toBe('theatre-1');
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SCHEDULE_SURGERY' }),
      );
    });
  });

  // ================================================================
  // 2. scheduleSurgery — theatre conflict
  // ================================================================
  describe('scheduleSurgery – theatre conflict', () => {
    it('should throw BadRequestException when theatre has a time conflict', async () => {
      const dto = buildScheduleDto({ scheduledTime: '09:00', estimatedDurationMinutes: 120 });

      const qb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'theatre-1' }),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockManager.createQueryBuilder.mockReturnValue(qb);

      // Existing case 09:30–11:30 overlaps with requested 09:00–11:00
      mockManager.find.mockResolvedValue([
        {
          id: 'existing-case',
          scheduledTime: '09:30',
          estimatedDurationMinutes: 120,
          status: SurgeryStatus.SCHEDULED,
        },
      ]);

      await expect(service.scheduleSurgery(dto, 'user-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.scheduleSurgery(dto, 'user-1', 'tenant-1')).rejects.toThrow(
        /conflicting surgery/,
      );
    });

    it('should throw NotFoundException when theatre does not exist', async () => {
      const dto = buildScheduleDto();

      const qb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockManager.createQueryBuilder.mockReturnValue(qb);

      await expect(service.scheduleSurgery(dto, 'user-1', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ================================================================
  // 3. startSurgery — happy path
  // ================================================================
  describe('startSurgery – happy path', () => {
    it('should start a surgery that is in PRE_OP with completed checklist and consent', async () => {
      const existingCase = buildSurgeryCase({
        status: SurgeryStatus.PRE_OP,
        priority: SurgeryPriority.ELECTIVE,
        consentSigned: true,
        preOpChecklist: [
          { item: 'Identity verified', checked: true },
          { item: 'NPO status confirmed', checked: true },
        ],
      });

      mockSurgeryCaseRepo.findOne.mockResolvedValue(existingCase);
      mockSurgeryCaseRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));
      mockTheatreRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.startSurgery('case-1', {}, 'tenant-1');

      expect(result.status).toBe(SurgeryStatus.IN_PROGRESS);
      expect(result.actualStartTime).toBeInstanceOf(Date);
      expect(mockTheatreRepo.update).toHaveBeenCalledWith('theatre-1', {
        status: TheatreStatus.IN_USE,
      });
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'START_SURGERY' }),
      );
    });
  });

  // ================================================================
  // 4. startSurgery — missing pre-op checklist
  // ================================================================
  describe('startSurgery – missing pre-op checklist', () => {
    it('should throw BadRequestException when pre-op checklist is null', async () => {
      const existingCase = buildSurgeryCase({
        status: SurgeryStatus.PRE_OP,
        priority: SurgeryPriority.EMERGENCY,
        consentSigned: true,
        preOpChecklist: null as any,
      });

      mockSurgeryCaseRepo.findOne.mockResolvedValue(existingCase);

      await expect(service.startSurgery('case-1', {}, 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.startSurgery('case-1', {}, 'tenant-1')).rejects.toThrow(
        /Pre-operative checklist must be completed/,
      );
    });

    it('should throw BadRequestException when pre-op checklist has unchecked items', async () => {
      const existingCase = buildSurgeryCase({
        status: SurgeryStatus.PRE_OP,
        priority: SurgeryPriority.URGENT,
        consentSigned: true,
        preOpChecklist: [
          { item: 'Identity verified', checked: true },
          { item: 'Blood type confirmed', checked: false },
        ],
      });

      mockSurgeryCaseRepo.findOne.mockResolvedValue(existingCase);

      await expect(service.startSurgery('case-1', {}, 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.startSurgery('case-1', {}, 'tenant-1')).rejects.toThrow(
        /checklist is incomplete/,
      );
    });
  });

  // ================================================================
  // 5. startSurgery — consent required for elective
  // ================================================================
  describe('startSurgery – consent required for elective surgery', () => {
    it('should throw BadRequestException when elective surgery has no consent', async () => {
      const existingCase = buildSurgeryCase({
        status: SurgeryStatus.PRE_OP,
        priority: SurgeryPriority.ELECTIVE,
        consentSigned: false,
        preOpChecklist: [{ item: 'Identity verified', checked: true }],
      });

      mockSurgeryCaseRepo.findOne.mockResolvedValue(existingCase);

      await expect(service.startSurgery('case-1', {}, 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.startSurgery('case-1', {}, 'tenant-1')).rejects.toThrow(
        /Consent must be signed/,
      );
    });

    it('should NOT require consent for emergency surgery', async () => {
      const existingCase = buildSurgeryCase({
        status: SurgeryStatus.PRE_OP,
        priority: SurgeryPriority.EMERGENCY,
        consentSigned: false,
        preOpChecklist: [{ item: 'Identity verified', checked: true }],
      });

      mockSurgeryCaseRepo.findOne.mockResolvedValue(existingCase);
      mockSurgeryCaseRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));
      mockTheatreRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.startSurgery('case-1', {}, 'tenant-1');

      expect(result.status).toBe(SurgeryStatus.IN_PROGRESS);
    });
  });

  // ================================================================
  // 6. completeSurgery — happy path
  // ================================================================
  describe('completeSurgery – happy path', () => {
    it('should complete an in-progress surgery and set theatre to CLEANING', async () => {
      const existingCase = buildSurgeryCase({
        status: SurgeryStatus.IN_PROGRESS,
        actualStartTime: new Date('2026-07-01T09:05:00Z'),
      });

      mockSurgeryCaseRepo.findOne.mockResolvedValue(existingCase);
      mockSurgeryCaseRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));
      mockTheatreRepo.update.mockResolvedValue({ affected: 1 });

      const dto = {
        operativeFindings: 'Inflamed appendix',
        operativeNotes: 'Appendectomy performed successfully',
        bloodLossMl: 50,
        dischargeDestination: 'Ward A',
        recoveryNotes: 'Stable vitals',
      };

      const result = await service.completeSurgery('case-1', dto as any, 'tenant-1');

      expect(result.status).toBe(SurgeryStatus.POST_OP);
      expect(result.actualEndTime).toBeInstanceOf(Date);
      expect(result.operativeFindings).toBe('Inflamed appendix');
      expect(result.dischargeDestination).toBe('Ward A');
      expect(mockTheatreRepo.update).toHaveBeenCalledWith('theatre-1', {
        status: TheatreStatus.CLEANING,
      });
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'COMPLETE_SURGERY' }),
      );
    });
  });

  // ================================================================
  // 7. completeSurgery — wrong status
  // ================================================================
  describe('completeSurgery – wrong status', () => {
    it('should throw BadRequestException when surgery is not IN_PROGRESS', async () => {
      const existingCase = buildSurgeryCase({
        status: SurgeryStatus.SCHEDULED,
      });

      mockSurgeryCaseRepo.findOne.mockResolvedValue(existingCase);

      const dto = {
        operativeFindings: 'N/A',
        operativeNotes: 'N/A',
        dischargeDestination: 'Ward',
      };

      await expect(service.completeSurgery('case-1', dto as any, 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.completeSurgery('case-1', dto as any, 'tenant-1')).rejects.toThrow(
        /Only in-progress surgeries can be completed/,
      );
    });

    it('should throw NotFoundException when case does not exist', async () => {
      mockSurgeryCaseRepo.findOne.mockResolvedValue(null);

      const dto = {
        operativeFindings: 'N/A',
        operativeNotes: 'N/A',
        dischargeDestination: 'Ward',
      };

      await expect(service.completeSurgery('nonexistent', dto as any, 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ================================================================
  // 8. cancelSurgery — cancel and postpone paths
  // ================================================================
  describe('cancelSurgery – cancel path', () => {
    it('should set status to CANCELLED when no new date/time is provided', async () => {
      const existingCase = buildSurgeryCase({
        status: SurgeryStatus.SCHEDULED,
        preOpNotes: 'Initial notes',
      });

      mockSurgeryCaseRepo.findOne.mockResolvedValue(existingCase);
      mockSurgeryCaseRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const dto = { reason: 'Patient request' };

      const result = await service.cancelSurgery('case-1', dto as any, 'tenant-1');

      expect(result.status).toBe(SurgeryStatus.CANCELLED);
      expect(result.preOpNotes).toContain('[CANCELLED]');
      expect(result.preOpNotes).toContain('Patient request');
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CANCEL_SURGERY' }),
      );
    });

    it('should reject cancellation of an in-progress surgery', async () => {
      const existingCase = buildSurgeryCase({
        status: SurgeryStatus.IN_PROGRESS,
      });

      mockSurgeryCaseRepo.findOne.mockResolvedValue(existingCase);

      await expect(
        service.cancelSurgery('case-1', { reason: 'Changed mind' } as any, 'tenant-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.cancelSurgery('case-1', { reason: 'Changed mind' } as any, 'tenant-1'),
      ).rejects.toThrow(/Cannot cancel surgery that is in progress/);
    });

    it('should reject cancellation of a completed surgery', async () => {
      const existingCase = buildSurgeryCase({
        status: SurgeryStatus.COMPLETED,
      });

      mockSurgeryCaseRepo.findOne.mockResolvedValue(existingCase);

      await expect(
        service.cancelSurgery('case-1', { reason: 'Error' } as any, 'tenant-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.cancelSurgery('case-1', { reason: 'Error' } as any, 'tenant-1'),
      ).rejects.toThrow(/Cannot cancel completed surgery/);
    });
  });

  describe('cancelSurgery – postpone path', () => {
    it('should set status to POSTPONED when newDate and newTime are provided', async () => {
      const existingCase = buildSurgeryCase({
        status: SurgeryStatus.SCHEDULED,
        preOpNotes: '',
      });

      mockSurgeryCaseRepo.findOne.mockResolvedValue(existingCase);
      mockSurgeryCaseRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const dto = {
        reason: 'Surgeon unavailable',
        newDate: '2026-07-15',
        newTime: '14:00',
      };

      const result = await service.cancelSurgery('case-1', dto as any, 'tenant-1');

      expect(result.status).toBe(SurgeryStatus.POSTPONED);
      expect(result.scheduledDate).toEqual(new Date('2026-07-15'));
      expect(result.scheduledTime).toBe('14:00');
      expect(result.preOpNotes).toContain('[POSTPONED]');
      expect(result.preOpNotes).toContain('Surgeon unavailable');
    });
  });

  // ================================================================
  // 9. updatePreOpChecklist
  // ================================================================
  describe('updatePreOpChecklist', () => {
    it('should update checklist and transition status to PRE_OP', async () => {
      const existingCase = buildSurgeryCase({
        status: SurgeryStatus.SCHEDULED,
      });

      mockSurgeryCaseRepo.findOne.mockResolvedValue(existingCase);
      mockSurgeryCaseRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const dto = {
        checklist: [
          { item: 'Identity verified', checked: true },
          { item: 'Allergies reviewed', checked: true },
        ],
        consentSigned: true,
        bloodAvailable: true,
        bloodGroup: 'O+',
      };

      const result = await service.updatePreOpChecklist('case-1', dto as any, 'tenant-1');

      expect(result.status).toBe(SurgeryStatus.PRE_OP);
      expect(result.preOpChecklist).toHaveLength(2);
      expect(result.consentSigned).toBe(true);
      expect(result.consentSignedAt).toBeInstanceOf(Date);
      expect(result.bloodAvailable).toBe(true);
      expect(result.bloodGroup).toBe('O+');
    });

    it('should throw when case is not SCHEDULED or PRE_OP', async () => {
      const existingCase = buildSurgeryCase({
        status: SurgeryStatus.IN_PROGRESS,
      });

      mockSurgeryCaseRepo.findOne.mockResolvedValue(existingCase);

      const dto = {
        checklist: [{ item: 'Identity verified', checked: true }],
      };

      await expect(
        service.updatePreOpChecklist('case-1', dto as any, 'tenant-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updatePreOpChecklist('case-1', dto as any, 'tenant-1'),
      ).rejects.toThrow(/Cannot update pre-op checklist at this stage/);
    });
  });
});
