import { IsUUID, IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateNeuroObservationDto {
  @IsUUID()
  admissionId: string;

  @IsString()
  avpu: string;

  @IsOptional()
  @IsNumber()
  gcsEye?: number;

  @IsOptional()
  @IsNumber()
  gcsVerbal?: number;

  @IsOptional()
  @IsNumber()
  gcsMotor?: number;

  @IsOptional()
  @IsString()
  pupilLeftSize?: string;

  @IsOptional()
  @IsString()
  pupilLeftReaction?: string;

  @IsOptional()
  @IsString()
  pupilRightSize?: string;

  @IsOptional()
  @IsString()
  pupilRightReaction?: string;

  @IsOptional()
  @IsString()
  limbLeftArm?: string;

  @IsOptional()
  @IsString()
  limbRightArm?: string;

  @IsOptional()
  @IsString()
  limbLeftLeg?: string;

  @IsOptional()
  @IsString()
  limbRightLeg?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryNeuroObservationDto {
  @IsOptional()
  @IsUUID()
  admissionId?: string;
}
