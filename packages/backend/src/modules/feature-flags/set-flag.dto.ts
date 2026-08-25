import { IsBoolean, IsObject, IsOptional } from 'class-validator';

/**
 * A feature flag decides whether a module is on for a tenant. `enabled` was an
 * inline-typed field, so a PUT with no body left it undefined and the service
 * wrote that straight into a boolean column.
 */
export class SetFeatureFlagDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  value?: unknown;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
