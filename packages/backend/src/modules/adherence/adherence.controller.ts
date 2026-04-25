import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Request,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdherenceService } from './adherence.service';
import { RecordAdherenceDto } from './dto/adherence.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('Adherence')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('chronic-care')
@Controller('adherence')
export class AdherenceController {
  constructor(private readonly adherenceService: AdherenceService) {}

  @Post('generate/:prescriptionId')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Generate medication adherence schedule from prescription' })
  async generateSchedule(
    @Param('prescriptionId', ParseUUIDPipe) prescriptionId: string,
    @Request() req: any,
  ) {
    return this.adherenceService.generateSchedule(prescriptionId, req.user?.tenantId);
  }

  @Put(':recordId')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Record adherence (taken/skipped)' })
  async recordAdherence(
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body() dto: RecordAdherenceDto,
    @Request() req: any,
  ) {
    return this.adherenceService.recordAdherence(recordId, dto, req.user?.tenantId);
  }

  @Get('patient/:patientId')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Get patient adherence records' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async getPatientAdherence(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Request() req?: any,
  ) {
    return this.adherenceService.getPatientAdherence(
      patientId,
      dateFrom,
      dateTo,
      req?.user?.tenantId,
    );
  }

  @Get('summary/:patientId')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Get patient adherence summary' })
  async getAdherenceSummary(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Request() req: any,
  ) {
    return this.adherenceService.getAdherenceSummary(patientId, req.user?.tenantId);
  }
}
