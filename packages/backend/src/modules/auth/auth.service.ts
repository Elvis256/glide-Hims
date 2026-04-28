import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, In, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as OTPAuth from 'otpauth';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Facility } from '../../database/entities/facility.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { PasswordPolicy, PasswordHistory } from '../../database/entities/password-policy.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { Permission } from '../../database/entities/permission.entity';
import { UserPermission } from '../../database/entities/user-permission.entity';
import { LoginHistory } from '../../database/entities/login-history.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { LoginDto, AuthResponseDto, ChangePasswordDto, UpdateProfileDto } from './dto/auth.dto';
import { RefreshTokenService } from './refresh-token.service';
import { JwtPayload } from './strategies/jwt.strategy';
import { getAccessibleModules } from '../../config/module-registry';
import { isSuperAdmin } from '../../common/constants/roles.constants';
import { getPreset, type FacilityMode } from '../../common/constants/facility-presets.constants';
import { CacheService } from '../cache/cache.service';
import { SessionService } from './session.service';
import { SupportAccessTier } from '../../database/entities/support-access-grant.entity';

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
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
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
    @InjectRepository(LoginHistory)
    private loginHistoryRepository: Repository<LoginHistory>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private cacheService: CacheService,
    private refreshTokenService: RefreshTokenService,
    private sessionService: SessionService,
    private dataSource: DataSource,
  ) {}

  async validateUser(username: string, password: string, tenantId?: string): Promise<User | null> {
    let user: User | null = null;

    if (tenantId) {
      // Tenant-scoped login: find non-system-admin user within the specified tenant
      user = await this.userRepository.findOne({
        where: [
          { username, tenantId, isSystemAdmin: false },
          { email: username, tenantId, isSystemAdmin: false },
        ],
      });

      // If no tenant user found, check for system admin (cross-tenant support access)
      if (!user) {
        user = await this.userRepository.findOne({
          where: [
            { username, isSystemAdmin: true },
            { email: username, isSystemAdmin: true },
          ],
        });
      }
    } else {
      // No tenantId: system admin login — only match system admin users
      user = await this.userRepository.findOne({
        where: [
          { username, isSystemAdmin: true },
          { email: username, isSystemAdmin: true },
        ],
      });

      // Fall back to any matching user (for on-premise single-tenant mode)
      if (!user) {
        user = await this.userRepository.findOne({
          where: [{ username }, { email: username }],
        });
      }
    }

    if (!user) {
      return null;
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account is temporarily locked. Please try again later.');
    }

    // Validate that passwordHash exists and is valid before comparing
    if (!user.passwordHash || !user.passwordHash.startsWith('$2')) {
      this.logger.error(`User ${user.id} has invalid password hash format`);
      return null;
    }

    let isPasswordValid: boolean;
    try {
      isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    } catch (error) {
      this.logger.error(
        `Password validation error for user ${user.id}: ${(error as Error).message}`,
      );
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

  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const deploymentMode = this.configService.get<string>('DEPLOYMENT_MODE', 'on-premise');

    // On-premise: auto-resolve the single tenant if no tenantId provided
    if (!loginDto.tenantId && deploymentMode === 'on-premise') {
      const singleTenant = await this.tenantRepository.findOne({
        where: { status: 'active' },
        order: { createdAt: 'ASC' },
      });
      if (singleTenant) {
        loginDto.tenantId = singleTenant.id;
      }
    }

    let user: User | null;
    try {
      user = await this.validateUser(loginDto.username, loginDto.password, loginDto.tenantId);
    } catch (error) {
      // Record failed login attempt for locked accounts
      if (error instanceof UnauthorizedException) {
        await this.recordLoginHistory(
          undefined,
          ipAddress,
          userAgent,
          false,
          error.message,
          loginDto.tenantId,
        );
      }
      throw error;
    }

    if (!user) {
      await this.recordLoginHistory(
        undefined,
        ipAddress,
        userAgent,
        false,
        'Invalid credentials',
        loginDto.tenantId,
      );
      this.logger.warn(`Login failed for provided credentials`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // FIX #1: System admin login validation — reject non-system-admins on system login
    if (!loginDto.tenantId && deploymentMode === 'multi-tenant' && !user.isSystemAdmin) {
      await this.recordLoginHistory(
        user.id,
        ipAddress,
        userAgent,
        false,
        'Non-system-admin attempted system login',
        undefined,
      );
      this.logger.warn(`System login rejected: user ${user.id} is not a system admin`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Prevent cross-tenant login: non-system-admins must belong to the requested tenant
    if (loginDto.tenantId && user.tenantId !== loginDto.tenantId && !user.isSystemAdmin) {
      await this.recordLoginHistory(
        user.id,
        ipAddress,
        userAgent,
        false,
        'Tenant mismatch',
        loginDto.tenantId,
      );
      this.logger.warn(
        `Cross-tenant login blocked: user ${user.id} (tenant ${user.tenantId}) attempted login to tenant ${loginDto.tenantId}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'active') {
      await this.recordLoginHistory(
        user.id,
        ipAddress,
        userAgent,
        false,
        'Account not active',
        user.tenantId,
      );
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
      const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(user.mfaSecret!),
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      });
      const delta = totp.validate({ token: loginDto.mfaCode!, window: 1 });
      const isValid = delta !== null;
      if (!isValid) {
        // Increment failed login attempts to prevent MFA brute force
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
          user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
          this.logger.warn(
            `Account ${user.id} locked after ${user.failedLoginAttempts} failed MFA attempts`,
          );
        }
        await this.userRepository.save(user);
        await this.recordLoginHistory(
          user.id,
          ipAddress,
          userAgent,
          false,
          'Invalid MFA code',
          user.tenantId,
        );
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
    const roleFacilityId = userRoles.find((ur) => ur.facilityId)?.facilityId;
    const roleFacility = userRoles.find((ur) => ur.facility)?.facility;
    let facilityId = roleFacilityId || user.facilityId;
    let facility = roleFacility;

    // System admin logging into a different tenant: verify support access tier
    if (user.isSystemAdmin && loginDto.tenantId && user.tenantId !== loginDto.tenantId) {
      const tierResult = await this.dataSource.query(
        `SELECT access_tier FROM support_access_grants
         WHERE granted_to_id = $1 AND tenant_id = $2
         AND revoked_at IS NULL AND expires_at > NOW()
         AND deleted_at IS NULL
         LIMIT 1`,
        [user.id, loginDto.tenantId],
      );
      const tier = tierResult.length > 0 ? tierResult[0].access_tier : SupportAccessTier.NONE;
      if (tier === SupportAccessTier.NONE) {
        this.logger.warn(
          `System admin ${user.id} cross-tenant login to ${loginDto.tenantId} blocked — no active support access grant`,
        );
        throw new ForbiddenException(
          'No active support access grant for this organization. Request access from the tenant administrator.',
        );
      }

      const tenantFacility = await this.facilityRepository.findOne({
        where: { tenantId: loginDto.tenantId },
      });
      if (tenantFacility) {
        facilityId = tenantFacility.id;
        facility = tenantFacility;
      }
    } else if (!facility && user.facilityId) {
      facility =
        (await this.facilityRepository.findOne({ where: { id: user.facilityId } })) ?? undefined;
    }

    if (!facility && facilityId) {
      facility =
        (await this.facilityRepository.findOne({ where: { id: facilityId } })) ?? undefined;
    }

    // Get permissions for all user's roles (including inherited from parent roles)
    let permissions: string[] = [];
    if (roleIds.length > 0) {
      // Collect all role IDs including parent roles (inheritance chain)
      const allRoleIds = new Set<string>(roleIds);
      for (const roleId of roleIds) {
        let currentId = roleId;
        const visited = new Set<string>([roleId]);
        for (let depth = 0; depth < 10; depth++) {
          const parentRole = await this.userRoleRepository.manager
            .getRepository('Role')
            .findOne({ where: { id: currentId }, select: ['id', 'parentRoleId'] });
          if (!parentRole?.parentRoleId || visited.has(parentRole.parentRoleId)) break;
          visited.add(parentRole.parentRoleId);
          allRoleIds.add(parentRole.parentRoleId);
          currentId = parentRole.parentRoleId;
        }
      }

      const allRoleIdsArray = [...allRoleIds];
      const rolePermissions = await this.rolePermissionRepository.find({
        where: { roleId: In(allRoleIdsArray) },
        relations: ['permission'],
      });
      permissions = [...new Set(rolePermissions.map((rp) => rp.permission.code))];

      // Also include permissions from permission groups assigned to these roles
      try {
        const groupResults = await this.userRoleRepository.manager.query(
          `
          SELECT DISTINCT p.code FROM permission_groups pg
          JOIN role_permission_groups rpg ON rpg.group_id = pg.id
          JOIN group_permissions gp ON gp.group_id = pg.id
          JOIN permissions p ON p.id = gp.permission_id
          WHERE rpg.role_id = ANY($1)
        `,
          [allRoleIdsArray],
        );
        const groupPermCodes = groupResults.map((r: any) => r.code);
        permissions = [...new Set([...permissions, ...groupPermCodes])];
      } catch {
        // Permission group tables may not exist yet - gracefully skip
      }
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
    const effectiveTenantId =
      user.isSystemAdmin && loginDto.tenantId ? loginDto.tenantId : user.tenantId;

    // Generate tokens
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      tenantId: effectiveTenantId,
      roles,
      facilityId,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { ...payload, jti: crypto.randomUUID() },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );

    // Calculate expiresIn from JWT_EXPIRES_IN config
    const expiresInConfig = this.configService.get<string>('JWT_EXPIRES_IN', '8h');
    const expiresInSeconds = this.parseExpiryToSeconds(expiresInConfig);

    // Record successful login
    await this.recordLoginHistory(user.id, ipAddress, userAgent, true, undefined, user.tenantId);

    // Store refresh token for server-side tracking and revocation
    await this.refreshTokenService.createRefreshToken(
      user.id,
      effectiveTenantId,
      refreshToken,
      ipAddress,
      userAgent,
    );

    // Create server-side session record
    await this.sessionService.createSession(
      user.id,
      effectiveTenantId,
      refreshToken,
      ipAddress,
      userAgent,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds,
      mustChangePassword: user.mustChangePassword || undefined,
      mustEnrollMfa: user.isSystemAdmin && !user.mfaEnabled ? true : undefined,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        roles,
        permissions,
        isSystemAdmin: user.isSystemAdmin || false,
        tenantId: effectiveTenantId,
        facilityId,
        facility: facility
          ? {
              id: facility.id,
              name: facility.name,
              type: facility.type,
              location: facility.location,
              contact: facility.contact,
            }
          : undefined,
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
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 28800;
    }
  }

  async refreshToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    try {
      // Server-side refresh token validation (checks revocation, expiry, reuse)
      const storedToken = await this.refreshTokenService.validateRefreshToken(refreshToken);
      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Verify tokenVersion for token revocation
      if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
        this.logger.warn(
          `Refresh token reuse detected for user ${user.id}. Revoking all sessions.`,
        );
        user.tokenVersion += 1;
        await this.userRepository.save(user);
        await this.refreshTokenService.revokeAllUserTokens(user.id);
        throw new UnauthorizedException('Token has been revoked');
      }

      // Rotate: bump tokenVersion so this refresh token cannot be used again
      user.tokenVersion += 1;
      await this.userRepository.save(user);

      // Get current roles
      const userRoles = await this.userRoleRepository.find({
        where: { userId: user.id },
        relations: ['role', 'facility'],
      });

      const roles = userRoles.map((ur) => ur.role.name);
      const roleIds = userRoles.map((ur) => ur.roleId);
      // Get facility: prefer user_roles.facilityId, fall back to user.facilityId
      const roleFacilityId = userRoles.find((ur) => ur.facilityId)?.facilityId;
      const roleFacility = userRoles.find((ur) => ur.facility)?.facility;
      const facilityId = roleFacilityId || user.facilityId;
      let facility = roleFacility;
      if (!facility && user.facilityId) {
        facility =
          (await this.facilityRepository.findOne({ where: { id: user.facilityId } })) ?? undefined;
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
        tokenVersion: user.tokenVersion,
      };

      const accessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(
        { ...newPayload, jti: crypto.randomUUID() },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        },
      );

      // Rotate server-side refresh token record
      await this.refreshTokenService.rotateRefreshToken(
        refreshToken,
        newRefreshToken,
        ipAddress,
        userAgent,
      );

      // Update session token hash after rotation
      await this.sessionService.updateSessionToken(refreshToken, newRefreshToken);

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
          isSystemAdmin: user.isSystemAdmin || false,
          tenantId: user.tenantId,
          facilityId,
          facility: facility
            ? {
                id: facility.id,
                name: facility.name,
                type: facility.type,
                location: facility.location,
                contact: facility.contact,
              }
            : undefined,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
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
      this.logger.error(
        `Password change validation error for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Validate new password against policy
    await this.validatePasswordPolicy(dto.newPassword, userId);

    // Check password history
    await this.checkPasswordHistory(userId, dto.newPassword);

    const saltRounds = parseInt(this.configService.get('BCRYPT_ROUNDS', '12'), 10) || 12;
    const newHash = await bcrypt.hash(dto.newPassword, saltRounds);

    // Save old password to history
    await this.passwordHistoryRepository.save({
      userId,
      passwordHash: user.passwordHash,
      changedAt: new Date(),
    });

    user.passwordHash = newHash;
    user.mustChangePassword = false;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await this.userRepository.save(user);
  }

  async validatePasswordPolicy(
    password: string,
    userId?: string,
    facilityId?: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
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
    if (
      policy.commonPasswordsBlacklist &&
      policy.commonPasswordsBlacklist.includes(password.toLowerCase())
    ) {
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
          `Password was used recently. Please choose a different password.`,
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

  async updatePasswordPolicy(id: string, data: Partial<PasswordPolicy>): Promise<PasswordPolicy> {
    const policy = await this.passwordPolicyRepository.findOne({ where: { id } });
    if (!policy) throw new BadRequestException('Policy not found');
    Object.assign(policy, data);
    return this.passwordPolicyRepository.save(policy);
  }

  async deletePasswordPolicy(id: string): Promise<void> {
    await this.passwordPolicyRepository.delete(id);
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

  /**
   * Get current user info + accessible modules based on effective permissions.
   * Used by frontend to drive navigation visibility.
   */
  async getMe(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const userRoles = await this.userRoleRepository.find({
      where: { userId: user.id },
      relations: ['role', 'facility'],
    });

    const roles = userRoles.map((ur) => ur.role.name);
    const roleIds = userRoles.map((ur) => ur.roleId);

    // Resolve permissions including inheritance
    let permissions: string[] = [];
    if (roleIds.length > 0) {
      const allRoleIds = new Set<string>(roleIds);
      for (const roleId of roleIds) {
        let currentId = roleId;
        const visited = new Set<string>([roleId]);
        for (let depth = 0; depth < 10; depth++) {
          const parentRole = await this.userRoleRepository.manager
            .getRepository('Role')
            .findOne({ where: { id: currentId }, select: ['id', 'parentRoleId'] });
          if (!parentRole?.parentRoleId || visited.has(parentRole.parentRoleId)) break;
          visited.add(parentRole.parentRoleId);
          allRoleIds.add(parentRole.parentRoleId);
          currentId = parentRole.parentRoleId;
        }
      }

      const rolePermissions = await this.rolePermissionRepository.find({
        where: { roleId: In([...allRoleIds]) },
        relations: ['permission'],
      });
      permissions = [...new Set(rolePermissions.map((rp) => rp.permission.code))];
    }

    // Direct permissions
    const directPermissions = await this.userPermissionRepository.find({
      where: { userId: user.id },
      relations: ['permission'],
    });
    permissions = [
      ...new Set([...permissions, ...directPermissions.map((up) => up.permission.code)]),
    ];

    const superAdmin = isSuperAdmin(roles);

    // Resolve tenant's enabled modules to filter navigation by facility type
    let tenantEnabledModules: string[] | null = null;
    let facilityMode: string | null = null;
    let businessType: string | null = null;
    if (user.tenantId) {
      // Priority 1: Check system_settings for enabled_modules (most reliable)
      const enabledModulesSetting = await this.userRoleRepository.manager.query(
        `SELECT value FROM system_settings WHERE tenant_id = $1 AND key = 'enabled_modules' LIMIT 1`,
        [user.tenantId],
      );
      if (enabledModulesSetting?.length > 0) {
        const val = enabledModulesSetting[0].value;
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        if (Array.isArray(parsed) && parsed.length > 0) {
          tenantEnabledModules = parsed;
        }
      }

      // Priority 2: Check tenant.settings.enabledModules (JSONB column)
      if (!tenantEnabledModules) {
        const tenant = await this.tenantRepository.findOne({ where: { id: user.tenantId } });
        if (tenant?.settings?.enabledModules && Array.isArray(tenant.settings.enabledModules)) {
          tenantEnabledModules = tenant.settings.enabledModules;
        }
      }

      // Priority 3: Derive from facility_mode preset
      if (!tenantEnabledModules) {
        const facilityModeSetting = await this.userRoleRepository.manager.query(
          `SELECT value FROM system_settings WHERE tenant_id = $1 AND key = 'facility_mode' LIMIT 1`,
          [user.tenantId],
        );
        if (facilityModeSetting?.length > 0) {
          const mode =
            typeof facilityModeSetting[0].value === 'string'
              ? facilityModeSetting[0].value.replace(/"/g, '')
              : facilityModeSetting[0].value;
          facilityMode = mode;
          const preset = getPreset(mode as FacilityMode);
          if (preset) {
            tenantEnabledModules = preset.enabledModules;
            businessType = preset.businessType;
          }
        }
      }
    }

    // If we have enabled modules but didn't set facilityMode yet, look it up
    if (!facilityMode && user.tenantId) {
      const fmSetting = await this.userRoleRepository.manager.query(
        `SELECT value FROM system_settings WHERE tenant_id = $1 AND key = 'facility_mode' LIMIT 1`,
        [user.tenantId],
      );
      if (fmSetting?.length > 0) {
        facilityMode =
          typeof fmSetting[0].value === 'string'
            ? fmSetting[0].value.replace(/"/g, '')
            : fmSetting[0].value;
        if (!businessType) {
          const preset = getPreset(facilityMode as FacilityMode);
          if (preset) businessType = preset.businessType;
        }
      }
    }

    const accessibleModules = getAccessibleModules(permissions, superAdmin, tenantEnabledModules);

    // Resolve workflow_mode (simple = single shared queue, departmental = per-dept queues).
    // Defaults to 'simple' so newly registered tenants behave as a clinic until they explicitly opt-in.
    let workflowMode: 'simple' | 'departmental' = 'simple';
    if (user.tenantId) {
      const wfRow = await this.userRoleRepository.manager.query(
        `SELECT value FROM system_settings WHERE tenant_id = $1 AND key = 'workflow_mode' LIMIT 1`,
        [user.tenantId],
      );
      if (wfRow?.length > 0) {
        const raw =
          typeof wfRow[0].value === 'string'
            ? wfRow[0].value.replace(/"/g, '')
            : wfRow[0].value;
        if (raw === 'departmental' || raw === 'simple') workflowMode = raw;
      }
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roles,
      permissions,
      accessibleModules,
      facilityMode,
      businessType,
      workflowMode,
      facilityId: userRoles.find((ur) => ur.facilityId)?.facilityId || user.facilityId,
      tenantId: user.tenantId,
    };
  }

  async setupMfa(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const issuer = this.configService.get<string>('MFA_ISSUER', 'Glide-HIMS');
    const secret = new OTPAuth.Secret({ size: 32 });
    const totp = new OTPAuth.TOTP({
      issuer,
      label: `${issuer}:${user.username}`,
      secret,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    // Store the secret temporarily (not yet enabled)
    user.mfaSecret = secret.base32;
    await this.userRepository.save(user);

    return {
      secret: secret.base32,
      otpauthUrl: totp.toString(),
    };
  }

  async verifyAndEnableMfa(userId: string, code: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.mfaSecret) {
      throw new BadRequestException('MFA setup not initiated. Call /auth/mfa/setup first.');
    }

    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(user.mfaSecret),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });
    const delta = totp.validate({ token: code, window: 1 });
    const isValid = delta !== null;

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

  // ========== Admin Password Reset ==========

  async adminResetPassword(
    targetUserId: string,
    newPassword: string | undefined,
    adminUserId: string,
    callerTenantId?: string,
  ): Promise<{ temporaryPassword: string }> {
    const user = await this.userRepository.findOne({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Cross-tenant isolation — non-system-admins can only reset within their tenant
    if (callerTenantId && user.tenantId !== callerTenantId) {
      throw new ForbiddenException('Cannot reset password for users in another organization');
    }

    // Generate random password if not provided
    const temporaryPassword = newPassword || this.generateRandomPassword(12);

    // Validate password policy
    await this.validatePasswordPolicy(temporaryPassword, targetUserId);

    const saltRounds = parseInt(this.configService.get('BCRYPT_ROUNDS', '12'), 10) || 12;
    const hashedPassword = await bcrypt.hash(temporaryPassword, saltRounds);

    user.passwordHash = hashedPassword;
    user.mustChangePassword = true;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await this.userRepository.save(user);

    // Audit log
    try {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          userId: adminUserId,
          action: 'ADMIN_PASSWORD_RESET',
          entityType: 'User',
          entityId: targetUserId,
          newValue: { targetUserId, mustChangePassword: true },
          tenantId: user.tenantId,
        }),
      );
    } catch (e) {
      this.logger.warn(`Failed to create audit log for admin password reset: ${e.message}`);
    }

    this.logger.log(`Admin ${adminUserId} reset password for user ${targetUserId}`);

    return { temporaryPassword };
  }

  // ========== User Self-Service Profile Update ==========

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if changing
    if (dto.email && dto.email !== user.email) {
      const whereConditions: any[] = user.tenantId
        ? [{ email: dto.email, tenantId: user.tenantId }]
        : [{ email: dto.email }];
      const existing = await this.userRepository.findOne({ where: whereConditions });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
      user.email = dto.email;
    }

    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.address !== undefined) user.address = dto.address;
    if (dto.emergencyContactName !== undefined)
      user.emergencyContactName = dto.emergencyContactName;
    if (dto.emergencyContactPhone !== undefined)
      user.emergencyContactPhone = dto.emergencyContactPhone;

    return this.userRepository.save(user);
  }

  // ========== Login History ==========

  async getLoginHistory(userId: string, limit = 50): Promise<LoginHistory[]> {
    return this.loginHistoryRepository.find({
      where: { userId },
      order: { loginAt: 'DESC' },
      take: limit,
    });
  }

  async getLoginHistoryForUser(targetUserId: string, limit = 50): Promise<LoginHistory[]> {
    const user = await this.userRepository.findOne({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.loginHistoryRepository.find({
      where: { userId: targetUserId },
      order: { loginAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Invalidate all outstanding tokens for a user by incrementing tokenVersion.
   * Called on logout and forced session termination.
   */
  async invalidateUserTokens(userId: string): Promise<void> {
    await this.userRepository.increment({ id: userId }, 'tokenVersion', 1);
    // Bust the JWT validation cache so revocation takes effect immediately
    await this.cacheService.del(`jwt:user:${userId}`);
    // Revoke all server-side refresh tokens
    await this.refreshTokenService.revokeAllUserTokens(userId);
    // Revoke all server-side sessions
    await this.sessionService.revokeAllSessions(userId);
    this.logger.log(`Invalidated tokens for user ${userId}`);
  }

  private async recordLoginHistory(
    userId: string | undefined,
    ipAddress?: string,
    userAgent?: string,
    success = true,
    failureReason?: string,
    tenantId?: string,
  ): Promise<void> {
    try {
      if (!userId && !failureReason) return;
      const record = this.loginHistoryRepository.create({
        userId: userId || null,
        ipAddress,
        userAgent: userAgent?.substring(0, 500),
        success,
        failureReason,
        loginAt: new Date(),
        tenantId,
      });
      await this.loginHistoryRepository.save(record);
    } catch (error) {
      this.logger.warn(`Failed to record login history: ${(error as Error).message}`);
    }
  }

  private generateRandomPassword(length: number): string {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const special = '!@#$%&*';
    const all = uppercase + lowercase + numbers + special;

    // Ensure at least one of each type
    let password = '';
    password += uppercase[crypto.randomInt(uppercase.length)];
    password += lowercase[crypto.randomInt(lowercase.length)];
    password += numbers[crypto.randomInt(numbers.length)];
    password += special[crypto.randomInt(special.length)];

    for (let i = password.length; i < length; i++) {
      password += all[crypto.randomInt(all.length)];
    }

    // Shuffle
    return password
      .split('')
      .sort(() => crypto.randomInt(3) - 1)
      .join('');
  }

  /**
   * Admin: Unlock a locked user account
   */
  async unlockAccount(userId: string, adminUserId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null as any;
    await this.userRepository.save(user);

    this.logger.log(`Account unlocked for user ${userId} by admin ${adminUserId}`);

    return { message: 'Account unlocked successfully' };
  }

  /**
   * Admin: Get account lockout status
   */
  async getAccountLockoutStatus(userId: string): Promise<{
    isLocked: boolean;
    failedAttempts: number;
    lockedUntil: Date | null;
    lockReason?: string;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();
    const isLocked = !!(user.lockedUntil && user.lockedUntil > now);

    return {
      isLocked,
      failedAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil || null,
      lockReason: isLocked ? 'Too many failed login attempts' : undefined,
    };
  }

  /**
   * Allow an authenticated system admin to switch into a target tenant context
   * without re-entering credentials, returning new JWT tokens scoped to that tenant.
   */
  async enterTenant(
    userId: string,
    targetTenantId: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    // Fetch the user and verify system admin status
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.isSystemAdmin) {
      throw new ForbiddenException('Only system administrators can enter another tenant context');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    // If targeting a different tenant, verify support access grant
    let supportAccessTier = SupportAccessTier.FULL_SUPPORT; // own tenant default
    if (user.tenantId !== targetTenantId) {
      const tierResult = await this.dataSource.query(
        `SELECT access_tier FROM support_access_grants
         WHERE granted_to_id = $1 AND tenant_id = $2
         AND revoked_at IS NULL AND expires_at > NOW()
         AND deleted_at IS NULL
         ORDER BY access_tier DESC
         LIMIT 1`,
        [user.id, targetTenantId],
      );
      supportAccessTier =
        tierResult.length > 0 ? tierResult[0].access_tier : SupportAccessTier.NONE;
      if (supportAccessTier === SupportAccessTier.NONE) {
        this.logger.warn(
          `System admin ${user.id} enter-tenant to ${targetTenantId} blocked — no active support access grant`,
        );
        throw new ForbiddenException(
          'No active support access grant for this organization. Request access from the tenant administrator.',
        );
      }
    }

    // Get the target tenant's facility
    const tenantFacility = await this.facilityRepository.findOne({
      where: { tenantId: targetTenantId },
    });
    const facilityId = tenantFacility?.id || user.facilityId;

    // Get user roles
    const userRoles = await this.userRoleRepository.find({
      where: { userId: user.id },
      relations: ['role', 'facility'],
    });
    const roles = userRoles.map((ur) => ur.role.name);
    const roleIds = userRoles.map((ur) => ur.roleId);

    // Get permissions for all user's roles (including inherited from parent roles)
    let permissions: string[] = [];
    if (roleIds.length > 0) {
      const allRoleIds = new Set<string>(roleIds);
      for (const roleId of roleIds) {
        let currentId = roleId;
        const visited = new Set<string>([roleId]);
        for (let depth = 0; depth < 10; depth++) {
          const parentRole = await this.userRoleRepository.manager
            .getRepository('Role')
            .findOne({ where: { id: currentId }, select: ['id', 'parentRoleId'] });
          if (!parentRole?.parentRoleId || visited.has(parentRole.parentRoleId)) break;
          visited.add(parentRole.parentRoleId);
          allRoleIds.add(parentRole.parentRoleId);
          currentId = parentRole.parentRoleId;
        }
      }

      const allRoleIdsArray = [...allRoleIds];
      const rolePermissions = await this.rolePermissionRepository.find({
        where: { roleId: In(allRoleIdsArray) },
        relations: ['permission'],
      });
      permissions = [...new Set(rolePermissions.map((rp) => rp.permission.code))];

      try {
        const groupResults = await this.userRoleRepository.manager.query(
          `
          SELECT DISTINCT p.code FROM permission_groups pg
          JOIN role_permission_groups rpg ON rpg.group_id = pg.id
          JOIN group_permissions gp ON gp.group_id = pg.id
          JOIN permissions p ON p.id = gp.permission_id
          WHERE rpg.role_id = ANY($1)
        `,
          [allRoleIdsArray],
        );
        const groupPermCodes = groupResults.map((r: any) => r.code);
        permissions = [...new Set([...permissions, ...groupPermCodes])];
      } catch {
        // Permission group tables may not exist yet - gracefully skip
      }
    }

    // Get direct user permissions
    const directPermissions = await this.userPermissionRepository.find({
      where: { userId: user.id },
      relations: ['permission'],
    });
    const directPermissionCodes = directPermissions.map((up) => up.permission.code);
    permissions = [...new Set([...permissions, ...directPermissionCodes])];

    // Generate tokens scoped to the target tenant
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      tenantId: targetTenantId,
      roles,
      facilityId,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { ...payload, jti: crypto.randomUUID() },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );

    const expiresInConfig = this.configService.get<string>('JWT_EXPIRES_IN', '8h');
    const expiresInSeconds = this.parseExpiryToSeconds(expiresInConfig);

    // Record audit trail
    await this.recordLoginHistory(user.id, ipAddress, userAgent, true, undefined, targetTenantId);

    // Store refresh token and session
    await this.refreshTokenService.createRefreshToken(
      user.id,
      targetTenantId,
      refreshToken,
      ipAddress,
      userAgent,
    );
    await this.sessionService.createSession(
      user.id,
      targetTenantId,
      refreshToken,
      ipAddress,
      userAgent,
    );

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
        isSystemAdmin: user.isSystemAdmin || false,
        supportAccessTier,
        tenantId: targetTenantId,
        facilityId,
        facility: tenantFacility
          ? {
              id: tenantFacility.id,
              name: tenantFacility.name,
              type: tenantFacility.type,
              location: tenantFacility.location,
              contact: tenantFacility.contact,
            }
          : undefined,
      },
    };
  }
}
