import { IsString, IsNotEmpty, IsOptional, IsEmail, IsDateString, Matches, MaxLength, IsIn, IsObject, ValidateNested, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export class NextOfKinDto {
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  relationship?: string;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  address?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  nationalId?: string;
}

export class CreatePatientDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName: string;

  @ApiProperty({ example: 'male', enum: ['male', 'female', 'other'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['male', 'female', 'other'])
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
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 'patient@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'O+', enum: VALID_BLOOD_GROUPS })
  @IsOptional()
  @IsString()
  @IsIn([...VALID_BLOOD_GROUPS], { message: 'Blood group must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-' })
  bloodGroup?: string;

  @ApiPropertyOptional({ description: 'Next of kin details' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NextOfKinDto)
  nextOfKin?: NextOfKinDto;

  @ApiPropertyOptional({ description: 'Known allergies' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  allergies?: string[];

  @ApiPropertyOptional({ description: 'Marital status' })
  @IsOptional()
  @IsString()
  @IsIn(['single', 'married', 'divorced', 'widowed', 'separated'])
  maritalStatus?: string;

  @ApiPropertyOptional({ description: 'Patient occupation' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  occupation?: string;

  @ApiPropertyOptional({ description: 'Preferred language' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  language?: string;

  @ApiPropertyOptional({ description: 'Additional metadata (max 5 fields)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string | number | boolean>;
}

export class UpdatePatientDto extends PartialType(CreatePatientDto) {}

export class PatientSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  mrn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number = 20;
}
