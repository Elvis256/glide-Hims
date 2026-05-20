import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  IsDateString,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class DiagnosisDto {
  @IsString()
  @MaxLength(32)
  code: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsIn(['primary', 'secondary', 'differential'])
  type: 'primary' | 'secondary' | 'differential';
}

export class CreateClinicalNoteDto {
  @IsUUID()
  encounterId: string;

  @IsString()
  @IsOptional()
  @MaxLength(20000)
  subjective?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20000)
  objective?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20000)
  assessment?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20000)
  plan?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DiagnosisDto)
  @IsOptional()
  diagnoses?: DiagnosisDto[];

  @IsDateString()
  @IsOptional()
  followUpDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  followUpNotes?: string;
}

export class UpdateClinicalNoteDto {
  @IsString()
  @IsOptional()
  @MaxLength(20000)
  subjective?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20000)
  objective?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20000)
  assessment?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20000)
  plan?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DiagnosisDto)
  @IsOptional()
  diagnoses?: DiagnosisDto[];

  @IsDateString()
  @IsOptional()
  followUpDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  followUpNotes?: string;
}
