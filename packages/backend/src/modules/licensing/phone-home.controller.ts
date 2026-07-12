import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request as ExpressRequest } from 'express';
import { PhoneHomeService, PhoneHomePayload } from './phone-home.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { withSystemContext } from '../../common/context/tenant-context';

@ApiTags('Phone Home')
@Controller('phone-home')
export class PhoneHomeController {
  constructor(private readonly phoneHomeService: PhoneHomeService) {}

  private requireSystemAdmin(req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
  }

  /**
   * Receive heartbeat from on-premise installation
   */
  @Post()
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Receive phone home heartbeat' })
  async receiveHeartbeat(@Body() payload: PhoneHomePayload, @Req() req: ExpressRequest) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      'unknown';

    // Trusted server-to-server flow (HMAC-validated license key inside):
    // runs in system context so RLS on licenses/deployments doesn't block it.
    return withSystemContext(() => this.phoneHomeService.receiveHeartbeat(payload, ipAddress));
  }

  /**
   * Get phone home records for a license (system admin only)
   */
  @Get('records/:licenseId')
  @Auth('Administrator')
  @ApiOperation({ summary: 'Get phone home records for a license' })
  async getRecords(
    @Param('licenseId', ParseUUIDPipe) licenseId: string,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    this.requireSystemAdmin(req);
    return this.phoneHomeService.getRecords(licenseId, limit);
  }

  /**
   * Get license dashboard (system admin only)
   */
  @Get('dashboard')
  @Auth('Administrator')
  @ApiOperation({ summary: 'Get license management dashboard' })
  async getDashboard(@Request() req: any) {
    this.requireSystemAdmin(req);
    return this.phoneHomeService.getDashboard();
  }

  /**
   * Get system info (system admin only)
   */
  @Get('system-info')
  @Auth('Administrator')
  @ApiOperation({ summary: 'Get system information' })
  async getSystemInfo(@Request() req: any) {
    this.requireSystemAdmin(req);
    return {
      hardwareId: this.phoneHomeService.getHardwareId(),
      systemInfo: this.phoneHomeService.getSystemInfo(),
    };
  }
}
