import api from './api';

export type ReferralStage =
  | 'collected'
  | 'packaged'
  | 'in_transit'
  | 'received_at_hub'
  | 'processing'
  | 'result_ready'
  | 'result_delivered'
  | 'rejected';

export type ReferralPriority = 'STAT' | 'URGENT' | 'ROUTINE';

export interface SampleReferral {
  id: string;
  referralNumber: string;
  sampleId: string;
  sample?: {
    id: string;
    sampleNumber: string;
    sampleType?: string;
    status?: string;
  };
  patientId: string;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
  };
  fromFacilityId: string;
  fromFacility?: { id: string; name: string };
  toFacilityId: string;
  toFacility?: { id: string; name: string };
  stage: ReferralStage;
  testRequested?: string;
  clinicalInfo?: string;
  priority: ReferralPriority;
  collectedAt?: string;
  packagedAt?: string;
  shippedAt?: string;
  receivedAtHubAt?: string;
  processingStartedAt?: string;
  resultReadyAt?: string;
  resultDeliveredAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  transportMethod?: string;
  transporterName?: string;
  transporterPhone?: string;
  temperatureOnArrival?: number;
  sampleConditionOnArrival?: string;
  notes?: string;
  collectedById?: string;
  receivedById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSampleReferralDto {
  sampleId: string;
  fromFacilityId: string;
  toFacilityId: string;
  testRequested?: string;
  clinicalInfo?: string;
  priority?: ReferralPriority;
  transportMethod?: string;
  transporterName?: string;
  transporterPhone?: string;
  notes?: string;
}

export interface UpdateStageDto {
  stage: ReferralStage;
  temperatureOnArrival?: number;
  sampleConditionOnArrival?: string;
  notes?: string;
}

export interface ReferralDashboard {
  total: number;
  inTransit: number;
  pendingAtHub: number;
  resultsReady: number;
  rejected: number;
  avgTATDays: number;
  pctMeeting7Day: number;
  completedCount: number;
}

export interface TATStats {
  stageAvgHours: Array<{ stage: string; avgHours: number; count: number }>;
  bottleneck: { stage: string; avgHours: number } | null;
  pctMeeting7Day: number;
  completedCount: number;
  totalReferrals: number;
  routeBreakdown: Array<{ from: string; to: string; count: number; avgDays: number }>;
}

export const sampleReferralService = {
  create: (data: CreateSampleReferralDto) =>
    api.post<SampleReferral>('/lab/sample-referrals', data).then((r) => r.data),

  list: (params: {
    stage?: ReferralStage;
    direction?: 'incoming' | 'outgoing';
    facilityId?: string;
    priority?: ReferralPriority;
    fromDate?: string;
    toDate?: string;
    search?: string;
  }) =>
    api.get<SampleReferral[]>('/lab/sample-referrals', { params }).then((r) => r.data),

  getOne: (id: string) =>
    api.get<SampleReferral>(`/lab/sample-referrals/${id}`).then((r) => r.data),

  updateStage: (id: string, data: UpdateStageDto) =>
    api.patch<SampleReferral>(`/lab/sample-referrals/${id}/stage`, data).then((r) => r.data),

  reject: (id: string, rejectionReason: string) =>
    api.patch<SampleReferral>(`/lab/sample-referrals/${id}/reject`, { rejectionReason }).then((r) => r.data),

  getDashboard: () =>
    api.get<ReferralDashboard>('/lab/sample-referrals/dashboard').then((r) => r.data),

  getTATStats: (params?: { facilityId?: string; fromDate?: string; toDate?: string }) =>
    api.get<TATStats>('/lab/sample-referrals/tat-stats', { params }).then((r) => r.data),
};

export default sampleReferralService;
