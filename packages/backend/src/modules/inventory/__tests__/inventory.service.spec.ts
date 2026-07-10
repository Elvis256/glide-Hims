import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InventoryService } from '../inventory.service';
import {
  Item,
  StockLedger,
  StockBalance,
  MovementType,
} from '../../../database/entities/inventory.entity';

// Mock transaction manager factory
function createMockManager(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn(),
    create: jest.fn((_entity: any, data: any) => ({ ...data })),
    save: jest.fn((_entity: any, data: any) => Promise.resolve(data)),
    ...overrides,
  };
}

const mockItemRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  save: jest.fn(),
  create: jest.fn((arg1: any, arg2?: any) => {
    const data = arg2 !== undefined ? arg2 : arg1;
    return { ...data };
  }),
  softRemove: jest.fn(),
};

const mockStockLedgerRepo = {
  create: jest.fn((data: any) => ({ ...data })),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockStockBalanceRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockDataSource = {
  transaction: jest.fn(),
};

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    const defaultManager = createMockManager({
      findOne: mockItemRepo.findOne,
      create: mockItemRepo.create,
      save: mockItemRepo.save,
      query: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      }),
    });
    mockDataSource.transaction.mockImplementation((cb: any) => cb(defaultManager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(Item), useValue: mockItemRepo },
        { provide: getRepositoryToken(StockLedger), useValue: mockStockLedgerRepo },
        { provide: getRepositoryToken(StockBalance), useValue: mockStockBalanceRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockItemRepo.findOne.mockReset();
    mockItemRepo.save.mockReset();
    mockItemRepo.create.mockReset();
    mockItemRepo.create.mockImplementation((data: any) => ({ ...data }));
    mockItemRepo.save.mockImplementation((data: any) => Promise.resolve(data));

    mockStockBalanceRepo.findOne.mockReset();
    mockStockBalanceRepo.save.mockReset();
  });

  describe('createItem', () => {
    it('should create a new item', async () => {
      const dto = { code: 'MED-001', name: 'Paracetamol', category: 'drugs' };
      mockItemRepo.findOne.mockResolvedValueOnce(null);
      mockItemRepo.create.mockReturnValueOnce({ id: 'item-1', ...dto });
      mockItemRepo.save.mockResolvedValueOnce({ id: 'item-1', ...dto });

      const result = await service.createItem(dto as any);

      expect(result).toEqual(expect.objectContaining({ code: 'MED-001' }));
      expect(mockItemRepo.create).toHaveBeenCalledWith(
        Item,
        expect.objectContaining({ code: 'MED-001' }),
      );
    });

    it('should throw BadRequestException when item code already exists', async () => {
      mockItemRepo.findOne.mockResolvedValueOnce({ id: 'existing', code: 'MED-001' });

      await expect(service.createItem({ code: 'MED-001', name: 'Test' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should include tenantId when provided', async () => {
      mockItemRepo.findOne.mockResolvedValueOnce(null);
      mockItemRepo.create.mockReturnValueOnce({ id: 'item-1', code: 'X', tenantId: 't1' });
      mockItemRepo.save.mockResolvedValueOnce({ id: 'item-1', code: 'X', tenantId: 't1' });

      await service.createItem({ code: 'X', name: 'Y' } as any, 't1');

      expect(mockItemRepo.create).toHaveBeenCalledWith(
        Item,
        expect.objectContaining({ tenantId: 't1' }),
      );
    });
  });

  describe('findItemById', () => {
    it('should return the item when found', async () => {
      const item = { id: 'item-1', code: 'MED-001', name: 'Paracetamol' };
      mockItemRepo.findOne.mockResolvedValueOnce(item);

      const result = await service.findItemById('item-1');
      expect(result).toEqual(item);
    });

    it('should throw NotFoundException when item not found', async () => {
      mockItemRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findItemById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('receiveStock', () => {
    const receiveDto = {
      itemId: 'item-1',
      facilityId: 'facility-1',
      quantity: 50,
      batchNumber: 'BATCH-001',
      unitCost: 10,
    };

    it('should increase quantity when balance exists', async () => {
      const existingBalance = {
        itemId: 'item-1',
        facilityId: 'facility-1',
        totalQuantity: 100,
        reservedQuantity: 5,
        availableQuantity: 95,
      };

      mockItemRepo.findOne.mockResolvedValueOnce({ id: 'item-1', unitCost: 10 });

      const mockManager = createMockManager();
      mockManager.findOne.mockResolvedValueOnce(existingBalance);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const result = await service.receiveStock(receiveDto as any, 'user-1');

      expect(result).toBeDefined();
      expect(result.quantity).toBe(50);
      expect(result.balanceAfter).toBe(150); // 100 + 50
      expect(result.movementType).toBe(MovementType.PURCHASE);

      // Verify balance was updated
      const savedBalance = mockManager.save.mock.calls.find((c: any) => c[0] === StockBalance);
      expect(savedBalance).toBeDefined();
      const balanceData = savedBalance![1];
      expect(balanceData.totalQuantity).toBe(150);
      expect(balanceData.availableQuantity).toBe(145); // 150 - 5 reserved
    });

    it('should create new balance when none exists', async () => {
      mockItemRepo.findOne.mockResolvedValueOnce({ id: 'item-1', unitCost: 10 });

      const mockManager = createMockManager();
      mockManager.findOne.mockResolvedValueOnce(null); // no existing balance
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const result = await service.receiveStock(receiveDto as any, 'user-1');

      expect(result.balanceAfter).toBe(50); // 0 + 50

      // Verify new balance was created
      const createCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === StockBalance);
      expect(createCalls.length).toBe(1);
      expect(createCalls[0][1]).toEqual(
        expect.objectContaining({
          totalQuantity: 50,
          reservedQuantity: 0,
          availableQuantity: 50,
        }),
      );
    });

    it('should throw NotFoundException when item does not exist', async () => {
      mockItemRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.receiveStock(receiveDto as any, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('adjustStock', () => {
    const adjustDto = {
      itemId: 'item-1',
      facilityId: 'facility-1',
      newQuantity: 80,
      reason: 'Inventory count correction',
    };

    it('should adjust stock to new quantity (decrease)', async () => {
      const existingBalance = {
        itemId: 'item-1',
        facilityId: 'facility-1',
        totalQuantity: 100,
        reservedQuantity: 0,
        availableQuantity: 100,
      };

      mockItemRepo.findOne.mockResolvedValueOnce({ id: 'item-1' });

      const mockManager = createMockManager();
      mockManager.findOne.mockResolvedValueOnce(existingBalance);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const result = await service.adjustStock(adjustDto as any, 'user-1');

      expect(result.quantity).toBe(-20); // 80 - 100
      expect(result.balanceAfter).toBe(80);
      expect(result.movementType).toBe(MovementType.ADJUSTMENT);

      const savedBalance = mockManager.save.mock.calls.find((c: any) => c[0] === StockBalance);
      expect(savedBalance![1].totalQuantity).toBe(80);
    });

    it('should adjust stock to new quantity (increase)', async () => {
      const existingBalance = {
        itemId: 'item-1',
        facilityId: 'facility-1',
        totalQuantity: 50,
        reservedQuantity: 0,
        availableQuantity: 50,
      };

      mockItemRepo.findOne.mockResolvedValueOnce({ id: 'item-1' });

      const mockManager = createMockManager();
      mockManager.findOne.mockResolvedValueOnce(existingBalance);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const result = await service.adjustStock({ ...adjustDto, newQuantity: 120 } as any, 'user-1');

      expect(result.quantity).toBe(70); // 120 - 50
      expect(result.balanceAfter).toBe(120);
    });

    it('should include reason in notes', async () => {
      mockItemRepo.findOne.mockResolvedValueOnce({ id: 'item-1' });

      const mockManager = createMockManager();
      mockManager.findOne.mockResolvedValueOnce({
        totalQuantity: 100,
        reservedQuantity: 0,
        availableQuantity: 100,
      });
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const result = await service.adjustStock(adjustDto as any, 'user-1');

      expect(result.notes).toContain('Inventory count correction');
    });
  });

  describe('transferStock', () => {
    const transferDto = {
      itemId: 'item-1',
      fromFacilityId: 'facility-1',
      toFacilityId: 'facility-2',
      quantity: 20,
      batchNumber: 'BATCH-001',
      notes: 'Transfer to branch',
    };

    it('should decrease source and increase destination', async () => {
      const fromBalance = {
        itemId: 'item-1',
        facilityId: 'facility-1',
        totalQuantity: 100,
        reservedQuantity: 0,
        availableQuantity: 100,
      };
      const toBalance = {
        itemId: 'item-1',
        facilityId: 'facility-2',
        totalQuantity: 30,
        reservedQuantity: 5,
        availableQuantity: 25,
      };

      const mockManager = createMockManager();
      mockManager.findOne
        .mockResolvedValueOnce(fromBalance) // source balance
        .mockResolvedValueOnce(toBalance); // destination balance
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const result = await service.transferStock(transferDto as any, 'user-1');

      expect(result.from).toBeDefined();
      expect(result.to).toBeDefined();

      // Source ledger
      expect(result.from.quantity).toBe(-20);
      expect(result.from.balanceAfter).toBe(80);
      expect(result.from.movementType).toBe(MovementType.TRANSFER_OUT);

      // Destination ledger
      expect(result.to.quantity).toBe(20);
      expect(result.to.balanceAfter).toBe(50); // 30 + 20
      expect(result.to.movementType).toBe(MovementType.TRANSFER_IN);
    });

    it('should throw BadRequestException when insufficient stock', async () => {
      const fromBalance = {
        itemId: 'item-1',
        facilityId: 'facility-1',
        totalQuantity: 10,
        reservedQuantity: 0,
        availableQuantity: 10,
      };

      const mockManager = createMockManager();
      mockManager.findOne.mockResolvedValueOnce(fromBalance);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      await expect(service.transferStock(transferDto as any, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when source has no balance', async () => {
      const mockManager = createMockManager();
      mockManager.findOne.mockResolvedValueOnce(null);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      await expect(service.transferStock(transferDto as any, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create new balance at destination if none exists', async () => {
      const fromBalance = {
        itemId: 'item-1',
        facilityId: 'facility-1',
        totalQuantity: 100,
        reservedQuantity: 0,
        availableQuantity: 100,
      };

      const mockManager = createMockManager();
      mockManager.findOne
        .mockResolvedValueOnce(fromBalance) // source balance
        .mockResolvedValueOnce(null); // no destination balance
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const result = await service.transferStock(transferDto as any, 'user-1');

      expect(result.to.balanceAfter).toBe(20);

      // Verify new balance was created for destination
      const createCalls = mockManager.create.mock.calls.filter((c: any) => c[0] === StockBalance);
      expect(createCalls.length).toBe(1);
      expect(createCalls[0][1]).toEqual(
        expect.objectContaining({
          itemId: 'item-1',
          facilityId: 'facility-2',
          totalQuantity: 20,
          reservedQuantity: 0,
          availableQuantity: 20,
        }),
      );
    });
  });

  describe('deductStock', () => {
    it('should deduct stock and update balance', async () => {
      const balance = {
        itemId: 'item-1',
        facilityId: 'facility-1',
        totalQuantity: 100,
        reservedQuantity: 0,
        availableQuantity: 100,
      };

      const mockManager = createMockManager();
      mockManager.findOne.mockResolvedValueOnce(balance);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      await service.deductStock('item-1', 'facility-1', 10, 'prescription', 'rx-1', 'user-1');

      expect(mockManager.save).toHaveBeenCalledWith(
        StockLedger,
        expect.objectContaining({
          quantity: -10,
          balanceAfter: 90,
          movementType: MovementType.SALE,
        }),
      );
      expect(balance.totalQuantity).toBe(90);
      expect(balance.availableQuantity).toBe(90);
    });

    it('should throw BadRequestException when insufficient stock for deduction', async () => {
      const balance = {
        itemId: 'item-1',
        facilityId: 'facility-1',
        totalQuantity: 5,
        reservedQuantity: 0,
        availableQuantity: 5,
      };

      const mockManager = createMockManager();
      mockManager.findOne.mockResolvedValueOnce(balance);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      await expect(
        service.deductStock('item-1', 'facility-1', 10, 'prescription', 'rx-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no balance exists', async () => {
      const mockManager = createMockManager();
      mockManager.findOne.mockResolvedValueOnce(null);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      await expect(
        service.deductStock('item-1', 'facility-1', 10, 'prescription', 'rx-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
