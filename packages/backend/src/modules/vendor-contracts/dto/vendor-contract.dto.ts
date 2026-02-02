import { IsString, IsOptional, IsUUID, IsDateString, IsNumber, IsEnum, Min, IsObject, IsBoolean } from 'class-validator';
import { ContractStatus } from '../../../database/entities/vendor-contract.entity';

export class CreateVendorContractDto {
  @IsString()
  contractNumber: string;

  @IsUUID()
  supplierId: string;

  @IsUUID()
  facilityId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsNumber()
  renewalNoticeDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateVendorContractDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsNumber()
  renewalNoticeDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;
}

export class CreateAmendmentDto {
  @IsUUID()
  contractId: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsObject()
  changes?: Record<string, { old: any; new: any }>;

  @IsDateString()
  effectiveDate: string;
}

export class RenewContractDto {
  @IsDateString()
  newEndDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  newValue?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
