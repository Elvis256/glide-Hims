import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DHIS2Service } from './dhis2.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('integrations')
@Controller('integrations/dhis2')
export class DHIS2Controller {
  constructor(private readonly dhis2Service: DHIS2Service) {}

  @Get('config')
  @AuthWithPermissions('settings.manage')
  @ApiOperation({ summary: 'Get DHIS2 integration configuration (password masked)' })
  async getConfig(@CurrentUser() user: any) {
    return this.dhis2Service.getConfigMasked(user.tenantId);
  }

  @Post('config')
  @AuthWithPermissions('settings.manage')
  @ApiOperation({ summary: 'Save DHIS2 integration configuration' })
  async saveConfig(
    @CurrentUser() user: any,
    @Body() body: {
      baseUrl?: string;
      username?: string;
      password?: string;
      orgUnitId?: string;
      enabled?: boolean;
    },
  ) {
    await this.dhis2Service.saveConfig(user.tenantId, body);
    return { message: 'DHIS2 configuration saved' };
  }

  @Post('test-connection')
  @AuthWithPermissions('settings.manage')
  @ApiOperation({ summary: 'Test DHIS2 connection with current credentials' })
  async testConnection(@CurrentUser() user: any) {
    return this.dhis2Service.testConnection(user.tenantId);
  }

  @Post('push-hmis105')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Push HMIS 105 report data to DHIS2' })
  async pushHMIS105(
    @CurrentUser() user: any,
    @Body() body: { month: number; year: number; facilityId?: string },
  ) {
    const facilityId = body.facilityId || user.facilityId;
    return this.dhis2Service.pushHMIS105(user.tenantId, facilityId, body.month, body.year);
  }

  @Get('org-units')
  @AuthWithPermissions('settings.manage')
  @ApiOperation({ summary: 'List DHIS2 organisation units' })
  async getOrgUnits(@CurrentUser() user: any) {
    const orgUnits = await this.dhis2Service.getOrgUnits(user.tenantId);
    return { data: orgUnits, count: orgUnits.length };
  }
}
