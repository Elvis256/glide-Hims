import { Controller, Post, Body, Get, Patch, HttpCode, HttpStatus, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, AuthResponseDto, ChangePasswordDto, UpdateProfileDto } from './dto/auth.dto';
import { Auth } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RateLimitGuard } from './guards/rate-limit.guard';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimitGuard: RateLimitGuard,
  ) {}

  @Post('login')
  @Public()
  @UseGuards(RateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || undefined;
    const result = await this.authService.login(loginDto, ip, userAgent);
    // Reset rate limit on successful login
    this.rateLimitGuard.resetAttempts(ip);
    return result;
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('change-password')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(userId, dto);
    return { message: 'Password changed successfully' };
  }

  @Get('profile')
  @Auth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Get('me')
  @Auth()
  @ApiOperation({ summary: 'Get current user info with accessible modules' })
  @ApiResponse({ status: 200, description: 'User info with permissions and accessible modules' })
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @Patch('profile')
  @Auth()
  @ApiOperation({ summary: 'Update current user profile (self-service)' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.authService.updateProfile(userId, dto);
    return { message: 'Profile updated successfully', data: { id: user.id, email: user.email, phone: user.phone, address: user.address, emergencyContactName: user.emergencyContactName, emergencyContactPhone: user.emergencyContactPhone } };
  }

  @Get('login-history')
  @Auth()
  @ApiOperation({ summary: 'Get own login history' })
  @ApiResponse({ status: 200, description: 'Login history' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of records to return (default 50)' })
  async getLoginHistory(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
  ) {
    const history = await this.authService.getLoginHistory(userId, limit || 50);
    return { data: history };
  }

  @Post('mfa/setup')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate MFA secret for setup' })
  @ApiResponse({ status: 200, description: 'MFA setup data with QR code URL' })
  async setupMfa(@CurrentUser('id') userId: string) {
    return this.authService.setupMfa(userId);
  }

  @Post('mfa/verify')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify MFA code and enable MFA' })
  @ApiResponse({ status: 200, description: 'MFA enabled successfully' })
  async verifyMfa(
    @CurrentUser('id') userId: string,
    @Body('code') code: string,
  ) {
    return this.authService.verifyAndEnableMfa(userId, code);
  }

  @Post('mfa/disable')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable MFA for current user' })
  @ApiResponse({ status: 200, description: 'MFA disabled successfully' })
  async disableMfa(
    @CurrentUser('id') userId: string,
    @Body('password') password: string,
  ) {
    return this.authService.disableMfa(userId, password);
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }
}
