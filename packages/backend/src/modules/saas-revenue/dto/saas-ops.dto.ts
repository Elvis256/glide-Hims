import {
  IsDate,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContractStatus } from '../contract.entity';
import { OnboardingStatus, OnboardingItemStatus } from '../onboarding.entity';

// Runtime lists so the union types can actually be validated. A bare union has
// no runtime value, which is exactly how `status` was accepted as any string.
const CONTRACT_STATUSES: ContractStatus[] = [
  'draft', 'pending_signature', 'active', 'expired', 'terminated',
];
const ONBOARDING_STATUSES: OnboardingStatus[] = [
  'not_started', 'in_progress', 'completed', 'blocked',
];
const ONBOARDING_ITEM_STATUSES: OnboardingItemStatus[] = [
  'pending', 'in_progress', 'completed', 'skipped', 'blocked',
];

/**
 * These four handlers took `@Body() dto: any` — the bluntest form of no
 * validation at all. Contracts carry money and onboarding drives go-live, so
 * they are the last places to accept an unchecked shape.
 */
export class CreateContractDto {
  @IsUUID()
  tenantId: string;

  @IsString() @IsNotEmpty() @MaxLength(200) name: string;

  @IsOptional() @IsIn(CONTRACT_STATUSES) status?: ContractStatus;
  @IsOptional() @IsDate() @Type(() => Date) startDate?: Date;
  @IsOptional() @IsDate() @Type(() => Date) endDate?: Date;
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Type(() => Number) value?: number;
  @IsOptional() @IsString() @MaxLength(10) currency?: string;
  @IsOptional() @IsString() @MaxLength(8000) notes?: string;
}

export class UpdateContractDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsIn(CONTRACT_STATUSES) status?: ContractStatus;
  @IsOptional() @IsDate() @Type(() => Date) startDate?: Date;
  @IsOptional() @IsDate() @Type(() => Date) endDate?: Date;
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Type(() => Number) value?: number;
  @IsOptional() @IsString() @MaxLength(10) currency?: string;
  @IsOptional() @IsString() @MaxLength(8000) notes?: string;
}

export class CreateOnboardingDto {
  @IsUUID()
  tenantId: string;

  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsIn(ONBOARDING_STATUSES) status?: OnboardingStatus;
  @IsOptional() @IsDate() @Type(() => Date) targetGoLiveDate?: Date;
  @IsOptional() @IsString() @MaxLength(8000) notes?: string;
}

export class UpdateOnboardingItemDto {
  @IsOptional() @IsIn(ONBOARDING_ITEM_STATUSES) status?: OnboardingItemStatus;
  @IsOptional() @IsString() @MaxLength(8000) notes?: string;
  @IsOptional() @IsDate() @Type(() => Date) completedAt?: Date;
  @IsOptional() @IsUUID() assignedTo?: string;
}
