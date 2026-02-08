import { IsString, IsOptional, IsEnum, IsDateString, IsUUID, IsNumber, IsArray } from 'class-validator';
import { ServicePoint, QueueStatus, QueuePriority } from '../../../database/entities/queue.entity';

export class CreateQueueDto {
  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsEnum(ServicePoint)
  servicePoint: ServicePoint;

  @IsOptional()
  @IsEnum(QueuePriority)
  priority?: QueuePriority;

  @IsOptional()
  @IsString()
  priorityReason?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  assignedDoctorId?: string;
}

export class CallNextDto {
  @IsEnum(ServicePoint)
  servicePoint: ServicePoint;

  @IsOptional()
  @IsString()
  counterNumber?: string;

  @IsOptional()
  @IsString()
  roomNumber?: string;
}

export class TransferQueueDto {
  @IsEnum(ServicePoint)
  nextServicePoint: ServicePoint;

  @IsOptional()
  @IsString()
  transferReason?: string;
}

export class SkipQueueDto {
  @IsString()
  skipReason: string;
}

export class QueueFilterDto {
  @IsOptional()
  @IsEnum(ServicePoint)
  servicePoint?: ServicePoint;

  @IsOptional()
  @IsEnum(QueueStatus)
  status?: QueueStatus;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  assignedDoctorId?: string;
}

export class CreateQueueDisplayDto {
  @IsString()
  name: string;

  @IsString()
  displayCode: string;

  @IsArray()
  @IsEnum(ServicePoint, { each: true })
  servicePoints: ServicePoint[];

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  displaySettings?: {
    showPatientName: boolean;
    showWaitTime: boolean;
    refreshInterval: number;
    maxDisplay: number;
    audioEnabled: boolean;
  };
}
