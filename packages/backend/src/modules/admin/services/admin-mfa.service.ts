import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../database/entities/user.entity';
import * as OTPAuth from 'otpauth';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';

export interface MFASetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MFAVerifyResponse {
  success: boolean;
  message: string;
}

@Injectable()
export class AdminMFAService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Generate a new TOTP secret and QR code for 2FA setup
   * Returns secret, QR code, and backup codes
   */
  async generateMFASecret(adminId: string): Promise<MFASetupResponse> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId, isSystemAdmin: true },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    if (admin.mfaEnabled) {
      throw new BadRequestException('2FA is already enabled for this admin. Disable it first.');
    }

    // Generate TOTP secret (base32 encoded random bytes)
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'Glide-HIMS',
      label: `Glide-HIMS Admin (${admin.email})`,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret
    });

    // Generate QR code for authenticator app
    const qrCode = await qrcode.toDataURL(secret.toString());

    // Generate 10 backup codes (8 alphanumeric characters each)
    const backupCodes = this.generateBackupCodes(10);

    return {
      secret: secret.toString(),
      qrCode,
      backupCodes,
    };
  }

  /**
   * Verify the TOTP code and enable 2FA for admin
   * Store encrypted secret and hashed backup codes
   */
  async verifyAndEnableMFA(
    adminId: string,
    totpCode: string,
    backupCodes: string[],
  ): Promise<MFAVerifyResponse> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId, isSystemAdmin: true },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    if (admin.mfaEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    // Verify the TOTP code before enabling
    if (!this.verifyTOTPCode(admin.mfaSecret!, totpCode)) {
      throw new UnauthorizedException('Invalid TOTP code. Please try again.');
    }

    // Hash and store backup codes (they can only be used once)
    const hashedCodes = backupCodes.map((code) => ({
      code: this.hashBackupCode(code),
      used: false,
    }));

    // Update user with MFA enabled and backup codes
    admin.mfaEnabled = true;
    admin.mfaSecret = admin.mfaSecret; // Already set from generation step
    admin.backupCodes = hashedCodes;

    await this.userRepository.save(admin);

    return {
      success: true,
      message: '2FA enabled successfully. Store your backup codes in a safe place.',
    };
  }

  /**
   * Verify a TOTP code during admin login
   */
  async verifyMFALogin(adminId: string, totpCode: string): Promise<boolean> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId, isSystemAdmin: true },
    });

    if (!admin || !admin.mfaEnabled) {
      throw new BadRequestException('2FA not enabled for this admin');
    }

    // Try TOTP code first
    if (this.verifyTOTPCode(admin.mfaSecret!, totpCode)) {
      return true;
    }

    // Try backup codes (can only use once)
    if (admin.backupCodes && Array.isArray(admin.backupCodes)) {
      const backupCodesData = admin.backupCodes as Array<{
        code: string;
        used: boolean;
      }>;

      for (let i = 0; i < backupCodesData.length; i++) {
        if (!backupCodesData[i].used && this.verifyBackupCode(totpCode, backupCodesData[i].code)) {
          // Mark backup code as used
          backupCodesData[i].used = true;
          admin.backupCodes = backupCodesData;
          await this.userRepository.save(admin);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Disable 2FA for an admin
   */
  async disableMFA(adminId: string, password?: string): Promise<MFAVerifyResponse> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId, isSystemAdmin: true },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    if (!admin.mfaEnabled) {
      throw new BadRequestException('2FA is not enabled for this admin');
    }

    admin.mfaEnabled = false;
    admin.mfaSecret = undefined;
    admin.backupCodes = undefined;

    await this.userRepository.save(admin);

    return {
      success: true,
      message: '2FA has been disabled',
    };
  }

  /**
   * Get unused backup codes count
   */
  async getUnusedBackupCodesCount(adminId: string): Promise<number> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId, isSystemAdmin: true },
    });

    if (!admin || !admin.backupCodes || !Array.isArray(admin.backupCodes)) {
      return 0;
    }

    return (admin.backupCodes as Array<{ code: string; used: boolean }>).filter((bc) => !bc.used)
      .length;
  }

  /**
   * Generate new backup codes (replaces old ones)
   */
  async regenerateBackupCodes(adminId: string): Promise<string[]> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId, isSystemAdmin: true },
    });

    if (!admin || !admin.mfaEnabled) {
      throw new BadRequestException('2FA not enabled for this admin');
    }

    const backupCodes = this.generateBackupCodes(10);
    const hashedCodes = backupCodes.map((code) => ({
      code: this.hashBackupCode(code),
      used: false,
    }));

    admin.backupCodes = hashedCodes;
    await this.userRepository.save(admin);

    return backupCodes;
  }

  /**
   * Generate random backup codes
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }

  /**
   * Hash a backup code using SHA256
   */
  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Verify a backup code
   */
  private verifyBackupCode(provided: string, hashed: string): boolean {
    const hash = this.hashBackupCode(provided);
    return hash === hashed;
  }

  /**
   * Verify TOTP code (6 digits, 30-second window)
   */
  private verifyTOTPCode(secret: string, code: string): boolean {
    if (!secret || !code) return false;

    try {
      const totp = new OTPAuth.TOTP({
        secret,
      });

      // Allow for time drift: current and ±1 window (60 seconds total)
      return totp.validate({ token: code, window: 1 }) !== null;
    } catch (error) {
      console.error('TOTP verification error:', error);
      return false;
    }
  }

  /**
   * Get list of all admins with 2FA status
   */
  async getAdminsMFAStatus(): Promise<
    Array<{
      id: string;
      fullName: string;
      email: string;
      mfaEnabled: boolean;
      backupCodesRemaining: number;
    }>
  > {
    const admins = await this.userRepository.find({
      where: { isSystemAdmin: true },
      select: ['id', 'fullName', 'email', 'mfaEnabled', 'backupCodes'],
    });

    return admins.map((admin) => ({
      id: admin.id,
      fullName: admin.fullName,
      email: admin.email,
      mfaEnabled: admin.mfaEnabled,
      backupCodesRemaining: admin.backupCodes
        ? (admin.backupCodes as Array<{ code: string; used: boolean }>).filter((bc) => !bc.used)
            .length
        : 0,
    }));
  }

  /**
   * Force enable 2FA for an admin (system admin only action)
   * This bypasses TOTP verification but still creates backup codes
   */
  async forceEnableMFA(adminId: string): Promise<{ backupCodes: string[] }> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId, isSystemAdmin: true },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    if (admin.mfaEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    // Generate new secret if not already set
    if (!admin.mfaSecret) {
      const secret = new OTPAuth.Secret({ size: 20 });
      admin.mfaSecret = secret.base32;
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(10);
    const hashedCodes = backupCodes.map((code) => ({
      code: this.hashBackupCode(code),
      used: false,
    }));

    admin.mfaEnabled = true;
    admin.backupCodes = hashedCodes;

    await this.userRepository.save(admin);

    return { backupCodes };
  }
}
