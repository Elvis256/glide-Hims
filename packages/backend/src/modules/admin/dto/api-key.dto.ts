import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * An API key grants programmatic access, and its body was an inline type — so
 * `scopes` could be absent, a string, or anything else, and the rate limit and
 * expiry were unbounded.
 */
export class CreateApiKeyDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  scopes: string[];

  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) rateLimitPerHour?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3650) expiresInDays?: number;
  @IsOptional() @IsString() @MaxLength(2000) ipWhitelist?: string;
}

export class UpdateApiKeyDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) scopes?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) rateLimitPerHour?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) ipWhitelist?: string;
}
