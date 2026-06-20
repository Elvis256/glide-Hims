import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { PatientsService } from '../patients.service';
import { Patient } from '../../../database/entities/patient.entity';
import { PatientDocument } from '../../../database/entities/patient-document.entity';
import { PatientNote } from '../../../database/entities/patient-note.entity';
import { PatientMerge } from '../../../database/entities/patient-merge.entity';
import { AuditLog } from '../../../database/entities/audit-log.entity';
import { SystemSetting } from '../../../database/entities/system-setting.entity';
import { ConflictException } from '@nestjs/common';

describe('PatientsService', () => {
  let service: PatientsService;
  let dataSource: DataSource;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };

  const mockPatientRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    find: jest.fn().mockResolvedValue([]),
  };

  const mockDocumentRepo = {};
  const mockNoteRepo = {};
  const mockMergeRepo = {};

  const mockAuditLogRepo = {
    save: jest.fn(),
  };

  const mockSystemSettingRepo = {
    findOne: jest.fn(),
  };

  const mockEntityManager = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn(),
    }),
    query: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb) => cb(mockEntityManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: getRepositoryToken(Patient), useValue: mockPatientRepo },
        { provide: getRepositoryToken(PatientDocument), useValue: mockDocumentRepo },
        { provide: getRepositoryToken(PatientNote), useValue: mockNoteRepo },
        { provide: getRepositoryToken(PatientMerge), useValue: mockMergeRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditLogRepo },
        { provide: getRepositoryToken(SystemSetting), useValue: mockSystemSettingRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      fullName: 'John Doe',
      gender: 'male',
      dateOfBirth: '1990-01-01',
      phone: '1234567890',
      nationalId: 'NID123',
    };

    it('should create a patient successfully', async () => {
      // Mock generateMRN internal logic
      mockEntityManager.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null), // Hospital name setting not found, defaults to HOSP
      });
      mockEntityManager.query.mockResolvedValue([]); // pg_advisory_xact_lock

      const mockSavedPatient = { id: 'patient-1', mrn: 'HOSP202602161234', ...createDto };
      mockEntityManager.save.mockResolvedValue(mockSavedPatient);
      mockEntityManager.create.mockReturnValue(mockSavedPatient);

      const result = await service.create(createDto, 'user-1', 'tenant-1');

      expect(result).toEqual(mockSavedPatient);
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledWith(Patient, expect.any(Object));
      expect(mockAuditLogRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if national ID exists', async () => {
      // Mock generateMRN dependencies
      mockEntityManager.getRepository.mockImplementation((entity) => {
        if (entity === SystemSetting) {
          return { findOne: jest.fn().mockResolvedValue({ value: { name: 'TEST HOSP' } }) };
        }
        if (entity === Patient) {
          return { findOne: jest.fn().mockResolvedValue(null) }; // MRN doesn't exist, so generateMRN succeeds
        }
        return {};
      });
      mockEntityManager.query.mockResolvedValue([]); // pg_advisory_xact_lock

      // Mock existing patient for NID check - this is called directly on manager.findOne
      mockEntityManager.findOne.mockResolvedValueOnce({ id: 'existing-1' });

      await expect(service.create(createDto, 'user-1', 'tenant-1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockEntityManager.save).not.toHaveBeenCalled();
    });
  });
});
