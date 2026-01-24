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
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Vitals')
@ApiBearerAuth()
@Controller('vitals')
export class VitalsController {
  constructor(private readonly vitalsService: VitalsService) {}

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Record vitals for an encounter' })
  create(@Body() dto: CreateVitalDto, @Request() req: any) {
    return this.vitalsService.create(dto, req.user.id);
  }

  @Get('encounter/:encounterId')
  @Auth()
  @ApiOperation({ summary: 'Get all vitals for an encounter' })
  findByEncounter(@Param('encounterId', ParseUUIDPipe) encounterId: string) {
    return this.vitalsService.findByEncounter(encounterId);
  }

  @Get('encounter/:encounterId/latest')
  @Auth()
  @ApiOperation({ summary: 'Get latest vitals for an encounter' })
  findLatestByEncounter(@Param('encounterId', ParseUUIDPipe) encounterId: string) {
    return this.vitalsService.findLatestByEncounter(encounterId);
  }

  @Get('patient/:patientId/history')
  @Auth()
  @ApiOperation({ summary: 'Get patient vital history' })
  getPatientHistory(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('limit') limit?: number,
  ) {
    return this.vitalsService.getPatientVitalHistory(patientId, limit);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Get vital record by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vitalsService.findOne(id);
  }

  @Patch(':id')
  @Auth()
  @ApiOperation({ summary: 'Update vital record' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVitalDto,
  ) {
    return this.vitalsService.update(id, dto);
  }

  @Delete(':id')
  @Auth('Admin', 'Super Admin')
  @ApiOperation({ summary: 'Delete vital record' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.vitalsService.delete(id);
  }
}
