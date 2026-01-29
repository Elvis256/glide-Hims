import { Controller, Get, Post, Put, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
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
  async getVersionHistory(@Query() query: MasterDataVersionQueryDto) {
    return this.mdmService.getVersionHistory(query);
  }

  @Get('versions/:id')
  @AuthWithPermissions('mdm.read')
  @ApiOperation({ summary: 'Get version by ID' })
  async getVersion(@Param('id', ParseUUIDPipe) id: string) {
    return this.mdmService.getVersion(id);
  }

  @Get('entity/:entityType/:entityId/versions')
  @AuthWithPermissions('mdm.read')
  @ApiOperation({ summary: 'Get all versions for entity' })
  async getEntityVersions(
    @Param('entityType') entityType: MasterDataEntityType,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.mdmService.getEntityVersions(entityType, entityId);
  }

  @Get('pending-approvals')
  @AuthWithPermissions('mdm.approve')
  @ApiOperation({ summary: 'Get pending approvals' })
  @ApiQuery({ name: 'facilityId', required: false })
  async getPendingApprovals(@Query('facilityId') facilityId?: string) {
    return this.mdmService.getPendingApprovals(facilityId);
  }

  @Put('versions/:id/approve')
  @AuthWithPermissions('mdm.approve')
  @ApiOperation({ summary: 'Approve version' })
  async approveVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: ApproveVersionDto,
  ) {
    const version = await this.mdmService.approveVersion(id, user.id, dto);
    return { message: 'Version approved', data: version };
  }

  @Put('versions/:id/reject')
  @AuthWithPermissions('mdm.approve')
  @ApiOperation({ summary: 'Reject version' })
  async rejectVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body('reason') reason: string,
  ) {
    const version = await this.mdmService.rejectVersion(id, user.id, reason);
    return { message: 'Version rejected', data: version };
  }

  @Get('compare/:versionId1/:versionId2')
  @AuthWithPermissions('mdm.read')
  @ApiOperation({ summary: 'Compare two versions' })
  async compareVersions(
    @Param('versionId1', ParseUUIDPipe) versionId1: string,
    @Param('versionId2', ParseUUIDPipe) versionId2: string,
  ) {
    return this.mdmService.compareVersions(versionId1, versionId2);
  }

  @Get('statistics')
  @AuthWithPermissions('mdm.read')
  @ApiOperation({ summary: 'Get change statistics' })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'days', required: false })
  async getChangeStatistics(
    @Query('facilityId') facilityId?: string,
    @Query('days') days?: number,
  ) {
    return this.mdmService.getChangeStatistics(facilityId, days || 30);
  }

  // Approval Rules
  @Post('approval-rules')
  @AuthWithPermissions('mdm.create')
  @ApiOperation({ summary: 'Create approval rule' })
  async createApprovalRule(@Body() dto: CreateApprovalRuleDto) {
    const rule = await this.mdmService.createApprovalRule(dto);
    return { message: 'Approval rule created', data: rule };
  }

  @Get('approval-rules')
  @AuthWithPermissions('mdm.read')
  @ApiOperation({ summary: 'Get approval rules' })
  @ApiQuery({ name: 'facilityId', required: false })
  async getApprovalRules(@Query('facilityId') facilityId?: string) {
    return this.mdmService.getApprovalRules(facilityId);
  }

  @Put('approval-rules/:id')
  @AuthWithPermissions('mdm.update')
  @ApiOperation({ summary: 'Update approval rule' })
  async updateApprovalRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateApprovalRuleDto>,
  ) {
    const rule = await this.mdmService.updateApprovalRule(id, dto);
    return { message: 'Approval rule updated', data: rule };
  }
}
