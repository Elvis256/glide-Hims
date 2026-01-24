import { IsString, IsOptional, IsBoolean, IsEnum, IsUUID, IsNumber, IsArray } from 'class-validator';
import { ProviderType, ProviderStatus } from '../../../database/entities/provider.entity';

export class CreateProviderDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsUUID()
  facilityId: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(ProviderType)
  providerType?: ProviderType;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  subSpecialty?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  licenseExpiry?: Date;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  regulatoryBody?: string;

  @IsOptional()
  @IsArray()
  qualifications?: { degree: string; institution: string; year: number }[];

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  canPrescribe?: boolean;

  @IsOptional()
  @IsBoolean()
  canOrderLabs?: boolean;

  @IsOptional()
  @IsBoolean()
  canOrderImaging?: boolean;

  @IsOptional()
  @IsBoolean()
  canAdmit?: boolean;

  @IsOptional()
  @IsBoolean()
  canPerformSurgery?: boolean;

  @IsOptional()
  @IsNumber()
  consultationFee?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availableDays?: string[];

  @IsOptional()
  @IsString()
  availableFrom?: string;

  @IsOptional()
  @IsString()
  availableTo?: string;

  @IsOptional()
  @IsNumber()
  maxPatientsPerDay?: number;
}

export class UpdateProviderDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  subSpecialty?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  licenseExpiry?: Date;

  @IsOptional()
  @IsBoolean()
  canPrescribe?: boolean;

  @IsOptional()
  @IsBoolean()
  canOrderLabs?: boolean;

  @IsOptional()
  @IsBoolean()
  canOrderImaging?: boolean;

  @IsOptional()
  @IsBoolean()
  canAdmit?: boolean;

  @IsOptional()
  @IsBoolean()
  canPerformSurgery?: boolean;

  @IsOptional()
  @IsNumber()
  consultationFee?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availableDays?: string[];

  @IsOptional()
  @IsString()
  availableFrom?: string;

  @IsOptional()
  @IsString()
  availableTo?: string;

  @IsOptional()
  @IsEnum(ProviderStatus)
  status?: ProviderStatus;
}

export class ProviderSearchDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(ProviderType)
  providerType?: ProviderType;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsEnum(ProviderStatus)
  status?: ProviderStatus;

  @IsOptional()
  @IsBoolean()
  canPrescribe?: boolean;

  @IsOptional()
  @IsBoolean()
  canPerformSurgery?: boolean;
}
