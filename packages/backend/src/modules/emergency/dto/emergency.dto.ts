import { IsNotEmpty, IsOptional, IsEnum, IsInt, Min, Max, IsString, IsNumber, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TriageLevel, TriageStatus, ArrivalMode } from '../../../database/entities/emergency-case.entity';

export class CreateEmergencyCaseDto {
  @ApiProperty({ description: 'Facility ID' })
  @IsNotEmpty()
  @IsUUID()
  facilityId: string;

  @ApiProperty({ description: 'Patient ID' })
  @IsNotEmpty()
  @IsString()
  patientId: string;

  @ApiProperty({ description: 'Chief complaint' })
  @IsNotEmpty()
  @IsString()
  chiefComplaint: string;

  @ApiPropertyOptional({ enum: ArrivalMode })
  @IsOptional()
  @IsEnum(ArrivalMode)
  arrivalMode?: ArrivalMode;

  @ApiPropertyOptional({ description: 'Presenting symptoms' })
  @IsOptional()
  @IsString()
  presentingSymptoms?: string;

  @ApiPropertyOptional({ description: 'Mechanism of injury for trauma cases' })
  @IsOptional()
  @IsString()
  mechanismOfInjury?: string;

  @ApiPropertyOptional({ description: 'Known allergies' })
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiPropertyOptional({ description: 'Current medications' })
  @IsOptional()
  @IsString()
  currentMedications?: string;

  @ApiPropertyOptional({ description: 'Past medical history' })
  @IsOptional()
  @IsString()
  pastMedicalHistory?: string;
}

export class TriageDto {
  @ApiProperty({ enum: TriageLevel, description: '1=Resuscitation, 2=Emergent, 3=Urgent, 4=Less Urgent, 5=Non-Urgent' })
  @IsEnum(TriageLevel)
  triageLevel: TriageLevel;

  @ApiPropertyOptional({ description: 'Systolic BP' })
  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(300)
  bloodPressureSystolic?: number;

  @ApiPropertyOptional({ description: 'Diastolic BP' })
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(200)
  bloodPressureDiastolic?: number;

  @ApiPropertyOptional({ description: 'Heart rate (bpm)' })
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(250)
  heartRate?: number;

  @ApiPropertyOptional({ description: 'Respiratory rate (breaths/min)' })
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(60)
  respiratoryRate?: number;

  @ApiPropertyOptional({ description: 'Temperature (°C)' })
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiPropertyOptional({ description: 'Oxygen saturation (%)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  oxygenSaturation?: number;

  @ApiPropertyOptional({ description: 'Glasgow Coma Scale score (3-15)' })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(15)
  gcsScore?: number;

  @ApiPropertyOptional({ description: 'Pain score (0-10)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  painScore?: number;

  @ApiPropertyOptional({ description: 'Blood glucose (mg/dL)' })
  @IsOptional()
  @IsNumber()
  bloodGlucose?: number;

  @ApiPropertyOptional({ description: 'Triage notes' })
  @IsOptional()
  @IsString()
  triageNotes?: string;
}

export class StartTreatmentDto {
  @ApiPropertyOptional({ description: 'Attending doctor ID' })
  @IsOptional()
  @IsString()
  attendingDoctorId?: string;

  @ApiPropertyOptional({ description: 'Treatment notes' })
  @IsOptional()
  @IsString()
  treatmentNotes?: string;
}

export class DischargeEmergencyDto {
  @ApiProperty({ description: 'Primary diagnosis' })
  @IsNotEmpty()
  @IsString()
  primaryDiagnosis: string;

  @ApiPropertyOptional({ description: 'Disposition notes' })
  @IsOptional()
  @IsString()
  dispositionNotes?: string;

  @ApiPropertyOptional({ description: 'Treatment notes' })
  @IsOptional()
  @IsString()
  treatmentNotes?: string;
}

export class AdmitFromEmergencyDto {
  @ApiProperty({ description: 'Ward ID to admit to' })
  @IsNotEmpty()
  @IsString()
  wardId: string;

  @ApiPropertyOptional({ description: 'Bed ID' })
  @IsOptional()
  @IsString()
  bedId?: string;

  @ApiProperty({ description: 'Primary diagnosis' })
  @IsNotEmpty()
  @IsString()
  primaryDiagnosis: string;

  @ApiPropertyOptional({ description: 'Admission notes' })
  @IsOptional()
  @IsString()
  admissionNotes?: string;
}

export class EmergencyQueryDto {
  @ApiPropertyOptional({ enum: TriageStatus })
  @IsOptional()
  @IsEnum(TriageStatus)
  status?: TriageStatus;

  @ApiPropertyOptional({ enum: TriageLevel })
  @IsOptional()
  triageLevel?: TriageLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facilityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  offset?: number;
}
