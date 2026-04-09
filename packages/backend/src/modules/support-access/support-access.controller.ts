import { Controller, Post, Delete, Get, Body, Param, ParseUUIDPipe, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Max, Min } from 'class-validator';
import { SupportAccessService } from './support-access.service';
import { SupportAccessTier } from '../../database/entities/support-access-grant.entity';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

class GrantSupportAccessDto {
  @IsUUID()
  grantedToId: string;

  @IsInt()
  @Min(1)
  @Max(3)
  accessTier: SupportAccessTier;

  @IsInt()
  @Min(1)
  @Max(72)
  durationHours: number;

  @IsString()
  reason: string;
}

@ApiTags('support-access')
@Controller('support-access')
export class SupportAccessController {
  constructor(private readonly supportAccessService: SupportAccessService) {}

  @Post('grant')
  @AuthWithPermissions('admin.settings.manage')
  @ApiOperation({ summary: 'Grant time-limited support access to a system admin' })
  async grantAccess(@Body() dto: GrantSupportAccessDto, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.supportAccessService.grantAccess({
      ...dto,
      tenantId,
      grantedById: req.user.id,
    });
  }

  @Delete('revoke/:id')
  @AuthWithPermissions('admin.settings.manage')
  @ApiOperation({ summary: 'Revoke a support access grant' })
  async revokeAccess(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.supportAccessService.revokeAccess(id, req.user.id);
    return { message: 'Access revoked' };
  }

  @Get('tenant-grants')
  @AuthWithPermissions('admin.settings.manage')
  @ApiOperation({ summary: 'List all support access grants for this tenant' })
  async listTenantGrants(@Request() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.supportAccessService.listGrantsForTenant(tenantId);
  }

  @Get('my-grants')
  @ApiOperation({ summary: 'List active support access grants for the current system admin' })
  async listMyGrants(@Request() req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    return this.supportAccessService.listActiveGrantsForUser(req.user.id);
  }
}
