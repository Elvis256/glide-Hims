import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf, IsNotEmpty } from 'class-validator';

/**
 * Overriding the discharge checks is a clinical decision, so it must carry a
 * reason. The body was an inline type: `override: true` with no reason went
 * through silently.
 */
export class FinalizeDischargeDto {
  @IsOptional()
  @IsBoolean()
  override?: boolean;

  @ValidateIf((o) => o.override === true)
  @IsString()
  @IsNotEmpty({ message: 'overrideReason is required when override is true' })
  @MaxLength(2000)
  overrideReason?: string;
}
