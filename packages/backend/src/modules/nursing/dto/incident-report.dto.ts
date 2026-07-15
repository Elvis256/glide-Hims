import { IsUUID, IsString, IsOptional, IsIn, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class WitnessDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class CreateIncidentReportDto {
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsString()
  type: string;

  @IsString()
  severity: string;

  @IsOptional()
  @IsIn(['draft', 'submitted'])
  status?: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsDateString()
  incidentDate: string;

  @IsOptional()
  @IsString()
  immediateAction?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WitnessDto)
  witnesses?: WitnessDto[];
}

export class UpdateIncidentReportDto {
  @IsOptional()
  @IsIn(['draft', 'submitted', 'investigating', 'closed'])
  status?: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  correctiveAction?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  immediateAction?: string;
}

export class QueryIncidentReportDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  severity?: string;
}
