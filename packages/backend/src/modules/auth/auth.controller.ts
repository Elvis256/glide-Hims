import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  HttpException,
  UseGuards,
  Req,
  Res,
  Query,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import {
  LoginDto,
  RefreshTokenDto,
  AuthResponseDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { Auth, AuthWithPermissions } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { AuditLogService } from '../../common/interceptors/audit-log.service';

interface AuthenticatedRequest extends Request {
  user?: { id: string; tenantId?: string; facilityId?: string; roles?: string[]; permissions?: string[]; isSystemAdmin?: boolean; };
}


@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly rateLimitGuard: RateLimitGuard,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.isProduction = configService.get('NODE_ENV') === 'production';
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
  ) {
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
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || undefined;
    try {
      const result = await this.authService.login(loginDto, ip, userAgent);
      // Reset rate limit on successful login (per-(ip, user) bucket)
      await this.rateLimitGuard.resetAttempts(ip, loginDto.username);
      // Audit: login success
      this.auditLogService
        .log({
          userId: result.user?.id,
          tenantId: result.user?.tenantId,
          action: 'LOGIN_SUCCESS',
          entityType: 'auth',
          entityId: result.user?.id,
          ipAddress: ip,
          userAgent,
          actorType: result.user?.isSystemAdmin ? 'system_admin' : 'tenant_user',
          requestMethod: 'POST',
          requestUrl: '/api/v1/auth/login',
          statusCode: 200,
          attemptedIdentifier: loginDto.username,
        })
        .catch(() => undefined);
      // Set httpOnly cookies so frontend never touches tokens
      this.setAuthCookies(res, result.accessToken, result.refreshToken, result.expiresIn);
      // Return user info and expiry only — tokens are in httpOnly cookies, not in response body
      return {
        ...result,
        accessToken: undefined,
        refreshToken: undefined,
      } as any as AuthResponseDto;
    } catch (err) {
      const status = err instanceof HttpException ? err.getStatus() : 500;
      const message = err instanceof Error ? err.message : 'Login failed';
      this.auditLogService
        .log({
          action: 'LOGIN_FAILED',
          entityType: 'auth',
          ipAddress: ip,
          userAgent,
          actorType: 'tenant_user',
          requestMethod: 'POST',
          requestUrl: '/api/v1/auth/login',
          statusCode: status,
          attemptedIdentifier: loginDto.username,
          errorMessage: (message || '').slice(0, 1000),
          tenantId: loginDto.tenantId,
        })
        .catch(() => undefined);
      throw err;
    }
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    // Prefer cookie-based refresh token, fall back to body for backward compat
    const token = req.cookies?.refreshToken || dto.refreshToken;
    const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString();
    const userAgent = req.headers['user-agent'];
    try {
      const result = await this.authService.refreshToken(token, ipAddress, userAgent);
      this.auditLogService
        .log({
          userId: result.user?.id,
          tenantId: result.user?.tenantId,
          action: 'TOKEN_REFRESHED',
          entityType: 'auth',
          entityId: result.user?.id,
          ipAddress,
          userAgent: userAgent as string | undefined,
          actorType: result.user?.isSystemAdmin ? 'system_admin' : 'tenant_user',
          requestMethod: 'POST',
          requestUrl: '/api/v1/auth/refresh',
          statusCode: 200,
        })
        .catch(() => undefined);
      this.setAuthCookies(res, result.accessToken, result.refreshToken, result.expiresIn);
      // Redact tokens from response body — they're delivered via httpOnly cookies
      const { accessToken: _a, refreshToken: _r, ...safeResult } = result;
      return safeResult as AuthResponseDto;
    } catch (err) {
      const status = err instanceof HttpException ? err.getStatus() : 500;
      const message = err instanceof Error ? err.message : 'Refresh failed';
      this.auditLogService
        .log({
          action: 'TOKEN_REFRESH_FAILED',
          entityType: 'auth',
          ipAddress,
          userAgent: userAgent as string | undefined,
          actorType: 'tenant_user',
          requestMethod: 'POST',
          requestUrl: '/api/v1/auth/refresh',
          statusCode: status,
          errorMessage: (message || '').slice(0, 1000),
        })
        .catch(() => undefined);
      throw err;
    }
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
  async getMe(@CurrentUser('id') userId: string, @Req() req: AuthenticatedRequest) {
    const me = await this.authService.getMe(userId);
    const u = req.user as any || {};
    return {
      ...me,
      impersonating: !!u.impersonating,
      originalTenantId: u.originalTenantId ?? null,
      activeTenantId: u.tenantId ?? null,
    };
  }

  @Post('impersonate')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'System admin: start impersonating a tenant' })
  async startImpersonation(
    @Body() body: { tenantId: string; reason?: string },
    @CurrentUser('id') userId: string,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '';
    const ua = req.get('user-agent') || '';
    const result = await this.authService.impersonateTenant(
      userId,
      body.tenantId,
      body.reason,
      ip,
      ua,
    );
    this.setAuthCookies(res, result.accessToken, result.refreshToken, result.expiresIn);
    return result;
  }

  @Post('end-impersonation')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'System admin: end an active tenant impersonation' })
  async endImpersonation(
    @CurrentUser('id') userId: string,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '';
    const ua = req.get('user-agent') || '';
    const u = req.user || {};
    const result = await this.authService.endImpersonation(userId, u, ip, ua);
    this.setAuthCookies(res, result.accessToken, result.refreshToken, result.expiresIn);
    return result;
  }

  @Patch('profile')
  @Auth()
  @ApiOperation({ summary: 'Update current user profile (self-service)' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    const user = await this.authService.updateProfile(userId, dto);
    return {
      message: 'Profile updated successfully',
      data: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        address: user.address,
        emergencyContactName: user.emergencyContactName,
        emergencyContactPhone: user.emergencyContactPhone,
      },
    };
  }

  @Get('login-history')
  @Auth()
  @ApiOperation({ summary: 'Get own login history' })
  @ApiResponse({ status: 200, description: 'Login history' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of records to return (default 50)',
  })
  async getLoginHistory(@CurrentUser('id') userId: string, @Query('limit') limit?: string) {
    const parsed = parseInt(String(limit ?? ''), 10);
    const safeLimit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 50;
    const history = await this.authService.getLoginHistory(userId, safeLimit);
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
  async verifyMfa(@CurrentUser('id') userId: string, @Body('code') code: string) {
    return this.authService.verifyAndEnableMfa(userId, code);
  }

  @Post('mfa/disable')
  @Auth()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable MFA for current user' })
  @ApiResponse({ status: 200, description: 'MFA disabled successfully' })
  async disableMfa(@CurrentUser('id') userId: string, @Body('password') password: string) {
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
  async revokeSession(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
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

  // ─── Admin: tenant-wide session management ──────────────────────────────

  @Get('admin/sessions')
  @AuthWithPermissions('users.read')
  @ApiOperation({ summary: 'List all active sessions in tenant (admin)' })
  async listAllSessions(@CurrentUser() user: any) {
    const sessions = await this.sessionService.getAllTenantSessions(user.tenantId);
    return { data: sessions };
  }

  @Delete('admin/sessions/:id')
  @AuthWithPermissions('users.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force-revoke any session in tenant (admin)' })
  async adminRevokeSession(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    await this.sessionService.adminRevokeSession(id, user.tenantId);
    return { message: 'Session revoked' };
  }

  @Delete('admin/users/:userId/sessions')
  @AuthWithPermissions('users.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all sessions for a specific user (force logout)' })
  async adminRevokeUserSessions(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: any,
  ) {
    await this.sessionService.adminRevokeUserSessions(userId, user.tenantId);
    return { message: 'All sessions revoked for user' };
  }

  // ─── Admin: rate-limit / IP block management ──────────────────────────────

  @Get('admin/rate-limit/blocked')
  @Auth()
  @ApiOperation({ summary: 'List currently rate-limited IPs and accounts (system admin)' })
  async listBlocked(@CurrentUser() user: any) {
    if (!user?.isSystemAdmin) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    const blocked = await this.rateLimitGuard.listBlocked();
    return { data: blocked };
  }

  @Delete('admin/rate-limit/blocked/:ip')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually unblock an IP (and optionally a specific username)' })
  @ApiQuery({ name: 'username', required: false })
  async unblock(
    @Param('ip') ip: string,
    @Query('username') username: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (!user?.isSystemAdmin) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    const result = await this.rateLimitGuard.unblockIp(ip, username);
    return { message: 'Unblocked', ip, username: username || null, ...result };
  }

  @Post('enter-tenant')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'System admin: enter a tenant organization context' })
  @ApiResponse({
    status: 200,
    description: 'Tenant context entered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Not a system admin or no access grant' })
  async enterTenant(
    @Body('tenantId', ParseUUIDPipe) tenantId: string,
    @CurrentUser() user: any,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || undefined;
    const result = await this.authService.enterTenant(user.id, tenantId, ip, userAgent);
    this.setAuthCookies(res, result.accessToken, result.refreshToken, result.expiresIn);
    return {
      ...result,
      accessToken: undefined,
      refreshToken: undefined,
    } as any as AuthResponseDto;
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
    @CurrentUser('tenantId') callerTenantId: string,
    @Param('userId') userId: string,
  ) {
    return this.authService.unlockAccount(userId, adminUserId, callerTenantId);
  }

  @Get('admin/lockout-status/:userId')
  @Auth('Administrator')
  @ApiOperation({ summary: 'Admin: Get account lockout status' })
  @ApiParam({ name: 'userId', description: 'ID of the user to check' })
  @ApiResponse({ status: 200, description: 'Account lockout status' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async getAccountLockoutStatus(
    @CurrentUser('tenantId') callerTenantId: string,
    @Param('userId') userId: string,
  ) {
    return this.authService.getAccountLockoutStatus(userId, callerTenantId);
  }

  @Post('admin/unblock-ip')
  @Auth('Administrator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: Unblock a rate-limited IP address' })
  @ApiResponse({ status: 200, description: 'IP unblocked successfully' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async unblockIp(@CurrentUser('id') adminUserId: string, @Body('ip') ip: string) {
    await this.rateLimitGuard.unblockIp(ip);
    return { message: `IP ${ip} has been unblocked` };
  }
}
