import api from './api';

// Enums matching backend
export const DrugSchedule = {
  SCHEDULE_I: 'schedule_1',
  SCHEDULE_II: 'schedule_2',
  SCHEDULE_III: 'schedule_3',
  SCHEDULE_IV: 'schedule_4',
  SCHEDULE_V: 'schedule_5',
  OTC: 'otc',
  POM: 'pom',
  UNSCHEDULED: 'unscheduled',
} as const;
export type DrugSchedule = (typeof DrugSchedule)[keyof typeof DrugSchedule];

export const DrugStorageCondition = {
  ROOM_TEMPERATURE: 'room_temperature',
  REFRIGERATED: 'refrigerated',
  FROZEN: 'frozen',
  CONTROLLED_ROOM: 'controlled_room',
  COOL: 'cool',
  PROTECT_FROM_LIGHT: 'protect_from_light',
  DRY: 'dry',
} as const;
export type DrugStorageCondition = (typeof DrugStorageCondition)[keyof typeof DrugStorageCondition];

export const TherapeuticClass = {
  ANALGESICS: 'analgesics',
  ANTIBIOTICS: 'antibiotics',
  ANTIVIRALS: 'antivirals',
  ANTIFUNGALS: 'antifungals',
  ANTIMALARIALS: 'antimalarials',
  ANTIRETROVIRALS: 'antiretrovirals',
  ANTITUBERCULOSIS: 'antituberculosis',
  ANTIHYPERTENSIVES: 'antihypertensives',
  ANTIDIABETICS: 'antidiabetics',
  ANTICOAGULANTS: 'anticoagulants',
  CARDIOVASCULAR: 'cardiovascular',
  CNS_AGENTS: 'cns_agents',
  GASTROINTESTINAL: 'gastrointestinal',
  RESPIRATORY: 'respiratory',
  DERMATOLOGICAL: 'dermatological',
  HORMONES: 'hormones',
  IMMUNOSUPPRESSANTS: 'immunosuppressants',
  VACCINES: 'vaccines',
  VITAMINS: 'vitamins',
  MINERALS: 'minerals',
  FLUIDS_ELECTROLYTES: 'fluids_electrolytes',
  ANAESTHETICS: 'anaesthetics',
  ANTIDOTES: 'antidotes',
  ONCOLOGY: 'oncology',
  OPHTHALMOLOGY: 'ophthalmology',
  OTHER: 'other',
} as const;
export type TherapeuticClass = (typeof TherapeuticClass)[keyof typeof TherapeuticClass];

export const DrugFormulation = {
  TABLET: 'tablet',
  CAPSULE: 'capsule',
  SYRUP: 'syrup',
  SUSPENSION: 'suspension',
  INJECTION: 'injection',
  INFUSION: 'infusion',
  CREAM: 'cream',
  OINTMENT: 'ointment',
  GEL: 'gel',
  DROPS: 'drops',
  INHALER: 'inhaler',
  SUPPOSITORY: 'suppository',
  PATCH: 'patch',
  POWDER: 'powder',
  SOLUTION: 'solution',
  LOTION: 'lotion',
  SPRAY: 'spray',
  OTHER: 'other',
} as const;
export type DrugFormulation = (typeof DrugFormulation)[keyof typeof DrugFormulation];

// Interfaces
export interface DrugClassification {
  id: string;
  itemId: string;
  atcCode?: string;
  atcDescription?: string;
  schedule: DrugSchedule;
  therapeuticClass?: TherapeuticClass;
  therapeuticSubclass?: string;
  formulation?: DrugFormulation;
  strength?: string;
  genericName?: string;
  brandName?: string;
  isControlled: boolean;
  isNarcotic: boolean;
  isPsychotropic: boolean;
  requiresDoubleCheck: boolean;
  highAlert: boolean;
  lookAlikeSoundAlike: boolean;
  storageCondition: DrugStorageCondition;
  maxSingleDose?: number;
  maxDailyDose?: number;
  doseUnit?: string;
  contraindications?: string;
  warnings?: string;
  pregnancyCategory?: string;
  isOnFormulary: boolean;
  formularyTier?: string;
  requiresPriorAuth: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDrugClassificationDto {
  itemId: string;
  atcCode?: string;
  atcDescription?: string;
  schedule?: DrugSchedule;
  therapeuticClass?: TherapeuticClass;
  therapeuticSubclass?: string;
  formulation?: DrugFormulation;
  strength?: string;
  genericName?: string;
  brandName?: string;
  isControlled?: boolean;
  isNarcotic?: boolean;
  isPsychotropic?: boolean;
  requiresDoubleCheck?: boolean;
  highAlert?: boolean;
  lookAlikeSoundAlike?: boolean;
  storageCondition?: DrugStorageCondition;
  maxSingleDose?: number;
  maxDailyDose?: number;
  doseUnit?: string;
  contraindications?: string;
  warnings?: string;
  pregnancyCategory?: string;
  isOnFormulary?: boolean;
  formularyTier?: string;
  requiresPriorAuth?: boolean;
  notes?: string;
}

export type UpdateDrugClassificationDto = Partial<CreateDrugClassificationDto>;

export interface DrugInteraction {
  id: string;
  drugAId: string;
  drugBId: string;
  severity: string;
  description: string;
  clinicalEffects?: string;
  mechanism?: string;
  management?: string;
  reference?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDrugInteractionDto {
  drugAId: string;
  drugBId: string;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description: string;
  clinicalEffects?: string;
  mechanism?: string;
  management?: string;
  reference?: string;
}

export interface UpdateDrugInteractionDto {
  severity?: string;
  description?: string;
  clinicalEffects?: string;
  mechanism?: string;
  management?: string;
  reference?: string;
  isActive?: boolean;
}

export interface DrugAllergyClass {
  id: string;
  className: string;
  description?: string;
  relatedDrugs?: string[];
  crossReactiveClasses?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAllergyClassDto {
  className: string;
  description?: string;
  relatedDrugs?: string[];
  crossReactiveClasses?: string[];
}

export interface CheckAllergyRiskDto {
  drugId: string;
  patientAllergies: string[];
}

export interface ClassificationFilters {
  schedule?: DrugSchedule;
  therapeuticClass?: TherapeuticClass;
  isControlled?: boolean;
  isNarcotic?: boolean;
  highAlert?: boolean;
  isOnFormulary?: boolean;
}

export const drugManagementService = {
  // Classifications
  classifications: {
    create: (data: CreateDrugClassificationDto) =>
      api.post<DrugClassification>('/drug-management/classifications', data),

    list: (params?: ClassificationFilters) =>
      api.get<DrugClassification[]>('/drug-management/classifications', { params }),

    getById: (id: string) =>
      api.get<DrugClassification>(`/drug-management/classifications/${id}`),

    getByItemId: (itemId: string) =>
      api.get<DrugClassification>(`/drug-management/classifications/item/${itemId}`),

    update: (id: string, data: UpdateDrugClassificationDto) =>
      api.put<DrugClassification>(`/drug-management/classifications/${id}`, data),

    search: (q: string) =>
      api.get<DrugClassification[]>('/drug-management/classifications/search', { params: { q } }),

    getControlled: () =>
      api.get<DrugClassification[]>('/drug-management/classifications/controlled'),

    getNarcotics: () =>
      api.get<DrugClassification[]>('/drug-management/classifications/narcotics'),

    getHighAlert: () =>
      api.get<DrugClassification[]>('/drug-management/classifications/high-alert'),

    getFormulary: () =>
      api.get<DrugClassification[]>('/drug-management/classifications/formulary'),

    getByTherapeuticClass: (therapeuticClass: TherapeuticClass) =>
      api.get<DrugClassification[]>(`/drug-management/classifications/by-therapeutic-class/${therapeuticClass}`),
  },

  // Interactions
  interactions: {
    create: (data: CreateDrugInteractionDto) =>
      api.post<DrugInteraction>('/drug-management/interactions', data),

    getForDrug: (drugId: string) =>
      api.get<DrugInteraction[]>(`/drug-management/interactions/drug/${drugId}`),

    check: (drugIds: string[]) =>
      api.post<DrugInteraction[]>('/drug-management/interactions/check', { drugIds }),

    getMajor: () =>
      api.get<DrugInteraction[]>('/drug-management/interactions/major'),

    update: (id: string, data: UpdateDrugInteractionDto) =>
      api.put<DrugInteraction>(`/drug-management/interactions/${id}`, data),
  },

  // Allergy Classes
  allergyClasses: {
    create: (data: CreateAllergyClassDto) =>
      api.post<DrugAllergyClass>('/drug-management/allergy-classes', data),

    list: () =>
      api.get<DrugAllergyClass[]>('/drug-management/allergy-classes'),

    checkRisk: (data: CheckAllergyRiskDto) =>
      api.post('/drug-management/allergy-check', data),
  },

  // Reports
  reports: {
    controlledSubstances: () =>
      api.get('/drug-management/reports/controlled-substances'),

    formulary: () =>
      api.get('/drug-management/reports/formulary'),
  },

  // Sync (Drug DB Sync)
  sync: {
    syncInteractions: () =>
      api.post('/drug-management/sync/interactions'),

    syncLabels: (drugName: string) =>
      api.post(`/drug-management/sync/labels/${drugName}`),

    getStatus: () =>
      api.get('/drug-management/sync/status'),

    getLogs: () =>
      api.get('/drug-management/sync/logs'),
  },
};

export default drugManagementService;
