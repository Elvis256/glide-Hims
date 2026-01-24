import { IsString, IsOptional, IsUUID, IsArray, ValidateNested, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class DiagnosisDto {
  @IsString()
  code: string;

  @IsString()
  description: string;

  @IsIn(['primary', 'secondary'])
  type: 'primary' | 'secondary';
}

export class CreateClinicalNoteDto {
  @IsUUID()
  encounterId: string;

  @IsString()
  @IsOptional()
  subjective?: string;

  @IsString()
  @IsOptional()
  objective?: string;

  @IsString()
  @IsOptional()
  assessment?: string;

  @IsString()
  @IsOptional()
  plan?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagnosisDto)
  @IsOptional()
  diagnoses?: DiagnosisDto[];

  @IsDateString()
  @IsOptional()
  followUpDate?: string;

  @IsString()
  @IsOptional()
  followUpNotes?: string;
}

export class UpdateClinicalNoteDto {
  @IsString()
  @IsOptional()
  subjective?: string;

  @IsString()
  @IsOptional()
  objective?: string;

  @IsString()
  @IsOptional()
  assessment?: string;

  @IsString()
  @IsOptional()
  plan?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagnosisDto)
  @IsOptional()
  diagnoses?: DiagnosisDto[];

  @IsDateString()
  @IsOptional()
  followUpDate?: string;

  @IsString()
  @IsOptional()
  followUpNotes?: string;
}
