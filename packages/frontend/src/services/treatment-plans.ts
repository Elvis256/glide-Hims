import api from './api';

// Enums matching backend
export const TreatmentPlanStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  DISCONTINUED: 'discontinued',
  REVISED: 'revised',
} as const;
export type TreatmentPlanStatus = (typeof TreatmentPlanStatus)[keyof typeof TreatmentPlanStatus];

export const TreatmentPlanType = {
  ACUTE: 'acute',
  CHRONIC: 'chronic',
  PREVENTIVE: 'preventive',
  PALLIATIVE: 'palliative',
  REHABILITATION: 'rehabilitation',
  SURGICAL: 'surgical',
  MENTAL_HEALTH: 'mental_health',
} as const;
export type TreatmentPlanType = (typeof TreatmentPlanType)[keyof typeof TreatmentPlanType];

export const TreatmentGoalStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  ACHIEVED: 'achieved',
  PARTIALLY_ACHIEVED: 'partially_achieved',
  NOT_ACHIEVED: 'not_achieved',
} as const;
export type TreatmentGoalStatus = (typeof TreatmentGoalStatus)[keyof typeof TreatmentGoalStatus];

// Nested DTOs
export interface GoalDto {
  id: string;
  description: string;
  targetDate?: string;
  status?: TreatmentGoalStatus;
  measurementCriteria?: string;
  notes?: string;
}

export interface InterventionDto {
  id: string;
  type: 'medication' | 'procedure' | 'therapy' | 'lifestyle' | 'monitoring' | 'referral';
  description: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
  responsibleProvider?: string;
  status?: 'active' | 'completed' | 'discontinued';
  notes?: string;
}

export interface MedicationDto {
  drugName: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  specialInstructions?: string;
}

export interface MonitoringParameterDto {
  parameter: string;
  frequency: string;
  targetRange?: string;
}

export interface LifestyleModificationDto {
  category: 'diet' | 'exercise' | 'smoking' | 'alcohol' | 'sleep' | 'stress' | 'other';
  recommendation: string;
  details?: string;
}

export interface FollowUpScheduleDto {
  date: string;
  purpose: string;
  provider?: string;
  status?: 'scheduled' | 'completed' | 'missed' | 'cancelled';
}

export interface CareTeamMemberDto {
  providerId: string;
  name: string;
  role: string;
  specialty?: string;
}

export interface DiagnosisCode {
  code: string;
  name: string;
  type: 'primary' | 'secondary';
}

// Main interfaces
export interface TreatmentPlan {
  id: string;
  planNumber: string;
  planName: string;
  type: TreatmentPlanType;
  status: TreatmentPlanStatus;
  primaryDiagnosis: string;
  diagnosisCodes?: DiagnosisCode[];
  clinicalSummary?: string;
  startDate: string;
  expectedEndDate?: string;
  actualEndDate?: string;
  goals?: GoalDto[];
  interventions?: InterventionDto[];
  medications?: MedicationDto[];
  monitoringParameters?: MonitoringParameterDto[];
  lifestyleModifications?: LifestyleModificationDto[];
  patientEducation?: string;
  followUpSchedule?: FollowUpScheduleDto[];
  precautions?: string;
  contraindications?: string;
  allergiesConsidered?: string[];
  patientConsentObtained: boolean;
  consentDate?: string;
  revisionNumber: number;
  revisionReason?: string;
  previousPlanId?: string;
  progressNotes?: { date: string; note: string; provider: string }[];
  patientId: string;
  patient?: { id: string; firstName: string; lastName: string; mrn?: string };
  encounterId?: string;
  createdById: string;
  primaryProviderId?: string;
  careTeam?: CareTeamMemberDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTreatmentPlanDto {
  patientId: string;
  encounterId?: string;
  planName: string;
  type: TreatmentPlanType;
  primaryDiagnosis: string;
  diagnosisCodes?: DiagnosisCode[];
  clinicalSummary?: string;
  startDate: string;
  expectedEndDate?: string;
  goals?: GoalDto[];
  interventions?: InterventionDto[];
  medications?: MedicationDto[];
  monitoringParameters?: MonitoringParameterDto[];
  lifestyleModifications?: LifestyleModificationDto[];
  patientEducation?: string;
  followUpSchedule?: FollowUpScheduleDto[];
  precautions?: string;
  contraindications?: string;
  allergiesConsidered?: string[];
  primaryProviderId?: string;
  careTeam?: CareTeamMemberDto[];
}

export interface UpdateTreatmentPlanDto {
  planName?: string;
  status?: TreatmentPlanStatus;
  expectedEndDate?: string;
  goals?: GoalDto[];
  interventions?: InterventionDto[];
  medications?: MedicationDto[];
  monitoringParameters?: MonitoringParameterDto[];
  lifestyleModifications?: LifestyleModificationDto[];
  followUpSchedule?: FollowUpScheduleDto[];
  patientEducation?: string;
  precautions?: string;
}

export interface TreatmentPlanFilterDto {
  patientId?: string;
  status?: TreatmentPlanStatus;
  type?: TreatmentPlanType;
  fromDate?: string;
  toDate?: string;
}

export interface RevisePlanDto {
  revisionReason: string;
  updates?: UpdateTreatmentPlanDto;
}

export const treatmentPlansService = {
  create: (data: CreateTreatmentPlanDto) =>
    api.post<TreatmentPlan>('/treatment-plans', data),

  list: (params?: TreatmentPlanFilterDto) =>
    api.get<TreatmentPlan[]>('/treatment-plans', { params }),

  getById: (id: string) =>
    api.get<TreatmentPlan>(`/treatment-plans/${id}`),

  getByPatient: (patientId: string) =>
    api.get<TreatmentPlan[]>(`/treatment-plans/patient/${patientId}`),

  getActiveByPatient: (patientId: string) =>
    api.get<TreatmentPlan[]>(`/treatment-plans/patient/${patientId}/active`),

  update: (id: string, data: UpdateTreatmentPlanDto) =>
    api.put<TreatmentPlan>(`/treatment-plans/${id}`, data),

  activate: (id: string) =>
    api.post<TreatmentPlan>(`/treatment-plans/${id}/activate`),

  complete: (id: string) =>
    api.post<TreatmentPlan>(`/treatment-plans/${id}/complete`),

  discontinue: (id: string, reason: string) =>
    api.post<TreatmentPlan>(`/treatment-plans/${id}/discontinue`, { reason }),

  addProgressNote: (id: string, note: string) =>
    api.post<TreatmentPlan>(`/treatment-plans/${id}/progress-notes`, { note }),

  updateGoalStatus: (id: string, goalId: string, status: string) =>
    api.post<TreatmentPlan>(`/treatment-plans/${id}/goals/${goalId}/status`, { status }),

  revise: (id: string, data: RevisePlanDto) =>
    api.post<TreatmentPlan>(`/treatment-plans/${id}/revise`, data),

  recordConsent: (id: string) =>
    api.post<TreatmentPlan>(`/treatment-plans/${id}/consent`),
};

export default treatmentPlansService;
