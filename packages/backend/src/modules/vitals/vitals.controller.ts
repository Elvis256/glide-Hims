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
import { VitalsService } from './vitals.service';
import { CreateVitalDto, UpdateVitalDto } from './vitals.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('Vitals')
@ApiBearerAuth()
@Controller('vitals')
export class VitalsController {
  constructor(private readonly vitalsService: VitalsService) {}

  @Post()
  @AuthWithPermissions('vitals.create')
  @ApiOperation({ summary: 'Record vitals for an encounter' })
  create(@Body() dto: CreateVitalDto, @Request() req: any) {
    return this.vitalsService.create(dto, req.user.id, req.user?.tenantId);
  }

  @Get('encounter/:encounterId')
  @AuthWithPermissions('vitals.read')
  @ApiOperation({ summary: 'Get all vitals for an encounter' })
  findByEncounter(@Param('encounterId', ParseUUIDPipe) encounterId: string, @Request() req: any) {
    return this.vitalsService.findByEncounter(encounterId, req.user?.tenantId);
  }

  @Get('encounter/:encounterId/latest')
  @AuthWithPermissions('vitals.read')
  @ApiOperation({ summary: 'Get latest vitals for an encounter' })
  findLatestByEncounter(@Param('encounterId', ParseUUIDPipe) encounterId: string, @Request() req: any) {
    return this.vitalsService.findLatestByEncounter(encounterId, req.user?.tenantId);
  }

  @Get('patient/:patientId/history')
  @AuthWithPermissions('vitals.read')
  @ApiOperation({ summary: 'Get patient vital history' })
  getPatientHistory(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('limit') limit?: string,
    @Request() req?: any,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.vitalsService.getPatientVitalHistory(patientId, parsedLimit, req?.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('vitals.read')
  @ApiOperation({ summary: 'Get vital record by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.vitalsService.findOne(id, req.user?.tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('vitals.update')
  @ApiOperation({ summary: 'Update vital record' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVitalDto,
    @Request() req: any,
  ) {
    return this.vitalsService.update(id, dto, req.user?.tenantId);
  }

  @Delete(':id')
  @AuthWithPermissions('vitals.delete')
  @ApiOperation({ summary: 'Delete vital record' })
  delete(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.vitalsService.delete(id, req.user?.tenantId);
  }
}
