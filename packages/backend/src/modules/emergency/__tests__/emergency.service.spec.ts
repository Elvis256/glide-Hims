import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EmergencyService } from '../emergency.service';
import {
  EmergencyCase,
  TriageLevel,
  TriageStatus,
  ArrivalMode,
} from '../../../database/entities/emergency-case.entity';
import {
  Encounter,
  EncounterType,
  EncounterStatus,
} from '../../../database/entities/encounter.entity';
import { Patient } from '../../../database/entities/patient.entity';
import { Facility } from '../../../database/entities/facility.entity';
import { VitalsService } from '../../vitals/vitals.service';
import { AuditLogService } from '../../../common/interceptors/audit-log.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createMockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getCount: jest.fn(),
    getMany: jest.fn(),
  })),
});

const mockManager = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getCount: jest.fn().mockResolvedValue(0),
  })),
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EmergencyService', () => {
  let service: EmergencyService;
  let caseRepo: ReturnType<typeof createMockRepository>;
  let encounterRepo: ReturnType<typeof createMockRepository>;
  let patientRepo: ReturnType<typeof createMockRepository>;
  let vitalsService: { recordFromSource: jest.Mock };
  let auditLogService: { log: jest.Mock };
  let dataSource: { transaction: jest.Mock; createQueryRunner: jest.Mock };

  const FACILITY_ID = 'facility-001';
  const USER_ID = 'user-001';
  const TENANT_ID = 'tenant-001';
  const CASE_ID = 'case-001';
  const ENCOUNTER_ID = 'encounter-001';
  const PATIENT_ID = 'patient-001';

  beforeEach(async () => {
    caseRepo = createMockRepository();
    encounterRepo = createMockRepository();
    patientRepo = createMockRepository();

    vitalsService = { recordFromSource: jest.fn().mockResolvedValue(undefined) };
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) };

    // dataSource.transaction invokes the callback with our mockManager
    dataSource = {
      transaction: jest.fn((cb: (manager: typeof mockManager) => Promise<any>) => cb(mockManager)),
      createQueryRunner: jest.fn(),
    };

    // Reset mockManager between tests
    mockManager.create.mockReset();
    mockManager.save.mockReset();
    mockManager.findOne.mockReset();
    mockManager.createQueryBuilder.mockReset().mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getCount: jest.fn().mockResolvedValue(0),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: getRepositoryToken(EmergencyCase), useValue: caseRepo },
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: VitalsService, useValue: vitalsService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<EmergencyService>(EmergencyService);
  });

  // =====================================================================
  // 1. Happy-path: registerCase
  // =====================================================================
  it('should register a new emergency case inside a transaction', async () => {
    const patient = { id: PATIENT_ID, tenantId: TENANT_ID };
    mockManager.findOne.mockResolvedValue(patient);

    const fakeEncounter = { id: ENCOUNTER_ID };
    const fakeCase = {
      id: CASE_ID,
      caseNumber: 'EM20260627-0001',
      status: TriageStatus.PENDING,
      chiefComplaint: 'Chest pain',
      arrivalMode: ArrivalMode.AMBULANCE,
      facilityId: FACILITY_ID,
    };

    // First save call is for the encounter, second is for the emergency case
    mockManager.create.mockReturnValueOnce(fakeEncounter).mockReturnValueOnce(fakeCase);
    mockManager.save.mockResolvedValueOnce(fakeEncounter).mockResolvedValueOnce(fakeCase);

    const dto = {
      patientId: PATIENT_ID,
      facilityId: FACILITY_ID,
      chiefComplaint: 'Chest pain',
      arrivalMode: ArrivalMode.AMBULANCE,
    } as any;

    const result = await service.registerCase(dto, FACILITY_ID, USER_ID, TENANT_ID);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(mockManager.findOne).toHaveBeenCalledWith(Patient, {
      where: { id: PATIENT_ID, tenantId: TENANT_ID },
    });
    expect(mockManager.save).toHaveBeenCalledTimes(2); // encounter + case
    expect(result).toEqual(fakeCase);
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REGISTER_EMERGENCY_CASE' }),
    );
  });

  // =====================================================================
  // 2. registerCase - patient not found
  // =====================================================================
  it('should throw NotFoundException when patient does not exist during registration', async () => {
    mockManager.findOne.mockResolvedValue(null);

    const dto = {
      patientId: 'nonexistent-patient',
      facilityId: FACILITY_ID,
      chiefComplaint: 'Headache',
    } as any;

    await expect(service.registerCase(dto, FACILITY_ID, USER_ID, TENANT_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  // =====================================================================
  // 3. Happy-path: triageCase
  // =====================================================================
  it('should triage a pending case and record vitals', async () => {
    const pendingCase = {
      id: CASE_ID,
      caseNumber: 'EM20260627-0001',
      status: TriageStatus.PENDING,
      triageLevel: TriageLevel.LESS_URGENT,
      encounterId: ENCOUNTER_ID,
      facilityId: FACILITY_ID,
    };

    caseRepo.findOne.mockResolvedValue({ ...pendingCase });

    const savedCase = {
      ...pendingCase,
      status: TriageStatus.TRIAGED,
      triageLevel: TriageLevel.EMERGENT,
      triageNurseId: USER_ID,
      triageTime: expect.any(Date),
    };
    caseRepo.save.mockResolvedValue(savedCase);

    // encounterRepo.findOne used to look up patientId for vitals mirroring
    encounterRepo.findOne.mockResolvedValue({ id: ENCOUNTER_ID, patientId: PATIENT_ID });

    const dto = {
      triageLevel: TriageLevel.EMERGENT,
      bloodPressureSystolic: 140,
      bloodPressureDiastolic: 90,
      heartRate: 110,
      respiratoryRate: 22,
      temperature: 38.5,
      oxygenSaturation: 94,
      painScore: 7,
      triageNotes: 'Acute distress',
    } as any;

    const result = await service.triageCase(CASE_ID, dto, USER_ID, TENANT_ID);

    expect(result.status).toBe(TriageStatus.TRIAGED);
    expect(encounterRepo.update).toHaveBeenCalledWith(
      { id: ENCOUNTER_ID, tenantId: TENANT_ID },
      { status: EncounterStatus.WAITING },
    );
    expect(vitalsService.recordFromSource).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
      }),
    );
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TRIAGE_CASE' }),
    );
  });

  // =====================================================================
  // 4. triageCase - invalid: case not in PENDING status
  // =====================================================================
  it('should reject triage when the case is not in PENDING status', async () => {
    const alreadyTriagedCase = {
      id: CASE_ID,
      status: TriageStatus.TRIAGED,
    };
    caseRepo.findOne.mockResolvedValue(alreadyTriagedCase);

    const dto = { triageLevel: TriageLevel.URGENT } as any;

    await expect(service.triageCase(CASE_ID, dto, USER_ID, TENANT_ID)).rejects.toThrow(
      BadRequestException,
    );
  });

  // =====================================================================
  // 5. Happy-path: startTreatment
  // =====================================================================
  it('should start treatment for a triaged case', async () => {
    const triagedCase = {
      id: CASE_ID,
      caseNumber: 'EM20260627-0001',
      status: TriageStatus.TRIAGED,
      encounterId: ENCOUNTER_ID,
      facilityId: FACILITY_ID,
    };
    caseRepo.findOne.mockResolvedValue({ ...triagedCase });

    const savedCase = {
      ...triagedCase,
      status: TriageStatus.IN_TREATMENT,
      treatmentStartTime: expect.any(Date),
      attendingDoctorId: 'doctor-001',
    };
    caseRepo.save.mockResolvedValue(savedCase);

    const dto = {
      attendingDoctorId: 'doctor-001',
      treatmentNotes: 'IV fluids started',
    } as any;

    const result = await service.startTreatment(CASE_ID, dto, USER_ID, TENANT_ID);

    expect(result.status).toBe(TriageStatus.IN_TREATMENT);
    expect(encounterRepo.update).toHaveBeenCalledWith(
      { id: ENCOUNTER_ID, tenantId: TENANT_ID },
      {
        status: EncounterStatus.IN_CONSULTATION,
        attendingProviderId: 'doctor-001',
      },
    );
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'START_TREATMENT' }),
    );
  });

  // =====================================================================
  // 6. startTreatment - invalid: case still in PENDING (not yet triaged)
  // =====================================================================
  it('should reject startTreatment when case is still PENDING', async () => {
    const pendingCase = {
      id: CASE_ID,
      status: TriageStatus.PENDING,
    };
    caseRepo.findOne.mockResolvedValue(pendingCase);

    const dto = { attendingDoctorId: 'doctor-001' } as any;

    await expect(service.startTreatment(CASE_ID, dto, USER_ID, TENANT_ID)).rejects.toThrow(
      BadRequestException,
    );
  });

  // =====================================================================
  // 7. Happy-path: dischargeCase
  // =====================================================================
  it('should discharge a case that is IN_TREATMENT', async () => {
    const inTreatmentCase = {
      id: CASE_ID,
      caseNumber: 'EM20260627-0001',
      status: TriageStatus.IN_TREATMENT,
      encounterId: ENCOUNTER_ID,
      facilityId: FACILITY_ID,
      treatmentNotes: 'IV fluids administered',
    };
    caseRepo.findOne.mockResolvedValue({ ...inTreatmentCase });

    const savedCase = {
      ...inTreatmentCase,
      status: TriageStatus.DISCHARGED,
      dischargeTime: expect.any(Date),
      primaryDiagnosis: 'Gastroenteritis',
      dispositionNotes: 'Stable for discharge',
    };
    caseRepo.save.mockResolvedValue(savedCase);

    const dto = {
      primaryDiagnosis: 'Gastroenteritis',
      dispositionNotes: 'Stable for discharge',
      treatmentNotes: 'Follow up in 3 days',
    } as any;

    const result = await service.dischargeCase(CASE_ID, dto, TENANT_ID);

    expect(result.status).toBe(TriageStatus.DISCHARGED);
    expect(encounterRepo.update).toHaveBeenCalledWith(
      { id: ENCOUNTER_ID, tenantId: TENANT_ID },
      { status: EncounterStatus.DISCHARGED, endTime: expect.any(Date) },
    );
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DISCHARGE_EMERGENCY_CASE' }),
    );
  });

  // =====================================================================
  // 8. dischargeCase - invalid: case in PENDING status
  // =====================================================================
  it('should reject discharge when the case is in PENDING status', async () => {
    const pendingCase = {
      id: CASE_ID,
      status: TriageStatus.PENDING,
    };
    caseRepo.findOne.mockResolvedValue(pendingCase);

    const dto = { primaryDiagnosis: 'N/A' } as any;

    await expect(service.dischargeCase(CASE_ID, dto, TENANT_ID)).rejects.toThrow(
      BadRequestException,
    );
  });

  // =====================================================================
  // 9. dischargeCase - invalid: case in TRIAGED status (not yet treated)
  // =====================================================================
  it('should reject discharge when the case is in TRIAGED status', async () => {
    const triagedCase = {
      id: CASE_ID,
      status: TriageStatus.TRIAGED,
    };
    caseRepo.findOne.mockResolvedValue(triagedCase);

    const dto = { primaryDiagnosis: 'N/A' } as any;

    await expect(service.dischargeCase(CASE_ID, dto, TENANT_ID)).rejects.toThrow(
      BadRequestException,
    );
  });

  // =====================================================================
  // 10. Case not found for triageCase
  // =====================================================================
  it('should throw NotFoundException when case is not found during triage', async () => {
    caseRepo.findOne.mockResolvedValue(null);

    const dto = { triageLevel: TriageLevel.URGENT } as any;

    await expect(service.triageCase('nonexistent-id', dto, USER_ID, TENANT_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  // =====================================================================
  // 11. Case not found for startTreatment
  // =====================================================================
  it('should throw NotFoundException when case is not found during startTreatment', async () => {
    caseRepo.findOne.mockResolvedValue(null);

    const dto = { attendingDoctorId: 'doctor-001' } as any;

    await expect(service.startTreatment('nonexistent-id', dto, USER_ID, TENANT_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  // =====================================================================
  // 12. Case not found for dischargeCase
  // =====================================================================
  it('should throw NotFoundException when case is not found during discharge', async () => {
    caseRepo.findOne.mockResolvedValue(null);

    const dto = { primaryDiagnosis: 'N/A' } as any;

    await expect(service.dischargeCase('nonexistent-id', dto, TENANT_ID)).rejects.toThrow(
      NotFoundException,
    );
  });
});
