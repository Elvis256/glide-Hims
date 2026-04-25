import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MdmService } from './mdm.service';
import { MasterDataVersionQueryDto, ApproveVersionDto, CreateApprovalRuleDto } from './dto/mdm.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MasterDataEntityType } from '../../database/entities/master-data-version.entity';

@ApiTags('mdm')
@Controller('mdm')
export class MdmController {
  constructor(private readonly mdmService: MdmService) {}

  @Get('versions')
  @AuthWithPermissions('mdm.read')
  @ApiOperation({ summary: 'Get version history' })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'entityType', required: false, enum: MasterDataEntityType })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  async getVersionHistory(@Query() query: MasterDataVersionQueryDto, @Request() req: any) {
    return this.mdmService.getVersionHistory(query, req.user?.tenantId);
  }

  @Get('versions/:id')
  @AuthWithPermissions('mdm.read')
  @ApiOperation({ summary: 'Get version by ID' })
  async getVersion(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.mdmService.getVersion(id, req.user?.tenantId);
  }

  @Get('entity/:entityType/:entityId/versions')
  @AuthWithPermissions('mdm.read')
  @ApiOperation({ summary: 'Get all versions for entity' })
  async getEntityVersions(
    @Param('entityType') entityType: MasterDataEntityType,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Request() req: any,
  ) {
    return this.mdmService.getEntityVersions(entityType, entityId, req.user?.tenantId);
  }

  @Get('pending-approvals')
  @AuthWithPermissions('mdm.approve')
  @ApiOperation({ summary: 'Get pending approvals' })
  @ApiQuery({ name: 'facilityId', required: false })
  async getPendingApprovals(@Query('facilityId') facilityId?: string, @Request() req?: any) {
    return this.mdmService.getPendingApprovals(facilityId, req?.user?.tenantId);
  }

  @Put('versions/:id/approve')
  @AuthWithPermissions('mdm.approve')
  @ApiOperation({ summary: 'Approve version' })
  async approveVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: ApproveVersionDto,
    @Request() req: any,
  ) {
    const version = await this.mdmService.approveVersion(id, user.id, dto, req.user?.tenantId);
    return { message: 'Version approved', data: version };
  }

  @Put('versions/:id/reject')
  @AuthWithPermissions('mdm.approve')
  @ApiOperation({ summary: 'Reject version' })
  async rejectVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    const version = await this.mdmService.rejectVersion(id, user.id, reason, req.user?.tenantId);
    return { message: 'Version rejected', data: version };
  }

  @Get('compare/:versionId1/:versionId2')
  @AuthWithPermissions('mdm.read')
  @ApiOperation({ summary: 'Compare two versions' })
  async compareVersions(
    @Param('versionId1', ParseUUIDPipe) versionId1: string,
    @Param('versionId2', ParseUUIDPipe) versionId2: string,
    @Request() req: any,
  ) {
    return this.mdmService.compareVersions(versionId1, versionId2, req.user?.tenantId);
  }

  @Get('statistics')
  @AuthWithPermissions('mdm.read')
  @ApiOperation({ summary: 'Get change statistics' })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'days', required: false })
  async getChangeStatistics(
    @Query('facilityId') facilityId?: string,
    @Query('days') days?: number,
    @Request() req?: any,
  ) {
    return this.mdmService.getChangeStatistics(facilityId, days || 30, req?.user?.tenantId);
  }

  // Approval Rules
  @Post('approval-rules')
  @AuthWithPermissions('mdm.create')
  @ApiOperation({ summary: 'Create approval rule' })
  async createApprovalRule(@Body() dto: CreateApprovalRuleDto, @Request() req: any) {
    const rule = await this.mdmService.createApprovalRule(dto, req.user?.tenantId);
    return { message: 'Approval rule created', data: rule };
  }

  @Get('approval-rules')
  @AuthWithPermissions('mdm.read')
  @ApiOperation({ summary: 'Get approval rules' })
  @ApiQuery({ name: 'facilityId', required: false })
  async getApprovalRules(@Query('facilityId') facilityId?: string, @Request() req?: any) {
    return this.mdmService.getApprovalRules(facilityId, req?.user?.tenantId);
  }

  @Put('approval-rules/:id')
  @AuthWithPermissions('mdm.update')
  @ApiOperation({ summary: 'Update approval rule' })
  async updateApprovalRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateApprovalRuleDto>,
    @Request() req: any,
  ) {
    const rule = await this.mdmService.updateApprovalRule(id, dto, req.user?.tenantId);
    return { message: 'Approval rule updated', data: rule };
  }
}
