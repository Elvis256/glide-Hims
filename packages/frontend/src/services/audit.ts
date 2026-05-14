import api from './api';

export interface AuditLogEntry {
  id: string;
  createdAt: string;
  userId?: string;
  user?: { id: string; firstName?: string; lastName?: string; username?: string; email?: string };
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  requestMethod?: string;
  requestUrl?: string;
  statusCode?: number;
  actorType?: string;
  attemptedIdentifier?: string;
}

export interface AuditLogListParams {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface AuditLogStats {
  totalLogs: number;
  uniqueUsers: number;
  actionBreakdown: Record<string, number>;
  entityBreakdown: Record<string, number>;
  recentActivity: AuditLogEntry[];
}

export const auditService = {
  async list(
    params: AuditLogListParams = {},
  ): Promise<{ data: AuditLogEntry[]; total: number; page: number; limit: number; totalPages: number }> {
    const { data } = await api.get('/audit-logs', { params });
    return data;
  },
  async stats(): Promise<AuditLogStats> {
    const { data } = await api.get('/audit-logs/stats');
    return data;
  },
  exportCsvUrl(params: Omit<AuditLogListParams, 'page' | 'limit'> = {}): string {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') usp.append(k, String(v));
    });
    const qs = usp.toString();
    return `/audit-logs/export.csv${qs ? `?${qs}` : ''}`;
  },
  async exportCsv(params: Omit<AuditLogListParams, 'page' | 'limit'> = {}): Promise<Blob> {
    const { data } = await api.get('/audit-logs/export.csv', {
      params,
      responseType: 'blob',
    });
    return data as Blob;
  },
  async forPatient(
    patientId: string,
    params: { limit?: number; action?: string } = {},
  ): Promise<{ data: AuditLogEntry[]; total: number; patientId: string }> {
    const { data } = await api.get(`/audit-logs/patient/${patientId}`, { params });
    return data;
  },
};

export default auditService;
