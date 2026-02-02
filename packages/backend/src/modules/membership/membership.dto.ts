import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, IsUUID, IsDateString, IsObject } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { MembershipType } from '../../database/entities/membership.entity';

export class CreateMembershipSchemeDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ enum: MembershipType }) @IsEnum(MembershipType) type: MembershipType;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() discountPercent?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() creditLimit?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() requiresApproval?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() validDays?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsObject() benefits?: Record<string, any>;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() facilityId?: string;
}

export class UpdateMembershipSchemeDto extends PartialType(CreateMembershipSchemeDto) {}

export class CreatePatientMembershipDto {
  @ApiProperty() @IsUUID() patientId: string;
  @ApiProperty() @IsUUID() schemeId: string;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() endDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() corporateName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() employeeId?: string;
}

export class UpdatePatientMembershipDto extends PartialType(CreatePatientMembershipDto) {
  @ApiProperty({ required: false }) @IsOptional() @IsString() status?: string;
}
