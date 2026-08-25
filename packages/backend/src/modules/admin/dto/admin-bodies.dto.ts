import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Email templates in the integrations settings blob. */
export class CreateAdminEmailTemplateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  subject: string;

  @ApiProperty()
  @IsString()
  @MaxLength(50000)
  body: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];
}

export class UpdateAdminEmailTemplateDto extends PartialType(CreateAdminEmailTemplateDto) {}

/**
 * SSO configuration, stored as a settings blob. It is left deliberately open
 * — providers differ in what they need — but the body must still be an object,
 * which is what `any` could not guarantee.
 */
export class UpdateSsoConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  provider?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

/**
 * Alert rules decide when the system pages someone. A threshold that is not a
 * number, or a cooldown that is negative, makes a rule that either never fires
 * or never stops — neither was checked.
 */
export class CreateAlertRuleDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  metricType: string;

  @ApiProperty({ enum: ['gt', 'gte', 'lt', 'lte', 'eq'] })
  @IsIn(['gt', 'gte', 'lt', 'lte', 'eq'])
  operator: string;

  @ApiProperty()
  @IsNumber()
  threshold: number;

  @ApiProperty({ enum: ['info', 'warning', 'critical'] })
  @IsIn(['info', 'warning', 'critical'])
  severity: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  cooldownMinutes?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notifyChannels?: string[];
}

export class UpdateAlertRuleDto extends PartialType(CreateAlertRuleDto) {}
