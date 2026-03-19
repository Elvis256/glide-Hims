import { IsString, IsNotEmpty, IsOptional, IsEmail, IsDateString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreatePatientDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'male', enum: ['male', 'female', 'other'] })
  @IsString()
  @IsNotEmpty()
  gender: string;

  @ApiProperty({ example: '1990-01-15' })
  @IsDateString()
  dateOfBirth: string;

  @ApiPropertyOptional({ example: 'CM1234567890' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{5,20}$/i, { message: 'National ID must be 5-20 alphanumeric characters' })
  nationalId?: string;

  @ApiPropertyOptional({ example: '+256700000000' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{7,15}$/, { message: 'Phone must be a valid phone number (7-15 digits, optional + prefix)' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Kampala, Uganda' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'patient@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'O+' })
  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @ApiPropertyOptional({ description: 'Next of kin details' })
  @IsOptional()
  nextOfKin?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdatePatientDto extends PartialType(CreatePatientDto) {}

export class PatientSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mrn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number = 20;
}
