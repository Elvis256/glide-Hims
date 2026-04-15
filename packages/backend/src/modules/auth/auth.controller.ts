import { Controller, Post, Body, Get, Patch, Delete, HttpCode, HttpStatus, UseGuards, Req, Res, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { LoginDto, RefreshTokenDto, AuthResponseDto, ChangePasswordDto, UpdateProfileDto } from './dto/auth.dto';
import { Auth } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RateLimitGuard } from './guards/rate-limit.guard';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly rateLimitGuard: RateLimitGuard,
    private readonly configService: ConfigService,
  ) {
    this.isProduction = configService.get('NODE_ENV') === 'production';
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string, expiresIn: number) {
    const cookieOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict' as const,
    };
    res.cookie('accessToken', accessToken, {
      ...cookieOptions,
      maxAge: expiresIn * 1000,
    });
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      path: '/api/v1/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private clearAuthCookies(res: Response) {
    const cookieOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict' as const,
    };
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', { ...cookieOptions, path: '/api/v1/auth/refresh' });
  }

  @Post('login')
  @Public()
  @UseGuards(RateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponseDto> {
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || undefined;
    const result = await this.authService.login(loginDto, ip, userAgent);
    // Reset rate limit on successful login
    await this.rateLimitGuard.resetAttempts(ip);
    // Set httpOnly cookies so frontend never touches tokens
    this.setAuthCookies(res, result.accessToken, result.refreshToken, result.expiresIn);
    // Return user info and expiry only — tokens are in httpOnly cookies, not in response body
    return {
      ...result,
      accessToken: undefined,
      refreshToken: undefined,
    } as any as AuthResponseDto;
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body() dto: RefreshTokenDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponseDto> {
    // Prefer cookie-based refresh token, fall back to body for backward compat
    const token = req.cookies?.refreshToken || dto.refreshToken;
    const ipAddress = (req as any).ip || req.headers['x-forwarded-for']?.toString();
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.refreshToken(token, ipAddress, userAgent);
    this.setAuthCookies(res, result.accessToken, result.refreshToken, result.expiresIn);
    return result;
  }

  @Post('change-password')
  @Auth()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
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

  @Post('logout')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear auth cookies' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@CurrentUser('id') userId: string, @Res({ passthrough: true }) res: Response) {
    // Invalidate all outstanding tokens by incrementing tokenVersion
    await this.authService.invalidateUserTokens(userId);
    this.clearAuthCookies(res);
    return { message: 'Logged out successfully' };
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
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate MFA secret for setup' })
  @ApiResponse({ status: 200, description: 'MFA setup data with QR code URL' })
  async setupMfa(@CurrentUser('id') userId: string) {
    return this.authService.setupMfa(userId);
  }

  @Post('mfa/verify')
  @Auth()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
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
  @Throttle({ default: { ttl: 60000, limit: 3 } })
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
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  @Get('sessions')
  @Auth()
  @ApiOperation({ summary: 'List active sessions for current user' })
  @ApiResponse({ status: 200, description: 'Active sessions list' })
  async listSessions(@CurrentUser() user: any) {
    const sessions = await this.sessionService.getUserSessions(user.id, user.tenantId);
    return { data: sessions };
  }

  @Delete('sessions/:id')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiParam({ name: 'id', description: 'Session ID to revoke' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  async revokeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.sessionService.revokeSession(id, userId);
    return { message: 'Session revoked' };
  }

  @Delete('sessions')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all other sessions' })
  @ApiResponse({ status: 200, description: 'All other sessions revoked' })
  async revokeAllSessions(@CurrentUser('id') userId: string) {
    await this.sessionService.revokeAllSessions(userId);
    return { message: 'All other sessions revoked' };
  }

  @Post('admin/unlock/:userId')
  @Auth('Administrator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: Unlock a locked user account' })
  @ApiParam({ name: 'userId', description: 'ID of the user to unlock' })
  @ApiResponse({ status: 200, description: 'Account unlocked successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async unlockAccount(
    @CurrentUser('id') adminUserId: string,
    @Param('userId') userId: string,
  ) {
    return this.authService.unlockAccount(userId, adminUserId);
  }

  @Get('admin/lockout-status/:userId')
  @Auth('Administrator')
  @ApiOperation({ summary: 'Admin: Get account lockout status' })
  @ApiParam({ name: 'userId', description: 'ID of the user to check' })
  @ApiResponse({ status: 200, description: 'Account lockout status' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async getAccountLockoutStatus(
    @Param('userId') userId: string,
  ) {
    return this.authService.getAccountLockoutStatus(userId);
  }

  @Post('admin/unblock-ip')
  @Auth('Administrator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: Unblock a rate-limited IP address' })
  @ApiResponse({ status: 200, description: 'IP unblocked successfully' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async unblockIp(
    @CurrentUser('id') adminUserId: string,
    @Body('ip') ip: string,
  ) {
    await this.rateLimitGuard.unblockIp(ip);
    return { message: `IP ${ip} has been unblocked` };
  }
}
