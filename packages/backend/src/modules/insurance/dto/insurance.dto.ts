import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsUUID,
  IsBoolean,
  IsArray,
  IsEmail,
  Min,
  Max,
  MaxLength,
  MinLength,
  ArrayNotEmpty,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ProviderType,
  ClaimSubmissionMethod,
} from '../../../database/entities/insurance-provider.entity';
import {
  CoverageType,
  MemberType,
  PolicyStatus,
} from '../../../database/entities/insurance-policy.entity';
import { ClaimType } from '../../../database/entities/insurance-claim.entity';
import { ClaimItemType } from '../../../database/entities/claim-item.entity';
import { PreAuthType } from '../../../database/entities/pre-authorization.entity';

// Provider DTOs
export class CreateProviderDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code: string;

  @ApiPropertyOptional({ enum: ProviderType })
  @IsOptional()
  @IsEnum(ProviderType)
  providerType?: ProviderType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactPerson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ enum: ClaimSubmissionMethod })
  @IsOptional()
  @IsEnum(ClaimSubmissionMethod)
  claimSubmissionMethod?: ClaimSubmissionMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(365)
  paymentTermsDays?: number;
}

export class UpdateProviderDto extends PartialType(CreateProviderDto) {}

// Policy DTOs
export class CreatePolicyDto {
  @ApiProperty()
  @IsUUID()
  providerId: string;

  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  policyNumber: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  memberNumber: string;

  @ApiPropertyOptional({ enum: MemberType })
  @IsOptional()
  @IsEnum(MemberType)
  memberType?: MemberType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  principalMemberNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  employerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  employerCode?: string;

  @ApiPropertyOptional({ enum: CoverageType })
  @IsOptional()
  @IsEnum(CoverageType)
  coverageType?: CoverageType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000_000)
  annualLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  copayPercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000_000)
  copayAmount?: number;

  @ApiProperty()
  @IsDateString()
  effectiveDate: string;

  @ApiProperty()
  @IsDateString()
  expiryDate: string;
}

export class VerifyPolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}

// Claim DTOs
export class CreateClaimDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsUUID()
  policyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  preAuthId?: string;

  @ApiProperty({ enum: ClaimType })
  @IsEnum(ClaimType)
  claimType: ClaimType;

  @ApiProperty()
  @IsDateString()
  serviceDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dischargeDate?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  primaryDiagnosis: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  diagnosisCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  secondaryDiagnoses?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateClaimItemDto)
  items?: CreateClaimItemDto[];
}

export class CreateClaimItemDto {
  @ApiProperty({ enum: ClaimItemType })
  @IsEnum(ClaimItemType)
  itemType: ClaimItemType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  serviceCode?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(10_000)
  quantity?: number;

  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000_000)
  unitPrice: number;

  @ApiProperty()
  @IsDateString()
  serviceDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  providerNotes?: string;
}

export class SubmitClaimDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;
}

export class ProcessClaimDto {
  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000_000)
  approvedAmount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  denialReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  denialCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  notes?: string;
}

export class RecordPaymentDto {
  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000_000)
  paidAmount: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  paymentReference: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}

// Pre-Authorization DTOs
export class CreatePreAuthDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsUUID()
  policyId: string;

  @ApiProperty({ enum: PreAuthType })
  @IsEnum(PreAuthType)
  authType: PreAuthType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  primaryDiagnosis: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  diagnosisCode?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4_000)
  clinicalJustification: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4_000)
  proposedTreatment: string;

  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000_000)
  estimatedCost: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedAdmissionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDischargeDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(3650)
  expectedLosDays?: number;
}

export class BatchSubmitClaimsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  encounterIds: string[];
}

export class ProcessPreAuthDto {
  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000_000)
  approvedAmount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  insurerReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  denialReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  notes?: string;
}
