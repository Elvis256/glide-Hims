import { IsUUID, IsString, IsOptional, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreateGoalDto {
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  targetDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class CreateInterventionDto {
  @IsString()
  description: string;

  @IsOptional()
  @IsUUID()
  goalId?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateCarePlanDto {
  @IsUUID()
  admissionId: string;

  @IsString()
  diagnosis: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGoalDto)
  goals?: CreateGoalDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInterventionDto)
  interventions?: CreateInterventionDto[];
}

export class UpdateCarePlanDto {
  @IsOptional()
  @IsIn(['active', 'completed', 'discontinued'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddGoalDto {
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  targetDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddInterventionDto {
  @IsString()
  description: string;

  @IsOptional()
  @IsUUID()
  goalId?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryCarePlanDto {
  @IsOptional()
  @IsUUID()
  admissionId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
