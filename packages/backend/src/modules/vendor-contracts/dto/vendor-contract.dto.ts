import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNumber,
  IsEnum,
  Min,
  IsObject,
  IsBoolean,
  MaxLength,
} from 'class-validator';
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

  /**
   * vendor_contracts.documents exists — a map of label to stored path — and
   * the frontend sends it; only this DTO refused it.
   */
  @IsOptional()
  @IsObject()
  documents?: Record<string, string>;
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

  /**
   * contract_amendments.amendment_number exists and the frontend sends it;
   * this DTO refused it, which rejects the whole amendment.
   */
  @IsString()
  @MaxLength(64)
  amendmentNumber: string;

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

export class TerminateContractDto {
  @IsString()
  reason: string;
}
