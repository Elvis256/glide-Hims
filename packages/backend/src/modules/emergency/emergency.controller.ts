import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Request,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { EmergencyService } from './emergency.service';
import {
  CreateEmergencyCaseDto,
  TriageDto,
  StartTreatmentDto,
  DischargeEmergencyDto,
  AdmitFromEmergencyDto,
  EmergencyQueryDto,
} from './dto/emergency.dto';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('Emergency')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('emergency')
@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  // ========== CASE MANAGEMENT ==========
  @Post('cases')
  @AuthWithPermissions('emergency.create')
  @ApiOperation({ summary: 'Register new emergency case (rapid registration)' })
  registerCase(@Body() dto: CreateEmergencyCaseDto, @Request() req: any) {
    return this.emergencyService.registerCase(dto, dto.facilityId, req.user.id, req.user?.tenantId);
  }

  @Get('cases')
  @AuthWithPermissions('emergency.read')
  @ApiOperation({ summary: 'Get emergency cases' })
  getCases(@Query() query: EmergencyQueryDto, @Request() req: any) {
    return this.emergencyService.getCases(query, req.user?.tenantId);
  }

  @Get('cases/:id')
  @AuthWithPermissions('emergency.read')
  @ApiOperation({ summary: 'Get emergency case by ID' })
  getCase(@Param('id') id: string, @Request() req: any) {
    return this.emergencyService.getCase(id, req.user?.tenantId);
  }

  // ========== TRIAGE WORKFLOW ==========
  @Put('cases/:id/triage')
  @AuthWithPermissions('emergency.update')
  @ApiOperation({ summary: 'Triage an emergency case' })
  triageCase(@Param('id') id: string, @Body() dto: TriageDto, @Request() req: any) {
    return this.emergencyService.triageCase(id, dto, req.user.id, req.user?.tenantId);
  }

  @Put('cases/:id/start-treatment')
  @AuthWithPermissions('emergency.update')
  @ApiOperation({ summary: 'Start treatment for a triaged case' })
  startTreatment(@Param('id') id: string, @Body() dto: StartTreatmentDto, @Request() req: any) {
    return this.emergencyService.startTreatment(id, dto, req.user.id, req.user?.tenantId);
  }

  // ========== DISPOSITION ==========
  @Put('cases/:id/discharge')
  @AuthWithPermissions('emergency.update')
  @ApiOperation({ summary: 'Discharge emergency case' })
  dischargeCase(@Param('id') id: string, @Body() dto: DischargeEmergencyDto, @Request() req: any) {
    return this.emergencyService.dischargeCase(id, dto, req.user?.tenantId);
  }

  @Put('cases/:id/admit')
  @AuthWithPermissions('emergency.update')
  @ApiOperation({ summary: 'Admit emergency case to IPD' })
  admitToWard(@Param('id') id: string, @Body() dto: AdmitFromEmergencyDto, @Request() req: any) {
    return this.emergencyService.admitToWard(id, dto, req.user?.tenantId);
  }

  // ========== QUEUES ==========
  @Get('queue/triage')
  @AuthWithPermissions('emergency.read')
  @ApiOperation({ summary: 'Get patients waiting for triage' })
  @ApiQuery({ name: 'facilityId', required: true, description: 'Facility UUID' })
  getTriageQueue(@Query('facilityId') facilityId: string, @Request() req: any) {
    if (!facilityId || !UUID_REGEX.test(facilityId)) {
      throw new BadRequestException('Valid facilityId is required');
    }
    return this.emergencyService.getTriageQueue(facilityId, req.user?.tenantId);
  }

  @Get('queue/treatment')
  @AuthWithPermissions('emergency.read')
  @ApiOperation({ summary: 'Get triaged patients waiting for treatment (sorted by priority)' })
  @ApiQuery({ name: 'facilityId', required: true, description: 'Facility UUID' })
  getTreatmentQueue(@Query('facilityId') facilityId: string, @Request() req: any) {
    if (!facilityId || !UUID_REGEX.test(facilityId)) {
      throw new BadRequestException('Valid facilityId is required');
    }
    return this.emergencyService.getTreatmentQueue(facilityId, req.user?.tenantId);
  }

  // ========== DASHBOARD ==========
  @Get('dashboard')
  @AuthWithPermissions('emergency.read')
  @ApiOperation({ summary: 'Get emergency department dashboard' })
  @ApiQuery({ name: 'facilityId', required: true, description: 'Facility UUID' })
  getDashboard(@Query('facilityId') facilityId: string, @Request() req: any) {
    if (!facilityId || !UUID_REGEX.test(facilityId)) {
      throw new BadRequestException('Valid facilityId is required');
    }
    return this.emergencyService.getEmergencyDashboard(facilityId, req.user?.tenantId);
  }
}
