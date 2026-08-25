import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
  IsObject,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ApproverGroupQuorum,
  ApprovalPolicyDocType,
  ApprovalPolicyStepType,
} from '../../../database/entities/org-approval.entities';

/**
 * Thirteen handlers in org-admin.controller took `@Body() body: any` or an
 * inline object type. Both are erased before the ValidationPipe sees them, so
 * whitelist and forbidNonWhitelisted had nothing to work against and every one
 * of these routes accepted and persisted arbitrary properties.
 *
 * This is the module that decides who may approve what and up to what amount.
 * An approval policy accepting an unchecked body is a control that can be
 * written around.
 */

/** `null` is meaningful on these four: it clears the assignment. */
export class SetDepartmentHeadDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  headUserId: string | null;
}

export class SetDepartmentParentDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  parentId: string | null;
}

export class SetEmployeeManagerDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  managerId: string | null;
}

export class SetEmployeePositionDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  positionId: string | null;
}

export class CreatePositionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  rank?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePositionDto extends PartialType(CreatePositionDto) {}

export class CreateApproverGroupDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: ApproverGroupQuorum })
  @IsOptional()
  @IsEnum(ApproverGroupQuorum)
  quorumType?: ApproverGroupQuorum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  quorumCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Consumed by the service, not a column on the group itself. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  memberUserIds?: string[];
}

export class UpdateApproverGroupDto extends PartialType(CreateApproverGroupDto) {}

export class ApprovalPolicyStepDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  stepOrder?: number;

  @ApiProperty({ enum: ApprovalPolicyStepType })
  @IsEnum(ApprovalPolicyStepType)
  approverType: ApprovalPolicyStepType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  roleName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  positionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  levelsUp?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  escalateToParent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  skipIfSelf?: boolean;

  /** A structured predicate on the entity, not free text. */
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  slaHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  escalateToUserId?: string;
}

export class CreateApprovalPolicyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  module?: string;

  @ApiPropertyOptional({ enum: ApprovalPolicyDocType })
  @IsOptional()
  @IsEnum(ApprovalPolicyDocType)
  documentType?: ApprovalPolicyDocType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [ApprovalPolicyStepDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalPolicyStepDto)
  steps?: ApprovalPolicyStepDto[];
}

export class UpdateApprovalPolicyDto extends PartialType(CreateApprovalPolicyDto) {}

export class CreateApprovalDelegationDto {
  @ApiProperty()
  @IsUUID()
  fromUserId: string;

  @ApiProperty()
  @IsUUID()
  toUserId: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentTypes?: string[];

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  validFrom: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  validTo: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateApprovalDelegationDto extends PartialType(CreateApprovalDelegationDto) {}

export class PreviewApprovalChainDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  module?: string;

  /**
   * Required, and only PR or PO: the resolver types it that way and cannot
   * resolve a chain without it. Under `any` this arrived as undefined and the
   * mismatch was invisible.
   */
  @ApiProperty({ enum: ['PR', 'PO'] })
  @IsIn(['PR', 'PO'])
  documentType: 'PR' | 'PO';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requesterId?: string;
}
