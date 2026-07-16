import { IsString, IsOptional, IsEnum, IsUUID, IsBoolean } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import {
  MasterDataEntityType,
  ApprovalStatus,
} from '../../../database/entities/master-data-version.entity';

export class MasterDataVersionQueryDto {
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @IsOptional()
  @IsEnum(MasterDataEntityType)
  entityType?: MasterDataEntityType;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;
}

export class ApproveVersionDto {
  @IsOptional()
  @IsString()
  approvalNotes?: string;
}

export class CreateApprovalRuleDto {
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @IsEnum(MasterDataEntityType)
  entityType: MasterDataEntityType;

  // Optional so callers that omit it keep landing on the column default (false).
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsUUID()
  approverRoleId?: string;

  @IsOptional()
  minApprovers?: number;

  @IsOptional()
  notifyOnChange?: boolean;

  @IsOptional()
  notificationEmails?: string[];
}

// PartialType keeps the update surface to declared fields only; with
// forbidNonWhitelisted this is what blocks writes to id/tenantId/createdAt.
export class UpdateApprovalRuleDto extends PartialType(CreateApprovalRuleDto) {
  // Deactivation is PUT { isActive: false } — there is no DELETE route.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
