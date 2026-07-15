import { IsUUID, IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class CreateBloodGlucoseDto {
  @IsUUID()
  admissionId: string;

  @IsNumber()
  value: number;

  @IsString()
  timing: string;

  @IsOptional()
  @IsObject()
  insulinGiven?: { type: string; dose: number; unit: string };

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryBloodGlucoseDto {
  @IsOptional()
  @IsUUID()
  admissionId?: string;
}
