import {
  Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe,
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
  createScheme(@Body() dto: CreateMembershipSchemeDto) {
    return this.service.createScheme(dto);
  }

  @Get('schemes')
  @AuthWithPermissions('membership.read')
  @ApiOperation({ summary: 'List all membership schemes' })
  findAllSchemes(@Query('facilityId') facilityId?: string) {
    return this.service.findAllSchemes(facilityId);
  }

  @Get('schemes/:id')
  @AuthWithPermissions('membership.read')
  @ApiOperation({ summary: 'Get membership scheme by ID' })
  findScheme(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findScheme(id);
  }

  @Patch('schemes/:id')
  @AuthWithPermissions('membership.update')
  @ApiOperation({ summary: 'Update membership scheme' })
  updateScheme(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMembershipSchemeDto) {
    return this.service.updateScheme(id, dto);
  }

  @Post('patients')
  @AuthWithPermissions('membership.create')
  @ApiOperation({ summary: 'Assign membership to patient' })
  createMembership(@Body() dto: CreatePatientMembershipDto) {
    return this.service.createMembership(dto);
  }

  @Get('patients/:patientId')
  @AuthWithPermissions('membership.read')
  @ApiOperation({ summary: 'Get patient memberships' })
  findPatientMemberships(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.service.findPatientMemberships(patientId);
  }

  @Get('patients/:patientId/active')
  @AuthWithPermissions('membership.read')
  @ApiOperation({ summary: 'Get active membership for patient' })
  findActiveMembership(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.service.findActiveMembership(patientId);
  }

  @Get('patients/:patientId/discount')
  @AuthWithPermissions('membership.read')
  @ApiOperation({ summary: 'Get patient discount percentage' })
  getPatientDiscount(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.service.getPatientDiscount(patientId);
  }

  @Patch('memberships/:id')
  @AuthWithPermissions('membership.update')
  @ApiOperation({ summary: 'Update patient membership' })
  updateMembership(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePatientMembershipDto) {
    return this.service.updateMembership(id, dto);
  }
}
