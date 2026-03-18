import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { User } from '../../../database/entities/user.entity';
import { UserRole } from '../../../database/entities/user-role.entity';
import { Facility } from '../../../database/entities/facility.entity';
import { PasswordPolicy, PasswordHistory } from '../../../database/entities/password-policy.entity';
import { RolePermission } from '../../../database/entities/role-permission.entity';
import { Permission } from '../../../database/entities/permission.entity';
import { UserPermission } from '../../../database/entities/user-permission.entity';

jest.mock('bcrypt');

const mockUserRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockUserRoleRepo = {
  find: jest.fn(),
  manager: {
    getRepository: jest.fn().mockReturnValue({ findOne: jest.fn() }),
    query: jest.fn().mockResolvedValue([]),
  },
};

const mockFacilityRepo = {
  findOne: jest.fn(),
};

const mockPasswordPolicyRepo = {
  findOne: jest.fn(),
};

const mockPasswordHistoryRepo = {
  find: jest.fn(),
  save: jest.fn(),
};

const mockRolePermissionRepo = {
  find: jest.fn(),
};

const mockPermissionRepo = {
  find: jest.fn(),
};

const mockUserPermissionRepo = {
  find: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultVal?: any) => {
    const config: Record<string, any> = {
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_REFRESH_EXPIRES_IN: '7d',
      JWT_EXPIRES_IN: '8h',
      BCRYPT_ROUNDS: 12,
    };
    return config[key] ?? defaultVal;
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  const mockUser: Partial<User> = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
    passwordHash: '$2b$12$validhashstring',
    status: 'active',
    failedLoginAttempts: 0,
    lockedUntil: undefined as any,
    mfaEnabled: false,
    isSystemAdmin: false,
    tenantId: 'tenant-1',
    facilityId: 'facility-1',
    lastLoginAt: undefined as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(UserRole), useValue: mockUserRoleRepo },
        { provide: getRepositoryToken(Facility), useValue: mockFacilityRepo },
        { provide: getRepositoryToken(PasswordPolicy), useValue: mockPasswordPolicyRepo },
        { provide: getRepositoryToken(PasswordHistory), useValue: mockPasswordHistoryRepo },
        { provide: getRepositoryToken(RolePermission), useValue: mockRolePermissionRepo },
        { provide: getRepositoryToken(Permission), useValue: mockPermissionRepo },
        { provide: getRepositoryToken(UserPermission), useValue: mockUserPermissionRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Reset all mocks
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string, defaultVal?: any) => {
      const config: Record<string, any> = {
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '7d',
        JWT_EXPIRES_IN: '8h',
        BCRYPT_ROUNDS: 12,
      };
      return config[key] ?? defaultVal;
    });
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      const user = { ...mockUser, failedLoginAttempts: 0 };
      mockUserRepo.findOne.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockUserRepo.save.mockResolvedValueOnce(user);

      const result = await service.validateUser('testuser', 'correct-password');

      expect(result).toBeDefined();
      expect(result!.username).toBe('testuser');
      expect(bcrypt.compare).toHaveBeenCalledWith('correct-password', user.passwordHash);
    });

    it('should return null when user is not found', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.validateUser('nonexistent', 'password');

      expect(result).toBeNull();
    });

    it('should return null when password is invalid and increment failed attempts', async () => {
      const user = { ...mockUser, failedLoginAttempts: 0 };
      mockUserRepo.findOne.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      mockUserRepo.save.mockResolvedValueOnce(user);

      const result = await service.validateUser('testuser', 'wrong-password');

      expect(result).toBeNull();
      expect(mockUserRepo.save).toHaveBeenCalled();
      const savedUser = mockUserRepo.save.mock.calls[0][0];
      expect(savedUser.failedLoginAttempts).toBe(1);
    });

    it('should lock account after 5 failed attempts', async () => {
      const user = { ...mockUser, failedLoginAttempts: 4 };
      mockUserRepo.findOne.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      mockUserRepo.save.mockResolvedValueOnce(user);

      await service.validateUser('testuser', 'wrong-password');

      const savedUser = mockUserRepo.save.mock.calls[0][0];
      expect(savedUser.failedLoginAttempts).toBe(5);
      expect(savedUser.lockedUntil).toBeDefined();
      expect(savedUser.lockedUntil.getTime()).toBeGreaterThan(Date.now());
    });

    it('should throw UnauthorizedException when account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      };
      mockUserRepo.findOne.mockResolvedValueOnce(lockedUser);

      await expect(
        service.validateUser('testuser', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return null when passwordHash is missing', async () => {
      const userNoHash = { ...mockUser, passwordHash: '' };
      mockUserRepo.findOne.mockResolvedValueOnce(userNoHash);

      const result = await service.validateUser('testuser', 'password');

      expect(result).toBeNull();
    });

    it('should reset failed attempts on successful login', async () => {
      const user = { ...mockUser, failedLoginAttempts: 3 };
      mockUserRepo.findOne.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockUserRepo.save.mockResolvedValueOnce(user);

      await service.validateUser('testuser', 'correct-password');

      const savedUser = mockUserRepo.save.mock.calls[0][0];
      expect(savedUser.failedLoginAttempts).toBe(0);
    });
  });

  describe('login', () => {
    const loginDto = { username: 'testuser', password: 'Password1!' };

    beforeEach(() => {
      // Common setup for login tests
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUserRepo.save.mockImplementation((u: any) => Promise.resolve(u));
      mockUserRoleRepo.find.mockResolvedValue([
        {
          roleId: 'role-1',
          role: { name: 'doctor' },
          facilityId: 'facility-1',
          facility: { id: 'facility-1', name: 'Main Hospital', type: 'hospital', location: 'City' },
        },
      ]);
      mockRolePermissionRepo.find.mockResolvedValue([
        { permission: { code: 'patients.read' } },
        { permission: { code: 'patients.write' } },
      ]);
      mockUserPermissionRepo.find.mockResolvedValue([]);
      mockFacilityRepo.findOne.mockResolvedValue(null);
      mockJwtService.sign.mockReturnValue('mock-token');
    });

    it('should return tokens and user info on successful login', async () => {
      const result = await service.login(loginDto);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.expiresIn).toBe(28800); // 8h
      expect(result.user.username).toBe('testuser');
      expect(result.user.roles).toContain('doctor');
      expect(result.user.permissions).toContain('patients.read');
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2); // access + refresh
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(null); // validateUser returns null

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const inactiveUser = { ...mockUser, status: 'inactive' };
      mockUserRepo.findOne.mockResolvedValueOnce(inactiveUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockUserRepo.save.mockResolvedValueOnce(inactiveUser);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException when MFA is enabled but no code provided', async () => {
      const mfaUser = { ...mockUser, mfaEnabled: true, mfaSecret: 'secret' };
      mockUserRepo.findOne.mockResolvedValueOnce(mfaUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockUserRepo.save.mockResolvedValueOnce(mfaUser);

      await expect(service.login(loginDto)).rejects.toThrow(BadRequestException);
    });

    it('should sign refresh token with separate secret', async () => {
      await service.login(loginDto);

      const refreshSignCall = mockJwtService.sign.mock.calls[1];
      expect(refreshSignCall[1]).toEqual(
        expect.objectContaining({
          secret: 'test-refresh-secret',
          expiresIn: '7d',
        }),
      );
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens for valid refresh token', async () => {
      const payload = {
        sub: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        tenantId: 'tenant-1',
        roles: ['doctor'],
        facilityId: 'facility-1',
      };

      mockJwtService.verify.mockReturnValueOnce(payload);
      mockUserRepo.findOne.mockResolvedValueOnce({ ...mockUser });
      mockUserRoleRepo.find.mockResolvedValueOnce([
        {
          roleId: 'role-1',
          role: { name: 'doctor' },
          facilityId: 'facility-1',
          facility: { id: 'facility-1', name: 'Main Hospital', type: 'hospital' },
        },
      ]);
      mockRolePermissionRepo.find.mockResolvedValueOnce([
        { permission: { code: 'patients.read' } },
      ]);
      mockUserPermissionRepo.find.mockResolvedValueOnce([]);
      mockFacilityRepo.findOne.mockResolvedValueOnce(null);
      mockJwtService.sign.mockReturnValue('new-mock-token');

      const result = await service.refreshToken('valid-refresh-token');

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('new-mock-token');
      expect(result.user.id).toBe('user-1');
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-refresh-token', {
        secret: 'test-refresh-secret',
      });
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockJwtService.verify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      mockJwtService.verify.mockReturnValueOnce({ sub: 'user-1' });
      mockUserRepo.findOne.mockResolvedValueOnce({ ...mockUser, status: 'inactive' });

      await expect(service.refreshToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockJwtService.verify.mockReturnValueOnce({ sub: 'nonexistent' });
      mockUserRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.refreshToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    const changePasswordDto = {
      currentPassword: 'OldPassword1!',
      newPassword: 'NewPassword1!',
    };

    it('should change password when current password is correct', async () => {
      const user = { ...mockUser };
      mockUserRepo.findOne.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      // validatePasswordPolicy -> getPasswordPolicy
      mockPasswordPolicyRepo.findOne.mockResolvedValueOnce(null);
      // checkPasswordHistory -> getPasswordPolicy
      mockPasswordPolicyRepo.findOne.mockResolvedValueOnce(null);
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce('$2b$12$newhash');
      mockPasswordHistoryRepo.save.mockResolvedValueOnce({});
      mockUserRepo.save.mockResolvedValueOnce({ ...user, passwordHash: '$2b$12$newhash' });

      await expect(
        service.changePassword('user-1', changePasswordDto),
      ).resolves.toBeUndefined();

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword1!', 12);
      expect(mockPasswordHistoryRepo.save).toHaveBeenCalled();
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when current password is incorrect', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce({ ...mockUser });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.changePassword('user-1', changePasswordDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.changePassword('nonexistent', changePasswordDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException when user has invalid password hash', async () => {
      const userBadHash = { ...mockUser, passwordHash: 'not-a-bcrypt-hash' };
      mockUserRepo.findOne.mockResolvedValueOnce(userBadHash);

      await expect(
        service.changePassword('user-1', changePasswordDto),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
