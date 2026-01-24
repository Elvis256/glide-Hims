import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RiskLevel } from '../../../database/entities/antenatal-registration.entity';
import { DeliveryMode } from '../../../database/entities/labour-record.entity';
import { LabourOutcome } from '../../../database/entities/labour-record.entity';
import { BabySex } from '../../../database/entities/delivery-outcome.entity';
import { PNCVisitNumber, LochiaType, BreastCondition } from '../../../database/entities/postnatal-visit.entity';
import { FeedingType, CordStatus, JaundiceLevel } from '../../../database/entities/baby-wellness-check.entity';
import { AdverseReactionSeverity } from '../../../database/entities/immunization-schedule.entity';

// ============ ANTENATAL REGISTRATION ============
export class RegisterAntenatalDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty({ description: 'Last menstrual period date (YYYY-MM-DD)' })
  @IsDateString()
  lmpDate: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  gravida: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  para: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  livingChildren?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  abortions?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rhPositive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  medicalHistory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiPropertyOptional({ enum: RiskLevel })
  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  riskFactors?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partnerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partnerPhone?: string;
}

// ============ ANTENATAL VISIT ============
export class RecordAntenatalVisitDto {
  @ApiProperty()
  @IsUUID()
  registrationId: string;

  @ApiProperty({ description: 'Visit date (YYYY-MM-DD)' })
  @IsDateString()
  visitDate: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(45)
  gestationalAge: number;

  // Vitals
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  bpSystolic?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  bpDiastolic?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  pulseRate?: number;

  // Obstetric exam
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  fundalHeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fetalPresentation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  fetalHeartRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fetalMovement?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  edema?: boolean;

  // Lab
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  urineProtein?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  urineGlucose?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  hemoglobin?: number;

  // Interventions
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ironFolateGiven?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tetanusToxoidGiven?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  ttDoseNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  iptGiven?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  iptDoseNumber?: number;

  // Assessment
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complaints?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  findings?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextVisitDate?: string;
}

// ============ LABOUR ADMISSION ============
export class AdmitLabourDto {
  @ApiProperty()
  @IsUUID()
  registrationId: string;

  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsInt()
  @Min(20)
  @Max(45)
  gestationalAgeAtDelivery: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  admissionNotes?: string;

  // Vitals
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  bpSystolic?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  bpDiastolic?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  cervicalDilation?: number;
}

// ============ LABOUR PROGRESS ============
export class UpdateLabourProgressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  cervicalDilation?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  station?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  membranesIntact?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  liquorColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ DELIVERY ============
export class RecordDeliveryDto {
  @ApiProperty({ enum: DeliveryMode })
  @IsEnum(DeliveryMode)
  deliveryMode: DeliveryMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  placentaComplete?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  bloodLossMl?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  perineumStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  episiotomyDone?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  complications?: string[];
}

// ============ BABY OUTCOME ============
export class RecordBabyOutcomeDto {
  @ApiProperty()
  @IsUUID()
  labourRecordId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  babyNumber?: number;

  @ApiProperty({ enum: LabourOutcome })
  @IsEnum(LabourOutcome)
  outcome: LabourOutcome;

  @ApiProperty({ enum: BabySex })
  @IsEnum(BabySex)
  sex: BabySex;

  @ApiProperty()
  @IsNumber()
  @Min(0.3)
  @Max(7)
  birthWeight: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  birthLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  headCircumference?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  apgar1min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  apgar5min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  resuscitationNeeded?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  skinToSkin?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  breastfeedingInitiated?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  vitaminKGiven?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bcgGiven?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  abnormalities?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ POSTNATAL VISIT ============
export class RecordPostnatalVisitDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsUUID()
  registrationId: string;

  @ApiProperty()
  @IsUUID()
  deliveryOutcomeId: string;

  @ApiProperty({ enum: PNCVisitNumber })
  @IsEnum(PNCVisitNumber)
  visitNumber: PNCVisitNumber;

  @ApiProperty()
  @IsDateString()
  visitDate: string;

  // Vitals
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  bpSystolic?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  bpDiastolic?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  pulseRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  respiratoryRate?: number;

  // Uterine Assessment
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  uterusWellContracted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  fundalHeightCm?: number;

  // Lochia
  @ApiPropertyOptional({ enum: LochiaType })
  @IsOptional()
  @IsEnum(LochiaType)
  lochiaType?: LochiaType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  lochiaNormalAmount?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  lochiaFoulSmelling?: boolean;

  // Wound
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  perineumIntact?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  woundHealingWell?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  woundInfectionSigns?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  woundNotes?: string;

  // Breast
  @ApiPropertyOptional({ enum: BreastCondition })
  @IsOptional()
  @IsEnum(BreastCondition)
  breastCondition?: BreastCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  breastfeedingEstablished?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  breastfeedingIssues?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  breastfeedingNotes?: string;

  // Mental Health
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  epdsScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  mentalHealthReferral?: boolean;

  // Danger Signs
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  heavyBleeding?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fever?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  severeHeadache?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  blurredVision?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  convulsions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  breathingDifficulty?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  legSwelling?: boolean;

  // Interventions
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ironFolateGiven?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  vitaminAGiven?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  familyPlanningCounseling?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contraceptiveMethod?: string;

  // Notes
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complaints?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  examination?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  treatment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextVisitDate?: string;
}

// ============ BABY WELLNESS CHECK ============
export class RecordBabyWellnessDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsUUID()
  deliveryOutcomeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  postnatalVisitId?: string;

  @ApiProperty()
  @IsDateString()
  checkDate: string;

  // Vitals
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  heartRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  respiratoryRate?: number;

  // Feeding
  @ApiPropertyOptional({ enum: FeedingType })
  @IsOptional()
  @IsEnum(FeedingType)
  feedingType?: FeedingType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  feedingWell?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  feedsPerDay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  feedingNotes?: string;

  // Cord
  @ApiPropertyOptional({ enum: CordStatus })
  @IsOptional()
  @IsEnum(CordStatus)
  cordStatus?: CordStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  cordSeparationDate?: string;

  // Jaundice
  @ApiPropertyOptional({ enum: JaundiceLevel })
  @IsOptional()
  @IsEnum(JaundiceLevel)
  jaundiceLevel?: JaundiceLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  phototherapyNeeded?: boolean;

  // Eyes
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  eyesNormal?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  eyeDischarge?: boolean;

  // Danger Signs
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notFeeding?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  convulsions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fastBreathing?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  severeChestIndrawing?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  noMovement?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hypothermia?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hyperthermia?: boolean;

  // Growth
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  weightForAge?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weightChangePercent?: number;

  // Notes
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  findings?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referralReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ IMMUNIZATION ============
export class AdministerVaccineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteOfAdministration?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  adverseReaction?: boolean;

  @ApiPropertyOptional({ enum: AdverseReactionSeverity })
  @IsOptional()
  @IsEnum(AdverseReactionSeverity)
  reactionSeverity?: AdverseReactionSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reactionDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reactionTreatment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
