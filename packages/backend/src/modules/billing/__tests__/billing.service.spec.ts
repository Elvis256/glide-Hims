import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BillingService } from '../billing.service';
import { Invoice, InvoiceItem, Payment, InvoiceStatus } from '../../../database/entities/invoice.entity';
import { Encounter } from '../../../database/entities/encounter.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { FinanceService } from '../../finance/finance.service';

// Helper to create a mock QueryBuilder
function createMockQueryBuilder(result: any = null) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
  };
  return qb;
}

// Mock transaction manager
function createMockManager(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn(),
    create: jest.fn((entity: any, data: any) => ({ ...data })),
    save: jest.fn((entity: any, data: any) => Promise.resolve({ id: 'new-id', ...data })),
    update: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

const mockInvoiceRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn((data: any) => ({ ...data })),
  createQueryBuilder: jest.fn(),
};

const mockItemRepo = {
  create: jest.fn((data: any) => ({ ...data })),
  save: jest.fn(),
};

const mockPaymentRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data: any) => ({ ...data })),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockEncounterRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockNotificationsService = {
  sendThankYouMessage: jest.fn().mockResolvedValue({ success: true, channel: 'sms' }),
};

const mockSettingsService = {};

const mockFinanceService = {
  autoPostInvoiceJournal: jest.fn().mockResolvedValue({}),
  autoPostPatientPaymentJournal: jest.fn().mockResolvedValue({}),
};

const mockDataSource = {
  transaction: jest.fn(),
};

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: getRepositoryToken(Invoice), useValue: mockInvoiceRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: mockItemRepo },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(Encounter), useValue: mockEncounterRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: SystemSettingsService, useValue: mockSettingsService },
        { provide: FinanceService, useValue: mockFinanceService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
  });

  describe('createInvoice', () => {
    const createInvoiceDto = {
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      items: [
        { description: 'Consultation', quantity: 1, unitPrice: 200, serviceName: 'Consultation' },
        { description: 'Lab Test', quantity: 2, unitPrice: 50, serviceName: 'Lab' },
      ],
      taxPercent: 10,
      discountAmount: 20,
      notes: 'Test invoice',
      paymentType: 'cash',
    };

    it('should create invoice with correct total calculation', async () => {
      // subtotal = (1*200) + (2*50) = 300
      // tax = 300 * 10/100 = 30
      // discount = 20
      // total = 300 + 30 - 20 = 310
      const qb = createMockQueryBuilder(null);
      mockInvoiceRepo.createQueryBuilder.mockReturnValue(qb);
      mockInvoiceRepo.create.mockImplementation((data: any) => ({ id: 'inv-1', ...data }));
      mockInvoiceRepo.save.mockImplementation((data: any) => Promise.resolve({ id: 'inv-1', ...data }));
      mockInvoiceRepo.findOne.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV202401010001',
        subtotal: 300,
        taxAmount: 30,
        discountAmount: 20,
        totalAmount: 310,
        balanceDue: 310,
        items: createInvoiceDto.items,
        payments: [],
        patient: { id: 'patient-1' },
      });
      mockEncounterRepo.findOne.mockResolvedValue({
        id: 'encounter-1',
        facilityId: 'facility-1',
        status: 'in_progress',
      });

      const result = await service.createInvoice(createInvoiceDto as any, 'user-1', 'tenant-1');

      expect(result).toBeDefined();
      expect(result.totalAmount).toBe(310);
      expect(result.subtotal).toBe(300);

      // Verify invoice was created with correct amounts
      const createCall = mockInvoiceRepo.create.mock.calls[0][0];
      expect(createCall.subtotal).toBe(300);
      expect(createCall.taxAmount).toBe(30);
      expect(createCall.discountAmount).toBe(20);
      expect(createCall.totalAmount).toBe(310);
      expect(createCall.balanceDue).toBe(310);
    });

    it('should create invoice with zero tax and discount', async () => {
      const simpleDto = {
        patientId: 'patient-1',
        items: [{ description: 'Service', quantity: 3, unitPrice: 100, serviceName: 'Gen' }],
      };

      const qb = createMockQueryBuilder(null);
      mockInvoiceRepo.createQueryBuilder.mockReturnValue(qb);
      mockInvoiceRepo.create.mockImplementation((data: any) => ({ id: 'inv-2', ...data }));
      mockInvoiceRepo.save.mockImplementation((data: any) => Promise.resolve({ id: 'inv-2', ...data }));
      mockInvoiceRepo.findOne.mockResolvedValue({
        id: 'inv-2',
        subtotal: 300,
        totalAmount: 300,
        balanceDue: 300,
        items: [],
        payments: [],
      });

      const result = await service.createInvoice(simpleDto as any, 'user-1');

      const createCall = mockInvoiceRepo.create.mock.calls[0][0];
      expect(createCall.subtotal).toBe(300);
      expect(createCall.taxAmount).toBe(0);
      expect(createCall.discountAmount).toBe(0);
      expect(createCall.totalAmount).toBe(300);
    });
  });

  describe('recordPayment', () => {
    it('should update invoice status to PAID when fully paid', async () => {
      const mockManager = createMockManager();
      const invoice = {
        id: 'inv-1',
        totalAmount: 100,
        amountPaid: 0,
        balanceDue: 100,
        status: InvoiceStatus.PENDING,
        patientId: 'patient-1',
        encounterId: 'encounter-1',
      };

      mockManager.findOne
        .mockResolvedValueOnce(invoice) // Lock invoice
        .mockResolvedValueOnce(null)    // Queue lookup
        .mockResolvedValueOnce(null)    // Encounter lookup
        .mockResolvedValueOnce({ ...invoice, patient: { fullName: 'Test' }, encounter: { facilityId: 'f1' } }); // Full invoice

      const qb = createMockQueryBuilder(null);
      mockPaymentRepo.createQueryBuilder.mockReturnValue(qb);

      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const dto = { invoiceId: 'inv-1', amount: 100, method: 'cash' };
      const result = await service.recordPayment(dto as any, 'user-1', 'tenant-1');

      expect(result).toBeDefined();
      // Verify the invoice was updated to PAID
      const updateCall = mockManager.update.mock.calls.find(
        (c: any) => c[0] === Invoice,
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![2].status).toBe(InvoiceStatus.PAID);
      expect(updateCall![2].balanceDue).toBe(0);
    });

    it('should update invoice status to PARTIALLY_PAID when partially paid', async () => {
      const mockManager = createMockManager();
      const invoice = {
        id: 'inv-1',
        totalAmount: 200,
        amountPaid: 0,
        balanceDue: 200,
        status: InvoiceStatus.PENDING,
        patientId: 'patient-1',
      };

      mockManager.findOne
        .mockResolvedValueOnce(invoice) // Lock invoice
        .mockResolvedValueOnce({ ...invoice, patient: { fullName: 'Test' } }); // Full invoice for GL

      const qb = createMockQueryBuilder(null);
      mockPaymentRepo.createQueryBuilder.mockReturnValue(qb);

      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const dto = { invoiceId: 'inv-1', amount: 80, method: 'cash' };
      await service.recordPayment(dto as any, 'user-1');

      const updateCall = mockManager.update.mock.calls.find(
        (c: any) => c[0] === Invoice,
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![2].status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(updateCall![2].amountPaid).toBe(80);
      expect(updateCall![2].balanceDue).toBe(120);
    });

    it('should throw BadRequestException when payment exceeds balance due', async () => {
      const mockManager = createMockManager();
      const invoice = {
        id: 'inv-1',
        totalAmount: 100,
        amountPaid: 50,
        balanceDue: 50,
        status: InvoiceStatus.PARTIALLY_PAID,
      };

      mockManager.findOne.mockResolvedValueOnce(invoice);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const dto = { invoiceId: 'inv-1', amount: 75, method: 'cash' };

      await expect(
        service.recordPayment(dto as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when invoice not found', async () => {
      const mockManager = createMockManager();
      mockManager.findOne.mockResolvedValueOnce(null);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const dto = { invoiceId: 'nonexistent', amount: 100, method: 'cash' };

      await expect(
        service.recordPayment(dto as any, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when invoice is already fully paid', async () => {
      const mockManager = createMockManager();
      const invoice = {
        id: 'inv-1',
        totalAmount: 100,
        amountPaid: 100,
        balanceDue: 0,
        status: InvoiceStatus.PAID,
      };

      mockManager.findOne.mockResolvedValueOnce(invoice);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const dto = { invoiceId: 'inv-1', amount: 10, method: 'cash' };

      await expect(
        service.recordPayment(dto as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findInvoice', () => {
    it('should return invoice when found', async () => {
      const invoice = { id: 'inv-1', invoiceNumber: 'INV001', items: [], payments: [] };
      mockInvoiceRepo.findOne.mockResolvedValueOnce(invoice);

      const result = await service.findInvoice('inv-1');

      expect(result).toEqual(invoice);
    });

    it('should throw NotFoundException when invoice not found', async () => {
      mockInvoiceRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findInvoice('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
