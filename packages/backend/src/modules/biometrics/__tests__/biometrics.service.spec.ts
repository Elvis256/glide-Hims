import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { of } from 'rxjs';
import { BiometricsService } from '../biometrics.service';
import { BiometricData } from '../../../database/entities/biometric-data.entity';
import { User } from '../../../database/entities/user.entity';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';

describe('BiometricsService', () => {
  let service: BiometricsService;
  let httpService: HttpService;

  const mockBiometricRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultVal?: any) => {
      const config: Record<string, any> = {
        FINGERPRINT_SERVICE_URL: 'http://localhost:8444',
        FINGERPRINT_API_KEY: 'test-api-key',
      };
      return config[key] ?? defaultVal;
    }),
  };

  const mockDataSource = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiometricsService,
        { provide: getRepositoryToken(BiometricData), useValue: mockBiometricRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<BiometricsService>(BiometricsService);
    httpService = module.get<HttpService>(HttpService);
  });

  describe('verifyProxy', () => {
    const verifyDto = {
      userId: 'user-1',
      templateData: 'captured-template-b64',
    };

    it('should verify biometrics successfully via proxy', async () => {
      mockBiometricRepo.find.mockResolvedValue([
        { fingerIndex: 'right_index', templateData: 'stored-template-b64' },
      ]);

      mockHttpService.post.mockReturnValue(
        of({
          data: {
            success: true,
            matched: true,
            fingerIndex: 'right_index',
          },
        }),
      );

      const result = await service.verifyProxy(verifyDto, 'tenant-1');

      expect(result.matched).toBe(true);
      expect(result.fingerIndex).toBe('right_index');
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://localhost:8444/verify',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should return matched: false if no match found by service', async () => {
      mockBiometricRepo.find.mockResolvedValue([
        { fingerIndex: 'right_index', templateData: 'stored-template-b64' },
      ]);

      mockHttpService.post.mockReturnValue(
        of({
          data: {
            success: true,
            matched: false,
          },
        }),
      );

      const result = await service.verifyProxy(verifyDto, 'tenant-1');

      expect(result.matched).toBe(false);
    });

    it('should throw NotFoundException if no templates stored', async () => {
      mockBiometricRepo.find.mockResolvedValue([]);

      await expect(service.verifyProxy(verifyDto, 'tenant-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException if API key missing', async () => {
      mockBiometricRepo.find.mockResolvedValue([{ templateData: '...' }]);
      jest.spyOn(mockConfigService, 'get').mockReturnValue(null); // API key missing

      await expect(service.verifyProxy(verifyDto, 'tenant-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
