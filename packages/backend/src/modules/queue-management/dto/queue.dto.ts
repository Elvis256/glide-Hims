import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsUUID,
  IsNumber,
  IsArray,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ServicePoint,
  QueueStatus,
  QueuePriority,
  VisitType,
} from '../../../database/entities/queue.entity';

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

  /** Payment type: cash, insurance, mobile_money, card, membership, hospital_scheme, staff */
  @IsOptional()
  @IsString()
  paymentType?: string;

  /** Consultation fee override (default fetched from service pricing) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  consultationFee?: number;

  /** Insurance policy ID for insurance payments */
  @IsOptional()
  @IsUUID()
  insurancePolicyId?: string;

  /**
   * Billing timing for this visit:
   *   - 'pre_pay'  : patient pays at billing counter before consultation (queue starts at PENDING_PAYMENT)
   *   - 'post_pay' : patient consults first, settles all charges (consultation + labs + pharmacy) at checkout
   * If omitted, falls back to tenant default (system_setting `billing.mode`, default 'post_pay').
   */
  @IsOptional()
  @IsString()
  billingMode?: 'pre_pay' | 'post_pay';
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

  @IsOptional()
  @IsBoolean()
  allowCallUnpaid?: boolean;
}
