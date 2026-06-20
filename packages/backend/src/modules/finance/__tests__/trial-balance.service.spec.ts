import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TrialBalanceService } from '../trial-balance.service';
import { JournalEntry, JournalStatus } from '../../../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../../../database/entities/journal-entry-line.entity';
import { ChartOfAccount, AccountType, AccountCategory } from '../../../database/entities/chart-of-account.entity';
import { FiscalPeriod } from '../../../database/entities/fiscal-period.entity';

describe('TrialBalanceService', () => {
  let service: TrialBalanceService;
  let journalEntryRepo: any;
  let journalEntryLineRepo: any;
  let chartOfAccountRepo: any;
  let fiscalPeriodRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrialBalanceService,
        {
          provide: getRepositoryToken(JournalEntry),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(JournalEntryLine),
          useValue: {
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ChartOfAccount),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(FiscalPeriod),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TrialBalanceService>(TrialBalanceService);
    journalEntryRepo = module.get(getRepositoryToken(JournalEntry));
    journalEntryLineRepo = module.get(getRepositoryToken(JournalEntryLine));
    chartOfAccountRepo = module.get(getRepositoryToken(ChartOfAccount));
    fiscalPeriodRepo = module.get(getRepositoryToken(FiscalPeriod));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    // Mock fiscal period as found
    fiscalPeriodRepo.findOne.mockResolvedValue({
      id: 'period-1',
      name: 'Period 1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    });
    journalEntryRepo.find.mockResolvedValue([{ id: 'je-1' }]);
    journalEntryLineRepo.find.mockResolvedValue([]);
  });

  describe('getTrialBalance', () => {
    it('should calculate trial balance with balanced accounts', async () => {
      const facilityId = 'facility-1';
      const periodId = 'period-1';

      const mockAccount1 = {
        id: 'acc-1',
        accountCode: '1000',
        accountName: 'Cash',
        accountType: AccountType.ASSET,
      };

      const mockAccount2 = {
        id: 'acc-2',
        accountCode: '2000',
        accountName: 'Accounts Payable',
        accountType: AccountType.LIABILITY,
      };

      const mockLines = [
        {
          journalEntryId: 'je-1',
          accountId: 'acc-1',
          debit: 1000,
          credit: 0,
          account: mockAccount1,
        },
        {
          journalEntryId: 'je-1',
          accountId: 'acc-2',
          debit: 0,
          credit: 1000,
          account: mockAccount2,
        },
      ];

      journalEntryLineRepo.find.mockResolvedValue(mockLines);

      const result = await service.getTrialBalance(facilityId, periodId);

      expect(result).toBeDefined();
      expect(result.lines).toHaveLength(2);
      expect(result.balanced).toBe(true);
      expect(result.totalDebit).toBe(1000);
      expect(result.totalCredit).toBe(1000);
    });

    it('should detect imbalanced trial balance', async () => {
      const facilityId = 'facility-1';
      const periodId = 'period-1';

      const mockAccount = {
        id: 'acc-1',
        accountCode: '1000',
        accountName: 'Cash',
        accountType: AccountType.ASSET,
      };

      const mockLines = [
        {
          journalEntryId: 'je-1',
          accountId: 'acc-1',
          debit: 1000,
          credit: 500,
          account: mockAccount,
        },
      ];

      journalEntryLineRepo.find.mockResolvedValue(mockLines);

      const result = await service.getTrialBalance(facilityId, periodId);

      expect(result.balanced).toBe(false);
      expect(result.imbalanceAmount).toBe(500);
    });

    it('should handle empty trial balance', async () => {
      const facilityId = 'facility-1';
      const periodId = 'period-1';

      journalEntryLineRepo.find.mockResolvedValue([]);

      const result = await service.getTrialBalance(facilityId, periodId);

      expect(result.lines).toHaveLength(0);
      expect(result.totalDebit).toBe(0);
      expect(result.totalCredit).toBe(0);
      expect(result.balanced).toBe(true);
    });

    it('should allow small rounding differences', async () => {
      const facilityId = 'facility-1';
      const periodId = 'period-1';

      const mockAccount1 = {
        id: 'acc-1',
        accountCode: '1000',
        accountName: 'Cash',
        accountType: AccountType.ASSET,
      };

      const mockAccount2 = {
        id: 'acc-2',
        accountCode: '2000',
        accountName: 'Payable',
        accountType: AccountType.LIABILITY,
      };

      const mockLines = [
        {
          journalEntryId: 'je-1',
          accountId: 'acc-1',
          debit: 1000.005,
          credit: 0,
          account: mockAccount1,
        },
        {
          journalEntryId: 'je-1',
          accountId: 'acc-2',
          debit: 0,
          credit: 1000.0,
          account: mockAccount2,
        },
      ];

      journalEntryLineRepo.find.mockResolvedValue(mockLines);

      const result = await service.getTrialBalance(facilityId, periodId);

      // Should be considered balanced (difference < 0.01)
      expect(result.balanced).toBe(true);
    });
  });

  describe('getReconciliationStatus', () => {
    it('should return reconciliation status for accounts', async () => {
      const facilityId = 'facility-1';
      const periodId = 'period-1';

      const mockLines = [
        {
          journalEntryId: 'je-1',
          accountId: 'acc-1',
          debit: 1000,
          credit: 0,
          account: {
            id: 'acc-1',
            accountCode: '1000',
            accountName: 'Cash',
            accountType: AccountType.ASSET,
          },
        },
        {
          journalEntryId: 'je-1',
          accountId: 'acc-2',
          debit: 0,
          credit: 1000,
          account: {
            id: 'acc-2',
            accountCode: '2000',
            accountName: 'Payable',
            accountType: AccountType.LIABILITY,
          },
        },
      ];
      journalEntryLineRepo.find.mockResolvedValue(mockLines);

      const result = await service.getReconciliationStatus(facilityId, periodId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].accountId).toBe('acc-1');
      expect(result[1].accountId).toBe('acc-2');
    });
  });

  describe('detectVariances', () => {
    it('should detect variances in trial balance', async () => {
      const facilityId = 'facility-1';
      const periodId = 'period-1';

      const mockAccount = {
        id: 'acc-1',
        accountCode: '1000',
        accountName: 'Cash',
        accountType: AccountType.ASSET,
        currentBalance: 5000,
      };

      const mockLines = [
        {
          journalEntryId: 'je-1',
          accountId: 'acc-1',
          debit: 1000,
          credit: 0,
          account: mockAccount,
        },
      ];

      journalEntryLineRepo.find.mockResolvedValue(mockLines);

      const result = await service.detectVariances(facilityId, periodId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('comparePeriodsTrialBalance', () => {
    it('should compare trial balance between periods', async () => {
      const facilityId = 'facility-1';
      const period1Id = 'period-1';
      const period2Id = 'period-2';

      const mockLinesPeriod1 = [
        {
          journalEntryId: 'je-1',
          accountId: 'acc-1',
          debit: 1000,
          credit: 0,
          account: { id: 'acc-1', accountCode: '1000', accountName: 'Cash', accountType: AccountType.ASSET },
        },
      ];

      const mockLinesPeriod2 = [
        {
          journalEntryId: 'je-2',
          accountId: 'acc-1',
          debit: 2000,
          credit: 0,
          account: { id: 'acc-1', accountCode: '1000', accountName: 'Cash', accountType: AccountType.ASSET },
        },
      ];

      let callCount = 0;
      journalEntryLineRepo.find.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? mockLinesPeriod1 : mockLinesPeriod2);
      });

      const result = await service.comparePeriodsTrialBalance(facilityId, period1Id, period2Id);

      expect(result).toBeDefined();
      expect(result.period1TrialBalance.totalDebit).toBe(1000);
      expect(result.period2TrialBalance.totalDebit).toBe(2000);
    });
  });

  describe('getAccountBalance', () => {
    it('should get account balance for a period', async () => {
      const accountId = 'acc-1';
      const fiscalPeriodId = 'period-1';

      journalEntryLineRepo.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          debit: 1000,
          credit: 500,
        }),
      });

      const result = await service.getAccountBalance(accountId, fiscalPeriodId);

      expect(result).toBeDefined();
      expect(result.debit).toBe(1000);
      expect(result.credit).toBe(500);
      expect(result.balance).toBe(500);
    });

    it('should handle zero balances', async () => {
      const accountId = 'acc-1';
      const fiscalPeriodId = 'period-1';

      journalEntryLineRepo.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getAccountBalance(accountId, fiscalPeriodId);

      expect(result.debit).toBe(0);
      expect(result.credit).toBe(0);
      expect(result.balance).toBe(0);
    });
  });

  describe('getAccountsByType', () => {
    it('should filter accounts by type', async () => {
      const facilityId = 'facility-1';
      const accountType = AccountType.ASSET;

      const mockAccounts = [
        {
          id: 'acc-1',
          accountCode: '1000',
          accountName: 'Cash',
          accountType: AccountType.ASSET,
        },
        {
          id: 'acc-2',
          accountCode: '1001',
          accountName: 'Bank',
          accountType: AccountType.ASSET,
        },
      ];

      chartOfAccountRepo.find.mockResolvedValue(mockAccounts);

      const result = await service.getAccountsByType(facilityId, accountType);

      expect(result).toHaveLength(2);
      expect(result[0].accountType).toBe(AccountType.ASSET);
    });

    it('should return empty array if no accounts found', async () => {
      const facilityId = 'facility-1';
      const accountType = AccountType.EXPENSE;

      chartOfAccountRepo.find.mockResolvedValue([]);

      const result = await service.getAccountsByType(facilityId, accountType);

      expect(result).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle accounts with only debits', async () => {
      const facilityId = 'facility-1';
      const periodId = 'period-1';

      const mockAccount = {
        id: 'acc-1',
        accountCode: '1000',
        accountName: 'Cash',
        accountType: AccountType.ASSET,
      };

      const mockLines = [
        {
          journalEntryId: 'je-1',
          accountId: 'acc-1',
          debit: 5000,
          credit: 0,
          account: mockAccount,
        },
      ];

      journalEntryLineRepo.find.mockResolvedValue(mockLines);

      const result = await service.getTrialBalance(facilityId, periodId);

      expect(result.lines[0].debit).toBe(5000);
      expect(result.lines[0].credit).toBe(0);
      expect(result.lines[0].debit - result.lines[0].credit).toBe(5000);
    });

    it('should handle accounts with only credits', async () => {
      const facilityId = 'facility-1';
      const periodId = 'period-1';

      const mockAccount = {
        id: 'acc-1',
        accountCode: '2000',
        accountName: 'Accounts Payable',
        accountType: AccountType.LIABILITY,
      };

      const mockLines = [
        {
          journalEntryId: 'je-1',
          accountId: 'acc-1',
          debit: 0,
          credit: 3000,
          account: mockAccount,
        },
      ];

      journalEntryLineRepo.find.mockResolvedValue(mockLines);

      const result = await service.getTrialBalance(facilityId, periodId);

      expect(result.lines[0].debit).toBe(0);
      expect(result.lines[0].credit).toBe(3000);
      expect(result.lines[0].debit - result.lines[0].credit).toBe(-3000);
    });

    it('should handle large numbers without precision loss', async () => {
      const facilityId = 'facility-1';
      const periodId = 'period-1';

      const mockAccount1 = {
        id: 'acc-1',
        accountCode: '1000',
        accountName: 'Cash',
        accountType: AccountType.ASSET,
      };

      const mockAccount2 = {
        id: 'acc-2',
        accountCode: '2000',
        accountName: 'Payable',
        accountType: AccountType.LIABILITY,
      };

      const mockLines = [
        {
          journalEntryId: 'je-1',
          accountId: 'acc-1',
          debit: 99999999.99,
          credit: 0,
          account: mockAccount1,
        },
        {
          journalEntryId: 'je-1',
          accountId: 'acc-2',
          debit: 0,
          credit: 99999999.99,
          account: mockAccount2,
        },
      ];

      journalEntryLineRepo.find.mockResolvedValue(mockLines);

      const result = await service.getTrialBalance(facilityId, periodId);

      expect(result.balanced).toBe(true);
      expect(result.totalDebit).toBe(99999999.99);
      expect(result.totalCredit).toBe(99999999.99);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should only return accounts from specified facility', async () => {
      const facilityId = 'facility-1';
      const periodId = 'period-1';

      const mockAccount = {
        id: 'acc-1',
        accountCode: '1000',
        accountName: 'Cash',
        accountType: AccountType.ASSET,
        facilityId: 'facility-1',
      };

      const mockLines = [
        {
          journalEntryId: 'je-1',
          accountId: 'acc-1',
          debit: 1000,
          credit: 0,
          account: mockAccount,
        },
      ];

      journalEntryLineRepo.find.mockResolvedValue(mockLines);

      const result = await service.getTrialBalance(facilityId, periodId);

      expect(result.lines[0].accountId).toBe('acc-1');
      expect(journalEntryRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            facilityId: 'facility-1',
          }),
        }),
      );
    });
  });
});
