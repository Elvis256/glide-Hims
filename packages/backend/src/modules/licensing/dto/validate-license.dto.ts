import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Public and throttled, so the one thing it must not do is reach the service
 * with a non-string. It was an inline type: `{"licenseKey": {}}` went straight
 * through to the HMAC comparison.
 */
export class ValidateLicenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  licenseKey: string;
}
