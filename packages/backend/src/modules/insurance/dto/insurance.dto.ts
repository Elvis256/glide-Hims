import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsUUID,
  IsBoolean,
  IsArray,
  Min,
} from 'class-validator';
import { ProviderType, ClaimSubmissionMethod } from '../../../database/entities/insurance-provider.entity';
import { CoverageType, MemberType, PolicyStatus } from '../../../database/entities/insurance-policy.entity';
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
  name: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiPropertyOptional({ enum: ProviderType })
  @IsOptional()
  @IsEnum(ProviderType)
  providerType?: ProviderType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: ClaimSubmissionMethod })
  @IsOptional()
  @IsEnum(ClaimSubmissionMethod)
  claimSubmissionMethod?: ClaimSubmissionMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  paymentTermsDays?: number;
}

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
  policyNumber: string;

  @ApiProperty()
  @IsString()
  memberNumber: string;

  @ApiPropertyOptional({ enum: MemberType })
  @IsOptional()
  @IsEnum(MemberType)
  memberType?: MemberType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  principalMemberNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employerCode?: string;

  @ApiPropertyOptional({ enum: CoverageType })
  @IsOptional()
  @IsEnum(CoverageType)
  coverageType?: CoverageType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  copayPercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
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
  primaryDiagnosis: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosisCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  secondaryDiagnoses?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  items?: CreateClaimItemDto[];
}

export class CreateClaimItemDto {
  @ApiProperty({ enum: ClaimItemType })
  @IsEnum(ClaimItemType)
  itemType: ClaimItemType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceCode?: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty()
  @IsDateString()
  serviceDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerNotes?: string;
}

export class SubmitClaimDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ProcessClaimDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  approvedAmount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  denialReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  denialCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordPaymentDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  paidAmount: number;

  @ApiProperty()
  @IsString()
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
  primaryDiagnosis: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosisCode?: string;

  @ApiProperty()
  @IsString()
  clinicalJustification: string;

  @ApiProperty()
  @IsString()
  proposedTreatment: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
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
  @IsNumber()
  @Min(1)
  expectedLosDays?: number;
}

export class ProcessPreAuthDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
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
  insurerReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  denialReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
