import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import {
  AdminMFAService,
  MFASetupResponse,
  MFAVerifyResponse,
} from '../services/admin-mfa.service';
import {
  InitiateMFASetupDto,
  VerifyMFASetupDto,
  VerifyMFALoginDto,
  DisableMFADto,
  RegenerateBackupCodesDto,
  ForceEnableMFADto,
  AdminMFAStatusDto,
} from '../dto/admin-mfa.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../../database/entities/user.entity';

@ApiTags('Admin - 2FA / MFA')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin/mfa')
export class AdminMFAController {
  constructor(private mfaService: AdminMFAService) {}

  /**
   * Step 1: Initiate 2FA setup
   * Returns QR code and secret to scan with authenticator app
   */
  @Post('setup/initiate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate 2FA setup for current admin',
    description:
      'Generates a TOTP secret and QR code. Admin must scan with authenticator app (Google Authenticator, Authy, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'MFA setup initiated',
    schema: {
      example: {
        secret: 'JBSWY3DPEBLW64TMMQ======',
        qrCode: 'data:image/png;base64,...',
        backupCodes: ['ABCD-1234', 'EFGH-5678', '...'],
      },
    },
  })
  async initiateMFASetup(
    @CurrentUser() user: User,
    @Body() _dto: InitiateMFASetupDto,
  ): Promise<MFASetupResponse> {
    if (!user.isSystemAdmin) {
      throw new BadRequestException('Only system admins can enable 2FA');
    }

    return this.mfaService.generateMFASecret(user.id);
  }

  /**
   * Step 2: Verify TOTP code and enable 2FA
   * Must be called within a short time of step 1
   */
  @Post('setup/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify TOTP code and enable 2FA',
    description: 'Admin provides the 6-digit code from authenticator app to complete setup',
  })
  @ApiResponse({
    status: 200,
    description: '2FA enabled successfully',
    schema: {
      example: {
        success: true,
        message: '2FA enabled successfully. Store your backup codes in a safe place.',
      },
    },
  })
  async verifyMFASetup(
    @CurrentUser() user: User,
    @Body() dto: VerifyMFASetupDto,
  ): Promise<MFAVerifyResponse> {
    if (!user.isSystemAdmin) {
      throw new BadRequestException('Only system admins can enable 2FA');
    }

    return this.mfaService.verifyAndEnableMFA(user.id, dto.totpCode, dto.backupCodes);
  }

  /**
   * Verify MFA code during login
   * Called by auth service when 2FA is enabled
   */
  @Post('verify-login/:adminId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify MFA code during login',
    description: 'Admin provides TOTP code to complete login when 2FA is enabled',
  })
  async verifyMFALogin(
    @Param('adminId') adminId: string,
    @Body() dto: VerifyMFALoginDto,
  ): Promise<{ verified: boolean }> {
    const verified = await this.mfaService.verifyMFALogin(adminId, dto.code);
    return { verified };
  }

  /**
   * Disable 2FA for current admin
   */
  @Delete('disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disable 2FA for current admin',
    description: 'Requires password confirmation. Clears all backup codes.',
  })
  async disableMFA(
    @CurrentUser() user: User,
    @Body() dto: DisableMFADto,
  ): Promise<MFAVerifyResponse> {
    if (!user.isSystemAdmin) {
      throw new BadRequestException('Only system admins can disable 2FA');
    }

    return this.mfaService.disableMFA(user.id, dto.password);
  }

  /**
   * Get current 2FA status
   */
  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current 2FA status' })
  async getMFAStatus(@CurrentUser() user: User): Promise<{
    mfaEnabled: boolean;
    backupCodesRemaining: number;
  }> {
    if (!user.isSystemAdmin) {
      throw new BadRequestException('Only system admins can check 2FA status');
    }

    const codesRemaining = await this.mfaService.getUnusedBackupCodesCount(user.id);

    return {
      mfaEnabled: user.mfaEnabled,
      backupCodesRemaining: codesRemaining,
    };
  }

  /**
   * Regenerate backup codes
   * Invalidates old codes immediately
   */
  @Post('backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate new backup codes',
    description: 'Old backup codes are invalidated. Store new codes securely.',
  })
  async regenerateBackupCodes(
    @CurrentUser() user: User,
    @Body() _dto: RegenerateBackupCodesDto,
  ): Promise<{ backupCodes: string[] }> {
    if (!user.isSystemAdmin) {
      throw new BadRequestException('Only system admins can regenerate backup codes');
    }

    const codes = await this.mfaService.regenerateBackupCodes(user.id);
    return { backupCodes: codes };
  }

  /**
   * ADMIN ONLY: View all admins' 2FA status
   * Used by lead admin to monitor 2FA compliance
   */
  @Get('all-admins-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN ONLY] View all admins 2FA status',
    description: 'Platform admin can see which admins have 2FA enabled and backup codes remaining',
  })
  async getAllAdminsMFAStatus(@CurrentUser() user: User): Promise<AdminMFAStatusDto[]> {
    if (!user.isSystemAdmin) {
      throw new BadRequestException('Only system admins can view all 2FA statuses');
    }

    return this.mfaService.getAdminsMFAStatus();
  }

  /**
   * ADMIN ONLY: Force enable 2FA for another admin
   * Used when admin loses access or for compliance enforcement
   */
  @Post('force-enable')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[ADMIN ONLY] Force enable 2FA for another admin',
    description:
      'Lead admin can force-enable 2FA for another admin account. Returns backup codes to share.',
  })
  async forceEnableMFA(
    @CurrentUser() user: User,
    @Body() dto: ForceEnableMFADto,
  ): Promise<{ backupCodes: string[] }> {
    if (!user.isSystemAdmin) {
      throw new BadRequestException('Only system admins can force enable 2FA');
    }

    return this.mfaService.forceEnableMFA(dto.adminId);
  }

  /**
   * ADMIN ONLY: Disable 2FA for another admin
   * Used for account recovery or incident response
   */
  @Delete('force-disable/:adminId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN ONLY] Force disable 2FA for another admin',
    description: 'Lead admin can force-disable 2FA for recovery purposes. Admin must re-enable.',
  })
  async forceDisableMFA(
    @CurrentUser() user: User,
    @Param('adminId') adminId: string,
  ): Promise<MFAVerifyResponse> {
    if (!user.isSystemAdmin) {
      throw new BadRequestException('Only system admins can force disable 2FA');
    }

    return this.mfaService.disableMFA(adminId);
  }
}
