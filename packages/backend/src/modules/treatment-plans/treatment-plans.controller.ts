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
    return this.treatmentPlansService.create(dto, req.user.sub);
  }

  @Get()
  @AuthWithPermissions('treatment-plans.read')
  async findAll(@Query() filter: TreatmentPlanFilterDto) {
    return this.treatmentPlansService.findAll(filter);
  }

  @Get('patient/:patientId')
  @AuthWithPermissions('treatment-plans.read')
  async findByPatient(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.treatmentPlansService.findByPatient(patientId);
  }

  @Get('patient/:patientId/active')
  @AuthWithPermissions('treatment-plans.read')
  async getActivePlans(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.treatmentPlansService.getActivePlans(patientId);
  }

  @Get(':id')
  @AuthWithPermissions('treatment-plans.read')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.treatmentPlansService.findOne(id);
  }

  @Put(':id')
  @AuthWithPermissions('treatment-plans.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTreatmentPlanDto,
  ) {
    return this.treatmentPlansService.update(id, dto);
  }

  @Post(':id/activate')
  @AuthWithPermissions('treatment-plans.create')
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.treatmentPlansService.activate(id);
  }

  @Post(':id/complete')
  @AuthWithPermissions('treatment-plans.create')
  async complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.treatmentPlansService.complete(id);
  }

  @Post(':id/discontinue')
  @AuthWithPermissions('treatment-plans.create')
  async discontinue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    return this.treatmentPlansService.discontinue(id, reason);
  }

  @Post(':id/progress-notes')
  @AuthWithPermissions('treatment-plans.create')
  async addProgressNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddProgressNoteDto,
    @Request() req: any,
  ) {
    return this.treatmentPlansService.addProgressNote(id, dto, req.user.sub, req.user.fullName || 'Provider');
  }

  @Post(':id/goals/:goalId/status')
  @AuthWithPermissions('treatment-plans.create')
  async updateGoalStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('goalId') goalId: string,
    @Body('status') status: string,
  ) {
    return this.treatmentPlansService.updateGoalStatus(id, goalId, status);
  }

  @Post(':id/revise')
  @AuthWithPermissions('treatment-plans.create')
  async revisePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisePlanDto,
    @Request() req: any,
  ) {
    return this.treatmentPlansService.revisePlan(id, dto, req.user.sub);
  }

  @Post(':id/consent')
  @AuthWithPermissions('treatment-plans.create')
  async recordConsent(@Param('id', ParseUUIDPipe) id: string) {
    return this.treatmentPlansService.recordConsent(id);
  }
}
