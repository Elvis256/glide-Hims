import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FinanceApprovalService } from '../finance-approval.service';
import { FinanceApprovalChain, FinanceApprovalStatus } from '../../../database/entities/finance-approval-chain.entity';
import { JournalEntry, JournalStatus } from '../../../database/entities/journal-entry.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('FinanceApprovalService', () => {
  let service: FinanceApprovalService;
  let approvalChainRepo: Repository<FinanceApprovalChain>;
  let journalEntryRepo: Repository<JournalEntry>;

  // Test data
  const testTenantId = '550e8400-e29b-41d4-a716-446655440000';
  const testFacilityId = '550e8400-e29b-41d4-a716-446655440001';
  const testUserId1 = '550e8400-e29b-41d4-a716-446655440002'; // Finance Officer
  const testUserId2 = '550e8400-e29b-41d4-a716-446655440003'; // Accounting Manager

  const mockJournalEntry = (amount: number): JournalEntry => {
    const entry = new JournalEntry();
    entry.id = '550e8400-e29b-41d4-a716-446655440100';
    entry.facilityId = testFacilityId;
    entry.tenantId = testTenantId;
    entry.journalNumber = 'JE-2026-001';
    entry.journalDate = new Date();
    entry.fiscalPeriodId = '550e8400-e29b-41d4-a716-446655440101';
    entry.status = JournalStatus.DRAFT;
    entry.totalDebit = amount;
    entry.totalCredit = 0;
    entry.description = 'Test journal entry';
    entry.createdById = testUserId1;
    return entry;
  };

  const mockApprovalChain = (entryId: string, level: number, role: string): FinanceApprovalChain => {
    const chain = new FinanceApprovalChain();
    chain.id = `550e8400-e29b-41d4-a716-446655440${level}00`;
    chain.journalEntryId = entryId;
    chain.tenantId = testTenantId;
    chain.facilityId = testFacilityId;
    chain.approvalLevel = level;
    chain.requiredRole = role;
    chain.status = FinanceApprovalStatus.PENDING;
    return chain;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceApprovalService,
        {
          provide: getRepositoryToken(FinanceApprovalChain),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(JournalEntry),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(
            require('../../../database/entities/audit-log.entity').AuditLog,
          ),
          useValue: {
            create: jest.fn((d) => d),
            save: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (cb: any) => cb({} as any)),
          },
        },
      ],
    }).compile();

    service = module.get<FinanceApprovalService>(FinanceApprovalService);
    approvalChainRepo = module.get<Repository<FinanceApprovalChain>>(
      getRepositoryToken(FinanceApprovalChain),
    );
    journalEntryRepo = module.get<Repository<JournalEntry>>(getRepositoryToken(JournalEntry));
  });

  describe('getRequiredApprovalsForAmount', () => {
    it('should return 1 level (Finance Officer) for amount < 10K', async () => {
      const result = await service.getRequiredApprovalsForAmount(5000);
      expect(result).toHaveLength(1);
      expect(result[0].level).toBe(1);
      expect(result[0].role).toBe('Finance Officer');
    });

    it('should return 2 levels for 10K ≤ amount < 50K', async () => {
      const result = await service.getRequiredApprovalsForAmount(25000);
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('Finance Officer');
      expect(result[1].role).toBe('Accounting Manager');
    });

    it('should return 3 levels for 50K ≤ amount < 100K', async () => {
      const result = await service.getRequiredApprovalsForAmount(75000);
      expect(result).toHaveLength(3);
      expect(result[2].role).toBe('Director');
    });

    it('should return 4 levels for amount ≥ 100K', async () => {
      const result = await service.getRequiredApprovalsForAmount(150000);
      expect(result).toHaveLength(4);
      expect(result[3].role).toBe('CFO');
    });

    it('should include all levels in order', async () => {
      const result = await service.getRequiredApprovalsForAmount(100000);
      expect(result.length).toBeGreaterThan(0);
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].level).toBeLessThan(result[i + 1].level);
      }
    });
  });

  describe('submitForApproval', () => {
    it('should throw NotFoundException for non-existent entry', async () => {
      jest.spyOn(journalEntryRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.submitForApproval('invalid-id', testUserId1, testTenantId, testFacilityId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if entry not in DRAFT', async () => {
      const entry = mockJournalEntry(5000);
      entry.status = JournalStatus.SUBMITTED;

      jest.spyOn(journalEntryRepo, 'findOne').mockResolvedValue(entry);

      await expect(
        service.submitForApproval(entry.id, testUserId1, testTenantId, testFacilityId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveAtLevel', () => {
    it('should throw NotFoundException if chain entry not found', async () => {
      jest.spyOn(approvalChainRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.approveAtLevel('test-id', testUserId1, 'Finance Officer', testTenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if already approved', async () => {
      const chainEntry = mockApprovalChain('test-id', 1, 'Finance Officer');
      chainEntry.status = FinanceApprovalStatus.APPROVED;

      jest.spyOn(approvalChainRepo, 'findOne').mockResolvedValue(chainEntry);

      await expect(
        service.approveAtLevel('test-id', testUserId1, 'Finance Officer', testTenantId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectAtLevel', () => {
    it('should throw NotFoundException if chain entry not found', async () => {
      jest.spyOn(approvalChainRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.rejectAtLevel('test-id', testUserId1, 'Finance Officer', 'Invalid', testTenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if already processed', async () => {
      const chainEntry = mockApprovalChain('test-id', 1, 'Finance Officer');
      chainEntry.status = FinanceApprovalStatus.APPROVED;

      jest.spyOn(approvalChainRepo, 'findOne').mockResolvedValue(chainEntry);

      await expect(
        service.rejectAtLevel('test-id', testUserId1, 'Finance Officer', 'Test', testTenantId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPendingApprovalsForRole', () => {
    it('should return empty array if no pending approvals', async () => {
      jest.spyOn(approvalChainRepo, 'find').mockResolvedValueOnce([]);

      const result = await service.getPendingApprovalsForRole(
        'Finance Officer',
        testFacilityId,
        testTenantId,
      );

      expect(result).toEqual([]);
    });
  });

  describe('isReadyToPost', () => {
    it('should throw NotFoundException for invalid entry', async () => {
      jest.spyOn(journalEntryRepo, 'findOne').mockResolvedValue(null);

      await expect(service.isReadyToPost('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should return true if entry is APPROVED', async () => {
      const entry = mockJournalEntry(5000);
      entry.status = JournalStatus.APPROVED;

      jest.spyOn(journalEntryRepo, 'findOne').mockResolvedValue(entry);

      const result = await service.isReadyToPost(entry.id);

      expect(result).toBe(true);
    });

    it('should return false if entry is SUBMITTED', async () => {
      const entry = mockJournalEntry(5000);
      entry.status = JournalStatus.SUBMITTED;

      jest.spyOn(journalEntryRepo, 'findOne').mockResolvedValue(entry);

      const result = await service.isReadyToPost(entry.id);

      expect(result).toBe(false);
    });
  });

  describe('getApprovalHistory', () => {
    it('should return approval chains ordered by level', async () => {
      const entryId = 'test-entry-id';
      const chains = [
        mockApprovalChain(entryId, 1, 'Finance Officer'),
        mockApprovalChain(entryId, 2, 'Accounting Manager'),
      ];

      jest.spyOn(approvalChainRepo, 'find').mockResolvedValue(chains);

      const result = await service.getApprovalHistory(entryId);

      expect(result).toHaveLength(2);
    });
  });

  describe('getEscalationCandidates', () => {
    it('should return empty array if no pending entries', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      jest.spyOn(journalEntryRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.getEscalationCandidates(testFacilityId, 5);

      expect(result).toEqual([]);
    });
  });
});
