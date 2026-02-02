import { IsString, IsOptional, IsEnum, IsUUID, IsDateString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EncounterType, EncounterStatus } from '../../database/entities/encounter.entity';

export class CreateEncounterDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  facilityId: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsEnum(EncounterType)
  @IsOptional()
  type?: EncounterType = EncounterType.OPD;

  @IsString()
  @IsOptional()
  chiefComplaint?: string;
}

export class UpdateEncounterDto {
  @IsEnum(EncounterStatus)
  @IsOptional()
  status?: EncounterStatus;

  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  attendingProviderId?: string;
}

export class UpdateStatusDto {
  @IsEnum(EncounterStatus)
  status: EncounterStatus;

  @IsUUID()
  @IsOptional()
  providerId?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class EncounterQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(EncounterStatus)
  @IsOptional()
  status?: EncounterStatus;

  @IsEnum(EncounterType)
  @IsOptional()
  type?: EncounterType;

  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
