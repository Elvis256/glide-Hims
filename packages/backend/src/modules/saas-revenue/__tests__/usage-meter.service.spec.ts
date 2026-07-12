import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { UsageMeterService } from '../usage-meter.service';
import {
  UsageMeterEvent,
  UsageMeterAggregate,
  UsageQuota,
  UsageAlert,
  UsageMetricType,
  UsageAggregationPeriod,
} from '../../../database/entities/usage-meter.entity';
import { Tenant } from '../../../database/entities/tenant.entity';
import { Repository } from 'typeorm';

describe('UsageMeterService', () => {
  let service: UsageMeterService;
  let eventRepository: Repository<UsageMeterEvent>;
  let aggregateRepository: Repository<UsageMeterAggregate>;
  let quotaRepository: Repository<UsageQuota>;
  let alertRepository: Repository<UsageAlert>;
  let tenantRepository: Repository<Tenant>;

  const mockTenant = {
    id: 'tenant-123',
    name: 'Test Healthcare',
    status: 'active',
  };

  const mockRepositories = {
    eventRepository: {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    },
    aggregateRepository: {
      findOne: jest.fn(),
      find: jest.fn(),
    },
    quotaRepository: {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    },
    alertRepository: {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    },
    tenantRepository: {
      findOne: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageMeterService,
        {
          provide: getRepositoryToken(UsageMeterEvent),
          useValue: mockRepositories.eventRepository,
        },
        {
          provide: getRepositoryToken(UsageMeterAggregate),
          useValue: mockRepositories.aggregateRepository,
        },
        {
          provide: getRepositoryToken(UsageQuota),
          useValue: mockRepositories.quotaRepository,
        },
        {
          provide: getRepositoryToken(UsageAlert),
          useValue: mockRepositories.alertRepository,
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockRepositories.tenantRepository,
        },
      ],
    }).compile();

    service = module.get<UsageMeterService>(UsageMeterService);
    eventRepository = module.get<Repository<UsageMeterEvent>>(getRepositoryToken(UsageMeterEvent));
    aggregateRepository = module.get<Repository<UsageMeterAggregate>>(
      getRepositoryToken(UsageMeterAggregate),
    );
    quotaRepository = module.get<Repository<UsageQuota>>(getRepositoryToken(UsageQuota));
    alertRepository = module.get<Repository<UsageAlert>>(getRepositoryToken(UsageAlert));
    tenantRepository = module.get<Repository<Tenant>>(getRepositoryToken(Tenant));

    jest.clearAllMocks();
  });

  describe('recordUsage', () => {
    it('should record a usage event', async () => {
      mockRepositories.tenantRepository.findOne.mockResolvedValue(mockTenant);
      mockRepositories.eventRepository.create.mockReturnValue({
        id: 'event-123',
        tenantId: 'tenant-123',
        metricType: UsageMetricType.API_CALLS,
        amount: 1,
      });
      mockRepositories.eventRepository.save.mockResolvedValue({
        id: 'event-123',
        tenantId: 'tenant-123',
        metricType: UsageMetricType.API_CALLS,
        amount: 1,
        billable: true,
        createdAt: new Date(),
      });

      const result = await service.recordUsage(
        'tenant-123',
        UsageMetricType.API_CALLS,
        1,
        true,
        'api_endpoint',
        { endpoint: '/api/test' },
      );

      expect(result).toBeDefined();
      expect(mockRepositories.eventRepository.create).toHaveBeenCalled();
      expect(mockRepositories.eventRepository.save).toHaveBeenCalled();
    });

    it('should throw error if tenant not found', async () => {
      mockRepositories.tenantRepository.findOne.mockResolvedValue(null);

      await expect(
        service.recordUsage('nonexistent', UsageMetricType.API_CALLS, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if hard limit exceeded', async () => {
      const quota = {
        tenantId: 'tenant-123',
        metricType: UsageMetricType.API_CALLS,
        limitMonthly: 100,
        hardLimit: true,
        alertThresholdPct: 80,
      };

      const aggregate = {
        tenantId: 'tenant-123',
        metricType: UsageMetricType.API_CALLS,
        totalAmount: 100,
      };

      mockRepositories.tenantRepository.findOne.mockResolvedValue(mockTenant);
      mockRepositories.eventRepository.create.mockReturnValue({});
      mockRepositories.eventRepository.save.mockResolvedValue({});
      mockRepositories.quotaRepository.findOne.mockResolvedValue(quota);
      mockRepositories.aggregateRepository.findOne.mockResolvedValue(aggregate);

      await expect(service.recordUsage('tenant-123', UsageMetricType.API_CALLS, 1)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('checkQuota', () => {
    it('should return unlimited if no quota configured', async () => {
      mockRepositories.quotaRepository.findOne.mockResolvedValue(null);

      const result = await service.checkQuota('tenant-123', UsageMetricType.API_CALLS);

      expect(result.allowed).toBe(true);
      expect(result.message).toContain('unlimited');
    });

    it('should return quota status for configured metric', async () => {
      const quota = {
        tenantId: 'tenant-123',
        metricType: UsageMetricType.API_CALLS,
        limitMonthly: 100000,
        hardLimit: true,
        alertThresholdPct: 80,
      };

      const aggregate = {
        tenantId: 'tenant-123',
        metricType: UsageMetricType.API_CALLS,
        totalAmount: 50000,
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      };

      mockRepositories.quotaRepository.findOne.mockResolvedValue(quota);
      mockRepositories.aggregateRepository.findOne.mockResolvedValue(aggregate);

      const result = await service.checkQuota('tenant-123', UsageMetricType.API_CALLS);

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(50000);
      expect(result.limit).toBe(100000);
      expect(result.usagePercentage).toBe(50);
    });

    it('should block if hard limit exceeded', async () => {
      const quota = {
        tenantId: 'tenant-123',
        metricType: UsageMetricType.API_CALLS,
        limitMonthly: 100,
        hardLimit: true,
        alertThresholdPct: 80,
      };

      const aggregate = {
        tenantId: 'tenant-123',
        metricType: UsageMetricType.API_CALLS,
        totalAmount: 100,
      };

      mockRepositories.quotaRepository.findOne.mockResolvedValue(quota);
      mockRepositories.aggregateRepository.findOne.mockResolvedValue(aggregate);

      const result = await service.checkQuota('tenant-123', UsageMetricType.API_CALLS);

      expect(result.allowed).toBe(false);
      expect(result.usagePercentage).toBe(100);
    });
  });

  describe('setQuota', () => {
    it('should create new quota if not exists', async () => {
      mockRepositories.quotaRepository.findOne.mockResolvedValue(null);
      mockRepositories.quotaRepository.create.mockReturnValue({
        tenantId: 'tenant-123',
        metricType: UsageMetricType.API_CALLS,
      });
      mockRepositories.quotaRepository.save.mockResolvedValue({
        tenantId: 'tenant-123',
        metricType: UsageMetricType.API_CALLS,
        limitMonthly: 100000,
        hardLimit: true,
      });

      const result = await service.setQuota(
        'tenant-123',
        UsageMetricType.API_CALLS,
        100000,
        5000,
        true,
        80,
      );

      expect(result.limitMonthly).toBe(100000);
      expect(mockRepositories.quotaRepository.save).toHaveBeenCalled();
    });

    it('should update existing quota', async () => {
      const existingQuota = {
        tenantId: 'tenant-123',
        metricType: UsageMetricType.API_CALLS,
        limitMonthly: 50000,
      };

      mockRepositories.quotaRepository.findOne.mockResolvedValue(existingQuota);
      mockRepositories.quotaRepository.save.mockResolvedValue({
        ...existingQuota,
        limitMonthly: 100000,
      });

      const result = await service.setQuota(
        'tenant-123',
        UsageMetricType.API_CALLS,
        100000,
        5000,
        true,
        80,
      );

      expect(result.limitMonthly).toBe(100000);
      expect(mockRepositories.quotaRepository.save).toHaveBeenCalled();
    });
  });

  describe('getActiveAlerts', () => {
    it('should return active (unresolved) alerts for tenant', async () => {
      const alerts = [
        {
          id: 'alert-1',
          tenantId: 'tenant-123',
          metricType: UsageMetricType.API_CALLS,
          severity: 'warning',
          resolvedAt: null,
        },
        {
          id: 'alert-2',
          tenantId: 'tenant-123',
          metricType: UsageMetricType.STORAGE_GB,
          severity: 'critical',
          resolvedAt: null,
        },
      ];

      mockRepositories.alertRepository.find.mockResolvedValue(alerts);

      const result = await service.getActiveAlerts('tenant-123');

      expect(result).toHaveLength(2);
      expect(result[0].tenantId).toBe('tenant-123');
    });
  });

  describe('acknowledgeAlert', () => {
    it('should mark alert as acknowledged', async () => {
      const alert = {
        id: 'alert-123',
        tenantId: 'tenant-123',
        acknowledged: false,
      };

      mockRepositories.alertRepository.findOne.mockResolvedValue(alert);
      mockRepositories.alertRepository.save.mockResolvedValue({
        ...alert,
        acknowledged: true,
      });

      const result = await service.acknowledgeAlert('alert-123');

      expect(result.acknowledged).toBe(true);
    });
  });

  describe('resolveAlert', () => {
    it('should mark alert as resolved', async () => {
      const alert = {
        id: 'alert-123',
        tenantId: 'tenant-123',
        resolvedAt: null,
      };

      mockRepositories.alertRepository.findOne.mockResolvedValue(alert);
      mockRepositories.alertRepository.save.mockResolvedValue({
        ...alert,
        resolvedAt: new Date(),
      });

      const result = await service.resolveAlert('alert-123');

      expect(result.resolvedAt).toBeDefined();
    });
  });

  describe('getBillingUsage', () => {
    it('should return billable usage by metric type', async () => {
      // Only billable events are returned by the repository query (service filters with billable: true in WHERE clause)
      const billableEvents = [
        {
          tenantId: 'tenant-123',
          metricType: UsageMetricType.API_CALLS,
          amount: 5000,
          billable: true,
        },
        {
          tenantId: 'tenant-123',
          metricType: UsageMetricType.STORAGE_GB,
          amount: 100,
          billable: true,
        },
      ];

      mockRepositories.eventRepository.find.mockResolvedValue(billableEvents);

      const result = await service.getBillingUsage(
        'tenant-123',
        new Date('2026-06-01'),
        new Date('2026-06-30'),
      );

      expect(result).toHaveLength(2);
      expect(result[0].metricType).toBe(UsageMetricType.API_CALLS);
      expect(result[0].totalAmount).toBe(5000); // Only billable
    });
  });
});
