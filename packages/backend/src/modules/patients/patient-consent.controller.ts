import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { PatientConsentService } from './patient-consent.service';
import { ConsentType } from '../../database/entities/patient-consent.entity';

export class RecordConsentDto {
  @IsEnum(ConsentType)
  consentType: ConsentType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  version?: string;

  @IsOptional()
  @IsBoolean()
  accepted?: boolean;

  @IsOptional()
  @IsUUID()
  witnessedById?: string;
}

export class WithdrawConsentDto {
  @IsString()
  @MaxLength(2000)
  reason: string;
}

@ApiTags('Patient Consents')
@Controller('patients/:patientId/consents')
export class PatientConsentController {
  constructor(private readonly consentService: PatientConsentService) {}

  @Post()
  @AuthWithPermissions('patients.update')
  async recordConsent(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: RecordConsentDto,
    @Req() req: any,
  ) {
    return this.consentService.recordConsent({
      patientId,
      consentType: dto.consentType,
      version: dto.version,
      accepted: dto.accepted,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      recordedById: req.user!.id,
      witnessedById: dto.witnessedById,
      tenantId: req.user!.tenantId,
    });
  }

  @Get()
  @AuthWithPermissions('patients.read')
  async getActiveConsents(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Req() req: any,
  ) {
    return this.consentService.getActiveConsents(patientId, req.user!.tenantId);
  }

  @Get('history')
  @AuthWithPermissions('patients.read')
  async getConsentHistory(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Req() req: any,
  ) {
    return this.consentService.getConsentHistory(patientId, req.user!.tenantId);
  }

  @Post(':consentId/withdraw')
  @AuthWithPermissions('patients.update')
  async withdrawConsent(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('consentId', ParseUUIDPipe) consentId: string,
    @Body() dto: WithdrawConsentDto,
    @Req() req: any,
  ) {
    return this.consentService.withdrawConsent({
      consentId,
      patientId,
      reason: dto.reason,
      withdrawnById: req.user!.id,
      tenantId: req.user!.tenantId,
    });
  }
}
