import api from './api';

export type AllergyType = 'allergy' | 'intolerance';
export type AllergyCategory = 'medication' | 'food' | 'environment' | 'biologic' | 'other';
export type AllergyCriticality = 'low' | 'high' | 'unable-to-assess';
export type AllergySeverity = 'mild' | 'moderate' | 'severe';
export type AllergyStatus = 'active' | 'inactive' | 'resolved' | 'entered-in-error';
export type AllergyVerification = 'unconfirmed' | 'confirmed' | 'refuted';
export type AllergySource =
  | 'patient-reported'
  | 'family-reported'
  | 'observed'
  | 'imported';

export interface PatientAllergy {
  id: string;
  patientId: string;
  allergen: string;
  allergenNormalized: string;
  allergenCode?: string;
  codeSystem?: string;
  type: AllergyType;
  category: AllergyCategory;
  criticality: AllergyCriticality;
  severity?: AllergySeverity;
  reaction?: string;
  status: AllergyStatus;
  verification: AllergyVerification;
  source: AllergySource;
  onsetDate?: string;
  recordedById?: string;
  recordedAt: string;
  lastReactionAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAllergyDto {
  allergen: string;
  allergenCode?: string;
  codeSystem?: string;
  type?: AllergyType;
  category?: AllergyCategory;
  criticality?: AllergyCriticality;
  severity?: AllergySeverity;
  reaction?: string;
  verification?: AllergyVerification;
  source?: AllergySource;
  onsetDate?: string;
  notes?: string;
}

export type UpdateAllergyDto = Partial<CreateAllergyDto> & { status?: AllergyStatus };

export const allergiesService = {
  list: async (patientId: string): Promise<PatientAllergy[]> => {
    const res = await api.get<PatientAllergy[]>(`/patients/${patientId}/allergies`);
    const d: any = res.data;
    return Array.isArray(d) ? d : d?.data || [];
  },

  create: async (patientId: string, dto: CreateAllergyDto): Promise<PatientAllergy> => {
    const res = await api.post<PatientAllergy>(`/patients/${patientId}/allergies`, dto);
    return res.data;
  },

  update: async (
    patientId: string,
    id: string,
    dto: UpdateAllergyDto,
  ): Promise<PatientAllergy> => {
    const res = await api.patch<PatientAllergy>(`/patients/${patientId}/allergies/${id}`, dto);
    return res.data;
  },

  inactivate: async (patientId: string, id: string): Promise<PatientAllergy> => {
    const res = await api.patch<PatientAllergy>(
      `/patients/${patientId}/allergies/${id}/inactivate`,
      {},
    );
    return res.data;
  },

  remove: async (patientId: string, id: string): Promise<void> => {
    await api.delete(`/patients/${patientId}/allergies/${id}`);
  },
};
