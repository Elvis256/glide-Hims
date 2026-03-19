import api from './api';

// Enums matching backend
export const DischargeType = {
  REGULAR: 'regular',
  AGAINST_MEDICAL_ADVICE: 'against_medical_advice',
  TRANSFERRED: 'transferred',
  DECEASED: 'deceased',
  ABSCONDED: 'absconded',
  REFERRAL: 'referral',
} as const;
export type DischargeType = (typeof DischargeType)[keyof typeof DischargeType];

export const DischargeDestination = {
  HOME: 'home',
  OTHER_FACILITY: 'other_facility',
  NURSING_HOME: 'nursing_home',
  HOSPICE: 'hospice',
  REHABILITATION: 'rehabilitation',
  MORGUE: 'morgue',
} as const;
export type DischargeDestination = (typeof DischargeDestination)[keyof typeof DischargeDestination];

// Nested DTOs
export interface ProcedureDto {
  name: string;
  date: string;
  surgeon?: string;
  notes?: string;
}

export interface ConsultationDto {
  specialty: string;
  consultant: string;
  date: string;
  recommendations: string;
}

export interface VitalSignsDto {
  temperature?: number;
  pulse?: number;
  bloodPressure?: string;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
}

export interface DischargeMedicationDto {
  drugName: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions?: string;
  isNew: boolean;
}

export interface DiscontinuedMedicationDto {
  drugName: string;
  reason: string;
}

export interface FollowUpAppointmentDto {
  date: string;
  time?: string;
  department: string;
  provider?: string;
  purpose: string;
}

export interface PendingResultDto {
  testName: string;
  expectedDate: string;
  instructions: string;
}

export interface PendingReferralDto {
  specialty: string;
  reason: string;
  urgency: string;
}

export interface EducationProvidedDto {
  topic: string;
  method: string;
  understoodBy: string;
}

export interface DiagnosisCodeDto {
  code: string;
  name: string;
  type: 'primary' | 'secondary' | 'complication';
}

// Main interfaces
export interface DischargeSummary {
  id: string;
  dischargeNumber: string;
  type: DischargeType;
  destination: DischargeDestination;
  dischargeDate: string;
  chiefComplaint: string;
  presentingIllness?: string;
  admissionDiagnosis?: string;
  finalDiagnosis: string;
  diagnosisCodes?: DiagnosisCodeDto[];
  secondaryDiagnoses?: string[];
  comorbidities?: string[];
  hospitalCourse: string;
  proceduresPerformed?: ProcedureDto[];
  significantFindings?: string;
  complications?: string;
  consultations?: ConsultationDto[];
  conditionAtDischarge: string;
  vitalSignsAtDischarge?: VitalSignsDto;
  functionalStatus?: string;
  dischargeMedications?: DischargeMedicationDto[];
  medicationsDiscontinued?: DiscontinuedMedicationDto[];
  dischargeInstructions: string;
  dietInstructions?: string;
  activityInstructions?: string;
  woundCareInstructions?: string;
  warningSigns?: string;
  whenToSeekCare?: string;
  followUpAppointments?: FollowUpAppointmentDto[];
  pendingResults?: PendingResultDto[];
  pendingReferrals?: PendingReferralDto[];
  transferFacilityName?: string;
  transferReason?: string;
  transportMode?: string;
  amaReason?: string;
  amaRisksExplained?: boolean;
  amaConsentSigned?: boolean;
  educationProvided?: EducationProvidedDto[];
  emergencyContactInformed?: boolean;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  patientId: string;
  encounterId: string;
  facilityId: string;
  dischargedById: string;
  attendingPhysicianId?: string;
  patient?: { id: string; firstName: string; lastName: string; mrn?: string };
  encounter?: { id: string; visitNumber: string };
  dischargedBy?: { id: string; firstName: string; lastName: string };
  attendingPhysician?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateDischargeSummaryDto {
  patientId: string;
  encounterId: string;
  type: DischargeType;
  destination: DischargeDestination;
  dischargeDate: string;
  chiefComplaint: string;
  finalDiagnosis: string;
  hospitalCourse: string;
  conditionAtDischarge: string;
  dischargeInstructions: string;
  presentingIllness?: string;
  admissionDiagnosis?: string;
  diagnosisCodes?: DiagnosisCodeDto[];
  secondaryDiagnoses?: string[];
  comorbidities?: string[];
  proceduresPerformed?: ProcedureDto[];
  significantFindings?: string;
  complications?: string;
  consultations?: ConsultationDto[];
  vitalSignsAtDischarge?: VitalSignsDto;
  functionalStatus?: string;
  dischargeMedications?: DischargeMedicationDto[];
  medicationsDiscontinued?: DiscontinuedMedicationDto[];
  dietInstructions?: string;
  activityInstructions?: string;
  woundCareInstructions?: string;
  warningSigns?: string;
  whenToSeekCare?: string;
  followUpAppointments?: FollowUpAppointmentDto[];
  pendingResults?: PendingResultDto[];
  pendingReferrals?: PendingReferralDto[];
  transferFacilityName?: string;
  transferReason?: string;
  transportMode?: string;
  amaReason?: string;
  amaRisksExplained?: boolean;
  amaConsentSigned?: boolean;
  educationProvided?: EducationProvidedDto[];
  emergencyContactInformed?: boolean;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  attendingPhysicianId?: string;
}

export interface DischargeSummaryFilterDto {
  patientId?: string;
  type?: DischargeType;
  fromDate?: string;
  toDate?: string;
}

export const dischargeService = {
  create: (data: CreateDischargeSummaryDto) =>
    api.post<DischargeSummary>('/discharge', data),

  list: (params?: DischargeSummaryFilterDto) =>
    api.get<DischargeSummary[]>('/discharge', { params }),

  getById: (id: string) =>
    api.get<DischargeSummary>(`/discharge/${id}`),

  getByPatient: (patientId: string) =>
    api.get<DischargeSummary[]>(`/discharge/patient/${patientId}`),

  getByEncounter: (encounterId: string) =>
    api.get<DischargeSummary>(`/discharge/encounter/${encounterId}`),

  getStats: (params?: { fromDate?: string; toDate?: string }) =>
    api.get('/discharge/stats', { params }),

  update: (id: string, data: Partial<CreateDischargeSummaryDto>) =>
    api.put<DischargeSummary>(`/discharge/${id}`, data),

  print: (id: string) =>
    api.get(`/discharge/${id}/print`),
};

export default dischargeService;
