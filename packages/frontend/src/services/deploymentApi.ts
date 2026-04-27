import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

interface ApiResponse<T> {
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface Deployment {
  id: string;
  tenantId: string;
  name: string;
  type: 'CLOUD' | 'ON_PREMISES' | 'HYBRID' | 'EDGE';
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DEGRADED';
  apiUrl: string;
  currentVersion: string;
  lastHealthCheck?: Date;
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface UpdateRollout {
  id: string;
  deploymentId: string;
  version: string;
  status: string;
  phases: Array<{
    phase: number;
    percentage: number;
    deploymentCount: number;
    duration: number;
  }>;
  successfulDeployments: number;
  failedDeployments: number;
  totalDeployments: number;
}

interface DeploymentHealth {
  id: string;
  deploymentId: string;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  healthScore: number;
  cpuUsage: number;
  memoryUsage: number;
  errorRate: number;
  responseTime: number;
  uptime: number;
  lastCheck: Date;
}

interface Alert {
  id: string;
  deploymentId: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  channel: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  createdAt: Date;
}

class DeploymentApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add authorization token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }

  // Deployments
  async listDeployments(
    tenantId: string,
    page = 1,
    limit = 20,
  ): Promise<ApiResponse<Deployment[]>> {
    const response = await this.client.get('/deployments', {
      params: { tenantId, page, limit },
    });
    return response.data;
  }

  async getDeployment(deploymentId: string): Promise<Deployment> {
    const response = await this.client.get(`/deployments/${deploymentId}`);
    return response.data;
  }

  async createDeployment(data: Partial<Deployment>): Promise<Deployment> {
    const response = await this.client.post('/deployments', data);
    return response.data;
  }

  async updateDeployment(
    deploymentId: string,
    data: Partial<Deployment>,
  ): Promise<Deployment> {
    const response = await this.client.put(`/deployments/${deploymentId}`, data);
    return response.data;
  }

  async deleteDeployment(deploymentId: string): Promise<void> {
    await this.client.delete(`/deployments/${deploymentId}`);
  }

  // Health
  async getDeploymentHealth(deploymentId: string): Promise<DeploymentHealth> {
    const response = await this.client.get(`/deployments/${deploymentId}/health`);
    return response.data;
  }

  // Rollouts
  async initiateRollout(data: {
    deploymentId: string;
    version: string;
    phases: any[];
  }): Promise<UpdateRollout> {
    const response = await this.client.post('/rollouts', data);
    return response.data;
  }

  async getRollout(rolloutId: string): Promise<UpdateRollout> {
    const response = await this.client.get(`/rollouts/${rolloutId}`);
    return response.data;
  }

  async executeRolloutPhase(rolloutId: string): Promise<void> {
    await this.client.post(`/rollouts/${rolloutId}/execute`);
  }

  async rollbackRollout(rolloutId: string): Promise<void> {
    await this.client.post(`/rollouts/${rolloutId}/rollback`);
  }

  // Alerts
  async listAlerts(
    page = 1,
    filters?: { deploymentId?: string; severity?: string },
  ): Promise<ApiResponse<Alert[]>> {
    const response = await this.client.get('/alerts', {
      params: { page, ...filters },
    });
    return response.data;
  }

  async sendAlert(data: Partial<Alert>): Promise<Alert> {
    const response = await this.client.post('/alerts', data);
    return response.data;
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    await this.client.post(`/alerts/${alertId}/acknowledge`);
  }

  // Sync
  async coordinateSync(data: {
    masterId: string;
    deploymentIds: string[];
    dataType: string;
    version: string;
  }): Promise<{ synced: boolean; syncId: string }> {
    const response = await this.client.post('/sync', data);
    return response.data;
  }

  // Error handling
  handleError(error: AxiosError): string {
    if (error.response) {
      return (error.response.data as any).message || 'An error occurred';
    }
    return error.message;
  }
}

export const deploymentApi = new DeploymentApiService();
export type { Deployment, UpdateRollout, DeploymentHealth, Alert };
