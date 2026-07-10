import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PatientActiveMedicationService } from './patient-active-medication.service';
import { IsUUID, IsString, MaxLength } from 'class-validator';

export class StopActiveMedicationDto {
  @IsString()
  @MaxLength(2000)
  reason: string;
}

@Controller('patient-active-medications')
export class PatientActiveMedicationController {
  constructor(private readonly service: PatientActiveMedicationService) {}

  @Get('patient/:patientId')
  @AuthWithPermissions('prescriptions.read')
  getActive(
    @Param('patientId') patientId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.getActiveMedications(patientId, tenantId);
  }

  @Get('patient/:patientId/history')
  @AuthWithPermissions('prescriptions.read')
  getHistory(
    @Param('patientId') patientId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser('tenantId') tenantId?: string,
  ) {
    return this.service.getMedicationHistory(
      patientId,
      tenantId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post(':id/stop')
  @AuthWithPermissions('prescriptions.update')
  stop(
    @Param('id') id: string,
    @Body() dto: StopActiveMedicationDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.stopMedication(id, userId, dto.reason, tenantId);
  }
}
