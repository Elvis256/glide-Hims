import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Facility } from '../../database/entities/facility.entity';
import { PasswordPolicy, PasswordHistory } from '../../database/entities/password-policy.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { Permission } from '../../database/entities/permission.entity';
import { UserPermission } from '../../database/entities/user-permission.entity';
import { LoginDto, AuthResponseDto, ChangePasswordDto } from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(Facility)
    private facilityRepository: Repository<Facility>,
    @InjectRepository(PasswordPolicy)
    private passwordPolicyRepository: Repository<PasswordPolicy>,
    @InjectRepository(PasswordHistory)
    private passwordHistoryRepository: Repository<PasswordHistory>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(UserPermission)
    private userPermissionRepository: Repository<UserPermission>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(username: string, password: string, tenantId?: string): Promise<User | null> {
    const whereConditions: any[] = tenantId
      ? [{ username, tenantId }, { email: username, tenantId }]
      : [{ username }, { email: username }];

    let user = await this.userRepository.findOne({
      where: whereConditions,
    });

    // If not found under the selected tenant, check for system admin
    if (!user && tenantId) {
      user = await this.userRepository.findOne({
        where: [
          { username, isSystemAdmin: true },
          { email: username, isSystemAdmin: true },
        ],
      });
    }

    if (!user) {
      return null;
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked. Please try again later.');
    }

    // Validate that passwordHash exists and is valid before comparing
    if (!user.passwordHash || !user.passwordHash.startsWith('$2')) {
      this.logger.error(`User ${user.username} has invalid password hash format`);
      return null;
    }

    let isPasswordValid: boolean;
    try {
      isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    } catch (error) {
      this.logger.error(`Password validation error for user ${user.username}: ${(error as Error).message}`);
      throw error;
    }

    if (!isPasswordValid) {
      // Increment failed login attempts
      user.failedLoginAttempts += 1;

      // Lock account after 5 failed attempts for 15 minutes
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await this.userRepository.save(user);
      return null;
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;
      await this.userRepository.save(user);
    }

    return user;
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.username, loginDto.password, loginDto.tenantId);

    if (!user) {
      this.logger.warn(`Login failed for username: ${loginDto.username}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    // Validate MFA if enabled
    if (user.mfaEnabled) {
      if (!loginDto.mfaCode) {
        throw new BadRequestException({
          message: 'MFA code required',
          mfaRequired: true,
        });
      }
      const speakeasy = require('speakeasy');
      const isValid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: loginDto.mfaCode,
        window: 1,
      });
      if (!isValid) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    // Get user roles
    const userRoles = await this.userRoleRepository.find({
      where: { userId: user.id },
      relations: ['role', 'facility'],
    });

    const roles = userRoles.map((ur) => ur.role.name);
    const roleIds = userRoles.map((ur) => ur.roleId);
    // Get facility: prefer user_roles.facilityId, fall back to user.facilityId
    let roleFacilityId = userRoles.find(ur => ur.facilityId)?.facilityId;
    let roleFacility = userRoles.find(ur => ur.facility)?.facility;
    let facilityId = roleFacilityId || user.facilityId;
    let facility = roleFacility;

    // System admin logging into a different tenant: resolve that tenant's facility
    if (user.isSystemAdmin && loginDto.tenantId && user.tenantId !== loginDto.tenantId) {
      const tenantFacility = await this.facilityRepository.findOne({
        where: { tenantId: loginDto.tenantId },
      });
      if (tenantFacility) {
        facilityId = tenantFacility.id;
        facility = tenantFacility;
      }
    } else if (!facility && user.facilityId) {
      facility = (await this.facilityRepository.findOne({ where: { id: user.facilityId } })) ?? undefined;
    }

    if (!facility && facilityId) {
      facility = (await this.facilityRepository.findOne({ where: { id: facilityId } })) ?? undefined;
    }

    // Get permissions for all user's roles
    let permissions: string[] = [];
    if (roleIds.length > 0) {
      const rolePermissions = await this.rolePermissionRepository.find({
        where: { roleId: In(roleIds) },
        relations: ['permission'],
      });
      permissions = [...new Set(rolePermissions.map((rp) => rp.permission.code))];
    }

    // Get direct user permissions (in addition to role permissions)
    const directPermissions = await this.userPermissionRepository.find({
      where: { userId: user.id },
      relations: ['permission'],
    });
    const directPermissionCodes = directPermissions.map((up) => up.permission.code);
    
    // Combine role permissions + direct permissions (remove duplicates)
    permissions = [...new Set([...permissions, ...directPermissionCodes])];

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Resolve effective tenantId (system admin can log into other tenants)
    const effectiveTenantId = (user.isSystemAdmin && loginDto.tenantId)
      ? loginDto.tenantId
      : user.tenantId;

    // Generate tokens
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      tenantId: effectiveTenantId,
      roles,
      facilityId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // Calculate expiresIn from JWT_EXPIRES_IN config
    const expiresInConfig = this.configService.get<string>('JWT_EXPIRES_IN', '8h');
    const expiresInSeconds = this.parseExpiryToSeconds(expiresInConfig);

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        roles,
        permissions,
        facilityId,
        facility: facility ? {
          id: facility.id,
          name: facility.name,
          type: facility.type,
          location: facility.location,
          contact: facility.contact,
        } : undefined,
      },
    };
  }

  /**
   * Parse JWT expiry string to seconds
   */
  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 28800; // default 8 hours
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 28800;
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get current roles
      const userRoles = await this.userRoleRepository.find({
        where: { userId: user.id },
        relations: ['role', 'facility'],
      });

      const roles = userRoles.map((ur) => ur.role.name);
      const roleIds = userRoles.map((ur) => ur.roleId);
      // Get facility: prefer user_roles.facilityId, fall back to user.facilityId
      const roleFacilityId = userRoles.find(ur => ur.facilityId)?.facilityId;
      const roleFacility = userRoles.find(ur => ur.facility)?.facility;
      const facilityId = roleFacilityId || user.facilityId;
      let facility = roleFacility;
      if (!facility && user.facilityId) {
        facility = (await this.facilityRepository.findOne({ where: { id: user.facilityId } })) ?? undefined;
      }

      // Get permissions for all user's roles
      let permissions: string[] = [];
      if (roleIds.length > 0) {
        const rolePermissions = await this.rolePermissionRepository.find({
          where: { roleId: In(roleIds) },
          relations: ['permission'],
        });
        permissions = [...new Set(rolePermissions.map((rp) => rp.permission.code))];
      }

      // Get direct user permissions (in addition to role permissions)
      const directPermissions = await this.userPermissionRepository.find({
        where: { userId: user.id },
        relations: ['permission'],
      });
      const directPermissionCodes = directPermissions.map((up) => up.permission.code);

      // Combine role permissions + direct permissions (remove duplicates)
      permissions = [...new Set([...permissions, ...directPermissionCodes])];

      const newPayload: JwtPayload = {
        sub: user.id,
        username: user.username,
        email: user.email,
        tenantId: payload.tenantId || user.tenantId,
        roles,
        facilityId,
      };

      const accessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      });

      // Calculate expiresIn from JWT_EXPIRES_IN config
      const expiresInConfig = this.configService.get<string>('JWT_EXPIRES_IN', '8h');
      const expiresInSeconds = this.parseExpiryToSeconds(expiresInConfig);

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: expiresInSeconds,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          roles,
          permissions,
          facilityId,
          facility: facility ? {
            id: facility.id,
            name: facility.name,
            type: facility.type,
            location: facility.location,
            contact: facility.contact,
          } : undefined,
        },
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Validate that passwordHash exists
    if (!user.passwordHash || !user.passwordHash.startsWith('$2')) {
      throw new BadRequestException('Cannot change password - invalid password hash in database');
    }

    let isCurrentPasswordValid: boolean;
    try {
      isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    } catch (error) {
      this.logger.error(`Password change validation error for user ${userId}: ${(error as Error).message}`);
      throw error;
    }

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Validate new password against policy
    await this.validatePasswordPolicy(dto.newPassword, userId);

    // Check password history
    await this.checkPasswordHistory(userId, dto.newPassword);

    const saltRounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    const newHash = await bcrypt.hash(dto.newPassword, saltRounds);

    // Save old password to history
    await this.passwordHistoryRepository.save({
      userId,
      passwordHash: user.passwordHash,
      changedAt: new Date(),
    });

    user.passwordHash = newHash;
    await this.userRepository.save(user);
  }

  async validatePasswordPolicy(password: string, userId?: string, facilityId?: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Get applicable policy
    const policy = await this.getPasswordPolicy(facilityId);
    
    if (!policy) {
      // Default validation if no policy exists
      if (password.length < 8) errors.push('Password must be at least 8 characters');
      return { valid: errors.length === 0, errors };
    }

    // Length check
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters`);
    }
    if (password.length > policy.maxLength) {
      errors.push(`Password must be at most ${policy.maxLength} characters`);
    }

    // Character requirements
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (policy.requireSpecialChars) {
      const specialChars = policy.allowedSpecialChars || '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const regex = new RegExp(`[${specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`);
      if (!regex.test(password)) {
        errors.push('Password must contain at least one special character');
      }
    }

    // Common password check
    if (policy.commonPasswordsBlacklist && policy.commonPasswordsBlacklist.includes(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a stronger password');
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('. '));
    }

    return { valid: true, errors: [] };
  }

  async checkPasswordHistory(userId: string, newPassword: string): Promise<void> {
    const policy = await this.getPasswordPolicy();
    if (!policy || policy.passwordHistoryCount === 0) return;

    const history = await this.passwordHistoryRepository.find({
      where: { userId },
      order: { changedAt: 'DESC' },
      take: policy.passwordHistoryCount,
    });

    for (const entry of history) {
      // Skip invalid password hashes in history
      if (!entry.passwordHash || !entry.passwordHash.startsWith('$2')) {
        this.logger.warn(`Skipping invalid password history entry for user ${userId}`);
        continue;
      }
      const matches = await bcrypt.compare(newPassword, entry.passwordHash);
      if (matches) {
        throw new BadRequestException(
          `Password was used recently. Please choose a different password.`
        );
      }
    }
  }

  async getPasswordPolicy(facilityId?: string): Promise<PasswordPolicy | null> {
    // Try facility-specific policy first
    if (facilityId) {
      const facilityPolicy = await this.passwordPolicyRepository.findOne({
        where: { facilityId, isActive: true },
      });
      if (facilityPolicy) return facilityPolicy;
    }

    // Fall back to default policy
    return this.passwordPolicyRepository.findOne({
      where: { isDefault: true, isActive: true },
    });
  }

  async createPasswordPolicy(data: Partial<PasswordPolicy>): Promise<PasswordPolicy> {
    const policy = this.passwordPolicyRepository.create({
      ...data,
      isActive: true,
    });
    return this.passwordPolicyRepository.save(policy);
  }

  async getPasswordPolicies(facilityId?: string): Promise<PasswordPolicy[]> {
    const where: any = { isActive: true };
    if (facilityId) where.facilityId = facilityId;
    return this.passwordPolicyRepository.find({ where });
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userRoles = await this.userRoleRepository.find({
      where: { userId: user.id },
      relations: ['role', 'facility'],
    });

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt,
      roles: userRoles.map((ur) => ({
        role: ur.role.name,
        facility: ur.facility?.name,
      })),
    };
  }

  async setupMfa(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const speakeasy = require('speakeasy');
    const issuer = this.configService.get<string>('MFA_ISSUER', 'Glide-HIMS');
    const secret = speakeasy.generateSecret({
      name: `${issuer}:${user.username}`,
      issuer,
      length: 32,
    });

    // Store the secret temporarily (not yet enabled)
    user.mfaSecret = secret.base32;
    await this.userRepository.save(user);

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    };
  }

  async verifyAndEnableMfa(userId: string, code: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.mfaSecret) {
      throw new BadRequestException('MFA setup not initiated. Call /auth/mfa/setup first.');
    }

    const speakeasy = require('speakeasy');
    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid MFA code. Please try again.');
    }

    user.mfaEnabled = true;
    await this.userRepository.save(user);

    return { message: 'MFA enabled successfully' };
  }

  async disableMfa(userId: string, password: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    // Require password confirmation to disable MFA
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password');
    }

    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    await this.userRepository.save(user);

    return { message: 'MFA disabled successfully' };
  }
}
