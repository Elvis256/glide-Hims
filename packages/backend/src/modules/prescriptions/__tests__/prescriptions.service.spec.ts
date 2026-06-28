import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PrescriptionsService } from '../prescriptions.service';
import {
  Prescription,
  PrescriptionItem,
  Dispensation,
  MedicationAdministration,
  PrescriptionStatus,
} from '../../../database/entities/prescription.entity';
import { ControlledSubstanceLog } from '../../../database/entities/controlled-substance.entity';
import {
  Encounter,
  EncounterStatus,
} from '../../../database/entities/encounter.entity';
import {
  Item,
  StockBalance,
  StockLedger,
} from '../../../database/entities/inventory.entity';
import { BillingService } from '../../billing/billing.service';
import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service';
import { QueueManagementService } from '../../queue-management/queue-management.service';
import { DrugManagementService } from '../../drug-management/drug-management.service';
import { MedicationSafetyService } from '../../allergies/medication-safety.service';
import { IdentityGuardService } from '../../../common/services/identity-guard.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-001';
const USER_ID = 'user-001';
const ENCOUNTER_ID = 'enc-001';
const PRESCRIPTION_ID = 'rx-001';
const ITEM_ID = 'item-001';
const FACILITY_ID = 'facility-001';

function mockEncounter(overrides: Partial<Encounter> = {}): Encounter {
  return {
    id: ENCOUNTER_ID,
    tenantId: TENANT_ID,
    facilityId: FACILITY_ID,
    status: EncounterStatus.IN_CONSULTATION,
    patientId: 'patient-001',
    patient: { id: 'patient-001', fullName: 'John Doe' } as any,
    ...overrides,
  } as Encounter;
}

function mockPrescriptionItem(overrides: Partial<PrescriptionItem> = {}): PrescriptionItem {
  return {
    id: ITEM_ID,
    prescriptionId: PRESCRIPTION_ID,
    drugCode: 'AMX500',
    drugName: 'Amoxicillin 500mg',
    dose: '500mg',
    frequency: 'TDS',
    duration: '5 days',
    quantity: 15,
    quantityDispensed: 0,
    isDispensed: false,
    instructions: 'Take after meals',
    ...overrides,
  } as PrescriptionItem;
}

function mockPrescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    id: PRESCRIPTION_ID,
    prescriptionNumber: 'RX202606270001',
    status: PrescriptionStatus.PENDING,
    encounterId: ENCOUNTER_ID,
    prescribedById: USER_ID,
    notes: null,
    items: [mockPrescriptionItem()],
    encounter: mockEncounter(),
    prescribedBy: { id: USER_ID, fullName: 'Dr. Smith' } as any,
    dispensingStartedAt: undefined,
    dispensedAt: null,
    readyAt: null,
    collectedAt: undefined,
    prescriberSignature: null,
    prescriberSignedAt: null,
    dispenserSignature: null,
    dispenserSignedAt: null,
    signatureVerified: false,
    tenantId: TENANT_ID,
    ...overrides,
  } as unknown as Prescription;
}

function safePassing() {
  return {
    blocked: false,
    alerts: [],
    blockingAlerts: [],
    degraded: false,
    degradedReasons: [],
  };
}

function safetyBlocked() {
  return {
    blocked: true,
    alerts: [
      {
        kind: 'ddi',
        severity: 'major',
        description: 'Severe interaction between Drug A and Drug B',
        drugIds: ['drug-a', 'drug-b'],
      },
    ],
    blockingAlerts: [
      {
        kind: 'ddi',
        severity: 'major',
        description: 'Severe interaction between Drug A and Drug B',
        drugIds: ['drug-a', 'drug-b'],
      },
    ],
    degraded: false,
    degradedReasons: [],
  };
}

// ---------------------------------------------------------------------------
// Mock repository factory
// ---------------------------------------------------------------------------
function mockRepository() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((entity) => entity),
    save: jest.fn((entity) => Promise.resolve(entity)),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder()),
  };
}

function mockQueryBuilder() {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  return qb;
}

// ---------------------------------------------------------------------------
// Mock transactional manager
// ---------------------------------------------------------------------------
function mockTransactionalManager() {
  const mgr: any = {
    create: jest.fn((_, entity) => entity),
    save: jest.fn((entity) => Promise.resolve(entity)),
    findOne: jest.fn(),
    getRepository: jest.fn(() => mockRepository()),
    createQueryBuilder: jest.fn(() => mockQueryBuilder()),
    query: jest.fn().mockResolvedValue([]),
  };
  return mgr;
}

// ---------------------------------------------------------------------------
// Describe block
// ---------------------------------------------------------------------------
describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let prescriptionRepo: jest.Mocked<Repository<Prescription>>;
  let itemRepo: jest.Mocked<Repository<PrescriptionItem>>;
  let dispensationRepo: jest.Mocked<Repository<Dispensation>>;
  let adminRepo: jest.Mocked<Repository<MedicationAdministration>>;
  let controlledSubstanceLogRepo: jest.Mocked<Repository<ControlledSubstanceLog>>;
  let encounterRepo: jest.Mocked<Repository<Encounter>>;
  let inventoryRepo: jest.Mocked<Repository<Item>>;
  let stockBalanceRepo: jest.Mocked<Repository<StockBalance>>;
  let stockLedgerRepo: jest.Mocked<Repository<StockLedger>>;

  let billingService: jest.Mocked<BillingService>;
  let inAppNotificationsService: jest.Mocked<InAppNotificationsService>;
  let queueManagementService: jest.Mocked<QueueManagementService>;
  let drugManagementService: jest.Mocked<DrugManagementService>;
  let medicationSafetyService: jest.Mocked<MedicationSafetyService>;
  let identityGuardService: jest.Mocked<IdentityGuardService>;
  let dataSource: { transaction: jest.Mock; query: jest.Mock; createQueryRunner: jest.Mock };

  const mockManager = mockTransactionalManager();

  beforeEach(async () => {
    dataSource = {
      transaction: jest.fn((cb) => cb(mockManager)),
      query: jest.fn().mockResolvedValue([]),
      createQueryRunner: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsService,
        { provide: getRepositoryToken(Prescription), useFactory: mockRepository },
        { provide: getRepositoryToken(PrescriptionItem), useFactory: mockRepository },
        { provide: getRepositoryToken(Dispensation), useFactory: mockRepository },
        { provide: getRepositoryToken(MedicationAdministration), useFactory: mockRepository },
        { provide: getRepositoryToken(ControlledSubstanceLog), useFactory: mockRepository },
        { provide: getRepositoryToken(Encounter), useFactory: mockRepository },
        { provide: getRepositoryToken(Item), useFactory: mockRepository },
        { provide: getRepositoryToken(StockBalance), useFactory: mockRepository },
        { provide: getRepositoryToken(StockLedger), useFactory: mockRepository },
        {
          provide: BillingService,
          useValue: {
            addBillableItem: jest.fn().mockResolvedValue({}),
            updateBillableItem: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: InAppNotificationsService,
          useValue: {
            notifyNewPrescription: jest.fn().mockResolvedValue(undefined),
            notifyPrescriptionDispensed: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: QueueManagementService,
          useValue: { moveToServicePoint: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: DrugManagementService,
          useValue: { checkInteractions: jest.fn().mockResolvedValue({ interactions: [] }) },
        },
        {
          provide: MedicationSafetyService,
          useValue: {
            runSafetyChecks: jest.fn().mockResolvedValue(safePassing()),
            recordOverride: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: IdentityGuardService,
          useValue: { assertWitness: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<PrescriptionsService>(PrescriptionsService);
    prescriptionRepo = module.get(getRepositoryToken(Prescription));
    itemRepo = module.get(getRepositoryToken(PrescriptionItem));
    dispensationRepo = module.get(getRepositoryToken(Dispensation));
    adminRepo = module.get(getRepositoryToken(MedicationAdministration));
    controlledSubstanceLogRepo = module.get(getRepositoryToken(ControlledSubstanceLog));
    encounterRepo = module.get(getRepositoryToken(Encounter));
    inventoryRepo = module.get(getRepositoryToken(Item));
    stockBalanceRepo = module.get(getRepositoryToken(StockBalance));
    stockLedgerRepo = module.get(getRepositoryToken(StockLedger));
    billingService = module.get(BillingService);
    inAppNotificationsService = module.get(InAppNotificationsService);
    queueManagementService = module.get(QueueManagementService);
    drugManagementService = module.get(DrugManagementService);
    medicationSafetyService = module.get(MedicationSafetyService);
    identityGuardService = module.get(IdentityGuardService);
  });

  afterEach(() => jest.clearAllMocks());

  // =========================================================================
  // 1. create — happy path
  // =========================================================================
  describe('create — happy path', () => {
    it('should create a prescription, move encounter to PENDING_PHARMACY, and return it', async () => {
      const encounter = mockEncounter();
      encounterRepo.findOne
        .mockResolvedValueOnce(encounter)   // first call: encounter lookup
        .mockResolvedValueOnce({ ...encounter, patient: encounter.patient } as any); // for notification lookup

      inventoryRepo.findOne.mockResolvedValue(null); // no inventory match — free-text prescribing

      const savedPrescription = mockPrescription();
      // dataSource.transaction calls the callback with mockManager
      mockManager.save.mockResolvedValue(savedPrescription);

      // findOne after save
      prescriptionRepo.findOne.mockResolvedValue(savedPrescription);

      const dto = {
        encounterId: ENCOUNTER_ID,
        items: [
          {
            drugCode: 'AMX500',
            drugName: 'Amoxicillin 500mg',
            dose: '500mg',
            frequency: 'TDS',
            duration: '5 days',
            quantity: 15,
            instructions: 'Take after meals',
          },
        ],
        notes: 'Routine prescription',
      };

      const result = await service.create(dto, USER_ID, TENANT_ID);

      // Verify encounter was looked up
      expect(encounterRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ENCOUNTER_ID, tenantId: TENANT_ID },
        }),
      );

      // Verify medication safety was invoked
      expect(medicationSafetyService.runSafetyChecks).toHaveBeenCalledTimes(1);

      // Verify transaction was used
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);

      // Verify encounter status updated to PENDING_PHARMACY
      expect(encounterRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: EncounterStatus.PENDING_PHARMACY }),
      );

      // Verify queue move
      expect(queueManagementService.moveToServicePoint).toHaveBeenCalledWith(
        ENCOUNTER_ID,
        'pharmacy',
        'Prescription created',
        TENANT_ID,
      );

      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // 2. create — safety blocked (no override)
  // =========================================================================
  describe('create — safety blocked without override', () => {
    it('should throw ConflictException with SAFETY_BLOCKED code when safety check fails and no override provided', async () => {
      const encounter = mockEncounter();
      encounterRepo.findOne.mockResolvedValueOnce(encounter);
      inventoryRepo.findOne.mockResolvedValue(null);

      (medicationSafetyService.runSafetyChecks as jest.Mock).mockResolvedValueOnce(
        safetyBlocked(),
      );

      const dto = {
        encounterId: ENCOUNTER_ID,
        items: [
          {
            drugCode: 'DRUG-A',
            drugName: 'Drug A',
            dose: '100mg',
            frequency: 'BD',
            duration: '7 days',
            quantity: 14,
          },
        ],
      };

      await expect(service.create(dto, USER_ID, TENANT_ID)).rejects.toThrow(
        ConflictException,
      );

      // Transaction should NOT have been called
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. create — safety blocked with override
  // =========================================================================
  describe('create — safety blocked with override accepted', () => {
    it('should create the prescription and record override audit when safetyOverride is provided', async () => {
      const encounter = mockEncounter();
      encounterRepo.findOne
        .mockResolvedValueOnce(encounter)
        .mockResolvedValueOnce({ ...encounter, patient: encounter.patient } as any);
      inventoryRepo.findOne.mockResolvedValue(null);

      (medicationSafetyService.runSafetyChecks as jest.Mock).mockResolvedValueOnce(
        safetyBlocked(),
      );

      const savedPrescription = mockPrescription();
      mockManager.save.mockResolvedValue(savedPrescription);
      prescriptionRepo.findOne.mockResolvedValue(savedPrescription);

      const dto = {
        encounterId: ENCOUNTER_ID,
        items: [
          {
            drugCode: 'DRUG-A',
            drugName: 'Drug A',
            dose: '100mg',
            frequency: 'BD',
            duration: '7 days',
            quantity: 14,
          },
        ],
        safetyOverride: {
          reason: 'Clinical judgement: benefit outweighs risk',
        },
      };

      const result = await service.create(dto, USER_ID, TENANT_ID);

      expect(result).toBeDefined();

      // Transaction should have been called
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);

      // Override audit should be recorded
      expect(medicationSafetyService.recordOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          prescriptionId: savedPrescription.id,
          reason: 'Clinical judgement: benefit outweighs risk',
          overriddenById: USER_ID,
          tenantId: TENANT_ID,
        }),
      );
    });
  });

  // =========================================================================
  // 4. dispenseItem — happy path
  // =========================================================================
  describe('dispenseItem — happy path', () => {
    it('should create a dispensation record and update the prescription item quantity', async () => {
      const pItem = mockPrescriptionItem({
        prescription: mockPrescription(),
      });
      (pItem.prescription as any).encounter = mockEncounter();

      itemRepo.findOne.mockResolvedValue(pItem);
      inventoryRepo.findOne.mockResolvedValue({
        id: 'inv-001',
        code: 'AMX500',
        name: 'Amoxicillin 500mg',
        retailPrice: 50,
        sellingPrice: 45,
        unitCost: 30,
      } as any);

      const createdDispensation = {
        id: 'disp-001',
        prescriptionId: PRESCRIPTION_ID,
        prescriptionItemId: ITEM_ID,
        quantity: 5,
        unitPrice: 50,
        totalPrice: 250,
        dispensedById: USER_ID,
      };
      dispensationRepo.create.mockReturnValue(createdDispensation as any);
      dispensationRepo.save.mockResolvedValue(createdDispensation as any);

      // For updatePrescriptionStatus
      prescriptionRepo.findOne.mockResolvedValue(
        mockPrescription({
          items: [mockPrescriptionItem({ quantityDispensed: 5 })],
        }),
      );

      const dto = {
        prescriptionItemId: ITEM_ID,
        quantity: 5,
        batchNumber: 'BATCH-001',
      };

      const result = await service.dispenseItem(dto, USER_ID, TENANT_ID);

      expect(result).toEqual(createdDispensation);

      // Verify dispensation was created with server-derived price
      expect(dispensationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          prescriptionId: PRESCRIPTION_ID,
          prescriptionItemId: ITEM_ID,
          quantity: 5,
          unitPrice: 50,
          totalPrice: 250,
        }),
      );

      // Verify item quantity updated
      expect(itemRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantityDispensed: 5 }),
      );
    });
  });

  // =========================================================================
  // 5. dispenseItem — exceeds remaining quantity
  // =========================================================================
  describe('dispenseItem — exceeds remaining quantity', () => {
    it('should throw BadRequestException when dispensing more than the remaining quantity', async () => {
      const pItem = mockPrescriptionItem({
        quantity: 15,
        quantityDispensed: 12,
        prescription: mockPrescription(),
      });
      (pItem.prescription as any).encounter = mockEncounter();

      itemRepo.findOne.mockResolvedValue(pItem);

      const dto = {
        prescriptionItemId: ITEM_ID,
        quantity: 5, // only 3 remaining (15 - 12)
      };

      await expect(service.dispenseItem(dto, USER_ID, TENANT_ID)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.dispenseItem(dto, USER_ID, TENANT_ID)).rejects.toThrow(
        /Cannot dispense more than 3 units/,
      );
    });
  });

  // =========================================================================
  // 6. cancelPrescription — happy path
  // =========================================================================
  describe('cancelPrescription — happy path', () => {
    it('should cancel a pending prescription and release reserved stock', async () => {
      const encounter = mockEncounter();
      const item = mockPrescriptionItem({ quantity: 10, quantityDispensed: 0 });
      const rx = mockPrescription({
        status: PrescriptionStatus.PENDING,
        items: [item],
        encounter,
      });

      prescriptionRepo.findOne.mockResolvedValue(rx);

      inventoryRepo.findOne.mockResolvedValue({
        id: 'inv-001',
        code: 'AMX500',
      } as any);

      stockBalanceRepo.findOne.mockResolvedValue({
        itemId: 'inv-001',
        facilityId: FACILITY_ID,
        reservedQuantity: 10,
        availableQuantity: 90,
        lastMovementAt: new Date(),
      } as any);

      prescriptionRepo.save.mockImplementation((entity) =>
        Promise.resolve(entity as any),
      );

      const result = await service.cancelPrescription(PRESCRIPTION_ID, TENANT_ID);

      expect(result.status).toBe(PrescriptionStatus.CANCELLED);

      // Verify stock was released
      expect(stockBalanceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reservedQuantity: 0,
          availableQuantity: 100,
        }),
      );
    });
  });

  // =========================================================================
  // 7. cancelPrescription — already fully dispensed
  // =========================================================================
  describe('cancelPrescription — already dispensed', () => {
    it('should throw BadRequestException when trying to cancel a fully dispensed prescription', async () => {
      const rx = mockPrescription({
        status: PrescriptionStatus.DISPENSED,
      });

      prescriptionRepo.findOne.mockResolvedValue(rx);

      await expect(
        service.cancelPrescription(PRESCRIPTION_ID, TENANT_ID),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.cancelPrescription(PRESCRIPTION_ID, TENANT_ID),
      ).rejects.toThrow(/Cannot cancel a fully dispensed prescription/);
    });
  });

  // =========================================================================
  // 8. updateStatus — valid transition (pending → dispensing)
  // =========================================================================
  describe('updateStatus — valid transition', () => {
    it('should update status from pending to dispensing and set dispensingStartedAt', async () => {
      const rx = mockPrescription({
        status: PrescriptionStatus.PENDING,
        dispensingStartedAt: undefined,
      });

      // findOne is used inside updateStatus via this.findOne()
      prescriptionRepo.findOne.mockResolvedValue(rx);
      prescriptionRepo.save.mockImplementation((entity) =>
        Promise.resolve(entity as any),
      );

      const dto = { status: 'dispensing' as const };

      const result = await service.updateStatus(PRESCRIPTION_ID, dto, TENANT_ID);

      expect(result.status).toBe(PrescriptionStatus.DISPENSING);
      expect(result.dispensingStartedAt).toBeInstanceOf(Date);
    });
  });

  // =========================================================================
  // 9. updateStatus — invalid transition (collected → pending)
  // =========================================================================
  describe('updateStatus — invalid transition', () => {
    it('should throw BadRequestException for transition from collected (terminal) to pending', async () => {
      const rx = mockPrescription({
        status: PrescriptionStatus.COLLECTED,
      });

      prescriptionRepo.findOne.mockResolvedValue(rx);

      const dto = { status: 'pending' as const };

      await expect(
        service.updateStatus(PRESCRIPTION_ID, dto as any, TENANT_ID),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus(PRESCRIPTION_ID, dto as any, TENANT_ID),
      ).rejects.toThrow(/terminal state/);
    });
  });

  // =========================================================================
  // 10. findOne — not found
  // =========================================================================
  describe('findOne — not found', () => {
    it('should throw NotFoundException when prescription does not exist', async () => {
      prescriptionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent-id', TENANT_ID),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findOne('nonexistent-id', TENANT_ID),
      ).rejects.toThrow(/Prescription not found/);
    });
  });

  // =========================================================================
  // 11. findByNumber — happy path
  // =========================================================================
  describe('findByNumber — happy path', () => {
    it('should return the prescription augmented with doctor and patient fields', async () => {
      const rx = mockPrescription();
      prescriptionRepo.findOne.mockResolvedValue(rx);

      const result = await service.findByNumber('RX202606270001', TENANT_ID);

      expect(prescriptionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { prescriptionNumber: 'RX202606270001', tenantId: TENANT_ID },
          relations: ['items', 'encounter', 'encounter.patient', 'prescribedBy'],
        }),
      );
      expect((result as any).doctor).toBeDefined();
      expect((result as any).patient).toBeDefined();
    });
  });

  // =========================================================================
  // 12. create — encounter not found
  // =========================================================================
  describe('create — encounter not found', () => {
    it('should throw NotFoundException when encounter does not exist', async () => {
      encounterRepo.findOne.mockResolvedValue(null);

      const dto = {
        encounterId: 'nonexistent-encounter',
        items: [
          {
            drugCode: 'AMX500',
            drugName: 'Amoxicillin 500mg',
            dose: '500mg',
            frequency: 'TDS',
            duration: '5 days',
            quantity: 15,
          },
        ],
      };

      await expect(service.create(dto, USER_ID, TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(dto, USER_ID, TENANT_ID)).rejects.toThrow(
        /Encounter not found/,
      );
    });
  });

  // =========================================================================
  // 13. create — encounter in completed status rejects prescription
  // =========================================================================
  describe('create — encounter in invalid status', () => {
    it('should throw BadRequestException when encounter is in COMPLETED status', async () => {
      const encounter = mockEncounter({ status: EncounterStatus.COMPLETED });
      encounterRepo.findOne.mockResolvedValue(encounter);

      const dto = {
        encounterId: ENCOUNTER_ID,
        items: [
          {
            drugCode: 'AMX500',
            drugName: 'Amoxicillin 500mg',
            dose: '500mg',
            frequency: 'TDS',
            duration: '5 days',
            quantity: 15,
          },
        ],
      };

      await expect(service.create(dto, USER_ID, TENANT_ID)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(dto, USER_ID, TENANT_ID)).rejects.toThrow(
        /Cannot create prescription for encounter/,
      );
    });
  });

  // =========================================================================
  // 14. updateStatus — valid transition (dispensed → collected)
  // =========================================================================
  describe('updateStatus — dispensed to collected', () => {
    it('should allow transition from dispensed to collected and set collectedAt', async () => {
      const rx = mockPrescription({
        status: PrescriptionStatus.DISPENSED,
        collectedAt: undefined,
      });

      prescriptionRepo.findOne.mockResolvedValue(rx);
      prescriptionRepo.save.mockImplementation((entity) =>
        Promise.resolve(entity as any),
      );

      const dto = { status: 'collected' as const };

      const result = await service.updateStatus(PRESCRIPTION_ID, dto, TENANT_ID);

      expect(result.status).toBe(PrescriptionStatus.COLLECTED);
      expect(result.collectedAt).toBeInstanceOf(Date);
    });
  });

  // =========================================================================
  // 15. updateStatus — invalid transition (cancelled → dispensing)
  // =========================================================================
  describe('updateStatus — cancelled is terminal', () => {
    it('should throw BadRequestException for any transition out of cancelled', async () => {
      const rx = mockPrescription({
        status: PrescriptionStatus.CANCELLED,
      });

      prescriptionRepo.findOne.mockResolvedValue(rx);

      const dto = { status: 'dispensing' as const };

      await expect(
        service.updateStatus(PRESCRIPTION_ID, dto, TENANT_ID),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus(PRESCRIPTION_ID, dto, TENANT_ID),
      ).rejects.toThrow(/terminal state/);
    });
  });
});
