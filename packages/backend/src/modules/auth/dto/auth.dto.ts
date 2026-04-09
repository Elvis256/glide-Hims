import { IsString, IsNotEmpty, MinLength, IsOptional, IsUUID, Matches, IsEmail, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Username or email' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'Tenant ID for multi-tenant login' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ example: '123456', description: 'MFA code if enabled' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'MFA code must be exactly 6 digits' })
  mfaCode?: string;
}

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: 'Refresh token (optional if sent via cookie)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ description: 'New password', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  newPassword: string;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  expiresIn: number;

  @ApiPropertyOptional()
  mustChangePassword?: boolean;

  @ApiProperty()
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    roles: string[];
    permissions: string[];
    isSystemAdmin: boolean;
    tenantId?: string;
    facilityId?: string;
    facility?: {
      id: string;
      name: string;
      type: string;
      location?: string;
      contact?: { phone?: string; email?: string };
    };
  };
}

export class AdminResetPasswordDto {
  @ApiPropertyOptional({ description: 'New password. If not provided, a random 12-character password is generated.' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;
}
