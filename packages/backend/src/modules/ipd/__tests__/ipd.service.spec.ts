import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { IpdService } from '../ipd.service';
import { Ward } from '../../../database/entities/ward.entity';
import { Bed, BedStatus } from '../../../database/entities/bed.entity';
import { Admission, AdmissionStatus } from '../../../database/entities/admission.entity';
import { NursingNote } from '../../../database/entities/nursing-note.entity';
import {
  MedicationAdministration,
  MedicationStatus,
} from '../../../database/entities/medication-administration.entity';
import { BedTransfer, TransferReason } from '../../../database/entities/bed-transfer.entity';
import {
  Encounter,
  EncounterStatus,
  EncounterType,
} from '../../../database/entities/encounter.entity';
import { Patient } from '../../../database/entities/patient.entity';
import { PrescriptionItem } from '../../../database/entities/prescription.entity';
import { BillingService } from '../../billing/billing.service';
import { BedBoardService } from '../bed-board.service';
import { AuditLogService } from '../../../common/interceptors/audit-log.service';
import { VitalsService } from '../../vitals/vitals.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates a deterministic UUID-like string for test readability. */
const uuid = (tag: string) => `00000000-0000-0000-0000-${tag.padStart(12, '0')}`;

const TENANT_ID = uuid('tenant1');
const USER_ID = uuid('user1');
const PATIENT_ID = uuid('patient1');
const WARD_ID = uuid('ward1');
const BED_ID = uuid('bed1');
const BED_ID_2 = uuid('bed2');
const WARD_ID_2 = uuid('ward2');
const ENCOUNTER_ID = uuid('enc1');
const ADMISSION_ID = uuid('adm1');
const MED_ID = uuid('med1');
const RX_ITEM_ID = uuid('rx1');

// ---------------------------------------------------------------------------
// Mock transaction manager
// ---------------------------------------------------------------------------
function createMockManager() {
  const mgr: Record<string, jest.Mock> = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    create: jest.fn((_, data) => ({ ...data })),
    save: jest.fn((entity) => Promise.resolve({ id: uuid('saved'), ...entity })),
    update: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
    increment: jest.fn().mockResolvedValue(undefined),
  };

  // Default query-builder chain used by pessimistic-lock queries
  const qbChain: Record<string, jest.Mock> = {
    setLock: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getCount: jest.fn().mockResolvedValue(0),
    getRawMany: jest.fn().mockResolvedValue([]),
  };

  mgr.createQueryBuilder.mockReturnValue(qbChain);

  return { mgr, qbChain };
}

// ---------------------------------------------------------------------------
// Mock repository factory
// ---------------------------------------------------------------------------
function createMockRepo(): Partial<Repository<any>> {
  const qb: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    clone: jest.fn(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getCount: jest.fn().mockResolvedValue(0),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  // clone() returns a fresh copy that still has all the chain methods
  qb.clone.mockReturnValue(qb);

  return {
    create: jest.fn((data) => ({ ...data })) as any,
    save: jest.fn((entity) => Promise.resolve({ id: uuid('saved'), ...entity })) as any,
    findOne: jest.fn().mockResolvedValue(null) as any,
    find: jest.fn().mockResolvedValue([]) as any,
    count: jest.fn().mockResolvedValue(0) as any,
    update: jest.fn().mockResolvedValue(undefined) as any,
    createQueryBuilder: jest.fn().mockReturnValue(qb) as any,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('IpdService', () => {
  let service: IpdService;
  let wardRepo: ReturnType<typeof createMockRepo>;
  let bedRepo: ReturnType<typeof createMockRepo>;
  let admissionRepo: ReturnType<typeof createMockRepo>;
  let nursingNoteRepo: ReturnType<typeof createMockRepo>;
  let medAdminRepo: ReturnType<typeof createMockRepo>;
  let transferRepo: ReturnType<typeof createMockRepo>;
  let encounterRepo: ReturnType<typeof createMockRepo>;
  let patientRepo: ReturnType<typeof createMockRepo>;
  let prescriptionItemRepo: ReturnType<typeof createMockRepo>;
  let dataSource: { transaction: jest.Mock };
  let billingService: Record<string, jest.Mock>;
  let bedBoardService: Record<string, jest.Mock>;
  let auditLogService: Record<string, jest.Mock>;
  let vitalsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    wardRepo = createMockRepo();
    bedRepo = createMockRepo();
    admissionRepo = createMockRepo();
    nursingNoteRepo = createMockRepo();
    medAdminRepo = createMockRepo();
    transferRepo = createMockRepo();
    encounterRepo = createMockRepo();
    patientRepo = createMockRepo();
    prescriptionItemRepo = createMockRepo();

    dataSource = {
      transaction: jest.fn(),
    };

    billingService = {
      addBillableItem: jest.fn().mockResolvedValue(undefined),
      createInvoice: jest.fn().mockResolvedValue({ id: uuid('inv1') }),
    };

    bedBoardService = {
      computeBedDayCharges: jest.fn().mockResolvedValue([]),
    };

    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    vitalsService = {
      recordFromSource: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpdService,
        { provide: getRepositoryToken(Ward), useValue: wardRepo },
        { provide: getRepositoryToken(Bed), useValue: bedRepo },
        { provide: getRepositoryToken(Admission), useValue: admissionRepo },
        { provide: getRepositoryToken(NursingNote), useValue: nursingNoteRepo },
        {
          provide: getRepositoryToken(MedicationAdministration),
          useValue: medAdminRepo,
        },
        { provide: getRepositoryToken(BedTransfer), useValue: transferRepo },
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: getRepositoryToken(PrescriptionItem), useValue: prescriptionItemRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: BillingService, useValue: billingService },
        { provide: BedBoardService, useValue: bedBoardService },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: VitalsService, useValue: vitalsService },
      ],
    }).compile();

    service = module.get<IpdService>(IpdService);
  });

  // -----------------------------------------------------------------------
  // 1. createAdmission — happy path
  // -----------------------------------------------------------------------
  describe('createAdmission', () => {
    it('should create an admission, occupy the bed, and update ward counts', async () => {
      const { mgr, qbChain } = createMockManager();

      // No existing admission for this patient
      mgr.findOne.mockResolvedValueOnce(null);

      // Bed lookup via pessimistic lock — bed is AVAILABLE
      qbChain.getOne.mockResolvedValueOnce({
        id: BED_ID,
        status: BedStatus.AVAILABLE,
        bedNumber: 'A01',
        wardId: WARD_ID,
      });

      // Daily admission count for number generation
      qbChain.getCount.mockResolvedValueOnce(3);

      // manager.save for admission
      mgr.save.mockResolvedValueOnce({
        id: ADMISSION_ID,
        admissionNumber: expect.any(String),
        patientId: PATIENT_ID,
        bedId: BED_ID,
        wardId: WARD_ID,
      });

      // manager.count calls for ward bed count update
      mgr.count
        .mockResolvedValueOnce(10) // totalBeds
        .mockResolvedValueOnce(5); // occupiedBeds

      // Ward lookup for auto-billing
      mgr.findOne
        .mockResolvedValueOnce({ id: WARD_ID, name: 'General Ward' }) // ward
        .mockResolvedValueOnce({ id: BED_ID, bedNumber: 'A01' }); // bed

      dataSource.transaction.mockImplementation((cb: any) => cb(mgr));

      const dto = {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        wardId: WARD_ID,
        bedId: BED_ID,
        admissionReason: 'Fever',
      };

      const result = await service.createAdmission(dto as any, USER_ID, TENANT_ID);

      // Bed should be marked as OCCUPIED
      expect(mgr.update).toHaveBeenCalledWith(Bed, BED_ID, { status: BedStatus.OCCUPIED });

      // Ward counts should be updated
      expect(mgr.update).toHaveBeenCalledWith(Ward, WARD_ID, { totalBeds: 10, occupiedBeds: 5 });

      // Encounter updated to IPD + ADMITTED
      expect(mgr.update).toHaveBeenCalledWith(Encounter, ENCOUNTER_ID, {
        type: EncounterType.IPD,
        status: EncounterStatus.ADMITTED,
      });

      // Billing was attempted
      expect(billingService.addBillableItem).toHaveBeenCalled();

      expect(result).toBeDefined();
      expect(result.patientId).toBe(PATIENT_ID);
    });

    // -------------------------------------------------------------------
    // 2. createAdmission — duplicate admission
    // -------------------------------------------------------------------
    it('should throw BadRequestException when patient is already admitted', async () => {
      dataSource.transaction.mockImplementation((cb: any) => {
        const { mgr: freshMgr } = createMockManager();
        // Existing active admission found
        freshMgr.findOne.mockResolvedValueOnce({
          id: uuid('existing'),
          admissionNumber: 'ADM202606010001',
          status: AdmissionStatus.ADMITTED,
        });
        return cb(freshMgr);
      });

      const dto = {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        wardId: WARD_ID,
        bedId: BED_ID,
      };

      await expect(service.createAdmission(dto as any, USER_ID, TENANT_ID)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.createAdmission(dto as any, USER_ID, TENANT_ID)).rejects.toThrow(
        /already admitted/,
      );
    });

    // -------------------------------------------------------------------
    // 3. createAdmission — bed unavailable
    // -------------------------------------------------------------------
    it('should throw BadRequestException when bed is not available', async () => {
      dataSource.transaction.mockImplementation((cb: any) => {
        const { mgr: freshMgr, qbChain: freshQb } = createMockManager();
        // No duplicate admission
        freshMgr.findOne.mockResolvedValueOnce(null);
        // Bed is OCCUPIED
        freshQb.getOne.mockResolvedValueOnce({
          id: BED_ID,
          status: BedStatus.OCCUPIED,
          wardId: WARD_ID,
        });
        return cb(freshMgr);
      });

      const dto = {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        wardId: WARD_ID,
        bedId: BED_ID,
      };

      await expect(service.createAdmission(dto as any, USER_ID, TENANT_ID)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.createAdmission(dto as any, USER_ID, TENANT_ID)).rejects.toThrow(
        /not available/,
      );
    });

    // -------------------------------------------------------------------
    // 4. createAdmission — bed not found
    // -------------------------------------------------------------------
    it('should throw NotFoundException when bed does not exist', async () => {
      const { mgr, qbChain } = createMockManager();

      mgr.findOne.mockResolvedValueOnce(null); // no duplicate admission
      qbChain.getOne.mockResolvedValueOnce(null); // bed not found

      dataSource.transaction.mockImplementation((cb: any) => cb(mgr));

      const dto = {
        patientId: PATIENT_ID,
        wardId: WARD_ID,
        bedId: uuid('nonexistent'),
      };

      await expect(service.createAdmission(dto as any, USER_ID, TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // 5. dischargePatient — happy path
  // -----------------------------------------------------------------------
  describe('dischargePatient', () => {
    it('should discharge patient, set bed to CLEANING, and complete encounter', async () => {
      const { mgr } = createMockManager();

      const admission = {
        id: ADMISSION_ID,
        admissionNumber: 'ADM202606010001',
        status: AdmissionStatus.ADMITTED,
        patientId: PATIENT_ID,
        bedId: BED_ID,
        wardId: WARD_ID,
        encounterId: ENCOUNTER_ID,
        metadata: null,
      };

      mgr.findOne.mockResolvedValueOnce(admission);

      // ward bed counts after discharge
      mgr.count
        .mockResolvedValueOnce(10) // totalBeds
        .mockResolvedValueOnce(4); // occupiedBeds

      // save returns the updated admission
      mgr.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      // bedBoardService returns no charge lines (simple case)
      bedBoardService.computeBedDayCharges.mockResolvedValue([]);

      dataSource.transaction.mockImplementation((cb: any) => cb(mgr));

      const dto = {
        dischargeSummary: 'Recovered well',
        dischargeDiagnosis: 'Malaria',
      };

      const result = await service.dischargePatient(ADMISSION_ID, dto as any, USER_ID, TENANT_ID);

      expect(result.status).toBe(AdmissionStatus.DISCHARGED);
      expect(result.dischargedById).toBe(USER_ID);
      expect(result.dischargeDate).toBeInstanceOf(Date);

      // Bed set to CLEANING
      expect(mgr.update).toHaveBeenCalledWith(Bed, BED_ID, { status: BedStatus.CLEANING });

      // Encounter completed
      expect(mgr.update).toHaveBeenCalledWith(
        Encounter,
        ENCOUNTER_ID,
        expect.objectContaining({ status: EncounterStatus.COMPLETED }),
      );
    });

    // -------------------------------------------------------------------
    // 6. dischargePatient — patient not admitted
    // -------------------------------------------------------------------
    it('should throw BadRequestException when patient is not currently admitted', async () => {
      dataSource.transaction.mockImplementation((cb: any) => {
        const { mgr: freshMgr } = createMockManager();
        freshMgr.findOne.mockResolvedValueOnce({
          id: ADMISSION_ID,
          status: AdmissionStatus.DISCHARGED,
        });
        return cb(freshMgr);
      });

      await expect(
        service.dischargePatient(ADMISSION_ID, {} as any, USER_ID, TENANT_ID),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.dischargePatient(ADMISSION_ID, {} as any, USER_ID, TENANT_ID),
      ).rejects.toThrow(/not currently admitted/);
    });
  });

  // -----------------------------------------------------------------------
  // 7. transferBed — happy path
  // -----------------------------------------------------------------------
  describe('transferBed', () => {
    it('should transfer patient to new bed, free old bed, and update ward counts', async () => {
      const { mgr, qbChain } = createMockManager();

      // First getOne call: admission with pessimistic lock
      const admission = {
        id: ADMISSION_ID,
        admissionNumber: 'ADM202606010001',
        status: AdmissionStatus.ADMITTED,
        patientId: PATIENT_ID,
        bedId: BED_ID,
        wardId: WARD_ID,
        encounterId: ENCOUNTER_ID,
      };

      // Second getOne call: new bed with pessimistic lock
      const newBed = {
        id: BED_ID_2,
        status: BedStatus.AVAILABLE,
        wardId: WARD_ID_2,
      };

      qbChain.getOne
        .mockResolvedValueOnce(admission) // admission lock
        .mockResolvedValueOnce(newBed); // new bed lock

      // Ward bed stat aggregation
      qbChain.getRawMany.mockResolvedValueOnce([
        { wardId: WARD_ID, total: 10, occupied: 4 },
        { wardId: WARD_ID_2, total: 8, occupied: 3 },
      ]);

      mgr.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      dataSource.transaction.mockImplementation((cb: any) => cb(mgr));

      const dto = {
        toWardId: WARD_ID_2,
        toBedId: BED_ID_2,
        reason: TransferReason.CLINICAL,
        notes: 'Step-up to ICU',
      };

      const result = await service.transferBed(ADMISSION_ID, dto as any, USER_ID, TENANT_ID);

      // Old bed set to CLEANING
      expect(mgr.update).toHaveBeenCalledWith(Bed, BED_ID, { status: BedStatus.CLEANING });

      // New bed set to OCCUPIED
      expect(mgr.update).toHaveBeenCalledWith(Bed, BED_ID_2, { status: BedStatus.OCCUPIED });

      // Transfer record was saved
      expect(mgr.save).toHaveBeenCalledWith(
        expect.objectContaining({
          admissionId: ADMISSION_ID,
          fromBedId: BED_ID,
          toBedId: BED_ID_2,
          reason: TransferReason.CLINICAL,
        }),
      );

      // Admission ward/bed updated
      expect(result.wardId).toBe(WARD_ID_2);
      expect(result.bedId).toBe(BED_ID_2);
    });

    it('should throw BadRequestException when new bed is not available', async () => {
      const { mgr, qbChain } = createMockManager();

      qbChain.getOne
        .mockResolvedValueOnce({
          id: ADMISSION_ID,
          status: AdmissionStatus.ADMITTED,
          bedId: BED_ID,
          wardId: WARD_ID,
        })
        .mockResolvedValueOnce({
          id: BED_ID_2,
          status: BedStatus.OCCUPIED,
        });

      dataSource.transaction.mockImplementation((cb: any) => cb(mgr));

      const dto = {
        toWardId: WARD_ID_2,
        toBedId: BED_ID_2,
        reason: TransferReason.CLINICAL,
      };

      await expect(
        service.transferBed(ADMISSION_ID, dto as any, USER_ID, TENANT_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------------------
  // 8. Bed management — markBedAvailable
  // -----------------------------------------------------------------------
  describe('markBedAvailable', () => {
    it('should mark a CLEANING bed as AVAILABLE and update ward counts', async () => {
      const bed = {
        id: BED_ID,
        bedNumber: 'A01',
        status: BedStatus.CLEANING,
        wardId: WARD_ID,
        tenantId: TENANT_ID,
      };

      (bedRepo.findOne as jest.Mock).mockResolvedValueOnce(bed);
      (bedRepo.save as jest.Mock).mockImplementation((b: any) => Promise.resolve({ ...b }));
      (bedRepo.count as jest.Mock)
        .mockResolvedValueOnce(10) // totalBeds
        .mockResolvedValueOnce(3); // occupiedBeds

      const result = await service.markBedAvailable(BED_ID, TENANT_ID);

      expect(result.status).toBe(BedStatus.AVAILABLE);
      expect(wardRepo.update).toHaveBeenCalledWith(WARD_ID, {
        totalBeds: 10,
        occupiedBeds: 3,
      });
    });

    it('should throw BadRequestException when bed is not in CLEANING status', async () => {
      (bedRepo.findOne as jest.Mock).mockResolvedValue({
        id: BED_ID,
        status: BedStatus.OCCUPIED,
        wardId: WARD_ID,
      });

      await expect(service.markBedAvailable(BED_ID, TENANT_ID)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.markBedAvailable(BED_ID, TENANT_ID)).rejects.toThrow(/cleaning/);
    });

    it('should throw NotFoundException when bed does not exist', async () => {
      (bedRepo.findOne as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.markBedAvailable(uuid('nope'), TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // 9. createNursingNote — non-admitted admission
  // -----------------------------------------------------------------------
  describe('createNursingNote', () => {
    it('should throw BadRequestException when admission is not active', async () => {
      (admissionRepo.findOne as jest.Mock).mockResolvedValue({
        id: ADMISSION_ID,
        status: AdmissionStatus.DISCHARGED,
      });

      const dto = {
        admissionId: ADMISSION_ID,
        content: 'Patient resting well',
      };

      await expect(service.createNursingNote(dto as any, USER_ID, TENANT_ID)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.createNursingNote(dto as any, USER_ID, TENANT_ID)).rejects.toThrow(
        /non-active admission/,
      );
    });

    it('should create a nursing note for an active admission', async () => {
      (admissionRepo.findOne as jest.Mock).mockResolvedValue({
        id: ADMISSION_ID,
        status: AdmissionStatus.ADMITTED,
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
      });

      const savedNote = {
        id: uuid('note1'),
        admissionId: ADMISSION_ID,
        content: 'Patient vitals stable',
        nurseId: USER_ID,
        noteTime: new Date(),
      };
      (nursingNoteRepo.save as jest.Mock).mockResolvedValueOnce(savedNote);

      const dto = {
        admissionId: ADMISSION_ID,
        content: 'Patient vitals stable',
      };

      const result = await service.createNursingNote(dto as any, USER_ID, TENANT_ID);

      expect(result).toEqual(savedNote);
      expect(nursingNoteRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          admissionId: ADMISSION_ID,
          nurseId: USER_ID,
          tenantId: TENANT_ID,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 10. administerMedication — happy path
  // -----------------------------------------------------------------------
  describe('administerMedication', () => {
    it('should administer medication, increment Rx dispensed count, and log audit', async () => {
      const { mgr } = createMockManager();

      const med = {
        id: MED_ID,
        status: MedicationStatus.SCHEDULED,
        admissionId: ADMISSION_ID,
        drugName: 'Amoxicillin',
        prescriptionItemId: RX_ITEM_ID,
      };

      // findOne for medication (pessimistic lock)
      mgr.findOne
        .mockResolvedValueOnce(med)
        // findOne for admission+patient (allergy check)
        .mockResolvedValueOnce({
          id: ADMISSION_ID,
          patient: { allergies: [] },
        });

      mgr.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      dataSource.transaction.mockImplementation((cb: any) => cb(mgr));

      const dto = {
        status: MedicationStatus.ADMINISTERED,
        batchNumber: 'BATCH-001',
        notes: 'Given with food',
      };

      const result = await service.administerMedication(MED_ID, dto as any, USER_ID, TENANT_ID);

      expect(result.status).toBe(MedicationStatus.ADMINISTERED);
      expect(result.administeredById).toBe(USER_ID);
      expect(result.batchNumber).toBe('BATCH-001');

      // Rx item dispensed count incremented
      expect(mgr.increment).toHaveBeenCalledWith(
        PrescriptionItem,
        { id: RX_ITEM_ID },
        'quantityDispensed',
        1,
      );

      // Audit log fired
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MEDICATION_ADMINISTERED',
          entityType: 'MedicationAdministration',
          entityId: expect.any(String),
        }),
      );
    });

    it('should throw BadRequestException when dose was already administered', async () => {
      dataSource.transaction.mockImplementation((cb: any) => {
        const { mgr: freshMgr } = createMockManager();
        freshMgr.findOne.mockResolvedValueOnce({
          id: MED_ID,
          status: MedicationStatus.ADMINISTERED,
        });
        return cb(freshMgr);
      });

      const dto = { status: MedicationStatus.ADMINISTERED };

      await expect(
        service.administerMedication(MED_ID, dto as any, USER_ID, TENANT_ID),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.administerMedication(MED_ID, dto as any, USER_ID, TENANT_ID),
      ).rejects.toThrow(/already been administered/);
    });

    it('should throw BadRequestException for allergy without override reason', async () => {
      dataSource.transaction.mockImplementation((cb: any) => {
        const { mgr: freshMgr } = createMockManager();
        freshMgr.findOne
          .mockResolvedValueOnce({
            id: MED_ID,
            status: MedicationStatus.SCHEDULED,
            admissionId: ADMISSION_ID,
            drugName: 'Amoxicillin',
            prescriptionItemId: null,
          })
          .mockResolvedValueOnce({
            id: ADMISSION_ID,
            patient: { allergies: ['amoxicillin'] },
          });
        return cb(freshMgr);
      });

      const dto = {
        status: MedicationStatus.ADMINISTERED,
      };

      await expect(
        service.administerMedication(MED_ID, dto as any, USER_ID, TENANT_ID),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.administerMedication(MED_ID, dto as any, USER_ID, TENANT_ID),
      ).rejects.toThrow(/allergy/i);
    });

    it('should allow administration with allergy when override reason is provided', async () => {
      const { mgr } = createMockManager();

      mgr.findOne
        .mockResolvedValueOnce({
          id: MED_ID,
          status: MedicationStatus.SCHEDULED,
          admissionId: ADMISSION_ID,
          drugName: 'Amoxicillin',
          prescriptionItemId: null,
        })
        .mockResolvedValueOnce({
          id: ADMISSION_ID,
          patient: { allergies: ['amoxicillin'] },
        });

      mgr.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      dataSource.transaction.mockImplementation((cb: any) => cb(mgr));

      const dto = {
        status: MedicationStatus.ADMINISTERED,
        allergyOverrideReason: 'No alternative available, patient consented',
      };

      const result = await service.administerMedication(MED_ID, dto as any, USER_ID, TENANT_ID);

      expect(result.status).toBe(MedicationStatus.ADMINISTERED);
    });
  });

  // -----------------------------------------------------------------------
  // 11. getIpdStats
  // -----------------------------------------------------------------------
  describe('getIpdStats', () => {
    it('should return aggregated IPD statistics', async () => {
      const admissionQb = (admissionRepo.createQueryBuilder as jest.Mock)();

      // Each clone() returns the same qb mock, so we configure getCount
      // to return different values on successive calls
      admissionQb.getCount
        .mockResolvedValueOnce(25) // activeAdmissions
        .mockResolvedValueOnce(5) // todayAdmissions
        .mockResolvedValueOnce(3); // todayDischarges

      // Spy on getWardOccupancy — it uses wardRepo.createQueryBuilder
      const wardQb = (wardRepo.createQueryBuilder as jest.Mock)();
      wardQb.getRawMany.mockResolvedValueOnce([
        { id: WARD_ID, name: 'General', type: 'general', totalBeds: 20, occupiedBeds: 15 },
        { id: WARD_ID_2, name: 'ICU', type: 'icu', totalBeds: 10, occupiedBeds: 8 },
      ]);

      const facilityId = uuid('fac1');
      const result = await service.getIpdStats(facilityId, TENANT_ID);

      expect(result.activeAdmissions).toBe(25);
      expect(result.todayAdmissions).toBe(5);
      expect(result.todayDischarges).toBe(3);
      expect(result.totalBeds).toBe(30);
      expect(result.occupiedBeds).toBe(23);
      expect(result.availableBeds).toBe(7);
      expect(result.overallOccupancyRate).toBe(77); // round(23/30*100)
      expect(result.wardOccupancy).toHaveLength(2);
      expect(result.wardOccupancy[0]).toEqual(
        expect.objectContaining({
          name: 'General',
          occupancyRate: 75, // round(15/20*100)
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 12. createWard
  // -----------------------------------------------------------------------
  describe('createWard', () => {
    it('should create a ward with tenantId', async () => {
      const dto = { name: 'Surgical Ward', code: 'SURG-01', facilityId: uuid('fac1') };
      const saved = { id: uuid('ward-new'), ...dto, tenantId: TENANT_ID };
      (wardRepo.save as jest.Mock).mockResolvedValueOnce(saved);

      const result = await service.createWard(dto as any, TENANT_ID);

      expect(wardRepo.create).toHaveBeenCalledWith(dto);
      expect(result.tenantId).toBe(TENANT_ID);
    });
  });

  // -----------------------------------------------------------------------
  // 13. createBed
  // -----------------------------------------------------------------------
  describe('createBed', () => {
    it('should create a bed and update ward bed count', async () => {
      const dto = { bedNumber: 'B01', wardId: WARD_ID };
      const saved = { id: uuid('bed-new'), ...dto, tenantId: TENANT_ID };
      (bedRepo.save as jest.Mock).mockResolvedValueOnce(saved);
      (bedRepo.count as jest.Mock)
        .mockResolvedValueOnce(11) // totalBeds after add
        .mockResolvedValueOnce(4); // occupiedBeds

      const result = await service.createBed(dto as any, TENANT_ID);

      expect(result).toEqual(saved);
      expect(wardRepo.update).toHaveBeenCalledWith(WARD_ID, {
        totalBeds: 11,
        occupiedBeds: 4,
      });
    });
  });
});
