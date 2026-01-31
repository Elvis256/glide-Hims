import { Controller, Get, Post, Put, Body, Param, Query, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { EmergencyService } from './emergency.service';
import {
  CreateEmergencyCaseDto, TriageDto, StartTreatmentDto,
  DischargeEmergencyDto, AdmitFromEmergencyDto, EmergencyQueryDto
} from './dto/emergency.dto';

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('Emergency')
@ApiBearerAuth()
@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  // ========== CASE MANAGEMENT ==========
  @Post('cases')
  @AuthWithPermissions('emergency.create')
  @ApiOperation({ summary: 'Register new emergency case (rapid registration)' })
  registerCase(@Body() dto: CreateEmergencyCaseDto, @Request() req: any) {
    return this.emergencyService.registerCase(dto, dto.facilityId, req.user.id);
  }

  @Get('cases')
  @AuthWithPermissions('emergency.read')
  @ApiOperation({ summary: 'Get emergency cases' })
  getCases(@Query() query: EmergencyQueryDto) {
    return this.emergencyService.getCases(query);
  }

  @Get('cases/:id')
  @AuthWithPermissions('emergency.read')
  @ApiOperation({ summary: 'Get emergency case by ID' })
  getCase(@Param('id') id: string) {
    return this.emergencyService.getCase(id);
  }

  // ========== TRIAGE WORKFLOW ==========
  @Put('cases/:id/triage')
  @AuthWithPermissions('emergency.update')
  @ApiOperation({ summary: 'Triage an emergency case' })
  triageCase(@Param('id') id: string, @Body() dto: TriageDto, @Request() req: any) {
    return this.emergencyService.triageCase(id, dto, req.user.id);
  }

  @Put('cases/:id/start-treatment')
  @AuthWithPermissions('emergency.update')
  @ApiOperation({ summary: 'Start treatment for a triaged case' })
  startTreatment(@Param('id') id: string, @Body() dto: StartTreatmentDto, @Request() req: any) {
    return this.emergencyService.startTreatment(id, dto, req.user.id);
  }

  // ========== DISPOSITION ==========
  @Put('cases/:id/discharge')
  @AuthWithPermissions('emergency.update')
  @ApiOperation({ summary: 'Discharge emergency case' })
  dischargeCase(@Param('id') id: string, @Body() dto: DischargeEmergencyDto) {
    return this.emergencyService.dischargeCase(id, dto);
  }

  @Put('cases/:id/admit')
  @AuthWithPermissions('emergency.update')
  @ApiOperation({ summary: 'Admit emergency case to IPD' })
  admitToWard(@Param('id') id: string, @Body() dto: AdmitFromEmergencyDto) {
    return this.emergencyService.admitToWard(id, dto);
  }

  // ========== QUEUES ==========
  @Get('queue/triage')
  @AuthWithPermissions('emergency.read')
  @ApiOperation({ summary: 'Get patients waiting for triage' })
  @ApiQuery({ name: 'facilityId', required: true, description: 'Facility UUID' })
  getTriageQueue(@Query('facilityId') facilityId: string) {
    if (!facilityId || !UUID_REGEX.test(facilityId)) {
      throw new BadRequestException('Valid facilityId is required');
    }
    return this.emergencyService.getTriageQueue(facilityId);
  }

  @Get('queue/treatment')
  @AuthWithPermissions('emergency.read')
  @ApiOperation({ summary: 'Get triaged patients waiting for treatment (sorted by priority)' })
  @ApiQuery({ name: 'facilityId', required: true, description: 'Facility UUID' })
  getTreatmentQueue(@Query('facilityId') facilityId: string) {
    if (!facilityId || !UUID_REGEX.test(facilityId)) {
      throw new BadRequestException('Valid facilityId is required');
    }
    return this.emergencyService.getTreatmentQueue(facilityId);
  }

  // ========== DASHBOARD ==========
  @Get('dashboard')
  @AuthWithPermissions('emergency.read')
  @ApiOperation({ summary: 'Get emergency department dashboard' })
  @ApiQuery({ name: 'facilityId', required: true, description: 'Facility UUID' })
  getDashboard(@Query('facilityId') facilityId: string) {
    if (!facilityId || !UUID_REGEX.test(facilityId)) {
      throw new BadRequestException('Valid facilityId is required');
    }
    return this.emergencyService.getEmergencyDashboard(facilityId);
  }
}
