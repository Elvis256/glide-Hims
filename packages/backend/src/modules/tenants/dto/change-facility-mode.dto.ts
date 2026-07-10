import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FACILITY_MODES } from '../../../common/constants/facility-presets.constants';

const ALLOWED_MODES = Object.values(FACILITY_MODES) as string[];

export class ChangeFacilityModeDto {
  @ApiProperty({
    enum: ALLOWED_MODES,
    example: 'hospital',
    description: 'Target facility mode preset',
  })
  @IsString()
  @IsIn(ALLOWED_MODES, {
    message: `facilityMode must be one of: ${ALLOWED_MODES.join(', ')}`,
  })
  facilityMode: string;

  @ApiPropertyOptional({
    default: true,
    description:
      "When true (default), refresh the tenant's enabled_modules override from the new preset " +
      "so the change is reflected in the sidebar immediately. When false, the operator's existing " +
      'custom module list is preserved (the mode change becomes metadata-only).',
  })
  @IsOptional()
  @IsBoolean()
  syncEnabledModules?: boolean;
}
