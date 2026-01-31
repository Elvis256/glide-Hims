import api from './api';

// Constants matching backend enums
export const TriageLevel = {
  RESUSCITATION: 1,
  EMERGENT: 2,
  URGENT: 3,
  LESS_URGENT: 4,
  NON_URGENT: 5,
} as const;
export type TriageLevel = (typeof TriageLevel)[keyof typeof TriageLevel];

export const TriageStatus = {
  PENDING: 'pending',
  TRIAGED: 'triaged',
  IN_TREATMENT: 'in_treatment',
  DISCHARGED: 'discharged',
  ADMITTED: 'admitted',
  LEFT_AMA: 'left_ama',
  DECEASED: 'deceased',
} as const;
export type TriageStatus = (typeof TriageStatus)[keyof typeof TriageStatus];

export const ArrivalMode = {
  WALK_IN: 'walk_in',
  AMBULANCE: 'ambulance',
  PRIVATE_VEHICLE: 'private_vehicle',
  POLICE: 'police',
  CARRIED: 'carried',
  REFERRED: 'referred',
} as const;
export type ArrivalMode = (typeof ArrivalMode)[keyof typeof ArrivalMode];

// DTOs
export interface CreateEmergencyCaseDto {
  facilityId: string;
  patientId: string;
  chiefComplaint: string;
  arrivalMode?: ArrivalMode;
  presentingSymptoms?: string;
  mechanismOfInjury?: string;
  allergies?: string;
  currentMedications?: string;
  pastMedicalHistory?: string;
}

export interface TriageDto {
  triageLevel: TriageLevel;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  gcsScore?: number;
  painScore?: number;
  bloodGlucose?: number;
  triageNotes?: string;
}

export interface StartTreatmentDto {
  attendingDoctorId?: string;
  treatmentNotes?: string;
}

export interface DischargeEmergencyDto {
  primaryDiagnosis: string;
  dispositionNotes?: string;
  treatmentNotes?: string;
}

export interface AdmitFromEmergencyDto {
  wardId: string;
  bedId?: string;
  primaryDiagnosis: string;
  admissionNotes?: string;
}

export interface EmergencyQueryDto {
  status?: TriageStatus;
  triageLevel?: TriageLevel;
  facilityId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

// Response types
export interface EmergencyCase {
  id: string;
  caseNumber: string;
  chiefComplaint: string;
  presentingSymptoms?: string;
  mechanismOfInjury?: string;
  allergies?: string;
  currentMedications?: string;
  pastMedicalHistory?: string;
  arrivalMode: ArrivalMode;
  arrivalTime: string;
  triageLevel: TriageLevel;
  status: TriageStatus;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  gcsScore?: number;
  painScore?: number;
  bloodGlucose?: number;
  triageNotes?: string;
  triageTime?: string;
  treatmentStartTime?: string;
  treatmentNotes?: string;
  primaryDiagnosis?: string;
  dispositionNotes?: string;
  dischargeTime?: string;
  encounterId?: string;
  facilityId: string;
  triageNurseId?: string;
  attendingDoctorId?: string;
  encounter?: {
    id: string;
    visitNumber: string;
    patient?: {
      id: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      gender: string;
      mrn?: string;
    };
  };
  triageNurse?: { id: string; firstName: string; lastName: string };
  attendingDoctor?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyDashboard {
  todayTotal: number;
  criticalCases: number;
  byTriageLevel: Record<string, number>;
  byStatus: Record<string, number>;
  avgWaitTimes: {
    triageMinutes: number;
    treatmentMinutes: number;
  };
}

export const emergencyService = {
  // Case Management
  registerCase: (data: CreateEmergencyCaseDto) => 
    api.post<EmergencyCase>('/emergency/cases', data),

  getCases: (params?: EmergencyQueryDto) => 
    api.get<{ data: EmergencyCase[]; meta: { total: number; limit: number; offset: number } }>(
      '/emergency/cases', 
      { params }
    ),

  getCase: (id: string) => 
    api.get<EmergencyCase>(`/emergency/cases/${id}`),

  // Workflow Actions
  triageCase: (id: string, data: TriageDto) => 
    api.put<EmergencyCase>(`/emergency/cases/${id}/triage`, data),

  startTreatment: (id: string, data?: StartTreatmentDto) => 
    api.put<EmergencyCase>(`/emergency/cases/${id}/start-treatment`, data || {}),

  dischargeCase: (id: string, data: DischargeEmergencyDto) => 
    api.put<EmergencyCase>(`/emergency/cases/${id}/discharge`, data),

  admitCase: (id: string, data: AdmitFromEmergencyDto) => 
    api.put<EmergencyCase>(`/emergency/cases/${id}/admit`, data),

  // Queues
  getTriageQueue: (facilityId: string) => 
    api.get<EmergencyCase[]>('/emergency/queue/triage', { params: { facilityId } }),

  getTreatmentQueue: (facilityId: string) => 
    api.get<EmergencyCase[]>('/emergency/queue/treatment', { params: { facilityId } }),

  // Dashboard
  getDashboard: (facilityId: string) => 
    api.get<EmergencyDashboard>('/emergency/dashboard', { params: { facilityId } }),
};

export default emergencyService;
