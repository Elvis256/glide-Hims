import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsDateString,
  IsEnum,
  Matches,
  MaxLength,
  IsIn,
  IsObject,
  ValidateNested,
  IsArray,
  IsBoolean,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ConsentType } from '../../../database/entities/patient-consent.entity';

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

export class ConsentRecordDto {
  @IsEnum(ConsentType)
  consentType: ConsentType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  version?: string;

  @IsOptional()
  @IsBoolean()
  accepted?: boolean;
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
  @Matches(/^\+?\d{7,15}$/, {
    message: 'Phone must be a valid phone number (7-15 digits, optional + prefix)',
  })
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
  @IsIn([...VALID_BLOOD_GROUPS], {
    message: 'Blood group must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-',
  })
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

  @ApiPropertyOptional({ description: 'Opt out of marketing/reminder SMS messages' })
  @IsOptional()
  @IsBoolean()
  smsOptOut?: boolean;

  @ApiPropertyOptional({ description: 'Opt out of WhatsApp messages' })
  @IsOptional()
  @IsBoolean()
  whatsappOptOut?: boolean;

  @ApiPropertyOptional({ description: 'Opt out of marketing/reminder emails' })
  @IsOptional()
  @IsBoolean()
  emailOptOut?: boolean;

  @ApiPropertyOptional({
    description:
      'Override the server-side high-confidence duplicate guard. Use only when the receptionist has manually confirmed via /patients/check-duplicates that this is a genuinely different person (e.g. twins, common name).',
  })
  @IsOptional()
  @IsBoolean()
  forceCreate?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata (max 5 fields)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string | number | boolean>;

  @ApiPropertyOptional({ description: 'Consents to record at registration', type: [ConsentRecordDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConsentRecordDto)
  consents?: ConsentRecordDto[];

  @ApiPropertyOptional({ description: 'Skip consent validation warning' })
  @IsOptional()
  @IsBoolean()
  skipConsentValidation?: boolean;
}

export class UpdatePatientDto extends PartialType(CreatePatientDto) {
  @ApiPropertyOptional({ description: 'Record status', enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}

export class MergePatientDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class LinkUserDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

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

  @ApiPropertyOptional({ enum: ['male', 'female', 'other'] })
  @IsOptional()
  @IsIn(['male', 'female', 'other'])
  gender?: string;

  @ApiPropertyOptional({
    description: 'Payment preference recorded at registration (stored in metadata)',
    enum: ['cash', 'insurance', 'corporate', 'membership'],
  })
  @IsOptional()
  @IsIn(['cash', 'insurance', 'corporate', 'membership'])
  paymentType?: string;

  @ApiPropertyOptional({ description: 'Registered on/after (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Registered on/before (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number = 20;
}
