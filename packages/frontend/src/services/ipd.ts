import api from './api';

export interface Ward {
  id: string;
  name: string;
  code: string;
  type: 'general' | 'pediatric' | 'maternity' | 'icu' | 'surgical' | 'private';
  capacity: number;
  occupiedBeds?: number;
  availableBeds?: number;
  description?: string;
  floorNumber?: number;
  isActive: boolean;
}

export interface Bed {
  id: string;
  wardId: string;
  ward?: Ward;
  bedNumber: string;
  type: 'standard' | 'private' | 'icu' | 'pediatric' | 'maternity';
  status: 'available' | 'occupied' | 'reserved' | 'maintenance' | 'cleaning';
  currentPatientId?: string;
  currentPatient?: {
    id: string;
    mrn: string;
    fullName: string;
  };
  features?: string[];
}

export interface Admission {
  id: string;
  admissionNumber: string;
  patientId: string;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
    gender: string;
    dateOfBirth: string;
    phone?: string;
  };
  bedId: string;
  bed?: Bed;
  wardId: string;
  ward?: Ward;
  type: 'emergency' | 'elective' | 'transfer';
  admittingDiagnosis: string;
  attendingDoctorId?: string;
  attendingDoctor?: {
    id: string;
    fullName: string;
    specialization?: string;
  };
  status: 'admitted' | 'discharged' | 'transferred' | 'deceased';
  priority: 'high' | 'medium' | 'low';
  admittedAt: string;
  dischargedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdmissionDto {
  patientId: string;
  bedId: string;
  type: 'emergency' | 'elective' | 'transfer';
  admittingDiagnosis: string;
  attendingDoctorId?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface AdmissionQueryParams {
  status?: string;
  wardId?: string;
  patientId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface WardOccupancy {
  wardId: string;
  wardName: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
}

// Nursing Note Types
export type NursingNoteType = 'assessment' | 'intervention' | 'observation' | 'progress' | 'handoff' | 'incident';

export interface Vitals {
  temperature?: number;
  pulse?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  painLevel?: number;
}

export interface IntakeOutput {
  oralIntake?: number;
  ivFluids?: number;
  urineOutput?: number;
  otherOutput?: number;
}

export interface NursingNote {
  id: string;
  admissionId: string;
  type: NursingNoteType;
  content: string;
  shift?: string;
  vitals?: Vitals;
  intakeOutput?: IntakeOutput;
  nurseId: string;
  nurse?: {
    id: string;
    firstName: string;
    lastName: string;
    fullName?: string;
  };
  noteTime: string;
  createdAt: string;
}

export interface CreateNursingNoteDto {
  admissionId: string;
  type?: NursingNoteType;
  content: string;
  shift?: string;
  vitals?: Vitals;
  intakeOutput?: IntakeOutput;
}

// Medication Administration Types
export type MedicationStatus = 'scheduled' | 'given' | 'missed' | 'held' | 'refused';

export interface MedicationAdministration {
  id: string;
  admissionId: string;
  prescriptionItemId?: string;
  drugName: string;
  dose: string;
  route: string;
  scheduledTime: string;
  status: MedicationStatus;
  administeredById?: string;
  administeredBy?: {
    id: string;
    firstName: string;
    lastName: string;
    fullName?: string;
  };
  administeredTime?: string;
  batchNumber?: string;
  notes?: string;
  reason?: string;
  createdAt: string;
}

export interface ScheduleMedicationDto {
  admissionId: string;
  prescriptionItemId?: string;
  drugName: string;
  dose: string;
  route: string;
  scheduledTime: string;
  notes?: string;
}

export interface AdministerMedicationDto {
  status: MedicationStatus;
  batchNumber?: string;
  notes?: string;
  reason?: string;
}

export const ipdService = {
  // Wards
  wards: {
    list: async (): Promise<Ward[]> => {
      const response = await api.get<Ward[]>('/ipd/wards');
      return response.data;
    },
    getById: async (id: string): Promise<Ward> => {
      const response = await api.get<Ward>(`/ipd/wards/${id}`);
      return response.data;
    },
    getOccupancy: async (): Promise<WardOccupancy[]> => {
      const response = await api.get<WardOccupancy[]>('/ipd/wards/occupancy');
      return response.data;
    },
  },

  // Beds
  beds: {
    list: async (wardId?: string): Promise<Bed[]> => {
      const response = await api.get<Bed[]>('/ipd/beds', { params: { wardId } });
      return response.data;
    },
    getAvailable: async (wardId?: string): Promise<Bed[]> => {
      const response = await api.get<Bed[]>('/ipd/beds/available', { params: { wardId } });
      return response.data;
    },
  },

  // Admissions
  admissions: {
    list: async (params?: AdmissionQueryParams): Promise<{ data: Admission[]; total: number }> => {
      const response = await api.get('/ipd/admissions', { params });
      return response.data;
    },
    getById: async (id: string): Promise<Admission> => {
      const response = await api.get<Admission>(`/ipd/admissions/${id}`);
      return response.data;
    },
    create: async (data: CreateAdmissionDto): Promise<Admission> => {
      const response = await api.post<Admission>('/ipd/admissions', data);
      return response.data;
    },
    discharge: async (id: string, data: { dischargeType: string; dischargeSummary: string }): Promise<Admission> => {
      const response = await api.post<Admission>(`/ipd/admissions/${id}/discharge`, data);
      return response.data;
    },
    transfer: async (id: string, data: { targetBedId: string; reason: string }): Promise<Admission> => {
      const response = await api.post<Admission>(`/ipd/admissions/${id}/transfer`, data);
      return response.data;
    },
  },

  // Nursing Notes
  nursingNotes: {
    list: async (admissionId: string): Promise<NursingNote[]> => {
      const response = await api.get<NursingNote[]>(`/ipd/admissions/${admissionId}/nursing-notes`);
      return response.data;
    },
    create: async (data: CreateNursingNoteDto): Promise<NursingNote> => {
      const response = await api.post<NursingNote>('/ipd/nursing-notes', data);
      return response.data;
    },
  },

  // Medication Administration
  medications: {
    list: async (admissionId: string, date?: string): Promise<MedicationAdministration[]> => {
      const response = await api.get<MedicationAdministration[]>(`/ipd/admissions/${admissionId}/medications`, { params: { date } });
      return response.data;
    },
    schedule: async (data: ScheduleMedicationDto): Promise<MedicationAdministration> => {
      const response = await api.post<MedicationAdministration>('/ipd/medications', data);
      return response.data;
    },
    administer: async (id: string, data: AdministerMedicationDto): Promise<MedicationAdministration> => {
      const response = await api.put<MedicationAdministration>(`/ipd/medications/${id}/administer`, data);
      return response.data;
    },
  },

  // Stats
  getStats: async (facilityId?: string): Promise<{
    totalAdmissions: number;
    currentInpatients: number;
    dischargedToday: number;
    admittedToday: number;
    activeAdmissions?: number;
    todayAdmissions?: number;
    todayDischarges?: number;
    totalBeds?: number;
    occupiedBeds?: number;
    availableBeds?: number;
    overallOccupancyRate?: number;
  }> => {
    const response = await api.get('/ipd/stats', { params: { facilityId } });
    return response.data;
  },
};

export default ipdService;
