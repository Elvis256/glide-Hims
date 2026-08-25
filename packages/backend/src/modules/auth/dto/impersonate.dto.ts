import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * POST /auth/impersonate takes over another tenant's session. It was an inline
 * object type, so nothing checked at runtime that tenantId was even a string —
 * on the one route in the system whose entire purpose is to assume someone
 * else's identity, and whose `reason` is what an auditor reads afterwards.
 */
export class StartImpersonationDto {
  @ApiProperty()
  @IsUUID()
  tenantId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
