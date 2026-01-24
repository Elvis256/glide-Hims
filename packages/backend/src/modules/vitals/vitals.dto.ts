import { IsString, IsOptional, IsNumber, IsUUID, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVitalDto {
  @IsUUID()
  encounterId: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(30)
  @Max(45)
  temperature?: number; // Celsius

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(20)
  @Max(250)
  pulse?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(50)
  @Max(300)
  bpSystolic?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(30)
  @Max(200)
  bpDiastolic?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(5)
  @Max(60)
  respiratoryRate?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(50)
  @Max(100)
  oxygenSaturation?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0.5)
  @Max(500)
  weight?: number; // kg

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(20)
  @Max(300)
  height?: number; // cm

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  bmi?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  bloodGlucose?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10)
  painScale?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  recordedAt?: string;
}

export class UpdateVitalDto {
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  temperature?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  pulse?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  bpSystolic?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  bpDiastolic?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  respiratoryRate?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  oxygenSaturation?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  weight?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  height?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  bloodGlucose?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  painScale?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
