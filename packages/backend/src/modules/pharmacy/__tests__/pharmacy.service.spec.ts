import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { PharmacyService } from '../pharmacy.service';
import { PharmacySale, PharmacySaleItem } from '../../../database/entities/pharmacy-sale.entity';
import {
  Item,
  StockLedger,
  StockBalance,
  ExpiryAlert,
} from '../../../database/entities/inventory.entity';
import { BatchStockBalance } from '../../../database/entities/batch-stock.entity';
import { Prescription, PrescriptionItem } from '../../../database/entities/prescription.entity';
import { AuditLog } from '../../../database/entities/audit-log.entity';
import { DrugClassification, DrugInteraction } from '../../../database/entities/drug-classification.entity';
import { DrugInteractionOverride } from '../../../database/entities/drug-interaction-override.entity';
import { ControlledSubstanceLog } from '../../../database/entities/controlled-substance.entity';
import { ReceiptReprint, RetailCustomer } from '../../../database/entities/pos-retail.entity';
import { PosShiftGuardService } from '../../pos/services/pos-shift-guard.service';
import { EfrisService } from '../../efris/efris.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FinanceService } from '../../finance/finance.service';
import { InventoryService } from '../../inventory/inventory.service';
import { BadRequestException } from '@nestjs/common';

describe('PharmacyService', () => {
  let service: PharmacyService;

  const mockSaleRepo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };
  const mockSaleItemRepo = { create: jest.fn(), save: jest.fn() };
  const mockItemRepo = { findOne: jest.fn() };
  const mockLedgerRepo = {};
  const mockStockBalanceRepo = {};
  const mockPrescriptionRepo = {};
  const mockPrescriptionItemRepo = {};
  const mockBatchStockRepo = {};
  const mockExpiryAlertRepo = {};
  const mockAuditLogRepo = {};
  const mockDrugClassRepo = {};
  const mockDrugInteractionRepo = {};
  const mockDdiOverrideRepo = {};
  const mockControlledLogRepo = {};
  const mockReprintRepo = {};
  const mockRetailCustomerRepo = {};
  const mockFinanceService = {};
  const mockInventoryService = { applyStockMovement: jest.fn().mockResolvedValue({ id: 'ledger-1' }) };
  const mockPosShiftGuard = {
    assertOpenShift: jest.fn().mockResolvedValue({ id: 'shift-1' }),
    assertActiveRegister: jest.fn().mockResolvedValue(true),
    recordSale: jest.fn(),
  };
  const mockEfrisService = {
    getConfig: jest.fn().mockResolvedValue({}),
    buildInvoicePayload: jest.fn().mockReturnValue({}),
    enqueueDocument: jest.fn().mockResolvedValue({}),
  };
  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockEntityManager = {
    findOne: jest.fn(),
    save: jest
      .fn()
      .mockImplementation((entity, data) => Promise.resolve({ id: 'sale-1', ...data })),
    create: jest.fn().mockImplementation((entity, data) => data),
    query: jest.fn().mockResolvedValue([]),
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    }),
  };

  const mockDataSource = {
    transaction: jest.fn((cb) => cb(mockEntityManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmacyService,
        { provide: FinanceService, useValue: mockFinanceService },
        { provide: getRepositoryToken(PharmacySale), useValue: mockSaleRepo },
        { provide: getRepositoryToken(PharmacySaleItem), useValue: mockSaleItemRepo },
        { provide: getRepositoryToken(Item), useValue: mockItemRepo },
        { provide: getRepositoryToken(StockLedger), useValue: mockLedgerRepo },
        { provide: getRepositoryToken(StockBalance), useValue: mockStockBalanceRepo },
        { provide: getRepositoryToken(Prescription), useValue: mockPrescriptionRepo },
        { provide: getRepositoryToken(PrescriptionItem), useValue: mockPrescriptionItemRepo },
        { provide: getRepositoryToken(BatchStockBalance), useValue: mockBatchStockRepo },
        { provide: getRepositoryToken(ExpiryAlert), useValue: mockExpiryAlertRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditLogRepo },
        { provide: getRepositoryToken(DrugClassification), useValue: mockDrugClassRepo },
        { provide: getRepositoryToken(DrugInteraction), useValue: mockDrugInteractionRepo },
        { provide: getRepositoryToken(DrugInteractionOverride), useValue: mockDdiOverrideRepo },
        { provide: getRepositoryToken(ControlledSubstanceLog), useValue: mockControlledLogRepo },
        { provide: getRepositoryToken(ReceiptReprint), useValue: mockReprintRepo },
        { provide: getRepositoryToken(RetailCustomer), useValue: mockRetailCustomerRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: PosShiftGuardService, useValue: mockPosShiftGuard },
        { provide: EfrisService, useValue: mockEfrisService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<PharmacyService>(PharmacyService);
    jest.spyOn(service, 'findSale').mockResolvedValue({ id: 'sale-1', items: [] } as any);
  });

  describe('createSale', () => {
    const createDto = {
      storeId: 'store-1',
      patientId: 'patient-1',
      items: [{ itemCode: 'DRUG001', itemName: 'Paracetamol', quantity: 10, unitPrice: 1000 }],
    };

    it('should create a sale successfully with transaction', async () => {
      mockItemRepo.findOne.mockResolvedValue({
        id: 'item-1',
        status: 'active',
        requiresPrescription: false,
      });

      const result = await service.createSale(createDto as any, 'user-1', 'tenant-1');

      expect(result.id).toBe('sale-1');
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if item quantity is non-positive', async () => {
      const invalidDto = { ...createDto, items: [{ ...createDto.items[0], quantity: 0 }] };
      await expect(service.createSale(invalidDto as any, 'user-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
