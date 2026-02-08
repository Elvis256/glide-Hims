import { IsString, IsUUID, IsOptional, IsInt, Min, Max, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateDoctorScheduleDto {
  @ApiProperty({ description: 'Doctor ID' })
  @IsUUID()
  doctorId: string;

  @ApiProperty({ description: 'Day of week (0=Sunday, 1=Monday, ...)' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ description: 'Start time (HH:MM)' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'End time (HH:MM)' })
  @IsString()
  endTime: string;

  @ApiPropertyOptional({ description: 'Slot duration in minutes', default: 15 })
  @IsOptional()
  @IsInt()
  @Min(5)
  slotDuration?: number;

  @ApiPropertyOptional({ description: 'Maximum patients per day', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPatients?: number;

  @ApiPropertyOptional({ description: 'Department' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Effective from date' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'Effective to date' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDoctorScheduleDto extends PartialType(CreateDoctorScheduleDto) {
  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ScheduleQueryDto {
  @ApiPropertyOptional({ description: 'Filter by doctor ID' })
  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @ApiPropertyOptional({ description: 'Filter by day of week' })
  @IsOptional()
  @IsInt()
  dayOfWeek?: number;

  @ApiPropertyOptional({ description: 'Filter by department' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Include inactive schedules' })
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;
}
