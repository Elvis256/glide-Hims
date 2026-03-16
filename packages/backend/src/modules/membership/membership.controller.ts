import {
  Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MembershipService } from './membership.service';
import { CreateMembershipSchemeDto, UpdateMembershipSchemeDto, CreatePatientMembershipDto, UpdatePatientMembershipDto } from './membership.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('Membership')
@ApiBearerAuth()
@Controller('membership')
export class MembershipController {
  constructor(private readonly service: MembershipService) {}

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

  @Patch('memberships/:id')
  @AuthWithPermissions('membership.update')
  @ApiOperation({ summary: 'Update patient membership' })
  updateMembership(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePatientMembershipDto, @Request() req: any) {
    return this.service.updateMembership(id, dto, req.user?.tenantId);
  }
}
