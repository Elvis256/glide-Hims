import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  organization: string;

  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  facilityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  estimatedUsers?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  deploymentInterest?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  utmCampaign?: string;
}

export class UpdateLeadStatusDto {
  @IsString()
  status: 'new' | 'contacted' | 'qualified' | 'won' | 'lost' | 'spam';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;
}
