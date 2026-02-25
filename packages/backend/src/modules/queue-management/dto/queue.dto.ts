import { IsString, IsOptional, IsEnum, IsDateString, IsUUID, IsNumber, IsArray, IsBoolean, Min, Max } from 'class-validator';
import { ServicePoint, QueueStatus, QueuePriority, VisitType } from '../../../database/entities/queue.entity';

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

  /** Visit type — determines routing, optional for legacy compatibility */
  @IsOptional()
  @IsEnum(VisitType)
  visitType?: VisitType;

  /** Chief complaint captured at reception before triage */
  @IsOptional()
  @IsString()
  chiefComplaintAtToken?: string;

  /** Condition flags set by receptionist: elderly, pregnant, wheelchair, child, appears_unwell */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  patientConditionFlags?: string[];
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
  @IsString()
  nextServicePoint: string;

  @IsOptional()
  @IsString()
  transferReason?: string;

  /** Assigned doctor to carry forward to next service point */
  @IsOptional()
  @IsUUID()
  assignedDoctorId?: string;
}

export class SkipQueueDto {
  @IsString()
  skipReason: string;
}

export class HoldQueueDto {
  @IsString()
  holdReason: string;
}

export class QueueFilterDto {
  @IsOptional()
  @IsString()
  servicePoint?: string;

  @IsOptional()
  @IsString()
  status?: string;

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
  @IsString({ each: true })
  servicePoints: string[];

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

export class ServiceConfigDto {
  @IsOptional()
  @IsArray()
  servicePoints?: Array<{
    code: string;
    label: string;
    prefix: string;
    color?: string;
    capacity?: number;
  }>;

  @IsOptional()
  triageDispositions?: Array<{
    value: string;
    label: string;
    servicePoint: string;
    priority?: number;
  }>;

  @IsOptional()
  priorityRules?: Array<{
    condition: string;
    priority: number;
    label: string;
  }>;

  @IsOptional()
  @IsString()
  opdEntryPoint?: string;

  @IsOptional()
  capacityLimits?: Record<string, number>;
}

