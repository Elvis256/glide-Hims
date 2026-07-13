import api from './api';

// Enums matching backend
export const SurgeryStatus = {
  SCHEDULED: 'scheduled',
  PRE_OP: 'pre_op',
  IN_PROGRESS: 'in_progress',
  POST_OP: 'post_op',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  POSTPONED: 'postponed',
} as const;
export type SurgeryStatus = (typeof SurgeryStatus)[keyof typeof SurgeryStatus];

export const SurgeryPriority = {
  ELECTIVE: 'elective',
  URGENT: 'urgent',
  EMERGENCY: 'emergency',
} as const;
export type SurgeryPriority = (typeof SurgeryPriority)[keyof typeof SurgeryPriority];

export const SurgeryType = {
  MAJOR: 'major',
  MINOR: 'minor',
  DAY_CASE: 'day_case',
} as const;
export type SurgeryType = (typeof SurgeryType)[keyof typeof SurgeryType];

export const AnesthesiaType = {
  GENERAL: 'general',
  SPINAL: 'spinal',
  EPIDURAL: 'epidural',
  LOCAL: 'local',
  REGIONAL: 'regional',
  SEDATION: 'sedation',
} as const;
export type AnesthesiaType = (typeof AnesthesiaType)[keyof typeof AnesthesiaType];

export const TheatreStatus = {
  AVAILABLE: 'available',
  IN_USE: 'in_use',
  CLEANING: 'cleaning',
  MAINTENANCE: 'maintenance',
  OUT_OF_SERVICE: 'out_of_service',
} as const;
export type TheatreStatus = (typeof TheatreStatus)[keyof typeof TheatreStatus];

export const TheatreType = {
  GENERAL: 'general',
  ORTHOPEDIC: 'orthopedic',
  CARDIAC: 'cardiac',
  NEURO: 'neuro',
  OBSTETRIC: 'obstetric',
  OPHTHALMIC: 'ophthalmic',
  ENT: 'ent',
  MINOR: 'minor',
} as const;
export type TheatreType = (typeof TheatreType)[keyof typeof TheatreType];

// Interfaces
export interface Theatre {
  id: string;
  facilityId: string;
  name: string;
  code: string;
  type: TheatreType;
  location?: string;
  capacity?: number;
  status: TheatreStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTheatreDto {
  facilityId: string;
  name: string;
  code: string;
  type: TheatreType;
  location?: string;
  capacity?: number;
}

export interface SurgeryCase {
  id: string;
  facilityId: string;
  patientId: string;
  encounterId?: string;
  theatreId: string;
  procedureName: string;
  procedureCode?: string;
  diagnosis?: string;
  surgeryType: SurgeryType;
  priority: SurgeryPriority;
  scheduledDate: string;
  scheduledTime: string;
  estimatedDurationMinutes: number;
  leadSurgeonId: string;
  assistantSurgeonId?: string;
  anesthesiologistId?: string;
  anesthesiaType?: AnesthesiaType;
  status: SurgeryStatus;
  patient?: { id: string; firstName: string; lastName: string; mrn?: string };
  theatre?: Theatre;
  leadSurgeon?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleSurgeryDto {
  facilityId: string;
  patientId: string;
  encounterId?: string;
  theatreId: string;
  procedureName: string;
  procedureCode?: string;
  diagnosis?: string;
  surgeryType: SurgeryType;
  priority: SurgeryPriority;
  scheduledDate: string;
  scheduledTime: string;
  estimatedDurationMinutes: number;
  leadSurgeonId: string;
  assistantSurgeonId?: string;
  anesthesiologistId?: string;
  anesthesiaType?: AnesthesiaType;
}

export interface PreOpChecklistItem {
  item: string;
  checked: boolean;
  checkedBy?: string;
  checkedAt?: string;
}

export interface PreOpChecklistDto {
  checklist: PreOpChecklistItem[];
  preOpNotes?: string;
  consentSigned?: boolean;
  bloodAvailable?: boolean;
  bloodGroup?: string;
}

export interface StartSurgeryDto {
  anesthesiaNotes?: string;
  nursingTeam?: { id: string; name: string; role: string }[];
}

export interface IntraOpComplication {
  type: string;
  description: string;
  time: string;
}

export interface IntraOpSpecimen {
  type: string;
  sentTo: string;
  labId?: string;
}

export interface IntraOpNotesDto {
  operativeFindings?: string;
  operativeNotes?: string;
  complications?: IntraOpComplication[];
  bloodLossMl?: number;
  specimensCollected?: IntraOpSpecimen[];
}

export interface CompleteSurgeryDto {
  operativeFindings: string;
  operativeNotes: string;
  bloodLossMl?: number;
  postOpDiagnosis?: string;
  postOpInstructions?: string;
  dischargeDestination: string;
  recoveryNotes?: string;
}

export interface CancelSurgeryDto {
  reason: string;
  newDate?: string;
  newTime?: string;
}

export interface SurgeryCaseQuery {
  facilityId: string;
  status?: SurgeryStatus;
  limit?: number;
  offset?: number;
}

// ── WHO Surgical Safety Checklist ────────────────────────────────────────────

export type WhoChecklistPhase = 'sign_in' | 'time_out' | 'sign_out';

export interface WhoChecklist {
  id: string;
  surgeryCaseId: string;
  signIn?: Record<string, unknown> | null;
  signInCompletedById?: string | null;
  signInCompletedAt?: string | null;
  timeOut?: Record<string, unknown> | null;
  timeOutCompletedById?: string | null;
  timeOutCompletedAt?: string | null;
  signOut?: Record<string, unknown> | null;
  signOutCompletedById?: string | null;
  signOutCompletedAt?: string | null;
}

export const surgeryService = {
  // Theatres
  theatres: {
    create: (data: CreateTheatreDto) =>
      api.post<Theatre>('/surgery/theatres', data),

    list: (facilityId: string) =>
      api.get<Theatre[]>('/surgery/theatres', { params: { facilityId } }),

    getById: (id: string) =>
      api.get<Theatre>(`/surgery/theatres/${id}`),

    updateStatus: (id: string, status: TheatreStatus) =>
      api.put<Theatre>(`/surgery/theatres/${id}/status`, { status }),
  },

  // Cases
  cases: {
    schedule: (data: ScheduleSurgeryDto) =>
      api.post<SurgeryCase>('/surgery/cases', data),

    list: (params: SurgeryCaseQuery) =>
      api.get<SurgeryCase[]>('/surgery/cases', { params }),

    getById: (id: string) =>
      api.get<SurgeryCase>(`/surgery/cases/${id}`),

    updatePreOp: (id: string, data: PreOpChecklistDto) =>
      api.put<SurgeryCase>(`/surgery/cases/${id}/pre-op`, data),

    start: (id: string, data?: StartSurgeryDto) =>
      api.put<SurgeryCase>(`/surgery/cases/${id}/start`, data || {}),

    updateIntraOp: (id: string, data: IntraOpNotesDto) =>
      api.put<SurgeryCase>(`/surgery/cases/${id}/intra-op`, data),

    complete: (id: string, data: CompleteSurgeryDto) =>
      api.put<SurgeryCase>(`/surgery/cases/${id}/complete`, data),

    dischargeRecovery: (id: string) =>
      api.put<SurgeryCase>(`/surgery/cases/${id}/discharge-recovery`),

    cancel: (id: string, data: CancelSurgeryDto) =>
      api.put<SurgeryCase>(`/surgery/cases/${id}/cancel`, data),

    reconfirm: (id: string) =>
      api.put<SurgeryCase>(`/surgery/cases/${id}/reconfirm`),
  },

  // WHO Surgical Safety Checklist
  whoChecklist: {
    get: (caseId: string) =>
      api.get<WhoChecklist>(`/surgery/cases/${caseId}/who-checklist`),

    completePhase: (caseId: string, phase: WhoChecklistPhase, items: Record<string, unknown>) =>
      api.put<WhoChecklist>(`/surgery/cases/${caseId}/who-checklist/${phase}`, { items }),
  },

  // Schedule & Dashboard
  getDashboard: (facilityId: string) =>
    api.get('/surgery/dashboard', { params: { facilityId } }),

  getTodaySchedule: (facilityId: string) =>
    api.get<SurgeryCase[]>('/surgery/schedule/today', { params: { facilityId } }),

  getScheduleByDate: (facilityId: string, date: string) =>
    api.get<SurgeryCase[]>('/surgery/schedule/date', { params: { facilityId, date } }),

  getWeeklySchedule: (facilityId: string, startDate?: string) =>
    api.get<SurgeryCase[]>('/surgery/schedule/week', { params: { facilityId, startDate } }),

  checkConflicts: (params: {
    theatreId: string;
    date: string;
    time: string;
    duration: number;
    excludeCaseId?: string;
  }) => api.get('/surgery/check-conflicts', { params }),
};

export default surgeryService;
