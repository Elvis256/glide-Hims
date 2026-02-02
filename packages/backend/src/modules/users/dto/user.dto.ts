import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsNumber,
  Min,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EmploymentType, Gender, StaffCategory } from '../../../database/entities/employee.entity';

export { StaffCategory } from '../../../database/entities/employee.entity';

// Employee profile to be created with user
export class CreateEmployeeProfileDto {
  @ApiProperty({ description: 'Facility ID where employee works' })
  @IsUUID()
  facilityId: string;

  @ApiProperty({ enum: StaffCategory, description: 'Category of staff member' })
  @IsEnum(StaffCategory)
  staffCategory: StaffCategory;

  @ApiProperty({ example: 'Senior Consultant' })
  @IsString()
  jobTitle: string;

  @ApiPropertyOptional({ example: 'Outpatient' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ enum: EmploymentType })
  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @ApiProperty({ example: '1990-01-15' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender: Gender;

  @ApiPropertyOptional({ example: 'CM12345678' })
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiPropertyOptional({ example: 5000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basicSalary?: number;

  @ApiPropertyOptional({ description: 'Medical license number for doctors/consultants' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ description: 'Medical specialization' })
  @IsOptional()
  @IsString()
  specialization?: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'jdoe' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'jdoe@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+256700000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ default: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Employee profile to create with user' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateEmployeeProfileDto)
  employeeProfile?: CreateEmployeeProfileDto;

  @ApiPropertyOptional({ description: 'Link to existing employee ID' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  password?: string;
}

export class AssignRoleDto {
  @ApiProperty({ description: 'Role ID to assign' })
  @IsUUID()
  roleId: string;

  @ApiPropertyOptional({ description: 'Facility ID to scope the role' })
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @ApiPropertyOptional({ description: 'Department ID to scope the role' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class LinkEmployeeDto {
  @ApiProperty({ description: 'Employee ID to link to user' })
  @IsUUID()
  employeeId: string;
}

export class AssignPermissionDto {
  @ApiProperty({ description: 'Permission ID to assign directly to user' })
  @IsUUID()
  permissionId: string;

  @ApiPropertyOptional({ description: 'Notes about why this permission was granted' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phone?: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  mfaEnabled: boolean;

  @ApiProperty()
  lastLoginAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UserListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}
