import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { BiometricsService } from './biometrics.service';
import { RegisterBiometricDto, UpdateStaffCoverageDto, FingerIndex } from './dto/biometric.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@Controller('biometrics')
export class BiometricsController {
  constructor(private readonly biometricsService: BiometricsService) {}

  /**
   * Register a fingerprint for a user
   */
  @Post('register')
  @AuthWithPermissions('users.update')
  async register(@Body() dto: RegisterBiometricDto) {
    const biometric = await this.biometricsService.register(dto);
    return {
      message: 'Fingerprint registered successfully',
      data: {
        id: biometric.id,
        fingerIndex: biometric.fingerIndex,
        qualityScore: biometric.qualityScore,
        registeredAt: biometric.registeredAt,
      },
    };
  }

  /**
   * Check if a user has registered fingerprints
   */
  @Get('check/:userId')
  @AuthWithPermissions('users.read')
  async checkEnrollment(@Param('userId') userId: string) {
    const result = await this.biometricsService.checkEnrollment(userId);
    return { data: result };
  }

  /**
   * Get fingerprint templates for verification (client-side matching)
   */
  @Get('templates/:userId')
  @AuthWithPermissions('users.read')
  async getTemplates(@Param('userId') userId: string) {
    const result = await this.biometricsService.getTemplatesForVerification(userId);
    return { data: result };
  }

  /**
   * Get all registered fingerprints for a user (metadata only)
   */
  @Get('user/:userId')
  @AuthWithPermissions('users.read')
  async getUserBiometrics(@Param('userId') userId: string) {
    const biometrics = await this.biometricsService.getUserBiometrics(userId);
    return { data: biometrics };
  }

  /**
   * Record a successful verification
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @AuthWithPermissions('users.read')
  async recordVerification(@Body() body: { userId: string; fingerIndex: FingerIndex }) {
    await this.biometricsService.recordVerification(body.userId, body.fingerIndex);
    return { message: 'Verification recorded' };
  }

  /**
   * Delete a fingerprint
   */
  @Delete(':userId/:fingerIndex')
  @AuthWithPermissions('users.update')
  async deleteFingerprint(
    @Param('userId') userId: string,
    @Param('fingerIndex') fingerIndex: FingerIndex,
  ) {
    await this.biometricsService.deleteFingerprint(userId, fingerIndex);
    return { message: 'Fingerprint deleted successfully' };
  }

  /**
   * Check staff insurance coverage
   */
  @Get('staff-coverage/:userId')
  @AuthWithPermissions('users.read')
  async checkStaffCoverage(@Param('userId') userId: string) {
    const result = await this.biometricsService.checkStaffCoverage(userId);
    return { data: result };
  }

  /**
   * Update staff insurance coverage
   */
  @Post('staff-coverage/:userId')
  @AuthWithPermissions('users.update')
  async updateStaffCoverage(
    @Param('userId') userId: string,
    @Body() dto: UpdateStaffCoverageDto,
  ) {
    await this.biometricsService.updateStaffCoverage(userId, dto);
    return { message: 'Staff coverage updated successfully' };
  }
}
