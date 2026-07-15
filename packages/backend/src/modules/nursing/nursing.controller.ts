import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { IntakeOutputService } from './intake-output.service';
import { BloodGlucoseService } from './blood-glucose.service';
import { NeuroObservationService } from './neuro-observation.service';
import { IncidentReportService } from './incident-report.service';
import { CarePlanService } from './care-plan.service';
import { WoundAssessmentService } from './wound-assessment.service';
import { CreateIntakeOutputDto, QueryIntakeOutputDto } from './dto/intake-output.dto';
import { CreateBloodGlucoseDto, QueryBloodGlucoseDto } from './dto/blood-glucose.dto';
import { CreateNeuroObservationDto, QueryNeuroObservationDto } from './dto/neuro-observation.dto';
import { CreateIncidentReportDto, UpdateIncidentReportDto, QueryIncidentReportDto } from './dto/incident-report.dto';
import { CreateCarePlanDto, UpdateCarePlanDto, AddGoalDto, AddInterventionDto, QueryCarePlanDto } from './dto/care-plan.dto';
import { CreateWoundAssessmentDto, QueryWoundAssessmentDto } from './dto/wound-assessment.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validateUuid(id: string, fieldName = 'id'): void {
  if (!UUID_REGEX.test(id)) throw new BadRequestException(`Invalid ${fieldName} format`);
}

@ApiTags('Nursing')
@ApiBearerAuth()
@Controller('nursing')
export class NursingController {
  constructor(
    private readonly ioService: IntakeOutputService,
    private readonly glucoseService: BloodGlucoseService,
    private readonly neuroService: NeuroObservationService,
    private readonly incidentService: IncidentReportService,
    private readonly carePlanService: CarePlanService,
    private readonly woundService: WoundAssessmentService,
  ) {}

  // ===== Intake/Output =====
  @Post('io')
  @AuthWithPermissions('nursing.create')
  @ApiOperation({ summary: 'Record intake or output entry' })
  createIO(@Body() dto: CreateIntakeOutputDto, @Request() req: any) {
    return this.ioService.create(dto, req.user.id, req.user.tenantId);
  }

  @Get('io')
  @AuthWithPermissions('nursing.read')
  @ApiOperation({ summary: 'List intake/output entries' })
  listIO(@Query() query: QueryIntakeOutputDto, @Request() req: any) {
    return this.ioService.list(query, req.user.tenantId);
  }

  @Get('io/summary/:admissionId')
  @AuthWithPermissions('nursing.read')
  @ApiOperation({ summary: 'Get daily I/O summary for admission' })
  ioSummary(@Param('admissionId') admissionId: string, @Request() req: any) {
    validateUuid(admissionId, 'admissionId');
    return this.ioService.getDailySummary(admissionId, req.user.tenantId);
  }

  @Delete('io/:id')
  @AuthWithPermissions('nursing.update')
  @ApiOperation({ summary: 'Soft-delete I/O entry' })
  deleteIO(@Param('id') id: string, @Request() req: any) {
    validateUuid(id);
    return this.ioService.remove(id, req.user.tenantId);
  }

  // ===== Blood Glucose =====
  @Post('glucose')
  @AuthWithPermissions('nursing.create')
  @ApiOperation({ summary: 'Record blood glucose reading' })
  createGlucose(@Body() dto: CreateBloodGlucoseDto, @Request() req: any) {
    return this.glucoseService.create(dto, req.user.id, req.user.tenantId);
  }

  @Get('glucose')
  @AuthWithPermissions('nursing.read')
  @ApiOperation({ summary: 'List blood glucose readings' })
  listGlucose(@Query() query: QueryBloodGlucoseDto, @Request() req: any) {
    return this.glucoseService.list(query, req.user.tenantId);
  }

  // ===== Neuro Observations =====
  @Post('neuro')
  @AuthWithPermissions('nursing.create')
  @ApiOperation({ summary: 'Record neurological observation' })
  createNeuro(@Body() dto: CreateNeuroObservationDto, @Request() req: any) {
    return this.neuroService.create(dto, req.user.id, req.user.tenantId);
  }

  @Get('neuro')
  @AuthWithPermissions('nursing.read')
  @ApiOperation({ summary: 'List neurological observations' })
  listNeuro(@Query() query: QueryNeuroObservationDto, @Request() req: any) {
    return this.neuroService.list(query, req.user.tenantId);
  }

  // ===== Incident Reports =====
  // Static routes first (before :id param route)
  @Get('incidents/stats')
  @AuthWithPermissions('nursing.read')
  @ApiOperation({ summary: 'Get incident report statistics' })
  incidentStats(@Request() req: any) {
    return this.incidentService.getStats(req.user.tenantId);
  }

  @Post('incidents')
  @AuthWithPermissions('nursing.create')
  @ApiOperation({ summary: 'Create incident report' })
  createIncident(@Body() dto: CreateIncidentReportDto, @Request() req: any) {
    return this.incidentService.create(dto, req.user.id, req.user.tenantId);
  }

  @Get('incidents')
  @AuthWithPermissions('nursing.read')
  @ApiOperation({ summary: 'List incident reports' })
  listIncidents(@Query() query: QueryIncidentReportDto, @Request() req: any) {
    return this.incidentService.list(query, req.user.tenantId);
  }

  @Get('incidents/:id')
  @AuthWithPermissions('nursing.read')
  @ApiOperation({ summary: 'Get incident report by ID' })
  getIncident(@Param('id') id: string, @Request() req: any) {
    validateUuid(id);
    return this.incidentService.findOne(id, req.user.tenantId);
  }

  @Patch('incidents/:id')
  @AuthWithPermissions('nursing.update')
  @ApiOperation({ summary: 'Update incident report' })
  updateIncident(@Param('id') id: string, @Body() dto: UpdateIncidentReportDto, @Request() req: any) {
    validateUuid(id);
    return this.incidentService.update(id, dto, req.user.tenantId);
  }

  // ===== Care Plans =====
  @Post('care-plans')
  @AuthWithPermissions('nursing.create')
  @ApiOperation({ summary: 'Create care plan with goals and interventions' })
  createCarePlan(@Body() dto: CreateCarePlanDto, @Request() req: any) {
    return this.carePlanService.create(dto, req.user.id, req.user.tenantId);
  }

  @Get('care-plans')
  @AuthWithPermissions('nursing.read')
  @ApiOperation({ summary: 'List care plans' })
  listCarePlans(@Query() query: QueryCarePlanDto, @Request() req: any) {
    return this.carePlanService.list(query, req.user.tenantId);
  }

  @Get('care-plans/:id')
  @AuthWithPermissions('nursing.read')
  @ApiOperation({ summary: 'Get care plan by ID' })
  getCarePlan(@Param('id') id: string, @Request() req: any) {
    validateUuid(id);
    return this.carePlanService.findOne(id, req.user.tenantId);
  }

  @Patch('care-plans/:id')
  @AuthWithPermissions('nursing.update')
  @ApiOperation({ summary: 'Update care plan status' })
  updateCarePlan(@Param('id') id: string, @Body() dto: UpdateCarePlanDto, @Request() req: any) {
    validateUuid(id);
    return this.carePlanService.update(id, dto, req.user.tenantId);
  }

  @Post('care-plans/:id/goals')
  @AuthWithPermissions('nursing.create')
  @ApiOperation({ summary: 'Add goal to care plan' })
  addGoal(@Param('id') id: string, @Body() dto: AddGoalDto, @Request() req: any) {
    validateUuid(id);
    return this.carePlanService.addGoal(id, dto, req.user.tenantId);
  }

  @Post('care-plans/:id/interventions')
  @AuthWithPermissions('nursing.create')
  @ApiOperation({ summary: 'Add intervention to care plan' })
  addIntervention(@Param('id') id: string, @Body() dto: AddInterventionDto, @Request() req: any) {
    validateUuid(id);
    return this.carePlanService.addIntervention(id, dto, req.user.tenantId);
  }

  // ===== Wound Assessments =====
  @Post('wounds')
  @AuthWithPermissions('nursing.create')
  @ApiOperation({ summary: 'Record wound assessment' })
  createWound(@Body() dto: CreateWoundAssessmentDto, @Request() req: any) {
    return this.woundService.create(dto, req.user.id, req.user.tenantId);
  }

  @Get('wounds')
  @AuthWithPermissions('nursing.read')
  @ApiOperation({ summary: 'List wound assessments' })
  listWounds(@Query() query: QueryWoundAssessmentDto, @Request() req: any) {
    return this.woundService.list(query, req.user.tenantId);
  }
}
