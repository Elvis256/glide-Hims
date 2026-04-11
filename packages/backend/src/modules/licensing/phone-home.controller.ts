import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PhoneHomeService, PhoneHomePayload } from './phone-home.service';
import { GlobalJwtAuthGuard } from '../auth/guards/global-jwt.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Phone Home')
@Controller('phone-home')
export class PhoneHomeController {
  constructor(private readonly phoneHomeService: PhoneHomeService) {}

  /**
   * Receive heartbeat from on-premise installation
   */
  @Post()
  @Public()
  @ApiOperation({ summary: 'Receive phone home heartbeat' })
  async receiveHeartbeat(
    @Body() payload: PhoneHomePayload,
    @Req() req: Request,
  ) {
    const ipAddress = 
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      'unknown';

    return this.phoneHomeService.receiveHeartbeat(payload, ipAddress);
  }

  /**
   * Get phone home records for a license (admin)
   */
  @Get('records/:licenseId')
  @UseGuards(GlobalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get phone home records for a license' })
  async getRecords(
    @Param('licenseId') licenseId: string,
    @Query('limit') limit?: number,
  ) {
    return this.phoneHomeService.getRecords(licenseId, limit);
  }

  /**
   * Get license dashboard (admin)
   */
  @Get('dashboard')
  @UseGuards(GlobalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get license management dashboard' })
  async getDashboard() {
    return this.phoneHomeService.getDashboard();
  }

  /**
   * Get system info (for debugging)
   */
  @Get('system-info')
  @UseGuards(GlobalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get system information' })
  async getSystemInfo() {
    return {
      hardwareId: this.phoneHomeService.getHardwareId(),
      systemInfo: this.phoneHomeService.getSystemInfo(),
    };
  }
}
