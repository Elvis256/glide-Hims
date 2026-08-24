import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * These two handlers declared their bodies as INLINE TypeScript types. An
 * inline type is erased at compile time, so the ValidationPipe has no metadata
 * and validates nothing — the same trap as the maternity partograph DTO and the
 * critical-result acknowledgement.
 *
 * The cost here: POST /features/check-batch with an empty body reached
 * `body.featureKeys.map` and threw "Cannot read properties of undefined
 * (reading 'map')" as a 500, and POST /features/system/definitions reached
 * Postgres and failed on "null value in column feature_key".
 */
export class CheckFeaturesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  featureKeys: string[];
}

export class UpsertSystemFeatureDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  featureKey: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  category: string;

  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsBoolean() defaultEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(60) minLicenseType?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) dependencies?: string[];
}
