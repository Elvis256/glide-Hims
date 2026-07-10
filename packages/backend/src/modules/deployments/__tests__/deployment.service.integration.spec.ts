import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DeploymentService } from '../deployment.service';
import {
  Deployment,
  DeploymentType,
  DeploymentStatus,
} from '../../../database/entities/deployment.entity';
import { DeploymentVersion } from '../../../database/entities/deployment-version.entity';
import { DeploymentConfig } from '../../../database/entities/deployment-config.entity';
import { License } from '../../../database/entities/license.entity';
import { TenantsService } from '../../tenants/tenants.service';
import { LicenseService } from '../../licensing/license.service';

describe('DeploymentService Integration Tests', () => {
  let service: DeploymentService;
  let deploymentRepository: Repository<Deployment>;
  let versionRepository: Repository<DeploymentVersion>;
  let configRepository: Repository<DeploymentConfig>;

  const mockDeploymentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    remove: jest.fn(),
  };

  const mockVersionRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockConfigRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockLicenseRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockTenantsService = {
    findOne: jest.fn(),
    findBySlug: jest.fn(),
    create: jest.fn(),
  };

  const mockLicenseService = {
    generateLicense: jest.fn(),
    updateLicense: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentService,
        {
          provide: getRepositoryToken(Deployment),
          useValue: mockDeploymentRepository,
        },
        {
          provide: getRepositoryToken(DeploymentVersion),
          useValue: mockVersionRepository,
        },
        {
          provide: getRepositoryToken(DeploymentConfig),
          useValue: mockConfigRepository,
        },
        {
          provide: getRepositoryToken(License),
          useValue: mockLicenseRepository,
        },
        {
          provide: TenantsService,
          useValue: mockTenantsService,
        },
        {
          provide: LicenseService,
          useValue: mockLicenseService,
        },
      ],
    }).compile();

    service = module.get<DeploymentService>(DeploymentService);
    deploymentRepository = module.get<Repository<Deployment>>(getRepositoryToken(Deployment));
    versionRepository = module.get<Repository<DeploymentVersion>>(
      getRepositoryToken(DeploymentVersion),
    );
    configRepository = module.get<Repository<DeploymentConfig>>(
      getRepositoryToken(DeploymentConfig),
    );

    jest.resetAllMocks();
    mockLicenseRepository.find.mockResolvedValue([]);
    mockLicenseService.generateLicense.mockResolvedValue({});
    mockLicenseService.updateLicense.mockResolvedValue({});
  });

  describe('provisionDeployment', () => {
    it('should provision against an existing tenant without requiring a form name', async () => {
      const tenant = {
        id: 'tenant-123',
        name: 'DEVELOPMENT ENVIROMENT',
        slug: 'development-enviroment',
      };
      const createdAt = new Date();
      const updatedAt = new Date();

      mockTenantsService.findOne.mockResolvedValue(tenant);
      mockDeploymentRepository.create.mockImplementation((entity) => ({
        id: 'deploy-1',
        createdAt,
        updatedAt,
        ...entity,
      }));
      mockDeploymentRepository.save.mockImplementation(async (entity) => entity);

      const result = await service.provisionDeployment({
        tenantId: tenant.id,
        organizationName: '',
        type: 'hybrid',
        tier: 'enterprise',
        maxUsers: 50,
      });

      expect(result.id).toBe('deploy-1');
      expect(result.name).toBe(tenant.name);
      expect(mockTenantsService.findOne).toHaveBeenCalledWith(tenant.id);
      expect(mockTenantsService.create).not.toHaveBeenCalled();
      expect(mockDeploymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenant.id,
          name: tenant.name,
          deploymentType: DeploymentType.HYBRID,
          status: DeploymentStatus.PENDING,
          config: expect.objectContaining({
            userFacingType: 'hybrid',
            tier: 'enterprise',
            maxUsers: 50,
          }),
        }),
      );
      expect(mockLicenseService.generateLicense).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenant.id,
          organizationName: tenant.name,
          licenseType: 'enterprise',
          maxUsers: 50,
        }),
      );
    });
  });

  describe('createDeployment', () => {
    it('should successfully create a new deployment', async () => {
      const tenantId = 'tenant-123';
      const dto = {
        tenantId,
        name: 'Production Deployment',
        type: DeploymentType.CLOUD,
        apiUrl: 'https://api.prod.example.com',
      };

      const mockDeployment = {
        id: 'deploy-1',
        tenantId,
        name: dto.name,
        deploymentType: dto.type,
        status: DeploymentStatus.PENDING,
        apiEndpoint: dto.apiUrl,
        currentVersion: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDeploymentRepository.create.mockReturnValue(mockDeployment);
      mockDeploymentRepository.save.mockResolvedValue(mockDeployment);

      const result = await service.createDeployment(tenantId, dto);

      expect(result).toBeDefined();
      expect(result.id).toBe('deploy-1');
      expect(result.name).toBe(dto.name);
      expect(mockDeploymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          name: dto.name,
          deploymentType: dto.type,
          status: DeploymentStatus.PENDING,
        }),
      );
      expect(mockDeploymentRepository.save).toHaveBeenCalled();
    });

    it('should reject deployment with mismatched tenant ID', async () => {
      const tenantId = 'tenant-123';
      const dto = {
        tenantId: 'tenant-456',
        name: 'Production Deployment',
        type: DeploymentType.CLOUD,
        apiUrl: 'https://api.prod.example.com',
      };

      await expect(service.createDeployment(tenantId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDeployment', () => {
    it('should retrieve deployment by ID and tenant', async () => {
      const tenantId = 'tenant-123';
      const deploymentId = 'deploy-1';
      const mockDeployment = {
        id: deploymentId,
        tenantId,
        name: 'Production',
        deploymentType: DeploymentType.CLOUD,
        status: DeploymentStatus.ACTIVE,
        apiEndpoint: 'https://api.prod.example.com',
        currentVersion: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDeploymentRepository.findOne.mockResolvedValue(mockDeployment);

      const result = await service.getDeployment(tenantId, deploymentId);

      expect(result).toBeDefined();
      expect(result.id).toBe(deploymentId);
      expect(mockDeploymentRepository.findOne).toHaveBeenCalledWith({
        where: { id: deploymentId, tenantId },
      });
    });

    it('should throw NotFoundException when deployment does not exist', async () => {
      const tenantId = 'tenant-123';
      const deploymentId = 'deploy-notfound';

      mockDeploymentRepository.findOne.mockResolvedValue(null);

      await expect(service.getDeployment(tenantId, deploymentId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listDeployments', () => {
    it('should list all deployments for a tenant', async () => {
      const tenantId = 'tenant-123';
      const mockDeployments = [
        {
          id: 'deploy-1',
          tenantId,
          name: 'Production',
          status: DeploymentStatus.ACTIVE,
        },
        {
          id: 'deploy-2',
          tenantId,
          name: 'Staging',
          status: DeploymentStatus.ACTIVE,
        },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockDeployments),
      };

      mockDeploymentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.listDeployments(tenantId);

      expect(result).toHaveLength(2);
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('d.createdAt', 'DESC');
    });

    it('should filter deployments by type', async () => {
      const tenantId = 'tenant-123';
      const type = DeploymentType.CLOUD;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockDeploymentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.listDeployments(tenantId, { type });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('d.deploymentType = :type', { type });
    });
  });

  describe('updateDeployment', () => {
    it('should update deployment properties', async () => {
      const tenantId = 'tenant-123';
      const deploymentId = 'deploy-1';
      const dto = { name: 'Updated Name', status: DeploymentStatus.INACTIVE };

      const mockDeployment = {
        id: deploymentId,
        tenantId,
        name: 'Original',
        status: DeploymentStatus.ACTIVE,
        apiEndpoint: 'https://api.example.com',
      };

      mockDeploymentRepository.findOne.mockResolvedValue(mockDeployment);
      mockDeploymentRepository.save.mockResolvedValue({
        ...mockDeployment,
        ...dto,
      });

      const result = await service.updateDeployment(tenantId, deploymentId, dto);

      expect(result.name).toBe('Updated Name');
      expect(mockDeploymentRepository.save).toHaveBeenCalled();
    });

    it('should throw when deployment not found during update', async () => {
      const tenantId = 'tenant-123';
      const deploymentId = 'deploy-notfound';

      mockDeploymentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateDeployment(tenantId, deploymentId, { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDeployment', () => {
    it('should delete an inactive deployment', async () => {
      const tenantId = 'tenant-123';
      const deploymentId = 'deploy-1';

      const mockDeployment = {
        id: deploymentId,
        tenantId,
        status: DeploymentStatus.INACTIVE,
      };

      mockDeploymentRepository.findOne.mockResolvedValue(mockDeployment);
      mockDeploymentRepository.remove.mockResolvedValue(mockDeployment);

      await service.deleteDeployment(tenantId, deploymentId);

      expect(mockDeploymentRepository.remove).toHaveBeenCalledWith(mockDeployment);
    });

    it('should reject deletion of active deployment', async () => {
      const tenantId = 'tenant-123';
      const deploymentId = 'deploy-1';

      const mockDeployment = {
        id: deploymentId,
        tenantId,
        status: DeploymentStatus.ACTIVE,
      };

      mockDeploymentRepository.findOne.mockResolvedValue(mockDeployment);

      await expect(service.deleteDeployment(tenantId, deploymentId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('activateDeployment', () => {
    it('should activate deployment with specified version', async () => {
      const tenantId = 'tenant-123';
      const deploymentId = 'deploy-1';
      const versionId = 'version-1';

      const mockDeployment = {
        id: deploymentId,
        tenantId,
        status: DeploymentStatus.INACTIVE,
      };

      const mockVersion = {
        id: versionId,
        deploymentId,
      };

      mockDeploymentRepository.findOne.mockResolvedValueOnce(mockDeployment).mockResolvedValueOnce({
        ...mockDeployment,
        status: DeploymentStatus.ACTIVE,
        currentVersion: versionId,
      });
      mockVersionRepository.findOne.mockResolvedValue(mockVersion);
      mockDeploymentRepository.save.mockResolvedValue({
        ...mockDeployment,
        status: DeploymentStatus.ACTIVE,
        currentVersion: versionId,
      });

      const result = await service.activateDeployment(tenantId, deploymentId, versionId);

      expect(result.status).toBe(DeploymentStatus.ACTIVE);
      expect(mockVersionRepository.findOne).toHaveBeenCalled();
    });
  });

  describe('getDeploymentHealth', () => {
    it('should retrieve deployment health status', async () => {
      const tenantId = 'tenant-123';
      const deploymentId = 'deploy-1';

      const mockDeployment = {
        id: deploymentId,
        tenantId,
        status: DeploymentStatus.ACTIVE,
        currentVersion: '1.0.0',
        lastHealthCheck: new Date(),
        lastSync: new Date(),
      };

      mockDeploymentRepository.findOne.mockResolvedValue(mockDeployment);

      const result = await service.getDeploymentHealth(tenantId, deploymentId);

      expect(result).toEqual(
        expect.objectContaining({
          id: deploymentId,
          status: DeploymentStatus.ACTIVE,
          currentVersion: '1.0.0',
        }),
      );
    });
  });
});
