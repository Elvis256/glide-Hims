import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  DoctorEmploymentType,
  DoctorFeeMode,
} from '../../database/entities/doctor-fee-profile.entity';

export class UpsertDoctorFeeProfileDto {
  @IsOptional()
  @IsEnum(DoctorEmploymentType)
  employmentType?: DoctorEmploymentType;

  @IsOptional()
  @IsEnum(DoctorFeeMode)
  feeMode?: DoctorFeeMode;

  @IsOptional()
  @IsNumber()
  @Min(0)
  flatFee?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  percentOfSpecialty?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  doctorSharePercent?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  hospitalSharePercent?: number | null;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  workingDays?: number[] | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  followUpWindowDays?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  followUpFee?: number | null;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string | null;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
