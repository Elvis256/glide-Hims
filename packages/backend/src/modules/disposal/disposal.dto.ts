import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsUUID } from 'class-validator';
import { DisposalMethod, ComplianceStatus } from '../../database/entities/disposal.entity';

export class CreateDisposalDto {
  @IsUUID()
  itemId: string;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  @IsOptional()
  unitValue?: number;

  @IsDateString()
  disposalDate: string;

  @IsEnum(DisposalMethod)
  disposalMethod: DisposalMethod;

  @IsString()
  @IsOptional()
  witness?: string;

  @IsString()
  @IsOptional()
  certificateNumber?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  facilityId: string;
}

export class UpdateDisposalDto {
  @IsEnum(ComplianceStatus)
  @IsOptional()
  complianceStatus?: ComplianceStatus;

  @IsString()
  @IsOptional()
  certificateNumber?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  approvedById?: string;
}

export class DisposalQueryDto {
  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @IsEnum(DisposalMethod)
  @IsOptional()
  disposalMethod?: DisposalMethod;

  @IsEnum(ComplianceStatus)
  @IsOptional()
  complianceStatus?: ComplianceStatus;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @IsOptional()
  page?: number;

  @IsNumber()
  @IsOptional()
  limit?: number;
}
