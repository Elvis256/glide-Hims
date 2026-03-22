import {
  Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe, Request, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MembershipService } from './membership.service';
import { CreateMembershipSchemeDto, UpdateMembershipSchemeDto, CreatePatientMembershipDto, UpdatePatientMembershipDto, RenewMembershipDto } from './membership.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('Membership')
@ApiBearerAuth()
@Controller('membership')
export class MembershipController {
  constructor(private readonly service: MembershipService) {}

  // ============ PLANS (frontend uses /plans, aliased to /schemes) ============
  @Post('plans')
  @AuthWithPermissions('membership.create')
  @ApiOperation({ summary: 'Create membership plan/scheme' })
  createPlan(@Body() dto: CreateMembershipSchemeDto, @Request() req: any) {
    return this.service.createScheme(dto, req.user?.tenantId);
  }

  @Get('plans')
  @AuthWithPermissions('membership.read')
  @ApiOperation({ summary: 'List all membership plans/schemes' })
  findAllPlans(@Query('facilityId') facilityId?: string, @Request() req?: any) {
    return this.service.findAllSchemes(facilityId, req?.user?.tenantId);
  }

  @Get('plans/:id')
  @AuthWithPermissions('membership.read')
  @ApiOperation({ summary: 'Get membership plan/scheme by ID' })
  findPlan(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.findScheme(id, req.user?.tenantId);
  }

  @Patch('plans/:id')
  @AuthWithPermissions('membership.update')
  @ApiOperation({ summary: 'Update membership plan/scheme' })
  updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMembershipSchemeDto, @Request() req: any) {
    return this.service.updateScheme(id, dto, req.user?.tenantId);
  }

  @Patch('plans/:id/toggle')
  @AuthWithPermissions('membership.update')
  @ApiOperation({ summary: 'Toggle membership plan active status' })
  async togglePlan(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const scheme = await this.service.findScheme(id, req.user?.tenantId);
    if (!scheme) throw new NotFoundException(`Plan ${id} not found`);
    return this.service.updateScheme(id, { isActive: !scheme.isActive } as any, req.user?.tenantId);
  }

  // ============ SCHEMES (original routes kept for backward compatibility) ============
  @Post('schemes')
  @AuthWithPermissions('membership.create')
  @ApiOperation({ summary: 'Create membership scheme' })
  createScheme(@Body() dto: CreateMembershipSchemeDto, @Request() req: any) {
    return this.service.createScheme(dto, req.user?.tenantId);
  }

  @Get('schemes')
  @AuthWithPermissions('membership.read')
  @ApiOperation({ summary: 'List all membership schemes' })
  findAllSchemes(@Query('facilityId') facilityId?: string, @Request() req?: any) {
    return this.service.findAllSchemes(facilityId, req?.user?.tenantId);
  }

  @Get('schemes/:id')
  @AuthWithPermissions('membership.read')
  @ApiOperation({ summary: 'Get membership scheme by ID' })
  findScheme(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.findScheme(id, req.user?.tenantId);
  }

  @Patch('schemes/:id')
  @AuthWithPermissions('membership.update')
  @ApiOperation({ summary: 'Update membership scheme' })
  updateScheme(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMembershipSchemeDto, @Request() req: any) {
    return this.service.updateScheme(id, dto, req.user?.tenantId);
  }

  // ============ MEMBERSHIPS (list all, create, cancel, renew) ============
  @Get('memberships')
  @AuthWithPermissions('membership.read')
  @ApiOperation({ summary: 'List all memberships' })
  async findAllMemberships(@Query('planId') planId?: string, @Query('status') status?: string, @Request() req?: any) {
    return this.service.findAllMemberships(planId, status, req?.user?.tenantId);
  }

  @Post('memberships')
  @AuthWithPermissions('membership.create')
  @ApiOperation({ summary: 'Create patient membership' })
  createMembershipAlias(@Body() dto: CreatePatientMembershipDto, @Request() req: any) {
    return this.service.createMembership(dto, req.user?.tenantId);
  }

  @Patch('memberships/:id')
  @AuthWithPermissions('membership.update')
  @ApiOperation({ summary: 'Update patient membership' })
  updateMembership(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePatientMembershipDto, @Request() req: any) {
    return this.service.updateMembership(id, dto, req.user?.tenantId);
  }

  @Post('memberships/:id/cancel')
  @AuthWithPermissions('membership.update')
  @ApiOperation({ summary: 'Cancel patient membership' })
  async cancelMembership(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.updateMembership(id, { status: 'cancelled' } as any, req.user?.tenantId);
  }

  @Post('memberships/:id/renew')
  @AuthWithPermissions('membership.update')
  @ApiOperation({ summary: 'Renew patient membership' })
  async renewMembership(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RenewMembershipDto, @Request() req: any) {
    return this.service.updateMembership(id, { endDate: dto.endDate, status: 'active' } as any, req.user?.tenantId);
  }

  // ============ PATIENTS ============
  @Post('patients')
  @AuthWithPermissions('membership.create')
  @ApiOperation({ summary: 'Assign membership to patient' })
  createMembership(@Body() dto: CreatePatientMembershipDto, @Request() req: any) {
    return this.service.createMembership(dto, req.user?.tenantId);
  }

  @Get('patients/:patientId')
  @AuthWithPermissions('membership.read')
  @ApiOperation({ summary: 'Get patient memberships' })
  findPatientMemberships(@Param('patientId', ParseUUIDPipe) patientId: string, @Request() req: any) {
    return this.service.findPatientMemberships(patientId, req.user?.tenantId);
  }

  @Get('patients/:patientId/active')
  @AuthWithPermissions('membership.read')
  @ApiOperation({ summary: 'Get active membership for patient' })
  findActiveMembership(@Param('patientId', ParseUUIDPipe) patientId: string, @Request() req: any) {
    return this.service.findActiveMembership(patientId, req.user?.tenantId);
  }

  @Get('patients/:patientId/discount')
  @AuthWithPermissions('membership.read')
  @ApiOperation({ summary: 'Get patient discount percentage' })
  getPatientDiscount(@Param('patientId', ParseUUIDPipe) patientId: string, @Request() req: any) {
    return this.service.getPatientDiscount(patientId, req.user?.tenantId);
  }
}
