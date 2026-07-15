import api from './api';

// ===== Intake/Output =====
export interface IntakeOutputEntry {
  id: string;
  admissionId: string;
  timestamp: string;
  type: 'intake' | 'output';
  category: string;
  amount: number;
  unit: string;
  characteristics?: Record<string, any>;
  notes?: string;
  recordedBy?: { id: string; fullName: string };
  createdAt: string;
}

export interface IOSummary {
  intake: number;
  output: number;
  balance: number;
}

export interface CreateIntakeOutputDto {
  admissionId: string;
  timestamp: string;
  type: 'intake' | 'output';
  category: string;
  amount: number;
  unit?: string;
  characteristics?: Record<string, any>;
  notes?: string;
}

// ===== Blood Glucose =====
export interface BloodGlucoseReading {
  id: string;
  admissionId: string;
  value: number;
  timing: string;
  insulinGiven?: { type: string; dose: number; unit: string };
  notes?: string;
  recordedBy?: { id: string; fullName: string };
  createdAt: string;
}

export interface CreateBloodGlucoseDto {
  admissionId: string;
  value: number;
  timing: string;
  insulinGiven?: { type: string; dose: number; unit: string };
  notes?: string;
}

// ===== Neuro Observations =====
export interface NeuroObservation {
  id: string;
  admissionId: string;
  avpu: string;
  gcsEye?: number;
  gcsVerbal?: number;
  gcsMotor?: number;
  gcsTotal?: number;
  pupilLeftSize?: string;
  pupilLeftReaction?: string;
  pupilRightSize?: string;
  pupilRightReaction?: string;
  limbLeftArm?: string;
  limbRightArm?: string;
  limbLeftLeg?: string;
  limbRightLeg?: string;
  notes?: string;
  assessedBy?: { id: string; fullName: string };
  createdAt: string;
}

export interface CreateNeuroObservationDto {
  admissionId: string;
  avpu: string;
  gcsEye?: number;
  gcsVerbal?: number;
  gcsMotor?: number;
  pupilLeftSize?: string;
  pupilLeftReaction?: string;
  pupilRightSize?: string;
  pupilRightReaction?: string;
  limbLeftArm?: string;
  limbRightArm?: string;
  limbLeftLeg?: string;
  limbRightLeg?: string;
  notes?: string;
}

// ===== Incident Reports =====
export interface IncidentReport {
  id: string;
  reportNumber: string;
  patientId?: string;
  patient?: { id: string; mrn: string; fullName: string };
  type: string;
  severity: string;
  status: string;
  description: string;
  location?: string;
  incidentDate: string;
  immediateAction?: string;
  rootCause?: string;
  correctiveAction?: string;
  witnesses?: { name: string; role?: string }[];
  reportedBy?: { id: string; fullName: string };
  createdAt: string;
}

export interface CreateIncidentReportDto {
  patientId?: string;
  type: string;
  severity: string;
  status?: string;
  description: string;
  location?: string;
  incidentDate: string;
  immediateAction?: string;
  witnesses?: { name: string; role?: string }[];
}

export interface UpdateIncidentReportDto {
  status?: string;
  rootCause?: string;
  correctiveAction?: string;
  description?: string;
  immediateAction?: string;
}

export interface IncidentStats {
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  total: number;
}

// ===== Care Plans =====
export interface CarePlanGoal {
  id: string;
  description: string;
  targetDate?: string;
  status: string;
  notes?: string;
}

export interface CarePlanIntervention {
  id: string;
  description: string;
  goalId?: string;
  frequency?: string;
  notes?: string;
}

export interface CarePlan {
  id: string;
  admissionId: string;
  diagnosis: string;
  priority: string;
  status: string;
  notes?: string;
  createdBy?: { id: string; fullName: string };
  goals?: CarePlanGoal[];
  interventions?: CarePlanIntervention[];
  createdAt: string;
}

export interface CreateCarePlanDto {
  admissionId: string;
  diagnosis: string;
  priority?: string;
  notes?: string;
  goals?: { description: string; targetDate?: string; notes?: string }[];
  interventions?: { description: string; goalId?: string; frequency?: string; notes?: string }[];
}

// ===== Wound Assessments =====
export interface WoundAssessment {
  id: string;
  admissionId: string;
  location: string;
  woundType: string;
  stage?: string;
  length?: number;
  width?: number;
  depth?: number;
  woundBed?: { granulation?: number; slough?: number; necrotic?: number; epithelial?: number };
  exudate?: { amount: string; type: string; color?: string };
  periwoundSkin?: string;
  treatment?: string;
  notes?: string;
  assessedBy?: { id: string; fullName: string };
  createdAt: string;
}

export interface CreateWoundAssessmentDto {
  admissionId: string;
  location: string;
  woundType: string;
  stage?: string;
  length?: number;
  width?: number;
  depth?: number;
  woundBed?: { granulation?: number; slough?: number; necrotic?: number; epithelial?: number };
  exudate?: { amount: string; type: string; color?: string };
  periwoundSkin?: string;
  treatment?: string;
  notes?: string;
}

// ===== Service =====
export const nursingService = {
  // Intake/Output
  io: {
    list: async (params?: { admissionId?: string; dateFrom?: string; dateTo?: string }): Promise<IntakeOutputEntry[]> => {
      const response = await api.get<IntakeOutputEntry[]>('/nursing/io', { params });
      return response.data;
    },
    create: async (dto: CreateIntakeOutputDto): Promise<IntakeOutputEntry> => {
      const response = await api.post<IntakeOutputEntry>('/nursing/io', dto);
      return response.data;
    },
    summary: async (admissionId: string): Promise<IOSummary> => {
      const response = await api.get<IOSummary>(`/nursing/io/summary/${admissionId}`);
      return response.data;
    },
    remove: async (id: string): Promise<void> => {
      await api.delete(`/nursing/io/${id}`);
    },
  },

  // Blood Glucose
  glucose: {
    list: async (params?: { admissionId?: string }): Promise<BloodGlucoseReading[]> => {
      const response = await api.get<BloodGlucoseReading[]>('/nursing/glucose', { params });
      return response.data;
    },
    create: async (dto: CreateBloodGlucoseDto): Promise<BloodGlucoseReading> => {
      const response = await api.post<BloodGlucoseReading>('/nursing/glucose', dto);
      return response.data;
    },
  },

  // Neuro Observations
  neuro: {
    list: async (params?: { admissionId?: string }): Promise<NeuroObservation[]> => {
      const response = await api.get<NeuroObservation[]>('/nursing/neuro', { params });
      return response.data;
    },
    create: async (dto: CreateNeuroObservationDto): Promise<NeuroObservation> => {
      const response = await api.post<NeuroObservation>('/nursing/neuro', dto);
      return response.data;
    },
  },

  // Incident Reports
  incidents: {
    list: async (params?: { status?: string; type?: string; severity?: string }): Promise<IncidentReport[]> => {
      const response = await api.get<IncidentReport[]>('/nursing/incidents', { params });
      return response.data;
    },
    get: async (id: string): Promise<IncidentReport> => {
      const response = await api.get<IncidentReport>(`/nursing/incidents/${id}`);
      return response.data;
    },
    create: async (dto: CreateIncidentReportDto): Promise<IncidentReport> => {
      const response = await api.post<IncidentReport>('/nursing/incidents', dto);
      return response.data;
    },
    update: async (id: string, dto: UpdateIncidentReportDto): Promise<IncidentReport> => {
      const response = await api.patch<IncidentReport>(`/nursing/incidents/${id}`, dto);
      return response.data;
    },
    stats: async (): Promise<IncidentStats> => {
      const response = await api.get<IncidentStats>('/nursing/incidents/stats');
      return response.data;
    },
  },

  // Care Plans
  carePlans: {
    list: async (params?: { admissionId?: string; status?: string }): Promise<CarePlan[]> => {
      const response = await api.get<CarePlan[]>('/nursing/care-plans', { params });
      return response.data;
    },
    get: async (id: string): Promise<CarePlan> => {
      const response = await api.get<CarePlan>(`/nursing/care-plans/${id}`);
      return response.data;
    },
    create: async (dto: CreateCarePlanDto): Promise<CarePlan> => {
      const response = await api.post<CarePlan>('/nursing/care-plans', dto);
      return response.data;
    },
    update: async (id: string, dto: { status?: string; notes?: string }): Promise<CarePlan> => {
      const response = await api.patch<CarePlan>(`/nursing/care-plans/${id}`, dto);
      return response.data;
    },
    addGoal: async (planId: string, dto: { description: string; targetDate?: string; notes?: string }): Promise<CarePlanGoal> => {
      const response = await api.post<CarePlanGoal>(`/nursing/care-plans/${planId}/goals`, dto);
      return response.data;
    },
    addIntervention: async (planId: string, dto: { description: string; goalId?: string; frequency?: string; notes?: string }): Promise<CarePlanIntervention> => {
      const response = await api.post<CarePlanIntervention>(`/nursing/care-plans/${planId}/interventions`, dto);
      return response.data;
    },
  },

  // Wound Assessments
  wounds: {
    list: async (params?: { admissionId?: string }): Promise<WoundAssessment[]> => {
      const response = await api.get<WoundAssessment[]>('/nursing/wounds', { params });
      return response.data;
    },
    create: async (dto: CreateWoundAssessmentDto): Promise<WoundAssessment> => {
      const response = await api.post<WoundAssessment>('/nursing/wounds', dto);
      return response.data;
    },
  },
};
