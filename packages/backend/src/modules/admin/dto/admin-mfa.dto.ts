import { IsString, IsArray, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiateMFASetupDto {
  // No fields needed - just triggers generation
}

export class VerifyMFASetupDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP code from authenticator app' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'TOTP code must be exactly 6 digits' })
  totpCode: string;

  @ApiProperty({
    example: ['ABCD-1234', 'EFGH-5678'],
    description: 'Backup codes provided during setup',
  })
  @IsArray()
  backupCodes: string[];
}

export class VerifyMFALoginDto {
  @ApiProperty({
    example: '123456',
    description: '6-digit TOTP code from authenticator app or backup code',
  })
  @IsString()
  @Length(6, 12)
  code: string;
}

export class DisableMFADto {
  @ApiProperty({
    example: 'mypassword123',
    description: 'Admin password for confirmation',
    required: false,
  })
  @IsString()
  password?: string;
}

export class RegenerateBackupCodesDto {
  // No fields needed - triggers regeneration
}

export class ForceEnableMFADto {
  @ApiProperty({ example: 'user-123', description: 'Admin user ID to enable 2FA for' })
  @IsString()
  adminId: string;
}

export class AdminMFAStatusDto {
  id: string;
  fullName: string;
  email: string;
  mfaEnabled: boolean;
  backupCodesRemaining: number;
}
