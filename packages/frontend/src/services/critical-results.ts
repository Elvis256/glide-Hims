import api from './api';

export type CriticalResultResourceType = 'lab' | 'radiology';
export type CriticalResultSeverity =
  | 'critical_low'
  | 'critical_high'
  | 'critical'
  | 'abnormal';
export type CriticalResultStatus =
  | 'pending'
  | 'acknowledged'
  | 'escalated'
  | 'resolved'
  | 'cancelled';

export interface CriticalResultAlert {
  id: string;
  resourceType: CriticalResultResourceType;
  resourceId: string;
  orderId?: string | null;
  patientId: string;
  encounterId?: string | null;
  severity: CriticalResultSeverity;
  summary?: string | null;
  flaggedAt: string;
  flaggedById?: string | null;
  flaggedBy?: { id: string; firstName?: string; lastName?: string } | null;
  assignedToId?: string | null;
  assignedTo?: { id: string; firstName?: string; lastName?: string } | null;
  status: CriticalResultStatus;
  slaDeadline: string;
  acknowledgedAt?: string | null;
  acknowledgedById?: string | null;
  acknowledgedBy?: { id: string; firstName?: string; lastName?: string } | null;
  acknowledgementNote?: string | null;
  actionTaken?: string | null;
  followUpOrderId?: string | null;
  escalatedAt?: string | null;
  escalationLevel: number;
  patient?: { id: string; fullName?: string; mrn?: string };
}

export interface AcknowledgeCriticalResultPayload {
  note: string;
  actionTaken?: string;
  followUpOrderId?: string;
}

const base = '/critical-results';

export const criticalResultsService = {
  async list(params: {
    status?: string;
    assignedToMe?: boolean;
    flaggedByMe?: boolean;
    resourceType?: 'lab' | 'radiology';
    patientId?: string;
    limit?: number;
  } = {}): Promise<CriticalResultAlert[]> {
    const { data } = await api.get(base, { params });
    return data;
  },

  async stats(params: {
    flaggedByMe?: boolean;
    resourceType?: 'lab' | 'radiology';
    sinceDays?: number;
  } = {}): Promise<{
    total: number;
    pending: number;
    acknowledged: number;
    escalated: number;
    cancelled: number;
    slaBreached: number;
    bySeverity: { critical_low: number; critical_high: number; critical: number; abnormal: number };
  }> {
    const { data } = await api.get(`${base}/stats`, { params });
    return data;
  },

  async count(assignedToMe = false): Promise<{ total: number; mine: number }> {
    const { data } = await api.get(`${base}/count`, {
      params: { assignedToMe },
    });
    return data;
  },

  async getOne(id: string): Promise<CriticalResultAlert> {
    const { data } = await api.get(`${base}/${id}`);
    return data;
  },

  async acknowledge(
    id: string,
    payload: AcknowledgeCriticalResultPayload,
  ): Promise<CriticalResultAlert> {
    const { data } = await api.post(`${base}/${id}/acknowledge`, payload);
    return data;
  },

  async cancel(id: string): Promise<CriticalResultAlert> {
    const { data } = await api.post(`${base}/${id}/cancel`);
    return data;
  },
};

export default criticalResultsService;
