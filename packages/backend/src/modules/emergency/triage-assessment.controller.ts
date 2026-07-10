import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TriageAssessmentService } from './triage-assessment.service';
import { CreateTriageAssessmentDto } from './dto/create-triage-assessment.dto';

@Controller('triage-assessments')
export class TriageAssessmentController {
  constructor(private readonly triageService: TriageAssessmentService) {}

  @Post()
  @AuthWithPermissions('triage.create')
  create(
    @Body() dto: CreateTriageAssessmentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.triageService.create(dto, userId, tenantId);
  }

  @Post(':id/reassess')
  @AuthWithPermissions('triage.create')
  reassess(
    @Param('id') id: string,
    @Body() dto: CreateTriageAssessmentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.triageService.reassess(id, dto, userId, tenantId);
  }

  @Get('by-queue/:queueId')
  @AuthWithPermissions('triage.read')
  getByQueue(
    @Param('queueId') queueId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.triageService.getByQueue(queueId, tenantId);
  }

  @Get('by-encounter/:encounterId')
  @AuthWithPermissions('triage.read')
  getByEncounter(
    @Param('encounterId') encounterId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.triageService.getByEncounter(encounterId, tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('triage.read')
  getById(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.triageService.getById(id, tenantId);
  }
}
