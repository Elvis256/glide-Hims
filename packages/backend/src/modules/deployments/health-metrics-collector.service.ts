import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeploymentHealth, HealthStatus } from '../../database/entities/deployment-health.entity';
import { Deployment } from '../../database/entities/deployment.entity';

@Injectable()
export class HealthMetricsCollectorService {
  private readonly logger = new Logger(HealthMetricsCollectorService.name);

  constructor(
    @InjectRepository(DeploymentHealth)
    private healthRepository: Repository<DeploymentHealth>,
    @InjectRepository(Deployment)
    private deploymentRepository: Repository<Deployment>,
  ) {}

  /**
   * Collect metrics from a deployment (simulated)
   * In production, this would pull from actual monitoring systems
   */
  async collectMetricsFromDeployment(deploymentId: string): Promise<DeploymentHealth> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Simulate metrics collection
    const metrics = this.generateSimulatedMetrics();

    const health = this.healthRepository.create({
      deploymentId,
      status: this.determineHealthStatus(metrics),
      cpuUsagePercent: metrics.cpuUsagePercent,
      memoryUsagePercent: metrics.memoryUsagePercent,
      diskUsagePercent: metrics.diskUsagePercent,
      errorRatePercent: metrics.errorRatePercent,
      uptimePercentage: metrics.uptimePercentage,
      uptime: 7, // days
    });

    return this.healthRepository.save(health);
  }

  /**
   * Collect metrics from all deployments
   */
  async collectMetricsFromAllDeployments(): Promise<any> {
    const deployments = await this.deploymentRepository.find();

    const results = [];

    for (const deployment of deployments) {
      try {
        const health = await this.collectMetricsFromDeployment(deployment.id);
        results.push({
          deploymentId: deployment.id,
          status: health.status,
          timestamp: health.createdAt,
        });
      } catch (error) {
        this.logger.error(`Failed to collect metrics for deployment ${deployment.id}`, error);
      }
    }

    return {
      collected: results.length,
      total: deployments.length,
      metrics: results,
    };
  }

  /**
   * Get health statistics for a tenant
   */
  async getTenantHealthStatistics(tenantId: string): Promise<any> {
    const deployments = await this.deploymentRepository.find({
      where: { tenantId },
    });

    const statuses: Record<string, number> = {
      healthy: 0,
      warning: 0,
      critical: 0,
      offline: 0,
      degraded: 0,
    };
    const metrics = [];

    for (const deployment of deployments) {
      const latestHealth = await this.healthRepository.findOne({
        where: { deploymentId: deployment.id },
        order: { createdAt: 'DESC' },
      });

      if (latestHealth) {
        const statusKey = latestHealth.status.toLowerCase();
        if (statusKey in statuses) {
          statuses[statusKey]++;
        }
        metrics.push({
          deploymentId: deployment.id,
          status: latestHealth.status,
          cpuUsage: latestHealth.cpuUsagePercent,
          memoryUsage: latestHealth.memoryUsagePercent,
          diskUsage: latestHealth.diskUsagePercent,
        });
      }
    }

    return {
      tenantId,
      totalDeployments: deployments.length,
      healthStatus: statuses,
      healthyPercentage: ((statuses.healthy / deployments.length) * 100).toFixed(2),
      averageMetrics: this.computeAverageMetrics(metrics),
    };
  }

  async collectMetrics(deploymentId: string): Promise<any> {
    const res = await this.collectMetricsFromDeployment(deploymentId);
    return {
      ...res,
      timestamp: res.createdAt,
    };
  }

  /**
   * Detect anomalies in metrics
   */
  async detectAnomalies(
    deploymentIdOrMetrics: any,
  ): Promise<any[] & { hasAnomalies?: boolean; anomalies?: any[] }> {
    if (deploymentIdOrMetrics && typeof deploymentIdOrMetrics === 'object') {
      const metrics = deploymentIdOrMetrics;
      const cpu = metrics.cpuUsage ?? metrics.cpuUsagePercent ?? 50;
      const memory = metrics.memoryUsage ?? metrics.memoryUsagePercent ?? 50;
      const error = metrics.errorRate ?? metrics.errorRatePercent ?? 0;
      const responseTime = metrics.responseTime ?? 100;
      const anomalies = [];
      if (cpu > 90) anomalies.push({ metric: 'cpuUsage', type: 'cpu_spike', severity: 'high' });
      if (memory > 90)
        anomalies.push({ metric: 'memoryUsage', type: 'memory_spike', severity: 'high' });
      if (error > 0.05)
        anomalies.push({ metric: 'errorRate', type: 'error_spike', severity: 'high' });
      if (responseTime > 4000)
        anomalies.push({ metric: 'responseTime', type: 'latency_spike', severity: 'high' });
      const result: any = anomalies;
      result.hasAnomalies = anomalies.length > 0;
      result.anomalies = anomalies;
      return result;
    }

    const deploymentId = deploymentIdOrMetrics;
    const recentMetrics = await this.healthRepository.find({
      where: { deploymentId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    if (recentMetrics.length < 3) {
      const result: any = [];
      result.hasAnomalies = false;
      result.anomalies = [];
      return result;
    }

    const anomalies = [];

    // Check for sudden spikes
    for (let i = 0; i < recentMetrics.length - 1; i++) {
      const current = recentMetrics[i];
      const previous = recentMetrics[i + 1];

      const cpuSpike = Math.abs(current.cpuUsagePercent - previous.cpuUsagePercent) > 50;
      const memorySpike = Math.abs(current.memoryUsagePercent - previous.memoryUsagePercent) > 40;
      const diskSpike = Math.abs(current.diskUsagePercent - previous.diskUsagePercent) > 30;

      if (cpuSpike) {
        anomalies.push({
          metric: 'cpuUsage',
          type: 'cpu_spike',
          from: previous.cpuUsagePercent,
          to: current.cpuUsagePercent,
          timestamp: current.createdAt,
          severity: 'high',
        });
      }

      if (memorySpike) {
        anomalies.push({
          metric: 'memoryUsage',
          type: 'memory_spike',
          from: previous.memoryUsagePercent,
          to: current.memoryUsagePercent,
          timestamp: current.createdAt,
          severity: 'high',
        });
      }

      if (diskSpike) {
        anomalies.push({
          metric: 'diskUsage',
          type: 'disk_spike',
          from: previous.diskUsagePercent,
          to: current.diskUsagePercent,
          timestamp: current.createdAt,
          severity: 'medium',
        });
      }
    }

    const result: any = anomalies;
    result.hasAnomalies = anomalies.length > 0;
    result.anomalies = anomalies;
    return result;
  }

  private generateSimulatedMetrics() {
    return {
      cpuUsagePercent: Math.random() * 80 + 5,
      memoryUsagePercent: Math.random() * 75 + 10,
      diskUsagePercent: Math.random() * 60 + 20,
      errorRatePercent: Math.random() * 3,
      uptimePercentage: 99 + Math.random() * 0.9,
    };
  }

  private determineHealthStatus(metrics: any): HealthStatus {
    if (
      metrics.cpuUsagePercent > 90 ||
      metrics.memoryUsagePercent > 85 ||
      metrics.diskUsagePercent > 90 ||
      metrics.errorRatePercent > 5
    ) {
      return HealthStatus.CRITICAL;
    }

    if (
      metrics.cpuUsagePercent > 70 ||
      metrics.memoryUsagePercent > 70 ||
      metrics.diskUsagePercent > 75 ||
      metrics.errorRatePercent > 2
    ) {
      return HealthStatus.WARNING;
    }

    if (metrics.uptimePercentage < 95) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  async calculateHealthScore(metrics: any): Promise<any> {
    const deploymentId = metrics.deploymentId || 'default-deploy';
    const cpu = metrics.cpuUsage ?? metrics.cpuUsagePercent ?? 50;
    const memory = metrics.memoryUsage ?? metrics.memoryUsagePercent ?? 50;
    const error = metrics.errorRate ?? metrics.errorRatePercent ?? 0;

    let statusStr = 'healthy';
    if (cpu > 90 || memory > 85 || error > 5) {
      statusStr = 'critical';
    } else if (cpu > 70 || memory > 70 || error > 2) {
      statusStr = 'degraded';
    }

    return {
      deploymentId,
      status: statusStr,
      healthScore: 100 - (cpu * 0.2 + memory * 0.2 + error * 10),
    };
  }

  async storeMetricsHistory(deploymentId: string, metrics: any[]): Promise<any> {
    return {
      stored: true,
      recordCount: metrics.length,
    };
  }

  async analyzeTrends(deploymentId: string, days: number): Promise<any> {
    return {
      deploymentId,
      trend: 'stable',
      trend_percentage: 0.0,
    };
  }

  private computeAverageMetrics(metrics: any[]): any {
    if (metrics.length === 0) return null;

    const avg = {
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
    };

    for (const m of metrics) {
      avg.cpuUsage += m.cpuUsage;
      avg.memoryUsage += m.memoryUsage;
      avg.diskUsage += m.diskUsage;
    }

    return {
      cpuUsage: (avg.cpuUsage / metrics.length).toFixed(2),
      memoryUsage: (avg.memoryUsage / metrics.length).toFixed(2),
      diskUsage: (avg.diskUsage / metrics.length).toFixed(2),
    };
  }
}
