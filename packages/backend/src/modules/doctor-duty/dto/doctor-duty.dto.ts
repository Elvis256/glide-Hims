import { IsUUID, IsOptional, IsString, IsEnum, IsInt, Min, Max, IsDateString } from 'class-validator';
import { DutyStatus } from '../../../database/entities/doctor-duty.entity';

export class CreateDoctorDutyDto {
  @IsUUID()
  doctorId: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  dutyDate?: string; // Defaults to today

  @IsOptional()
  @IsEnum(DutyStatus)
  status?: DutyStatus;

  @IsOptional()
  @IsString()
  roomNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxPatients?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDoctorDutyDto {
  @IsOptional()
  @IsEnum(DutyStatus)
  status?: DutyStatus;

  @IsOptional()
  @IsString()
  roomNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxPatients?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CheckInDto {
  @IsUUID()
  doctorId: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  roomNumber?: string;
}

export class CheckOutDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class DoctorDutyFilterDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(DutyStatus)
  status?: DutyStatus;

  @IsOptional()
  @IsString()
  onlyOnDuty?: string; // 'true' to filter only on-duty
}
