import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { EncountersService } from '../encounters.service';
import { Encounter, EncounterType, PayerType } from '../../../database/entities/encounter.entity';
import { Patient } from '../../../database/entities/patient.entity';
import { Service } from '../../../database/entities/service-category.entity';
import { InsurancePolicy } from '../../../database/entities/insurance-policy.entity';
import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service';
import { BillingService } from '../../billing/billing.service';
import { QueueManagementService } from '../../queue-management/queue-management.service';
import { InsuranceService } from '../../insurance/insurance.service';
import { AuditLogService } from '../../../common/interceptors/audit-log.service';
import { IdentityGuardService } from '../../../common/services/identity-guard.service';
import { BadRequestException } from '@nestjs/common';

describe('EncountersService', () => {
  let service: EncountersService;

  const mockEncounterRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockPatientRepo = {
    findOne: jest.fn(),
  };

  const mockServiceRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'service-1', code: 'CON-OPD', basePrice: 50000 }),
    }),
  };

  const mockInsurancePolicyRepo = {
    findOne: jest.fn(),
  };

  const mockInAppNotificationsService = {
    sendNotification: jest.fn(),
  };

  const mockBillingService = {
    addBillableItem: jest.fn(),
  };

  const mockQueueService = {
    addToQueue: jest.fn(),
  };

  const mockInsuranceService = {
    verifyCoverage: jest.fn(),
  };

  const mockAuditLogService = {
    log: jest.fn(),
  };

  const mockIdentityGuardService = {};

  const mockEntityManager = {
    getRepository: jest.fn().mockImplementation((entity) => {
      if (entity === Encounter) return mockEncounterRepo;
      if (entity === Service) return mockServiceRepo;
      return {};
    }),
    query: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((entity, data) => data),
    save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ id: 'enc-1', ...data })),
    findOne: jest.fn().mockImplementation((entity, options) => {
      if (entity === Encounter) return mockEncounterRepo.findOne(options);
      if (entity === Service) return mockServiceRepo.findOne(options);
      return Promise.resolve(null);
    }),
  };

  const mockDataSource = {
    transaction: jest.fn((cb) => cb(mockEntityManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncountersService,
        { provide: getRepositoryToken(Encounter), useValue: mockEncounterRepo },
        { provide: getRepositoryToken(Patient), useValue: mockPatientRepo },
        { provide: getRepositoryToken(Service), useValue: mockServiceRepo },
        { provide: getRepositoryToken(InsurancePolicy), useValue: mockInsurancePolicyRepo },
        { provide: InAppNotificationsService, useValue: mockInAppNotificationsService },
        { provide: BillingService, useValue: mockBillingService },
        { provide: QueueManagementService, useValue: mockQueueService },
        { provide: InsuranceService, useValue: mockInsuranceService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: IdentityGuardService, useValue: mockIdentityGuardService },
      ],
    }).compile();

    service = module.get<EncountersService>(EncountersService);
  });

  describe('create', () => {
    const createDto = {
      patientId: 'patient-1',
      facilityId: 'facility-1',
      type: EncounterType.OPD,
      payerType: PayerType.CASH,
      departmentId: 'dept-1',
    };

    it('should create an encounter successfully with transaction', async () => {
      mockPatientRepo.findOne.mockResolvedValue({ id: 'patient-1', tenantId: 'tenant-1' });
      mockEncounterRepo.findOne.mockResolvedValue(null); // No active encounter

      // Mock generateVisitNumber and getNextQueueNumber logic within manager
      mockEncounterRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getCount: jest.fn().mockResolvedValue(0),
      });

      const result = await service.create(createDto, 'user-1', 'tenant-1');

      expect(result.id).toBe('enc-1');
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledWith(Encounter, expect.any(Object));
      expect(mockBillingService.addBillableItem).toHaveBeenCalled();
    });

    it('should throw BadRequestException if patient has active encounter', async () => {
      mockPatientRepo.findOne.mockResolvedValue({ id: 'patient-1', tenantId: 'tenant-1' });
      mockEncounterRepo.findOne.mockResolvedValue({ id: 'active-enc' });

      await expect(service.create(createDto, 'user-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
