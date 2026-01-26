import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { PasswordPolicy, PasswordHistory } from '../../database/entities/password-policy.entity';
import { LoginDto, AuthResponseDto, ChangePasswordDto } from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(PasswordPolicy)
    private passwordPolicyRepository: Repository<PasswordPolicy>,
    @InjectRepository(PasswordHistory)
    private passwordHistoryRepository: Repository<PasswordHistory>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: [{ username }, { email: username }],
    });

    if (!user) {
      return null;
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked. Please try again later.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

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
    const user = await this.validateUser(loginDto.username, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    // TODO: Validate MFA if enabled
    if (user.mfaEnabled && !loginDto.mfaCode) {
      throw new BadRequestException('MFA code required');
    }

    // Get user roles
    const userRoles = await this.userRoleRepository.find({
      where: { userId: user.id },
      relations: ['role'],
    });

    const roles = userRoles.map((ur) => ur.role.name);
    // Get facility from first user role (users typically belong to one facility)
    const facilityId = userRoles.length > 0 ? userRoles[0].facilityId : undefined;

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Generate tokens
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles,
      facilityId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        roles,
      },
    };
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
        relations: ['role'],
      });

      const roles = userRoles.map((ur) => ur.role.name);

      const newPayload: JwtPayload = {
        sub: user.id,
        username: user.username,
        email: user.email,
        roles,
      };

      const accessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      });

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          roles,
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

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);

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
}
