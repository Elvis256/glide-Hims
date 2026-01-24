import { IsString, IsOptional, IsUUID, IsNumber, IsEnum, IsDateString, IsObject, Min, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { WardType, WardStatus } from '../../../database/entities/ward.entity';
import { BedType, BedStatus } from '../../../database/entities/bed.entity';
import { AdmissionType, AdmissionStatus } from '../../../database/entities/admission.entity';
import { NursingNoteType } from '../../../database/entities/nursing-note.entity';
import { MedicationStatus } from '../../../database/entities/medication-administration.entity';
import { TransferReason } from '../../../database/entities/bed-transfer.entity';

// Ward DTOs
export class CreateWardDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsEnum(WardType)
  @IsOptional()
  type?: WardType;

  @IsString()
  @IsOptional()
  floor?: string;

  @IsString()
  @IsOptional()
  building?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  facilityId: string;
}

export class UpdateWardDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(WardType)
  @IsOptional()
  type?: WardType;

  @IsEnum(WardStatus)
  @IsOptional()
  status?: WardStatus;

  @IsString()
  @IsOptional()
  floor?: string;

  @IsString()
  @IsOptional()
  building?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

// Bed DTOs
export class CreateBedDto {
  @IsString()
  bedNumber: string;

  @IsEnum(BedType)
  @IsOptional()
  type?: BedType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  dailyRate?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  wardId: string;
}

export class UpdateBedDto {
  @IsString()
  @IsOptional()
  bedNumber?: string;

  @IsEnum(BedType)
  @IsOptional()
  type?: BedType;

  @IsEnum(BedStatus)
  @IsOptional()
  status?: BedStatus;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  dailyRate?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class BulkCreateBedsDto {
  @IsUUID()
  wardId: string;

  @IsString()
  prefix: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  count: number;

  @IsEnum(BedType)
  @IsOptional()
  type?: BedType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  dailyRate?: number;
}

// Admission DTOs
export class CreateAdmissionDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  encounterId: string;

  @IsUUID()
  wardId: string;

  @IsUUID()
  bedId: string;

  @IsEnum(AdmissionType)
  @IsOptional()
  type?: AdmissionType;

  @IsString()
  @IsOptional()
  admissionReason?: string;

  @IsString()
  @IsOptional()
  admissionDiagnosis?: string;

  @IsUUID()
  @IsOptional()
  attendingDoctorId?: string;
}

export class DischargeAdmissionDto {
  @IsString()
  @IsOptional()
  dischargeSummary?: string;

  @IsString()
  @IsOptional()
  dischargeDiagnosis?: string;

  @IsString()
  @IsOptional()
  dischargeInstructions?: string;

  @IsString()
  @IsOptional()
  followUpPlan?: string;
}

export class TransferBedDto {
  @IsUUID()
  toWardId: string;

  @IsUUID()
  toBedId: string;

  @IsEnum(TransferReason)
  reason: TransferReason;

  @IsString()
  @IsOptional()
  notes?: string;
}

// Nursing Note DTOs
export class CreateNursingNoteDto {
  @IsUUID()
  admissionId: string;

  @IsEnum(NursingNoteType)
  @IsOptional()
  type?: NursingNoteType;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  shift?: string;

  @IsObject()
  @IsOptional()
  vitals?: {
    temperature?: number;
    pulse?: number;
    bpSystolic?: number;
    bpDiastolic?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    painLevel?: number;
  };

  @IsObject()
  @IsOptional()
  intakeOutput?: {
    oralIntake?: number;
    ivFluids?: number;
    urineOutput?: number;
    otherOutput?: number;
  };
}

// Medication Administration DTOs
export class ScheduleMedicationDto {
  @IsUUID()
  admissionId: string;

  @IsUUID()
  @IsOptional()
  prescriptionItemId?: string;

  @IsString()
  drugName: string;

  @IsString()
  dose: string;

  @IsString()
  route: string;

  @IsDateString()
  scheduledTime: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AdministerMedicationDto {
  @IsEnum(MedicationStatus)
  status: MedicationStatus;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

// Query DTOs
export class WardQueryDto {
  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @IsEnum(WardType)
  @IsOptional()
  type?: WardType;

  @IsEnum(WardStatus)
  @IsOptional()
  status?: WardStatus;
}

export class AdmissionQueryDto {
  @IsUUID()
  @IsOptional()
  wardId?: string;

  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsEnum(AdmissionStatus)
  @IsOptional()
  status?: AdmissionStatus;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
