import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/**
 * Bulk force-password-reset. The inline type promised string[] and checked
 * nothing: an empty array was a silent no-op and a non-array would have thrown
 * inside the handler. Capped so one request cannot lock out an entire
 * directory by accident.
 */
export class BulkForcePasswordResetDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  userIds: string[];
}
