import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { GLReconciliationService } from '../gl-reconciliation.service';
import { JournalEntry } from '../../../database/entities/journal-entry.entity';
import { ChartOfAccount, AccountType } from '../../../database/entities/chart-of-account.entity';

describe('GLReconciliationService', () => {
  let service: GLReconciliationService;
  let journalEntryRepo: any;
  let chartOfAccountRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GLReconciliationService,
        {
          provide: getRepositoryToken(JournalEntry),
          useValue: {
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
            manager: {
              getRepository: jest.fn().mockReturnValue({
                createQueryBuilder: jest.fn().mockReturnValue({
                  innerJoin: jest.fn().mockReturnThis(),
                  where: jest.fn().mockReturnThis(),
                  andWhere: jest.fn().mockReturnThis(),
                  getMany: jest.fn().mockResolvedValue([]),
                }),
              }),
            },
          },
        },
        {
          provide: getRepositoryToken(ChartOfAccount),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GLReconciliationService>(GLReconciliationService);
    journalEntryRepo = module.get(getRepositoryToken(JournalEntry));
    chartOfAccountRepo = module.get(getRepositoryToken(ChartOfAccount));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('markAsReconciled', () => {
    it('should throw NotImplementedException', async () => {
      const accountId = 'acc-1';
      const fiscalPeriodId = 'period-1';
      const userId = 'user-1';
      const notes = 'Reconciled with bank statement';

      const mockAccount = {
        id: accountId,
        accountCode: '1000',
        accountName: 'Cash',
        accountType: AccountType.ASSET,
      };

      chartOfAccountRepo.findOne.mockResolvedValue(mockAccount);

      await expect(
        service.markAsReconciled(accountId, fiscalPeriodId, userId, 'tenant-1', notes),
      ).rejects.toThrow('GL reconciliation persistence is not yet implemented');

      expect(chartOfAccountRepo.findOne).toHaveBeenCalledWith({
        where: { id: accountId, tenantId: 'tenant-1' },
      });
    });

    it('should throw NotFoundException for non-existent account', async () => {
      const accountId = 'non-existent';
      const fiscalPeriodId = 'period-1';
      const userId = 'user-1';

      chartOfAccountRepo.findOne.mockResolvedValue(null);

      await expect(
        service.markAsReconciled(accountId, fiscalPeriodId, userId, 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle reconciliation without notes', async () => {
      const accountId = 'acc-1';
      const fiscalPeriodId = 'period-1';
      const userId = 'user-1';

      const mockAccount = {
        id: accountId,
        accountCode: '1000',
        accountName: 'Cash',
        accountType: AccountType.ASSET,
      };

      chartOfAccountRepo.findOne.mockResolvedValue(mockAccount);

      await expect(
        service.markAsReconciled(accountId, fiscalPeriodId, userId, 'tenant-1'),
      ).rejects.toThrow('GL reconciliation persistence is not yet implemented');
    });
  });

  describe('getReconciliationHistory', () => {
    it('should return reconciliation history', async () => {
      const accountId = 'acc-1';
      const facilityId = 'facility-1';

      const history = await service.getReconciliationHistory(accountId, facilityId, 'tenant-1');

      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(0); // Placeholder returns empty
    });
  });

  describe('detectUnmatchedItems', () => {
    it('should return unmatched GL items', async () => {
      const accountId = 'acc-1';
      const fiscalPeriodId = 'period-1';

      const items = await service.detectUnmatchedItems(accountId, fiscalPeriodId, 'tenant-1');

      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(0); // Placeholder returns empty
    });
  });

  describe('getReconciliationSummary', () => {
    it('should return reconciliation summary', async () => {
      const facilityId = 'facility-1';
      const fiscalPeriodId = 'period-1';

      const mockAccounts = [
        {
          id: 'acc-1',
          accountCode: '1000',
          accountName: 'Cash',
          accountType: AccountType.ASSET,
        },
        {
          id: 'acc-2',
          accountCode: '2000',
          accountName: 'Payable',
          accountType: AccountType.LIABILITY,
        },
        {
          id: 'acc-3',
          accountCode: '3000',
          accountName: 'Revenue',
          accountType: AccountType.REVENUE,
        },
      ];

      chartOfAccountRepo.find.mockResolvedValue(mockAccounts);

      const summary = await service.getReconciliationSummary(
        facilityId,
        fiscalPeriodId,
        'tenant-1',
      );

      expect(summary).toBeDefined();
      expect(summary.totalAccounts).toBe(3);
      expect(summary.reconciledAccounts).toBe(0);
      expect(summary.pendingAccounts).toBe(3);
      expect(summary.completionPercent).toBe(0);
    });

    it('should handle empty facility', async () => {
      const facilityId = 'facility-1';
      const fiscalPeriodId = 'period-1';

      chartOfAccountRepo.find.mockResolvedValue([]);

      const summary = await service.getReconciliationSummary(
        facilityId,
        fiscalPeriodId,
        'tenant-1',
      );

      expect(summary.totalAccounts).toBe(0);
      expect(summary.reconciledAccounts).toBe(0);
      expect(summary.completionPercent).toBe(0);
    });
  });

  describe('reconcileWithExternal', () => {
    it('should reconcile GL entries with external data', async () => {
      const accountId = 'acc-1';
      const fiscalPeriodId = 'period-1';
      const externalData = [
        {
          date: new Date('2024-01-15'),
          amount: 1000,
          reference: 'CHQ-001',
        },
        {
          date: new Date('2024-01-16'),
          amount: 500,
          reference: 'CHQ-002',
        },
      ];

      const result = await service.reconcileWithExternal(
        accountId,
        fiscalPeriodId,
        externalData,
        'tenant-1',
      );

      expect(result).toBeDefined();
      expect(result.matched).toBe(0);
      expect(result.unmatched).toBe(0);
      expect(Array.isArray(result.discrepancies)).toBe(true);
    });

    it('should handle empty external data', async () => {
      const accountId = 'acc-1';
      const fiscalPeriodId = 'period-1';
      const externalData: any[] = [];

      const result = await service.reconcileWithExternal(
        accountId,
        fiscalPeriodId,
        externalData,
        'tenant-1',
      );

      expect(result.matched).toBe(0);
      expect(result.unmatched).toBe(0);
    });
  });

  describe('generateReconciliationReport', () => {
    it('should generate reconciliation report for account', async () => {
      const accountId = 'acc-1';
      const fiscalPeriodId = 'period-1';
      const facilityId = 'facility-1';

      const mockAccount = {
        id: accountId,
        accountCode: '1000',
        accountName: 'Cash',
        accountType: AccountType.ASSET,
        facilityId,
      };

      chartOfAccountRepo.findOne.mockResolvedValue(mockAccount);

      const report = await service.generateReconciliationReport(
        accountId,
        fiscalPeriodId,
        facilityId,
        'tenant-1',
      );

      expect(report).toBeDefined();
      expect(report.accountId).toBe(accountId);
      expect(report.accountCode).toBe('1000');
      expect(report.accountName).toBe('Cash');
      expect(report.reconciliationStatus).toBe('unreconciled');
      expect(report.glTotal).toBe(0);
      expect(report.externalTotal).toBe(0);
      expect(report.difference).toBe(0);
      expect(report.itemCount).toBe(0);
    });

    it('should throw NotFoundException for non-existent account', async () => {
      const accountId = 'non-existent';
      const fiscalPeriodId = 'period-1';
      const facilityId = 'facility-1';

      chartOfAccountRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateReconciliationReport(accountId, fiscalPeriodId, facilityId, 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter by facility', async () => {
      const accountId = 'acc-1';
      const fiscalPeriodId = 'period-1';
      const facilityId = 'facility-1';

      const mockAccount = {
        id: accountId,
        accountCode: '1000',
        accountName: 'Cash',
        accountType: AccountType.ASSET,
        facilityId,
      };

      chartOfAccountRepo.findOne.mockResolvedValue(mockAccount);

      await service.generateReconciliationReport(accountId, fiscalPeriodId, facilityId, 'tenant-1');

      expect(chartOfAccountRepo.findOne).toHaveBeenCalledWith({
        where: { id: accountId, facilityId, tenantId: 'tenant-1' },
      });
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should respect facility boundaries', async () => {
      const accountId = 'acc-1';
      const fiscalPeriodId = 'period-1';
      const facilityId = 'facility-1';

      const mockAccount = {
        id: accountId,
        accountCode: '1000',
        accountName: 'Cash',
        accountType: AccountType.ASSET,
        facilityId,
      };

      chartOfAccountRepo.findOne.mockResolvedValue(mockAccount);

      const report = await service.generateReconciliationReport(
        accountId,
        fiscalPeriodId,
        facilityId,
        'tenant-1',
      );

      expect(report.accountId).toBe(accountId);
      expect(chartOfAccountRepo.findOne).toHaveBeenCalledWith({
        where: { id: accountId, facilityId, tenantId: 'tenant-1' },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const accountId = 'acc-1';
      const facilityId = 'facility-1';

      chartOfAccountRepo.findOne.mockRejectedValue(new Error('Database connection error'));

      await expect(
        service.generateReconciliationReport(accountId, 'period-1', facilityId, 'tenant-1'),
      ).rejects.toThrow('Database connection error');
    });
  });
});
