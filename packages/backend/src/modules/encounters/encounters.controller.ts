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
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EncountersService } from './encounters.service';
import {
  CreateEncounterDto,
  UpdateEncounterDto,
  UpdateStatusDto,
  EncounterQueryDto,
  QueueQueryDto,
  CompleteConsultationDto,
  ReturnReasonDto,
} from './encounters.dto';
import { AuthWithPermissions, AuthWithOwnership } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireFacilityAccess } from '../auth/decorators/facility-access.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@ApiTags('Encounters')
@ApiBearerAuth()
@UseGuards(ModuleGuard, TenantContextGuard)
@RequireModule('doctors')
@RequireFacilityAccess()
@Controller('encounters')
export class EncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  @Post()
  @AuthWithPermissions('encounters.create')
  @ApiOperation({ summary: 'Create new encounter/visit' })
  create(@Body() dto: CreateEncounterDto, @Request() req: any) {
    return this.encountersService.create(dto, req.user.id, req.user.tenantId);
  }

  @Get()
  @AuthWithPermissions('encounters.read')
  @ApiOperation({ summary: 'List encounters with filters' })
  findAll(@Query() query: EncounterQueryDto, @Request() req: any) {
    return this.encountersService.findAll(query, req.user?.tenantId);
  }

  @Get('queue')
  @AuthWithPermissions('encounters.read')
  @ApiOperation({ summary: "Get today's doctor/reception patient queue" })
  getQueue(@Query() query: QueueQueryDto, @Request() req: any) {
    const facilityId = query.facilityId || req.headers['x-facility-id'] || req.user?.facilityId;
    if (!facilityId) {
      return [];
    }
    return this.encountersService.getQueue(
      facilityId,
      query.departmentId,
      req.user?.tenantId,
      query.doctorId,
      query.encounterType,
    );
  }

  @Get('queue/pharmacy')
  @AuthWithPermissions('encounters.read')
  @ApiOperation({ summary: 'Get pharmacy dispensing queue' })
  getPharmacyQueue(@Query() query: QueueQueryDto, @Request() req: any) {
    const facilityId = query.facilityId || req.headers['x-facility-id'] || req.user?.facilityId;
    if (!facilityId) {
      return [];
    }
    return this.encountersService.getPharmacyQueue(
      facilityId,
      query.departmentId,
      req.user?.tenantId,
    );
  }

  @Get('queue/lab')
  @AuthWithPermissions('encounters.read')
  @ApiOperation({ summary: 'Get lab sample collection queue' })
  getLabQueue(@Query() query: QueueQueryDto, @Request() req: any) {
    const facilityId = query.facilityId || req.headers['x-facility-id'] || req.user?.facilityId;
    if (!facilityId) {
      return [];
    }
    return this.encountersService.getLabQueue(
      facilityId,
      query.departmentId,
      req.user?.tenantId,
    );
  }

  @Get(':id/can-complete')
  @AuthWithPermissions('encounters.read')
  @ApiOperation({
    summary: 'Check if an encounter can be completed (preflight)',
  })
  canComplete(@Param('id') id: string, @Request() req: any) {
    return this.encountersService.canComplete(id, req.user?.tenantId);
  }

  @Get('stats/today')
  @AuthWithPermissions('encounters.read')
  @ApiOperation({ summary: "Get today's encounter statistics" })
  getTodayStats(@Query('facilityId') facilityId: string, @Request() req: any) {
    const effectiveFacilityId = facilityId || req.headers['x-facility-id'] || req.user?.facilityId;
    if (!effectiveFacilityId) {
      return {
        total: 0, waiting: 0, inConsultation: 0, inProgress: 0, completed: 0,
        cancelled: 0, pendingPayment: 0, pendingLab: 0, pendingPharmacy: 0,
        averageWaitMinutes: null, bouncedEncounters: 0, totalBounces: 0,
        bounceRate: 0, departmentBreakdown: [],
      };
    }
    return this.encountersService.getTodayStats(effectiveFacilityId, req.user?.tenantId);
  }

  @Get('visit/:visitNumber')
  @AuthWithPermissions('encounters.read')
  @ApiOperation({ summary: 'Get encounter by visit number' })
  findByVisitNumber(@Param('visitNumber') visitNumber: string, @Request() req: any) {
    return this.encountersService.findByVisitNumber(visitNumber, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithOwnership('encounters.read', {
    entity: 'Encounter',
    ownerField: 'attendingProviderId',
    bypassPermission: 'encounters.read-all',
    allowFacilityAccess: true,
  })
  @ApiOperation({ summary: 'Get encounter by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.encountersService.findOne(id, req.user?.tenantId);
  }

  @Patch(':id')
  @AuthWithOwnership('encounters.update', {
    entity: 'Encounter',
    ownerField: 'attendingProviderId',
    bypassPermission: 'encounters.read-all',
    allowFacilityAccess: true,
  })
  @ApiOperation({ summary: 'Update encounter' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEncounterDto,
    @Request() req: any,
  ) {
    return this.encountersService.update(id, dto, req.user.id, req.user?.tenantId);
  }

  @Patch(':id/status')
  @AuthWithPermissions('encounters.update')
  @ApiOperation({ summary: 'Update encounter status' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @Request() req: any,
  ) {
    return this.encountersService.updateStatus(
      id,
      dto.status,
      req.user.id,
      dto.attendingProviderId ?? dto.providerId,
      dto.reason,
      req.user?.tenantId,
    );
  }

  @Patch(':id/return-to-doctor')
  @AuthWithPermissions('encounters.update')
  @ApiOperation({ summary: 'Return patient to doctor with reason' })
  returnToDoctor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnReasonDto,
    @Request() req: any,
  ) {
    return this.encountersService.returnToDoctor(id, dto.reason, req.user.id, req.user?.tenantId);
  }

  @Patch(':id/return-to-pharmacy')
  @AuthWithPermissions('encounters.update')
  @ApiOperation({ summary: 'Return patient to pharmacy with reason' })
  returnToPharmacy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnReasonDto,
    @Request() req: any,
  ) {
    return this.encountersService.returnToPharmacy(id, dto.reason, req.user.id, req.user?.tenantId);
  }

  @Patch(':id/return-to-lab')
  @AuthWithPermissions('encounters.update')
  @ApiOperation({ summary: 'Return patient to lab with reason' })
  returnToLab(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnReasonDto,
    @Request() req: any,
  ) {
    return this.encountersService.returnToLab(id, dto.reason, req.user.id, req.user?.tenantId);
  }

  @Post(':id/complete')
  @AuthWithOwnership('encounters.update', {
    entity: 'Encounter',
    ownerField: 'attendingProviderId',
    bypassPermission: 'encounters.read-all',
    allowFacilityAccess: true,
  })
  @ApiOperation({ summary: 'Atomically complete consultation (clinical note + status)' })
  completeConsultation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteConsultationDto,
    @Request() req: any,
  ) {
    return this.encountersService.completeConsultation(id, dto, req.user.id, req.user?.tenantId);
  }

  @Delete(':id')
  @AuthWithPermissions('encounters.delete')
  @ApiOperation({ summary: 'Delete encounter' })
  delete(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.encountersService.delete(id, req.user.id, req.user?.tenantId);
  }
}
