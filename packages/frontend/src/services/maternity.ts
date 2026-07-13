import api from './api';

// Enums matching backend
export const PregnancyStatus = {
  ACTIVE: 'active',
  DELIVERED: 'delivered',
  MISCARRIAGE: 'miscarriage',
  STILLBIRTH: 'stillbirth',
  ECTOPIC: 'ectopic',
  TRANSFERRED: 'transferred',
} as const;
export type PregnancyStatus = (typeof PregnancyStatus)[keyof typeof PregnancyStatus];

export const RiskLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export const DeliveryMode = {
  SVD: 'svd',
  ASSISTED: 'assisted',
  CAESAREAN: 'caesarean',
  BREECH: 'breech',
} as const;
export type DeliveryMode = (typeof DeliveryMode)[keyof typeof DeliveryMode];

export const LabourOutcome = {
  LIVE_BIRTH: 'live_birth',
  STILLBIRTH: 'stillbirth',
  NEONATAL_DEATH: 'neonatal_death',
} as const;
export type LabourOutcome = (typeof LabourOutcome)[keyof typeof LabourOutcome];

export const BabySex = {
  MALE: 'male',
  FEMALE: 'female',
  AMBIGUOUS: 'ambiguous',
} as const;
export type BabySex = (typeof BabySex)[keyof typeof BabySex];

export const LochiaType = {
  RUBRA: 'rubra',
  SEROSA: 'serosa',
  ALBA: 'alba',
} as const;
export type LochiaType = (typeof LochiaType)[keyof typeof LochiaType];

export const BreastCondition = {
  NORMAL: 'normal',
  ENGORGED: 'engorged',
  CRACKED_NIPPLES: 'cracked_nipples',
  MASTITIS: 'mastitis',
  ABSCESS: 'abscess',
} as const;
export type BreastCondition = (typeof BreastCondition)[keyof typeof BreastCondition];

export const FeedingType = {
  EXCLUSIVE_BREASTFEEDING: 'exclusive_breastfeeding',
  MIXED_FEEDING: 'mixed_feeding',
  FORMULA_ONLY: 'formula_only',
} as const;
export type FeedingType = (typeof FeedingType)[keyof typeof FeedingType];

export const CordStatus = {
  CLEAN_DRY: 'clean_dry',
  SLIGHTLY_WET: 'slightly_wet',
  INFECTED: 'infected',
  FALLEN_OFF: 'fallen_off',
} as const;
export type CordStatus = (typeof CordStatus)[keyof typeof CordStatus];

export const JaundiceLevel = {
  NONE: 'none',
  MILD: 'mild',
  MODERATE: 'moderate',
  SEVERE: 'severe',
} as const;
export type JaundiceLevel = (typeof JaundiceLevel)[keyof typeof JaundiceLevel];

export const ImmunizationStatus = {
  SCHEDULED: 'scheduled',
  DUE: 'due',
  OVERDUE: 'overdue',
  ADMINISTERED: 'administered',
  MISSED: 'missed',
  CONTRAINDICATED: 'contraindicated',
} as const;
export type ImmunizationStatus = (typeof ImmunizationStatus)[keyof typeof ImmunizationStatus];

export const AdverseReactionSeverity = {
  NONE: 'none',
  MILD: 'mild',
  MODERATE: 'moderate',
  SEVERE: 'severe',
} as const;
export type AdverseReactionSeverity = (typeof AdverseReactionSeverity)[keyof typeof AdverseReactionSeverity];

// Interfaces
export interface AntenatalRegistration {
  id: string;
  facilityId: string;
  patientId: string;
  lmpDate: string;
  eddDate?: string;
  gravida: number;
  para: number;
  livingChildren?: number;
  abortions?: number;
  bloodGroup?: string;
  rhPositive?: boolean;
  medicalHistory?: string;
  allergies?: string;
  riskLevel?: RiskLevel;
  riskFactors?: string;
  partnerName?: string;
  partnerPhone?: string;
  status: PregnancyStatus;
  patient?: { id: string; firstName: string; lastName: string; mrn?: string };
  createdAt: string;
  updatedAt: string;
}

export interface RegisterAntenatalDto {
  facilityId: string;
  patientId: string;
  lmpDate: string;
  gravida: number;
  para: number;
  livingChildren?: number;
  abortions?: number;
  bloodGroup?: string;
  rhPositive?: boolean;
  medicalHistory?: string;
  allergies?: string;
  riskLevel?: RiskLevel;
  riskFactors?: string;
  partnerName?: string;
  partnerPhone?: string;
}

export interface AntenatalVisit {
  id: string;
  registrationId: string;
  visitDate: string;
  gestationalAge: number;
  weight?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  temperature?: number;
  pulseRate?: number;
  fundalHeight?: number;
  fetalPresentation?: string;
  fetalHeartRate?: number;
  fetalMovement?: boolean;
  edema?: boolean;
  urineProtein?: boolean;
  urineGlucose?: boolean;
  hemoglobin?: number;
  ironFolateGiven?: boolean;
  tetanusToxoidGiven?: boolean;
  ttDoseNumber?: number;
  iptGiven?: boolean;
  iptDoseNumber?: number;
  complaints?: string;
  findings?: string;
  diagnosis?: string;
  plan?: string;
  nextVisitDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecordAntenatalVisitDto {
  registrationId: string;
  visitDate: string;
  gestationalAge: number;
  weight?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  temperature?: number;
  pulseRate?: number;
  fundalHeight?: number;
  fetalPresentation?: string;
  fetalHeartRate?: number;
  fetalMovement?: boolean;
  edema?: boolean;
  urineProtein?: boolean;
  urineGlucose?: boolean;
  hemoglobin?: number;
  ironFolateGiven?: boolean;
  tetanusToxoidGiven?: boolean;
  ttDoseNumber?: number;
  iptGiven?: boolean;
  iptDoseNumber?: number;
  complaints?: string;
  findings?: string;
  diagnosis?: string;
  plan?: string;
  nextVisitDate?: string;
}

export interface LabourRecord {
  id: string;
  registrationId: string;
  facilityId: string;
  gestationalAgeAtDelivery: number;
  admissionNotes?: string;
  bpSystolic?: number;
  bpDiastolic?: number;
  cervicalDilation?: number;
  station?: number;
  membranesIntact?: boolean;
  liquorColor?: string;
  deliveryMode?: DeliveryMode;
  deliveryNotes?: string;
  placentaComplete?: boolean;
  bloodLossMl?: number;
  perineumStatus?: string;
  episiotomyDone?: boolean;
  complications?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdmitLabourDto {
  registrationId: string;
  facilityId: string;
  gestationalAgeAtDelivery: number;
  admissionNotes?: string;
  bpSystolic?: number;
  bpDiastolic?: number;
  cervicalDilation?: number;
}

// ── Partograph ───────────────────────────────────────────────────────────────

export interface PartographObservation {
  id: string;
  labourRecordId: string;
  observedAt: string;
  cervicalDilationCm?: number | null;
  descentFifths?: number | null;
  contractionsPer10Min?: number | null;
  contractionDurationSeconds?: number | null;
  fetalHeartRate?: number | null;
  liquor?: string | null;
  moulding?: string | null;
  pulse?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  temperature?: number | null;
  oxytocinUnitsPerLitre?: number | null;
  oxytocinDropsPerMin?: number | null;
  notes?: string | null;
  createdAt: string;
}

export type PartographProgressStatus =
  | 'latent_phase'
  | 'normal'
  | 'alert_line_crossed'
  | 'action_line_crossed';

export interface PartographLineParams {
  startAt: string;
  startDilationCm: number;
  cmPerHour: number;
}

export interface PartographData {
  labour: {
    id: string;
    labourNumber: string;
    status: string;
    admissionTime: string;
    patient: { id: string; name: string; mrn: string } | null;
  };
  observations: PartographObservation[];
  analysis: {
    progressStatus: PartographProgressStatus;
    activePhaseStartAt: string | null;
    activePhaseStartDilationCm: number | null;
    alertLine: PartographLineParams | null;
    actionLine: PartographLineParams | null;
    latestFetalHeartRate: number | null;
    fetalHeartRateAbnormal: boolean;
  };
}

export interface RecordPartographObservationDto {
  observedAt?: string;
  cervicalDilationCm?: number;
  descentFifths?: number;
  contractionsPer10Min?: number;
  contractionDurationSeconds?: number;
  fetalHeartRate?: number;
  liquor?: string;
  moulding?: string;
  pulse?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  temperature?: number;
  oxytocinUnitsPerLitre?: number;
  oxytocinDropsPerMin?: number;
  notes?: string;
}

export interface RecordPartographResult {
  observation: PartographObservation;
  progressStatus: PartographProgressStatus;
  fhrAbnormal: boolean;
  alerts: string[];
}

export interface UpdateLabourProgressDto {
  cervicalDilation?: number;
  station?: number;
  membranesIntact?: boolean;
  liquorColor?: string;
  notes?: string;
}

export interface RecordDeliveryDto {
  deliveryMode: DeliveryMode;
  deliveryNotes?: string;
  placentaComplete?: boolean;
  bloodLossMl?: number;
  perineumStatus?: string;
  episiotomyDone?: boolean;
  complications?: string[];
}

export interface DeliveryOutcome {
  id: string;
  labourRecordId: string;
  babyNumber?: number;
  outcome: LabourOutcome;
  sex: BabySex;
  birthWeight: number;
  birthLength?: number;
  headCircumference?: number;
  apgar1min?: number;
  apgar5min?: number;
  resuscitationNeeded?: boolean;
  skinToSkin?: boolean;
  breastfeedingInitiated?: boolean;
  vitaminKGiven?: boolean;
  bcgGiven?: boolean;
  abnormalities?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecordBabyOutcomeDto {
  labourRecordId: string;
  babyNumber?: number;
  outcome: LabourOutcome;
  sex: BabySex;
  birthWeight: number;
  birthLength?: number;
  headCircumference?: number;
  apgar1min?: number;
  apgar5min?: number;
  resuscitationNeeded?: boolean;
  skinToSkin?: boolean;
  breastfeedingInitiated?: boolean;
  vitaminKGiven?: boolean;
  bcgGiven?: boolean;
  abnormalities?: string;
  notes?: string;
}

export interface RecordPostnatalVisitDto {
  facilityId: string;
  registrationId: string;
  deliveryOutcomeId: string;
  visitNumber: 1 | 2 | 3 | 4;
  visitDate: string;
  temperature?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  pulseRate?: number;
  respiratoryRate?: number;
  uterusWellContracted?: boolean;
  fundalHeightCm?: number;
  lochiaType?: LochiaType;
  lochiaNormalAmount?: boolean;
  lochiaFoulSmelling?: boolean;
  perineumIntact?: boolean;
  woundHealingWell?: boolean;
  woundInfectionSigns?: boolean;
  woundNotes?: string;
  breastCondition?: BreastCondition;
  breastfeedingEstablished?: boolean;
  breastfeedingIssues?: boolean;
  breastfeedingNotes?: string;
  epdsScore?: number;
  mentalHealthReferral?: boolean;
  heavyBleeding?: boolean;
  fever?: boolean;
  severeHeadache?: boolean;
  blurredVision?: boolean;
  convulsions?: boolean;
  breathingDifficulty?: boolean;
  legSwelling?: boolean;
  ironFolateGiven?: boolean;
  vitaminAGiven?: boolean;
  familyPlanningCounseling?: boolean;
  contraceptiveMethod?: string;
  complaints?: string;
  examination?: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  nextVisitDate?: string;
}

export interface PostnatalVisit extends RecordPostnatalVisitDto {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecordBabyWellnessDto {
  facilityId: string;
  deliveryOutcomeId: string;
  postnatalVisitId?: string;
  checkDate: string;
  weight?: number;
  temperature?: number;
  heartRate?: number;
  respiratoryRate?: number;
  feedingType?: FeedingType;
  feedingWell?: boolean;
  feedsPerDay?: number;
  feedingNotes?: string;
  cordStatus?: CordStatus;
  cordSeparationDate?: string;
  jaundiceLevel?: JaundiceLevel;
  phototherapyNeeded?: boolean;
  eyesNormal?: boolean;
  eyeDischarge?: boolean;
  notFeeding?: boolean;
  convulsions?: boolean;
  fastBreathing?: boolean;
  severeChestIndrawing?: boolean;
  noMovement?: boolean;
  hypothermia?: boolean;
  hyperthermia?: boolean;
  weightForAge?: string;
  weightChangePercent?: number;
  findings?: string;
  actions?: string;
  referralReason?: string;
  notes?: string;
}

export interface BabyWellnessCheck extends RecordBabyWellnessDto {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdministerVaccineDto {
  batchNumber?: string;
  expiryDate?: string;
  manufacturer?: string;
  siteOfAdministration?: string;
  route?: string;
  adverseReaction?: boolean;
  reactionSeverity?: AdverseReactionSeverity;
  reactionDescription?: string;
  reactionTreatment?: string;
  notes?: string;
}

export interface ImmunizationSchedule {
  id: string;
  deliveryOutcomeId: string;
  vaccineName: string;
  dueDate: string;
  status: ImmunizationStatus;
  administeredDate?: string;
  batchNumber?: string;
  manufacturer?: string;
  adverseReaction?: boolean;
  reactionSeverity?: AdverseReactionSeverity;
  reactionDescription?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const maternityService = {
  // ANC Registration
  anc: {
    register: (data: RegisterAntenatalDto) =>
      api.post<AntenatalRegistration>('/maternity/anc/register', data),

    getRegistrations: (params: { facilityId: string; status?: PregnancyStatus; limit?: number; offset?: number }) =>
      api.get<AntenatalRegistration[]>('/maternity/anc/registrations', { params }),

    getRegistration: (id: string) =>
      api.get<AntenatalRegistration>(`/maternity/anc/registrations/${id}`),

    getDueSoon: (facilityId: string, weeks?: number) =>
      api.get<AntenatalRegistration[]>('/maternity/anc/due-soon', { params: { facilityId, weeks } }),

    // Visits
    recordVisit: (data: RecordAntenatalVisitDto) =>
      api.post<AntenatalVisit>('/maternity/anc/visits', data),

    getVisits: (registrationId: string) =>
      api.get<AntenatalVisit[]>(`/maternity/anc/registrations/${registrationId}/visits`),
  },

  // Labour & Delivery
  labour: {
    admit: (data: AdmitLabourDto) =>
      api.post<LabourRecord>('/maternity/labour/admit', data),

    getById: (id: string) =>
      api.get<LabourRecord>(`/maternity/labour/${id}`),

    updateProgress: (id: string, data: UpdateLabourProgressDto) =>
      api.put<LabourRecord>(`/maternity/labour/${id}/progress`, data),

    recordDelivery: (id: string, data: RecordDeliveryDto) =>
      api.put<LabourRecord>(`/maternity/labour/${id}/delivery`, data),

    recordBabyOutcome: (data: RecordBabyOutcomeDto) =>
      api.post<DeliveryOutcome>('/maternity/labour/baby-outcome', data),

    getOutcomes: (labourId: string) =>
      api.get<DeliveryOutcome[]>(`/maternity/labour/${labourId}/outcomes`),

    getActive: (facilityId: string) =>
      api.get<LabourRecord[]>('/maternity/labour/active', { params: { facilityId } }),

    // Partograph
    getPartograph: (labourId: string) =>
      api.get<PartographData>(`/maternity/labour/${labourId}/partograph`),

    recordPartographObservation: (labourId: string, data: RecordPartographObservationDto) =>
      api.post<RecordPartographResult>(`/maternity/labour/${labourId}/partograph`, data),
  },

  // Postnatal Care
  pnc: {
    recordVisit: (data: RecordPostnatalVisitDto) =>
      api.post<PostnatalVisit>('/maternity/pnc/visits', data),

    getVisits: (registrationId: string) =>
      api.get<PostnatalVisit[]>('/maternity/pnc/visits', { params: { registrationId } }),

    getVisit: (id: string) =>
      api.get<PostnatalVisit>(`/maternity/pnc/visits/${id}`),

    getDueList: (facilityId: string) =>
      api.get<PostnatalVisit[]>('/maternity/pnc/due-list', { params: { facilityId } }),
  },

  // Baby Wellness
  baby: {
    recordWellness: (data: RecordBabyWellnessDto) =>
      api.post<BabyWellnessCheck>('/maternity/baby/wellness', data),

    getWellnessChecks: (deliveryOutcomeId: string) =>
      api.get<BabyWellnessCheck[]>(`/maternity/baby/${deliveryOutcomeId}/wellness`),
  },

  // Immunization
  immunization: {
    generateSchedule: (deliveryOutcomeId: string, facilityId: string) =>
      api.post<ImmunizationSchedule[]>(`/maternity/immunization/generate/${deliveryOutcomeId}`, null, {
        params: { facilityId },
      }),

    getSchedule: (deliveryOutcomeId: string) =>
      api.get<ImmunizationSchedule[]>(`/maternity/immunization/schedule/${deliveryOutcomeId}`),

    administer: (id: string, data: AdministerVaccineDto) =>
      api.put<ImmunizationSchedule>(`/maternity/immunization/${id}/administer`, data),

    getDue: (facilityId: string) =>
      api.get<ImmunizationSchedule[]>('/maternity/immunization/due', { params: { facilityId } }),

    getDefaulters: (facilityId: string, daysOverdue?: number) =>
      api.get<ImmunizationSchedule[]>('/maternity/immunization/defaulters', {
        params: { facilityId, daysOverdue },
      }),
  },

  // Dashboard
  getDashboard: (facilityId: string) =>
    api.get('/maternity/dashboard', { params: { facilityId } }),
};

export default maternityService;
