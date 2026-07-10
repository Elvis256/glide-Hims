import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LabService } from '../lab.service';
import { LabTest } from '../../../database/entities/lab-test.entity';
import { LabSample, SampleStatus } from '../../../database/entities/lab-sample.entity';
import { LabResult, ResultStatus } from '../../../database/entities/lab-result.entity';
import { Order, OrderStatus } from '../../../database/entities/order.entity';
import { Patient } from '../../../database/entities/patient.entity';
import { Facility } from '../../../database/entities/facility.entity';
import { BillingService } from '../../billing/billing.service';
import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { EncountersService } from '../../encounters/encounters.service';
import { CriticalResultsService } from '../../critical-results/critical-results.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRepository() {
  return {
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn((data: any) => Promise.resolve({ id: 'new-id', ...data })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue({}),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };
}

function createMockQueryBuilder(result: any = null) {
  const qb: any = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  return qb;
}

function createMockManager(overrides: Record<string, jest.Mock> = {}) {
  const repo = {
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn((data: any) => Promise.resolve({ id: 'new-id', ...data })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((_entity: any, data: any) => ({ ...data })),
    save: jest.fn((_entityOrClass: any, maybeData?: any) => {
      const data = maybeData === undefined ? _entityOrClass : maybeData;
      return Promise.resolve({ id: data?.id || 'new-id', ...data });
    }),
    update: jest.fn().mockResolvedValue({}),
    query: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
    getRepository: jest.fn(() => repo),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockBillingService = {};

const mockInAppNotificationsService = {
  create: jest.fn().mockResolvedValue({}),
  notifyLabResultReady: jest.fn().mockResolvedValue({}),
};

const mockNotificationsService = {
  sendSmsToPatient: jest.fn().mockResolvedValue({ success: true }),
};

const mockEncountersService = {
  returnToDoctor: jest.fn().mockResolvedValue({}),
};

const mockCriticalResultsService = {
  flag: jest.fn().mockResolvedValue({}),
};

const mockDataSource = {
  transaction: jest.fn(),
};

// ---------------------------------------------------------------------------
// Shared IDs
// ---------------------------------------------------------------------------
const TENANT_ID = 'tenant-001';
const USER_ID = 'user-001';
const VALIDATOR_ID = 'user-002'; // different user for two-person rule
const ORDER_ID = 'order-001';
const PATIENT_ID = 'patient-001';
const FACILITY_ID = 'facility-001';
const LAB_TEST_ID = 'labtest-001';
const SAMPLE_ID = 'sample-001';
const RESULT_ID = 'result-001';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LabService', () => {
  let service: LabService;
  let labTestRepo: ReturnType<typeof createMockRepository>;
  let sampleRepo: ReturnType<typeof createMockRepository>;
  let resultRepo: ReturnType<typeof createMockRepository>;
  let orderRepo: ReturnType<typeof createMockRepository>;
  let patientRepo: ReturnType<typeof createMockRepository>;
  let facilityRepo: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    labTestRepo = createMockRepository();
    sampleRepo = createMockRepository();
    resultRepo = createMockRepository();
    orderRepo = createMockRepository();
    patientRepo = createMockRepository();
    facilityRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabService,
        { provide: getRepositoryToken(LabTest), useValue: labTestRepo },
        { provide: getRepositoryToken(LabSample), useValue: sampleRepo },
        { provide: getRepositoryToken(LabResult), useValue: resultRepo },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: getRepositoryToken(Facility), useValue: facilityRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: BillingService, useValue: mockBillingService },
        { provide: InAppNotificationsService, useValue: mockInAppNotificationsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: EncountersService, useValue: mockEncountersService },
        { provide: CriticalResultsService, useValue: mockCriticalResultsService },
      ],
    }).compile();

    service = module.get<LabService>(LabService);
    jest.clearAllMocks();

    // Default: transaction just invokes the callback with a mock manager
    mockDataSource.transaction.mockImplementation(async (cb: any) => cb(createMockManager()));
  });

  // -----------------------------------------------------------------------
  // 1. createLabTest — happy path
  // -----------------------------------------------------------------------
  describe('createLabTest', () => {
    it('should create a lab test when code is unique', async () => {
      const dto = {
        code: 'CBC',
        name: 'Complete Blood Count',
        category: 'hematology',
        sampleType: 'blood',
        price: 50,
        referenceRanges: [{ parameter: 'WBC', unit: '10^3/uL', normalMin: 4.5, normalMax: 11.0 }],
      };

      // No existing test with same code
      labTestRepo.findOne.mockResolvedValue(null);
      labTestRepo.create.mockReturnValue({ id: LAB_TEST_ID, ...dto, tenantId: TENANT_ID });
      labTestRepo.save.mockResolvedValue({ id: LAB_TEST_ID, ...dto, tenantId: TENANT_ID });

      const result = await service.createLabTest(dto as any, TENANT_ID);

      expect(result).toBeDefined();
      expect(result.id).toBe(LAB_TEST_ID);
      expect(result.code).toBe('CBC');
      expect(labTestRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ code: 'CBC', tenantId: TENANT_ID }),
        }),
      );
      expect(labTestRepo.create).toHaveBeenCalled();
      expect(labTestRepo.save).toHaveBeenCalled();
    });

    it('should reject duplicate test codes', async () => {
      const dto = { code: 'CBC', name: 'Complete Blood Count' };

      labTestRepo.findOne.mockResolvedValue({ id: 'existing', code: 'CBC' });

      await expect(service.createLabTest(dto as any, TENANT_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // 2. collectSample — happy path
  // -----------------------------------------------------------------------
  describe('collectSample', () => {
    it('should collect a sample with COLLECTED status', async () => {
      const dto = {
        orderId: ORDER_ID,
        patientId: PATIENT_ID,
        labTestId: LAB_TEST_ID,
        facilityId: FACILITY_ID,
        sampleType: 'blood',
        priority: 'routine',
        collectionNotes: 'Fasting sample',
      };

      // Referenced entities exist
      orderRepo.findOne.mockResolvedValue({
        id: ORDER_ID,
        status: OrderStatus.PENDING,
        tenantId: TENANT_ID,
      });
      labTestRepo.findOne.mockResolvedValue({
        id: LAB_TEST_ID,
        code: 'CBC',
        tenantId: TENANT_ID,
      });
      patientRepo.findOne.mockResolvedValue({ id: PATIENT_ID, tenantId: TENANT_ID });
      facilityRepo.findOne.mockResolvedValue({ id: FACILITY_ID, tenantId: TENANT_ID });

      // The transaction callback creates and saves the sample
      const savedSample = {
        id: SAMPLE_ID,
        sampleNumber: 'LAB202606270001',
        status: SampleStatus.COLLECTED,
        orderId: ORDER_ID,
        patientId: PATIENT_ID,
        labTestId: LAB_TEST_ID,
        facilityId: FACILITY_ID,
        collectedById: USER_ID,
      };

      const manager = createMockManager();
      // No duplicate found
      manager.findOne.mockResolvedValue(null);
      manager.create.mockReturnValue(savedSample);
      manager.save.mockResolvedValue(savedSample);

      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      const result = await service.collectSample(dto as any, USER_ID, TENANT_ID);

      expect(result).toBeDefined();
      expect(result.status).toBe(SampleStatus.COLLECTED);
      expect(result.collectedById).toBe(USER_ID);
      expect(manager.query).toHaveBeenCalledWith(
        expect.stringContaining('pg_advisory_xact_lock'),
        expect.any(Array),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 3. receiveSample — happy path (COLLECTED → RECEIVED)
  // -----------------------------------------------------------------------
  describe('receiveSample', () => {
    it('should transition sample from COLLECTED to RECEIVED', async () => {
      const collectedSample = {
        id: SAMPLE_ID,
        sampleNumber: 'LAB202606270001',
        status: SampleStatus.COLLECTED,
        collectionNotes: '',
      };

      const qb = createMockQueryBuilder(collectedSample);
      const manager = createMockManager();
      manager.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn(() => qb),
        create: jest.fn((data: any) => data),
        save: jest.fn().mockResolvedValue({}),
      } as any);

      // manager.save should return the mutated sample
      manager.save.mockImplementation(async (entity: any) => {
        return { ...entity, id: entity.id || SAMPLE_ID };
      });

      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      const dto = { notes: 'Good condition' };
      const result = await service.receiveSample(SAMPLE_ID, dto as any, USER_ID, TENANT_ID);

      expect(result.status).toBe(SampleStatus.RECEIVED);
      expect(result.receivedTime).toBeInstanceOf(Date);
    });

    // -------------------------------------------------------------------
    // 4. receiveSample — wrong status (rejects non-COLLECTED samples)
    // -------------------------------------------------------------------
    it('should reject receive when sample is not in COLLECTED status', async () => {
      const processingSample = {
        id: SAMPLE_ID,
        sampleNumber: 'LAB202606270001',
        status: SampleStatus.REJECTED,
      };

      const qb = createMockQueryBuilder(processingSample);
      const manager = createMockManager();
      manager.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn(() => qb),
      } as any);

      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      await expect(service.receiveSample(SAMPLE_ID, {} as any, USER_ID, TENANT_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // 5. startProcessing — happy path (RECEIVED → PROCESSING)
  // -----------------------------------------------------------------------
  describe('startProcessing', () => {
    it('should transition sample from RECEIVED to PROCESSING', async () => {
      const receivedSample = {
        id: SAMPLE_ID,
        sampleNumber: 'LAB202606270001',
        status: SampleStatus.RECEIVED,
      };

      const qb = createMockQueryBuilder(receivedSample);
      const manager = createMockManager();
      manager.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn(() => qb),
        create: jest.fn((data: any) => data),
        save: jest.fn().mockResolvedValue({}),
      } as any);
      manager.save.mockImplementation(async (entity: any) => {
        return { ...entity, id: entity.id || SAMPLE_ID };
      });

      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      const result = await service.startProcessing(SAMPLE_ID, USER_ID, TENANT_ID);

      expect(result.status).toBe(SampleStatus.PROCESSING);
      expect(result.processedById).toBe(USER_ID);
      expect(result.processedTime).toBeInstanceOf(Date);
    });

    it('should reject startProcessing when sample is not in RECEIVED status', async () => {
      const collectedSample = {
        id: SAMPLE_ID,
        sampleNumber: 'LAB202606270001',
        status: SampleStatus.COLLECTED,
      };

      const qb = createMockQueryBuilder(collectedSample);
      const manager = createMockManager();
      manager.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn(() => qb),
      } as any);

      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      await expect(service.startProcessing(SAMPLE_ID, USER_ID, TENANT_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // 6. enterResult — happy path
  // -----------------------------------------------------------------------
  describe('enterResult', () => {
    it('should create a result with ENTERED status for a PROCESSING sample', async () => {
      const processingSample = {
        id: SAMPLE_ID,
        sampleNumber: 'LAB202606270001',
        status: SampleStatus.PROCESSING,
        labTest: {
          id: LAB_TEST_ID,
          referenceRanges: [{ parameter: 'WBC', unit: '10^3/uL', normalMin: 4.5, normalMax: 11.0 }],
        },
        patient: { id: PATIENT_ID },
        order: { id: ORDER_ID },
        results: [],
      };

      // getSample is called internally — uses the sample repo
      sampleRepo.findOne.mockResolvedValue(processingSample);

      const dto = {
        parameter: 'WBC',
        value: '7.5',
        numericValue: 7.5,
        unit: '10^3/uL',
        referenceMin: 4.5,
        referenceMax: 11.0,
      };

      const savedResult = {
        id: RESULT_ID,
        ...dto,
        sampleId: SAMPLE_ID,
        status: ResultStatus.ENTERED,
        enteredById: USER_ID,
        abnormalFlag: 'normal',
      };

      resultRepo.create.mockReturnValue(savedResult);

      const manager = createMockManager();
      manager.save.mockImplementation(async (_entityOrClass: any, data?: any) => {
        const entity = data ?? _entityOrClass;
        return { id: entity?.id || RESULT_ID, ...entity };
      });

      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      const result = await service.enterResult(SAMPLE_ID, dto as any, USER_ID, TENANT_ID);

      expect(result).toBeDefined();
      expect(result.status).toBe(ResultStatus.ENTERED);
      expect(result.enteredById).toBe(USER_ID);
      expect(result.sampleId).toBe(SAMPLE_ID);
    });

    it('should reject negative numeric values', async () => {
      const processingSample = {
        id: SAMPLE_ID,
        sampleNumber: 'LAB202606270001',
        status: SampleStatus.PROCESSING,
        labTest: { id: LAB_TEST_ID, referenceRanges: [] },
        patient: { id: PATIENT_ID },
        order: { id: ORDER_ID },
        results: [],
      };
      sampleRepo.findOne.mockResolvedValue(processingSample);

      const dto = {
        parameter: 'WBC',
        value: '-5',
        numericValue: -5,
        unit: '10^3/uL',
      };

      await expect(service.enterResult(SAMPLE_ID, dto as any, USER_ID, TENANT_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // 7. validateResult — happy path (two-person rule passes)
  // -----------------------------------------------------------------------
  describe('validateResult', () => {
    it('should validate result when validator differs from technician', async () => {
      const enteredResult = {
        id: RESULT_ID,
        sampleId: SAMPLE_ID,
        parameter: 'WBC',
        value: '7.5',
        status: ResultStatus.ENTERED,
        enteredById: USER_ID, // technician
        abnormalFlag: 'normal',
      };

      const qb = createMockQueryBuilder(enteredResult);
      const auditRepo = {
        create: jest.fn((data: any) => data),
        save: jest.fn().mockResolvedValue({}),
        createQueryBuilder: jest.fn(() => qb),
      };
      const manager = createMockManager();
      manager.getRepository.mockReturnValue(auditRepo as any);
      manager.save.mockImplementation(async (entity: any) => {
        return { ...entity, id: entity.id || RESULT_ID };
      });

      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      // Stub for notification side-effect (getSample call after txn)
      sampleRepo.findOne.mockResolvedValue({
        id: SAMPLE_ID,
        order: {
          orderedById: 'doctor-001',
          encounterId: 'enc-001',
          encounter: {
            patient: { id: PATIENT_ID, fullName: 'John Doe' },
            facilityId: FACILITY_ID,
          },
        },
        orderId: ORDER_ID,
        patientId: PATIENT_ID,
      });

      const dto = { comments: 'Looks good' };

      // VALIDATOR_ID is different from enteredById (USER_ID) — passes two-person rule
      const result = await service.validateResult(RESULT_ID, dto as any, VALIDATOR_ID, TENANT_ID);

      expect(result.status).toBe(ResultStatus.VALIDATED);
      expect(result.validatedById).toBe(VALIDATOR_ID);
      expect(result.validatedAt).toBeInstanceOf(Date);
    });

    // -------------------------------------------------------------------
    // 8. validateResult — same user as technician (should fail)
    // -------------------------------------------------------------------
    it('should reject validation when validator is the same user who entered the result', async () => {
      const enteredResult = {
        id: RESULT_ID,
        sampleId: SAMPLE_ID,
        parameter: 'WBC',
        value: '7.5',
        status: ResultStatus.ENTERED,
        enteredById: USER_ID, // technician
      };

      const qb = createMockQueryBuilder(enteredResult);
      const manager = createMockManager();
      manager.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn(() => qb),
      } as any);

      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      // Same USER_ID attempts to validate — violates two-person rule
      await expect(
        service.validateResult(RESULT_ID, {} as any, USER_ID, TENANT_ID),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.validateResult(RESULT_ID, {} as any, USER_ID, TENANT_ID),
      ).rejects.toThrow(/Validator must differ/);
    });
  });

  // -----------------------------------------------------------------------
  // 9. releaseResult — happy path (VALIDATED → RELEASED)
  // -----------------------------------------------------------------------
  describe('releaseResult', () => {
    it('should release a validated result and complete sample when all released', async () => {
      const validatedResult = {
        id: RESULT_ID,
        sampleId: SAMPLE_ID,
        parameter: 'WBC',
        value: '7.5',
        status: ResultStatus.VALIDATED,
        abnormalFlag: 'normal',
      };

      const sampleForLock = {
        id: SAMPLE_ID,
        sampleNumber: 'LAB202606270001',
        status: SampleStatus.PROCESSING,
        orderId: ORDER_ID,
      };

      const resultQb = createMockQueryBuilder(validatedResult);
      const auditRepo = {
        create: jest.fn((data: any) => data),
        save: jest.fn().mockResolvedValue({}),
        createQueryBuilder: jest.fn(() => resultQb),
      };
      const manager = createMockManager();
      manager.getRepository.mockReturnValue(auditRepo as any);

      // findOne for the sample lock
      manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        // Return sample when locking for cascading update
        if (entity === LabSample || opts?.where?.id === SAMPLE_ID) {
          return { ...sampleForLock };
        }
        return null;
      });

      // All results for the sample are released (only the one being released)
      manager.find.mockResolvedValue([{ ...validatedResult, status: ResultStatus.RELEASED }]);

      manager.save.mockImplementation(async (entity: any) => {
        return { ...entity, id: entity.id || RESULT_ID };
      });

      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      const result = await service.releaseResult(RESULT_ID, USER_ID, TENANT_ID);

      expect(result.status).toBe(ResultStatus.RELEASED);
      expect(result.releasedById).toBe(USER_ID);
      expect(result.releasedAt).toBeInstanceOf(Date);
    });

    it('should reject release when result is not validated', async () => {
      const enteredResult = {
        id: RESULT_ID,
        sampleId: SAMPLE_ID,
        status: ResultStatus.ENTERED,
      };

      const qb = createMockQueryBuilder(enteredResult);
      const manager = createMockManager();
      manager.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn(() => qb),
      } as any);

      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      await expect(service.releaseResult(RESULT_ID, USER_ID, TENANT_ID)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.releaseResult(RESULT_ID, USER_ID, TENANT_ID)).rejects.toThrow(
        /must be validated before release/,
      );
    });
  });
});
