import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MaternityService } from '../maternity.service';
import {
  AntenatalRegistration,
  PregnancyStatus,
  RiskLevel,
} from '../../../database/entities/antenatal-registration.entity';
import { AntenatalVisit } from '../../../database/entities/antenatal-visit.entity';
import {
  LabourRecord,
  LabourStatus,
  DeliveryMode,
  LabourOutcome,
} from '../../../database/entities/labour-record.entity';
import {
  DeliveryOutcome,
  BabySex,
  BabyStatus,
} from '../../../database/entities/delivery-outcome.entity';
import { PostnatalVisit } from '../../../database/entities/postnatal-visit.entity';
import { BabyWellnessCheck } from '../../../database/entities/baby-wellness-check.entity';
import { ImmunizationSchedule } from '../../../database/entities/immunization-schedule.entity';
import { AuditLogService } from '../../../common/interceptors/audit-log.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockRepo = Partial<Record<keyof Repository<any>, jest.Mock>>;

const createMockRepo = (): MockRepo => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
});

const mockAuditLogService = {
  log: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('MaternityService', () => {
  let service: MaternityService;
  let ancRepo: MockRepo;
  let visitRepo: MockRepo;
  let labourRepo: MockRepo;
  let outcomeRepo: MockRepo;
  let pncRepo: MockRepo;
  let babyWellnessRepo: MockRepo;
  let immunizationRepo: MockRepo;

  const tenantId = 'tenant-uuid-1';
  const userId = 'user-uuid-1';
  const facilityId = 'facility-uuid-1';
  const patientId = 'patient-uuid-1';

  beforeEach(async () => {
    ancRepo = createMockRepo();
    visitRepo = createMockRepo();
    labourRepo = createMockRepo();
    outcomeRepo = createMockRepo();
    pncRepo = createMockRepo();
    babyWellnessRepo = createMockRepo();
    immunizationRepo = createMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaternityService,
        { provide: getRepositoryToken(AntenatalRegistration), useValue: ancRepo },
        { provide: getRepositoryToken(AntenatalVisit), useValue: visitRepo },
        { provide: getRepositoryToken(LabourRecord), useValue: labourRepo },
        { provide: getRepositoryToken(DeliveryOutcome), useValue: outcomeRepo },
        { provide: getRepositoryToken(PostnatalVisit), useValue: pncRepo },
        { provide: getRepositoryToken(BabyWellnessCheck), useValue: babyWellnessRepo },
        { provide: getRepositoryToken(ImmunizationSchedule), useValue: immunizationRepo },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<MaternityService>(MaternityService);

    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. registerAntenatal — happy path
  // -----------------------------------------------------------------------
  describe('registerAntenatal', () => {
    it('should create an ANC registration and return the saved entity', async () => {
      const lmpDateStr = '2026-01-01';
      const dto = {
        facilityId,
        patientId,
        lmpDate: lmpDateStr,
        gravida: 2,
        para: 1,
        bloodGroup: 'O+',
        rhPositive: true,
      };

      ancRepo.count!.mockResolvedValue(3);

      const createdEntity = {
        id: 'reg-uuid-1',
        ancNumber: `ANC${new Date().getFullYear()}-00004`,
        patientId,
        facilityId,
        lmpDate: new Date(lmpDateStr),
        edd: expect.any(Date),
        gestationalAgeAtBooking: expect.any(Number),
        gravida: 2,
        para: 1,
        status: PregnancyStatus.ACTIVE,
      };

      ancRepo.create!.mockReturnValue(createdEntity);
      ancRepo.save!.mockResolvedValue({ ...createdEntity, id: 'reg-uuid-1' });

      const result = await service.registerAntenatal(dto as any, userId, tenantId);

      expect(ancRepo.count).toHaveBeenCalledTimes(1);
      expect(ancRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId,
          facilityId,
          gravida: 2,
          para: 1,
          status: PregnancyStatus.ACTIVE,
        }),
      );
      expect(ancRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId }),
      );
      expect(result.id).toBe('reg-uuid-1');
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REGISTER_ANTENATAL' }),
      );
    });

    // -------------------------------------------------------------------
    // 2. registerAntenatal — EDD calculation (LMP + 280 days)
    // -------------------------------------------------------------------
    it('should compute EDD as LMP + 280 days', async () => {
      const lmpDateStr = '2026-03-01';
      const expectedEdd = new Date('2026-03-01');
      expectedEdd.setDate(expectedEdd.getDate() + 280);

      const dto = {
        facilityId,
        patientId,
        lmpDate: lmpDateStr,
        gravida: 1,
        para: 0,
      };

      ancRepo.count!.mockResolvedValue(0);
      ancRepo.create!.mockImplementation((data: any) => ({ ...data }));
      ancRepo.save!.mockImplementation(async (entity: any) => ({
        ...entity,
        id: 'reg-uuid-edd',
      }));

      const result = await service.registerAntenatal(dto as any, userId, tenantId);

      // The EDD stored on the created entity must be LMP + 280 days
      expect(ancRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          edd: expectedEdd,
        }),
      );
      expect(result.edd).toEqual(expectedEdd);
    });
  });

  // -----------------------------------------------------------------------
  // 3. recordVisit — happy path
  // -----------------------------------------------------------------------
  describe('recordVisit', () => {
    it('should record an ANC visit when registration exists', async () => {
      const registrationId = 'reg-uuid-1';
      const dto = {
        registrationId,
        visitDate: '2026-06-15',
        gestationalAge: 28,
        weight: 65,
        bpSystolic: 120,
        bpDiastolic: 80,
      };

      ancRepo.findOne!.mockResolvedValue({
        id: registrationId,
        lmpDate: new Date('2026-01-01'),
      });
      visitRepo.count!.mockResolvedValue(2);

      const createdVisit = {
        id: 'visit-uuid-1',
        registrationId,
        visitNumber: 3,
        gestationalAge: 28,
      };
      visitRepo.create!.mockReturnValue(createdVisit);
      visitRepo.save!.mockResolvedValue({ ...createdVisit });

      const result = await service.recordVisit(dto as any, userId, tenantId);

      expect(ancRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: registrationId, tenantId },
        }),
      );
      expect(visitRepo.count).toHaveBeenCalled();
      expect(visitRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          registrationId,
          visitNumber: 3,
          gestationalAge: 28,
        }),
      );
      expect(visitRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('visit-uuid-1');
    });

    // -------------------------------------------------------------------
    // 4. recordVisit — registration not found
    // -------------------------------------------------------------------
    it('should throw NotFoundException when registration does not exist', async () => {
      ancRepo.findOne!.mockResolvedValue(null);

      const dto = {
        registrationId: 'non-existent-uuid',
        visitDate: '2026-06-15',
        gestationalAge: 28,
      };

      await expect(service.recordVisit(dto as any, userId, tenantId)).rejects.toThrow(
        NotFoundException,
      );
      expect(visitRepo.create).not.toHaveBeenCalled();
      expect(visitRepo.save).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 5. admitLabour — happy path
  // -----------------------------------------------------------------------
  describe('admitLabour', () => {
    it('should create a labour record with ADMITTED status', async () => {
      const registrationId = 'reg-uuid-1';
      const dto = {
        registrationId,
        facilityId,
        gestationalAgeAtDelivery: 38,
        admissionNotes: 'Active labour on arrival',
        bpSystolic: 130,
        bpDiastolic: 85,
        cervicalDilation: 4,
      };

      ancRepo.findOne!.mockResolvedValue({ id: registrationId });
      labourRepo.count!.mockResolvedValue(5);

      const createdLabour = {
        id: 'labour-uuid-1',
        labourNumber: expect.any(String),
        registrationId,
        facilityId,
        status: LabourStatus.ADMITTED,
        gestationalAgeAtDelivery: 38,
      };
      labourRepo.create!.mockReturnValue(createdLabour);
      labourRepo.save!.mockResolvedValue({ ...createdLabour, id: 'labour-uuid-1' });

      const result = await service.admitLabour(dto as any, userId, tenantId);

      expect(ancRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: registrationId, tenantId },
        }),
      );
      expect(labourRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          registrationId,
          facilityId,
          gestationalAgeAtDelivery: 38,
          status: LabourStatus.ADMITTED,
          cervicalDilation: 4,
        }),
      );
      expect(labourRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId }),
      );
      expect(result.status).toBe(LabourStatus.ADMITTED);
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ADMIT_LABOUR' }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 6. recordDelivery — happy path
  // -----------------------------------------------------------------------
  describe('recordDelivery', () => {
    it('should record a delivery and set status to DELIVERED', async () => {
      const labourId = 'labour-uuid-1';
      const registrationId = 'reg-uuid-1';

      const existingLabour: Partial<LabourRecord> = {
        id: labourId,
        registrationId,
        status: LabourStatus.SECOND_STAGE,
        facilityId,
      };

      // getLabourById is called internally via findOne
      labourRepo.findOne!.mockResolvedValue({ ...existingLabour });
      labourRepo.save!.mockImplementation(async (entity: any) => ({ ...entity }));
      ancRepo.update!.mockResolvedValue({ affected: 1 });

      const dto = {
        deliveryMode: DeliveryMode.SVD,
        deliveryNotes: 'Uneventful delivery',
        placentaComplete: true,
        bloodLossMl: 350,
      };

      const result = await service.recordDelivery(labourId, dto as any, userId, tenantId);

      expect(labourRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: labourId }),
        }),
      );
      expect(result.status).toBe(LabourStatus.DELIVERED);
      expect(result.deliveryMode).toBe(DeliveryMode.SVD);
      expect(result.deliveredById).toBe(userId);
      expect(result.bloodLossMl).toBe(350);

      // Should update ANC registration to DELIVERED
      expect(ancRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: registrationId }),
        { status: PregnancyStatus.DELIVERED },
      );
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RECORD_DELIVERY' }),
      );
    });

    // -------------------------------------------------------------------
    // 7. recordDelivery — labour record not found (wrong status scenario)
    // -------------------------------------------------------------------
    it('should throw NotFoundException when the labour record does not exist', async () => {
      labourRepo.findOne!.mockResolvedValue(null);

      const dto = {
        deliveryMode: DeliveryMode.SVD,
      };

      await expect(
        service.recordDelivery('non-existent-id', dto as any, userId, tenantId),
      ).rejects.toThrow(NotFoundException);
      expect(labourRepo.save).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 8. recordBabyOutcome — happy path
  // -----------------------------------------------------------------------
  describe('recordBabyOutcome', () => {
    it('should create a baby outcome linked to the labour record', async () => {
      const labourRecordId = 'labour-uuid-1';
      const deliveryTime = new Date('2026-06-20T10:30:00Z');

      labourRepo.findOne!.mockResolvedValue({
        id: labourRecordId,
        deliveryTime,
        status: LabourStatus.DELIVERED,
      });

      const dto = {
        labourRecordId,
        outcome: LabourOutcome.LIVE_BIRTH,
        sex: BabySex.FEMALE,
        birthWeight: 3.2,
        apgar1min: 8,
        apgar5min: 9,
        skinToSkin: true,
        breastfeedingInitiated: true,
      };

      const createdOutcome = {
        id: 'outcome-uuid-1',
        labourRecordId,
        babyNumber: 1,
        timeOfBirth: deliveryTime,
        outcome: LabourOutcome.LIVE_BIRTH,
        sex: BabySex.FEMALE,
        birthWeight: 3.2,
        babyStatus: BabyStatus.ALIVE,
      };

      outcomeRepo.create!.mockReturnValue(createdOutcome);
      outcomeRepo.save!.mockResolvedValue({ ...createdOutcome });

      const result = await service.recordBabyOutcome(dto as any, tenantId);

      expect(labourRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: labourRecordId, tenantId },
        }),
      );
      expect(outcomeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labourRecordId,
          outcome: LabourOutcome.LIVE_BIRTH,
          sex: BabySex.FEMALE,
          birthWeight: 3.2,
          babyStatus: BabyStatus.ALIVE,
        }),
      );
      expect(outcomeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId }),
      );
      expect(result.babyStatus).toBe(BabyStatus.ALIVE);
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RECORD_BABY_OUTCOME' }),
      );
    });

    // -------------------------------------------------------------------
    // 9. recordBabyOutcome — labour record not found
    // -------------------------------------------------------------------
    it('should throw NotFoundException when the labour record does not exist', async () => {
      labourRepo.findOne!.mockResolvedValue(null);

      const dto = {
        labourRecordId: 'non-existent-id',
        outcome: LabourOutcome.LIVE_BIRTH,
        sex: BabySex.MALE,
        birthWeight: 3.5,
      };

      await expect(service.recordBabyOutcome(dto as any, tenantId)).rejects.toThrow(
        NotFoundException,
      );
      expect(outcomeRepo.create).not.toHaveBeenCalled();
      expect(outcomeRepo.save).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------
    // 10. recordBabyOutcome — stillbirth sets babyStatus to DECEASED
    // -------------------------------------------------------------------
    it('should set babyStatus to DECEASED for a stillbirth outcome', async () => {
      const labourRecordId = 'labour-uuid-2';

      labourRepo.findOne!.mockResolvedValue({
        id: labourRecordId,
        deliveryTime: new Date(),
        status: LabourStatus.DELIVERED,
      });

      const dto = {
        labourRecordId,
        outcome: LabourOutcome.STILLBIRTH,
        sex: BabySex.MALE,
        birthWeight: 2.8,
      };

      outcomeRepo.create!.mockImplementation((data: any) => ({ ...data, id: 'outcome-uuid-2' }));
      outcomeRepo.save!.mockImplementation(async (entity: any) => ({ ...entity }));

      const result = await service.recordBabyOutcome(dto as any, tenantId);

      expect(outcomeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          babyStatus: BabyStatus.DECEASED,
        }),
      );
      expect(result.babyStatus).toBe(BabyStatus.DECEASED);
    });
  });
});
