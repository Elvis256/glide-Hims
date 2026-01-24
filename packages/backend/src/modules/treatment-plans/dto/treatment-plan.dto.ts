import { IsString, IsOptional, IsEnum, IsDateString, IsBoolean, IsArray, ValidateNested, IsUUID, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { TreatmentPlanType, TreatmentPlanStatus, TreatmentGoalStatus } from '../../../database/entities/treatment-plan.entity';

class GoalDto {
  @IsString()
  id: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  targetDate?: string;

  @IsOptional()
  @IsEnum(TreatmentGoalStatus)
  status?: TreatmentGoalStatus;

  @IsOptional()
  @IsString()
  measurementCriteria?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class InterventionDto {
  @IsString()
  id: string;

  @IsString()
  type: 'medication' | 'procedure' | 'therapy' | 'lifestyle' | 'monitoring' | 'referral';

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  responsibleProvider?: string;

  @IsOptional()
  @IsString()
  status?: 'active' | 'completed' | 'discontinued';

  @IsOptional()
  @IsString()
  notes?: string;
}

class MedicationDto {
  @IsString()
  drugName: string;

  @IsString()
  dosage: string;

  @IsString()
  frequency: string;

  @IsString()
  route: string;

  @IsString()
  duration: string;

  @IsOptional()
  @IsString()
  specialInstructions?: string;
}

class MonitoringParameterDto {
  @IsString()
  parameter: string;

  @IsString()
  frequency: string;

  @IsOptional()
  @IsString()
  targetRange?: string;
}

class LifestyleModificationDto {
  @IsString()
  category: 'diet' | 'exercise' | 'smoking' | 'alcohol' | 'sleep' | 'stress' | 'other';

  @IsString()
  recommendation: string;

  @IsOptional()
  @IsString()
  details?: string;
}

class FollowUpScheduleDto {
  @IsString()
  date: string;

  @IsString()
  purpose: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  status?: 'scheduled' | 'completed' | 'missed' | 'cancelled';
}

class CareTeamMemberDto {
  @IsUUID()
  providerId: string;

  @IsString()
  name: string;

  @IsString()
  role: string;

  @IsOptional()
  @IsString()
  specialty?: string;
}

export class CreateTreatmentPlanDto {
  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsString()
  planName: string;

  @IsEnum(TreatmentPlanType)
  type: TreatmentPlanType;

  @IsString()
  primaryDiagnosis: string;

  @IsOptional()
  @IsArray()
  diagnosisCodes?: { code: string; name: string; type: 'primary' | 'secondary' }[];

  @IsOptional()
  @IsString()
  clinicalSummary?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  expectedEndDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoalDto)
  goals?: GoalDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterventionDto)
  interventions?: InterventionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationDto)
  medications?: MedicationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MonitoringParameterDto)
  monitoringParameters?: MonitoringParameterDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LifestyleModificationDto)
  lifestyleModifications?: LifestyleModificationDto[];

  @IsOptional()
  @IsString()
  patientEducation?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FollowUpScheduleDto)
  followUpSchedule?: FollowUpScheduleDto[];

  @IsOptional()
  @IsString()
  precautions?: string;

  @IsOptional()
  @IsString()
  contraindications?: string;

  @IsOptional()
  @IsArray()
  allergiesConsidered?: string[];

  @IsOptional()
  @IsUUID()
  primaryProviderId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CareTeamMemberDto)
  careTeam?: CareTeamMemberDto[];
}

export class UpdateTreatmentPlanDto {
  @IsOptional()
  @IsString()
  planName?: string;

  @IsOptional()
  @IsEnum(TreatmentPlanStatus)
  status?: TreatmentPlanStatus;

  @IsOptional()
  @IsDateString()
  expectedEndDate?: string;

  @IsOptional()
  @IsArray()
  goals?: GoalDto[];

  @IsOptional()
  @IsArray()
  interventions?: InterventionDto[];

  @IsOptional()
  @IsArray()
  medications?: MedicationDto[];

  @IsOptional()
  @IsArray()
  monitoringParameters?: MonitoringParameterDto[];

  @IsOptional()
  @IsArray()
  lifestyleModifications?: LifestyleModificationDto[];

  @IsOptional()
  @IsArray()
  followUpSchedule?: FollowUpScheduleDto[];

  @IsOptional()
  @IsString()
  patientEducation?: string;

  @IsOptional()
  @IsString()
  precautions?: string;
}

export class AddProgressNoteDto {
  @IsString()
  note: string;
}

export class RevisePlanDto {
  @IsString()
  revisionReason: string;

  @IsOptional()
  updates?: UpdateTreatmentPlanDto;
}

export class TreatmentPlanFilterDto {
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsEnum(TreatmentPlanStatus)
  status?: TreatmentPlanStatus;

  @IsOptional()
  @IsEnum(TreatmentPlanType)
  type?: TreatmentPlanType;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
