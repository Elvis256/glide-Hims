import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Max, Min } from 'class-validator';
import { SupportAccessService } from './support-access.service';
import { SupportAccessTier } from '../../database/entities/support-access-grant.entity';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import {
  CreateSupportAccessRequestDto,
  DenySupportAccessRequestDto,
} from './dto/support-access-request.dto';

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

  // ─── Support Access Request Flow ─────────────────────────────────────

  @Post('request')
  @AuthWithPermissions('admin.settings.manage')
  @ApiOperation({ summary: 'Request support access from system admins' })
  async requestAccess(@Body() dto: CreateSupportAccessRequestDto, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.supportAccessService.createRequest({
      tenantId,
      requestedById: req.user.id,
      requestedTier: dto.requestedTier,
      requestedDurationHours: dto.requestedDurationHours,
      reason: dto.reason,
    });
  }

  @Get('requests')
  @AuthWithPermissions('admin.settings.manage')
  @ApiOperation({ summary: 'List support access requests for this tenant' })
  async listRequests(@Request() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.supportAccessService.listRequestsForTenant(tenantId);
  }

  @Get('requests/pending')
  @ApiOperation({ summary: 'List all pending support access requests (system admin)' })
  async listPendingRequests(@Request() req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    return this.supportAccessService.listPendingRequests();
  }

  @Post('requests/:id/approve')
  @ApiOperation({ summary: 'Approve a support access request (system admin)' })
  async approveRequest(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    return this.supportAccessService.approveRequest(id, req.user.id);
  }

  @Post('requests/:id/deny')
  @ApiOperation({ summary: 'Deny a support access request (system admin)' })
  async denyRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DenySupportAccessRequestDto,
    @Request() req: any,
  ) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    return this.supportAccessService.denyRequest(id, req.user.id, dto.reviewNotes);
  }
}
