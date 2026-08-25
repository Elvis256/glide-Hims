import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * The template create/update bodies were TypeScript interfaces, so the route
 * named a DTO and validated nothing. A prescription template's items become a
 * real prescription when the template is applied, so the dose, frequency and
 * quantity a clinician later signs off started life unchecked here.
 */
export class RxTemplateItemDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  drugName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  genericName?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  dose: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  frequency: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  duration: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  route?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;
}

export class CreateRxTemplateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  condition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  department?: string;

  @ApiProperty({ enum: ['personal', 'department', 'facility'] })
  @IsIn(['personal', 'department', 'facility'])
  scope: 'personal' | 'department' | 'facility';

  @ApiProperty({ type: [RxTemplateItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RxTemplateItemDto)
  items: RxTemplateItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  facilityId?: string;
}

export class UpdateRxTemplateDto extends PartialType(CreateRxTemplateDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
