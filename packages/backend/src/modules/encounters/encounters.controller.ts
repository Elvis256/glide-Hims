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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EncountersService } from './encounters.service';
import { CreateEncounterDto, UpdateEncounterDto, UpdateStatusDto, EncounterQueryDto } from './encounters.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('Encounters')
@ApiBearerAuth()
@Controller('encounters')
export class EncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  @Post()
  @AuthWithPermissions('encounters.create')
  @ApiOperation({ summary: 'Create new encounter/visit' })
  create(@Body() dto: CreateEncounterDto, @Request() req: any) {
    return this.encountersService.create(dto, req.user.id);
  }

  @Get()
  @AuthWithPermissions('encounters.read')
  @ApiOperation({ summary: 'List encounters with filters' })
  findAll(@Query() query: EncounterQueryDto) {
    return this.encountersService.findAll(query);
  }

  @Get('queue')
  @AuthWithPermissions('encounters.read')
  @ApiOperation({ summary: 'Get today\'s patient queue' })
  getQueue(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.encountersService.getQueue(facilityId, departmentId);
  }

  @Get('stats/today')
  @AuthWithPermissions('encounters.read')
  @ApiOperation({ summary: 'Get today\'s encounter statistics' })
  getTodayStats(@Query('facilityId') facilityId: string, @Request() req: any) {
    const effectiveFacilityId = facilityId || req.headers['x-facility-id'] || req.user?.facilityId;
    if (!effectiveFacilityId) {
      return { total: 0, waiting: 0, inProgress: 0, completed: 0 };
    }
    return this.encountersService.getTodayStats(effectiveFacilityId);
  }

  @Get('visit/:visitNumber')
  @AuthWithPermissions('encounters.read')
  @ApiOperation({ summary: 'Get encounter by visit number' })
  findByVisitNumber(@Param('visitNumber') visitNumber: string) {
    return this.encountersService.findByVisitNumber(visitNumber);
  }

  @Get(':id')
  @AuthWithPermissions('encounters.read')
  @ApiOperation({ summary: 'Get encounter by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.encountersService.findOne(id);
  }

  @Patch(':id')
  @AuthWithPermissions('encounters.update')
  @ApiOperation({ summary: 'Update encounter' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEncounterDto,
  ) {
    return this.encountersService.update(id, dto);
  }

  @Patch(':id/status')
  @AuthWithPermissions('encounters.update')
  @ApiOperation({ summary: 'Update encounter status' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.encountersService.updateStatus(id, dto.status, dto.providerId, dto.reason);
  }

  @Patch(':id/return-to-doctor')
  @AuthWithPermissions('encounters.update')
  @ApiOperation({ summary: 'Return patient to doctor with reason' })
  returnToDoctor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { reason: string },
  ) {
    return this.encountersService.returnToDoctor(id, dto.reason);
  }

  @Patch(':id/return-to-pharmacy')
  @AuthWithPermissions('encounters.update')
  @ApiOperation({ summary: 'Return patient to pharmacy with reason' })
  returnToPharmacy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { reason: string },
  ) {
    return this.encountersService.returnToPharmacy(id, dto.reason);
  }

  @Delete(':id')
  @AuthWithPermissions('encounters.delete')
  @ApiOperation({ summary: 'Delete encounter' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.encountersService.delete(id);
  }
}
