import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { MasterDataEntityType, ApprovalStatus } from '../../../database/entities/master-data-version.entity';

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

  requiresApproval: boolean;

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
