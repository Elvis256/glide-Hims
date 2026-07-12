import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { REQUEST } from '@nestjs/core';
import { AdminAuditService } from '../services/admin-audit.service';
import {
  AdminAuditLog,
  AdminAuditAction,
  AdminAuditEntityType,
} from '../../../database/entities/admin-audit-log.entity';

describe('AdminAuditService', () => {
  let service: AdminAuditService;
  let repository: Repository<AdminAuditLog>;
  let module: TestingModule;

  const mockAuditLog = {
    id: 'log-123',
    adminUserId: 'admin-001',
    tenantId: 'tenant-001',
    action: AdminAuditAction.CREATE,
    entityType: AdminAuditEntityType.ORGANIZATION,
    entityId: 'org-001',
    entityLabel: 'Test Organization',
    description: 'Organization created',
    newValues: { name: 'Test Org' },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    changeReason: 'Onboarding new client',
    systemGenerated: false,
    result: 'success' as const,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    isArchived: false,
    previousHash: undefined,
    hash: '85c80bfe9f9aec76e0b5aac7a3a575683fdf05647c8c1a3e2569ba3bcedab656',
  } as AdminAuditLog;

  const mockQueryBuilder = {
    andWhere: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    take: jest.fn(),
    skip: jest.fn(),
    getCount: jest.fn(),
    getMany: jest.fn(),
    getRawMany: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    groupBy: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AdminAuditService,
        {
          provide: getRepositoryToken(AdminAuditLog),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: REQUEST,
          useValue: {
            ip: '127.0.0.1',
            headers: { 'user-agent': 'test-agent' },
          },
        },
      ],
    }).compile();

    service = module.get<AdminAuditService>(AdminAuditService);
    repository = module.get<Repository<AdminAuditLog>>(getRepositoryToken(AdminAuditLog));
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  describe('logAction', () => {
    it('should save audit log with all fields', async () => {
      jest.spyOn(repository, 'save').mockResolvedValue(mockAuditLog);

      const result = await service.logAction({
        adminUserId: 'admin-001',
        tenantId: 'tenant-001',
        action: AdminAuditAction.CREATE,
        entityType: AdminAuditEntityType.ORGANIZATION,
        entityId: 'org-001',
        entityLabel: 'Test Organization',
        description: 'Organization created',
        newValues: { name: 'Test Org' },
        changeReason: 'Onboarding new client',
      });

      expect(result).toEqual(mockAuditLog);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should default result to success', async () => {
      jest.spyOn(repository, 'save').mockResolvedValue(mockAuditLog);

      await service.logAction({
        action: AdminAuditAction.CREATE,
        entityType: AdminAuditEntityType.ORGANIZATION,
      });

      const savedLog = (repository.save as jest.Mock).mock.calls[0][0];
      expect(savedLog.result).toBe('success');
    });

    it('should default systemGenerated to false', async () => {
      jest.spyOn(repository, 'save').mockResolvedValue(mockAuditLog);

      await service.logAction({
        action: AdminAuditAction.CREATE,
        entityType: AdminAuditEntityType.ORGANIZATION,
      });

      const savedLog = (repository.save as jest.Mock).mock.calls[0][0];
      expect(savedLog.systemGenerated).toBe(false);
    });
  });

  describe('queryAuditLogs', () => {
    beforeEach(() => {
      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      mockQueryBuilder.andWhere.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.orderBy.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.addOrderBy.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.take.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.skip.mockReturnValue(mockQueryBuilder);
    });

    it('should filter by adminUserId', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditLog]);

      await service.queryAuditLogs({ adminUserId: 'admin-001' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.adminUserId = :adminUserId', {
        adminUserId: 'admin-001',
      });
    });

    it('should filter by tenantId', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditLog]);

      await service.queryAuditLogs({ tenantId: 'tenant-001' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.tenantId = :tenantId', {
        tenantId: 'tenant-001',
      });
    });

    it('should filter by action', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditLog]);

      await service.queryAuditLogs({ action: AdminAuditAction.CREATE });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.action = :action', {
        action: AdminAuditAction.CREATE,
      });
    });

    it('should filter by date range', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditLog]);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await service.queryAuditLogs({ startDate, endDate });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.createdAt BETWEEN :startDate AND :endDate',
        { startDate, endDate },
      );
    });

    it('should order by createdAt DESC', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditLog]);

      await service.queryAuditLogs({});

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('log.createdAt', 'DESC');
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('log.id', 'DESC');
    });

    it('should apply limit and offset', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(100);
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditLog]);

      await service.queryAuditLogs({ limit: 20, offset: 40 });

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(40);
    });

    it('should return data and total', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(100);
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditLog]);

      const result = await service.queryAuditLogs({});

      expect(result.data).toEqual([mockAuditLog]);
      expect(result.total).toBe(100);
    });
  });

  describe('getEntityAuditTrail', () => {
    it('should find logs for specific entity', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([mockAuditLog]);

      const result = await service.getEntityAuditTrail(
        AdminAuditEntityType.ORGANIZATION,
        'org-001',
      );

      expect(result).toEqual([mockAuditLog]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { entityType: AdminAuditEntityType.ORGANIZATION, entityId: 'org-001' },
        order: { createdAt: 'DESC' },
        take: 1000,
      });
    });
  });

  describe('getAdminActivityLog', () => {
    beforeEach(() => {
      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.andWhere.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.orderBy.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.take.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditLog]);
    });

    it('should filter by adminUserId', async () => {
      await service.getAdminActivityLog('admin-001');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('log.adminUserId = :adminUserId', {
        adminUserId: 'admin-001',
      });
    });

    it('should filter by date range when provided', async () => {
      const startDate = new Date('2024-01-01');

      await service.getAdminActivityLog('admin-001', { startDate });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.createdAt >= :startDate', {
        startDate,
      });
    });

    it('should apply custom limit', async () => {
      await service.getAdminActivityLog('admin-001', { limit: 500 });

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(500);
    });
  });

  describe('getTenantAuditTrail', () => {
    it('should find all logs for tenant', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([mockAuditLog]);

      const result = await service.getTenantAuditTrail('tenant-001');

      expect(result).toEqual([mockAuditLog]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-001' },
        order: { createdAt: 'DESC' },
        take: 1000,
      });
    });

    it('should apply custom limit', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([mockAuditLog]);

      await service.getTenantAuditTrail('tenant-001', 500);

      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-001' },
        order: { createdAt: 'DESC' },
        take: 500,
      });
    });
  });

  describe('searchAuditLogs', () => {
    beforeEach(() => {
      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.orderBy.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.take.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.skip.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getCount.mockResolvedValue(5);
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditLog]);
    });

    it('should search description, changeReason, entityLabel', async () => {
      await service.searchAuditLogs('ticket-123');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        '(log.description ILIKE :term OR log.changeReason ILIKE :term OR log.entityLabel ILIKE :term)',
        { term: '%ticket-123%' },
      );
    });

    it('should return data and total', async () => {
      const result = await service.searchAuditLogs('search-term');

      expect(result.data).toEqual([mockAuditLog]);
      expect(result.total).toBe(5);
    });
  });

  describe('archiveOldLogs', () => {
    it('should mark logs before date as archived', async () => {
      jest.spyOn(repository, 'update').mockResolvedValue({ affected: 100 } as any);

      const beforeDate = new Date('2017-01-01');
      const result = await service.archiveOldLogs(beforeDate);

      expect(result).toBe(100);
      expect(repository.update).toHaveBeenCalled();
    });

    it('should set archive timestamp and location', async () => {
      jest.spyOn(repository, 'update').mockResolvedValue({ affected: 50 } as any);

      await service.archiveOldLogs(new Date('2017-01-01'));

      const updateData = (repository.update as jest.Mock).mock.calls[0][1];
      expect(updateData.isArchived).toBe(true);
      expect(updateData.archivedAt).toBeDefined();
      expect(updateData.archiveLocation).toContain('s3://audit-archive');
    });
  });

  describe('verifyLogIntegrity', () => {
    it('should verify existing log', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockAuditLog);

      const result = await service.verifyLogIntegrity('log-123');

      expect(result.valid).toBe(true);
      expect(result.checksum).toBeDefined();
    });

    it('should return invalid for non-existent log', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const result = await service.verifyLogIntegrity('non-existent');

      expect(result.valid).toBe(false);
      expect(result.checksum).toBeUndefined();
    });
  });

  describe('exportAuditLogs', () => {
    beforeEach(() => {
      jest.spyOn(service, 'queryAuditLogs').mockResolvedValue({
        data: [mockAuditLog],
        total: 1,
      });
    });

    it('should export as JSON', async () => {
      const result = await service.exportAuditLogs({}, 'json');

      expect(result).toContain('"id": "log-123"');
      expect(result).toContain('"action": "create"');
    });

    it('should export as CSV', async () => {
      const result = await service.exportAuditLogs({}, 'csv');

      expect(result).toContain('Timestamp');
      expect(result).toContain('Admin User ID');
      expect(result).toContain('org-001');
    });

    it('should include headers in CSV', async () => {
      const result = await service.exportAuditLogs({}, 'csv');
      const lines = result.split('\n');

      expect(lines[0]).toContain('Timestamp');
      expect(lines[0]).toContain('Action');
    });
  });

  describe('getActionStats', () => {
    beforeEach(() => {
      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.addSelect.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.groupBy.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.andWhere.mockReturnValue(mockQueryBuilder);
    });

    it('should count actions by type', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { action: AdminAuditAction.CREATE, count: '10' },
        { action: AdminAuditAction.UPDATE, count: '5' },
      ]);

      const result = await service.getActionStats();

      expect(result[AdminAuditAction.CREATE]).toBe(10);
      expect(result[AdminAuditAction.UPDATE]).toBe(5);
    });

    it('should filter by tenantId if provided', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await service.getActionStats('tenant-001');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('log.tenantId = :tenantId', {
        tenantId: 'tenant-001',
      });
    });
  });

  describe('detectAnomalies', () => {
    beforeEach(() => {
      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.andWhere.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.orderBy.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.take.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getMany.mockResolvedValue([mockAuditLog]);
    });

    it('should find failures and suspicious actions', async () => {
      await service.detectAnomalies(24);

      // Verify it looks for failures and suspicious actions
      const andWhereCall = (mockQueryBuilder.andWhere as jest.Mock).mock.calls[0];
      expect(andWhereCall[0]).toContain('log.result');
      expect(andWhereCall[0]).toContain('log.action');
    });

    it('should use hours parameter', async () => {
      await service.detectAnomalies(48);

      // Verify it uses the hours for time filter
      const whereCall = (mockQueryBuilder.where as jest.Mock).mock.calls[0];
      expect(whereCall[0]).toContain('createdAt');
    });
  });
});
