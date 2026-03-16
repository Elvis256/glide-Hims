import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TreatmentPlansService } from './treatment-plans.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CreateTreatmentPlanDto, UpdateTreatmentPlanDto, AddProgressNoteDto, RevisePlanDto, TreatmentPlanFilterDto } from './dto/treatment-plan.dto';

@Controller('treatment-plans')
@UseGuards(AuthGuard('jwt'))
export class TreatmentPlansController {
  constructor(private readonly treatmentPlansService: TreatmentPlansService) {}

  @Post()
  @AuthWithPermissions('treatment-plans.create')
  async create(@Body() dto: CreateTreatmentPlanDto, @Request() req: any) {
    return this.treatmentPlansService.create(dto, req.user.sub, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('treatment-plans.read')
  async findAll(@Query() filter: TreatmentPlanFilterDto, @Request() req: any) {
    return this.treatmentPlansService.findAll(filter, req.user?.tenantId);
  }

  @Get('patient/:patientId')
  @AuthWithPermissions('treatment-plans.read')
  async findByPatient(@Param('patientId', ParseUUIDPipe) patientId: string, @Request() req: any) {
    return this.treatmentPlansService.findByPatient(patientId, req.user?.tenantId);
  }

  @Get('patient/:patientId/active')
  @AuthWithPermissions('treatment-plans.read')
  async getActivePlans(@Param('patientId', ParseUUIDPipe) patientId: string, @Request() req: any) {
    return this.treatmentPlansService.getActivePlans(patientId, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('treatment-plans.read')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.treatmentPlansService.findOne(id, req.user?.tenantId);
  }

  @Put(':id')
  @AuthWithPermissions('treatment-plans.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTreatmentPlanDto,
    @Request() req: any,
  ) {
    return this.treatmentPlansService.update(id, dto, req.user?.tenantId);
  }

  @Post(':id/activate')
  @AuthWithPermissions('treatment-plans.create')
  async activate(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.treatmentPlansService.activate(id, req.user?.tenantId);
  }

  @Post(':id/complete')
  @AuthWithPermissions('treatment-plans.create')
  async complete(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.treatmentPlansService.complete(id, req.user?.tenantId);
  }

  @Post(':id/discontinue')
  @AuthWithPermissions('treatment-plans.create')
  async discontinue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.treatmentPlansService.discontinue(id, reason, req.user?.tenantId);
  }

  @Post(':id/progress-notes')
  @AuthWithPermissions('treatment-plans.create')
  async addProgressNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddProgressNoteDto,
    @Request() req: any,
  ) {
    return this.treatmentPlansService.addProgressNote(id, dto, req.user.sub, req.user.fullName || 'Provider', req.user?.tenantId);
  }

  @Post(':id/goals/:goalId/status')
  @AuthWithPermissions('treatment-plans.create')
  async updateGoalStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('goalId') goalId: string,
    @Body('status') status: string,
    @Request() req: any,
  ) {
    return this.treatmentPlansService.updateGoalStatus(id, goalId, status, req.user?.tenantId);
  }

  @Post(':id/revise')
  @AuthWithPermissions('treatment-plans.create')
  async revisePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisePlanDto,
    @Request() req: any,
  ) {
    return this.treatmentPlansService.revisePlan(id, dto, req.user.sub, req.user?.tenantId);
  }

  @Post(':id/consent')
  @AuthWithPermissions('treatment-plans.create')
  async recordConsent(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.treatmentPlansService.recordConsent(id, req.user?.tenantId);
  }
}
