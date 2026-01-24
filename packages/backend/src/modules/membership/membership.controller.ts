import {
  Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MembershipService } from './membership.service';
import { CreateMembershipSchemeDto, UpdateMembershipSchemeDto, CreatePatientMembershipDto, UpdatePatientMembershipDto } from './membership.dto';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Membership')
@ApiBearerAuth()
@Controller('membership')
export class MembershipController {
  constructor(private readonly service: MembershipService) {}

  @Post('schemes')
  @Auth('Admin', 'Super Admin')
  @ApiOperation({ summary: 'Create membership scheme' })
  createScheme(@Body() dto: CreateMembershipSchemeDto) {
    return this.service.createScheme(dto);
  }

  @Get('schemes')
  @Auth()
  @ApiOperation({ summary: 'List all membership schemes' })
  findAllSchemes(@Query('facilityId') facilityId?: string) {
    return this.service.findAllSchemes(facilityId);
  }

  @Get('schemes/:id')
  @Auth()
  @ApiOperation({ summary: 'Get membership scheme by ID' })
  findScheme(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findScheme(id);
  }

  @Patch('schemes/:id')
  @Auth('Admin', 'Super Admin')
  @ApiOperation({ summary: 'Update membership scheme' })
  updateScheme(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMembershipSchemeDto) {
    return this.service.updateScheme(id, dto);
  }

  @Post('patients')
  @Auth()
  @ApiOperation({ summary: 'Assign membership to patient' })
  createMembership(@Body() dto: CreatePatientMembershipDto) {
    return this.service.createMembership(dto);
  }

  @Get('patients/:patientId')
  @Auth()
  @ApiOperation({ summary: 'Get patient memberships' })
  findPatientMemberships(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.service.findPatientMemberships(patientId);
  }

  @Get('patients/:patientId/active')
  @Auth()
  @ApiOperation({ summary: 'Get active membership for patient' })
  findActiveMembership(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.service.findActiveMembership(patientId);
  }

  @Get('patients/:patientId/discount')
  @Auth()
  @ApiOperation({ summary: 'Get patient discount percentage' })
  getPatientDiscount(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.service.getPatientDiscount(patientId);
  }

  @Patch('memberships/:id')
  @Auth()
  @ApiOperation({ summary: 'Update patient membership' })
  updateMembership(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePatientMembershipDto) {
    return this.service.updateMembership(id, dto);
  }
}
