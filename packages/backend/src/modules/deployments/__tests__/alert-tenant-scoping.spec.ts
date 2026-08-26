import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { MonitoringService } from '../monitoring.service';
import { DeploymentHealth } from '../../../database/entities/deployment-health.entity';
import { DeploymentAlert } from '../../../database/entities/deployment-alert.entity';
import { Deployment } from '../../../database/entities/deployment.entity';

/**
 * deployment_alerts carries no tenant_id of its own — an alert is only reachable
 * to a tenant through the deployment that owns it — and the table has RLS
 * DISABLED, so the database will not catch a missing filter either. Both alert
 * reads and the resolve mutation were returning every tenant's rows: a hospital
 * admin could list, and silence, another hospital's critical alerts.
 *
 * These tests pin the join. They fail if the tenant predicate is ever dropped.
 */
describe('MonitoringService — alert tenant scoping', () => {
  let service: MonitoringService;
  let queryBuilder: any;

  const makeQueryBuilder = (result: any) => ({
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
    getOne: jest.fn().mockResolvedValue(result),
  });

  const mockAlertRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((a) => Promise.resolve(a)),
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        { provide: getRepositoryToken(DeploymentHealth), useValue: {} },
        { provide: getRepositoryToken(DeploymentAlert), useValue: mockAlertRepository },
        { provide: getRepositoryToken(Deployment), useValue: {} },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
  });

  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  describe('getAlerts', () => {
    it('joins the owning deployment and filters on its tenant', async () => {
      queryBuilder = makeQueryBuilder([]);
      mockAlertRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.getAlerts(tenantA);

      expect(queryBuilder.innerJoinAndSelect).toHaveBeenCalledWith('a.deployment', 'd');
      expect(queryBuilder.where).toHaveBeenCalledWith('d.tenantId = :tenantId', {
        tenantId: tenantA,
      });
    });

    it('keeps the tenant filter when a deployment filter is also supplied', async () => {
      queryBuilder = makeQueryBuilder([]);
      mockAlertRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.getAlerts(tenantA, 'dep-1');

      expect(queryBuilder.where).toHaveBeenCalledWith('d.tenantId = :tenantId', {
        tenantId: tenantA,
      });
      // must be andWhere — a second .where() would replace the tenant predicate
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('a.deploymentId = :deploymentId', {
        deploymentId: 'dep-1',
      });
    });
  });

  describe('getAllAlerts', () => {
    it('spans tenants for the platform inbox, but still joins the deployment', async () => {
      queryBuilder = makeQueryBuilder([]);
      mockAlertRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.getAllAlerts();

      expect(queryBuilder.innerJoinAndSelect).toHaveBeenCalledWith('a.deployment', 'd');
      expect(queryBuilder.where).not.toHaveBeenCalled();
    });
  });

  describe('resolveAlert', () => {
    it('scopes the lookup to the caller tenant', async () => {
      queryBuilder = makeQueryBuilder({ id: 'alert-1', status: 'open' });
      mockAlertRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.resolveAlert(tenantA, 'alert-1');

      expect(queryBuilder.innerJoin).toHaveBeenCalledWith('a.deployment', 'd');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('d.tenantId = :tenantId', {
        tenantId: tenantA,
      });
    });

    it('refuses another tenant’s alert rather than resolving it', async () => {
      queryBuilder = makeQueryBuilder(null);
      mockAlertRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await expect(service.resolveAlert(tenantA, 'someone-elses-alert')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockAlertRepository.save).not.toHaveBeenCalled();
    });
  });
});
