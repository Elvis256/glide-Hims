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

  /**
   * Detect anomalies in metrics
   */
  async detectAnomalies(deploymentId: string): Promise<any[]> {
    const recentMetrics = await this.healthRepository.find({
      where: { deploymentId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    if (recentMetrics.length < 3) {
      return [];
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
          type: 'cpu_spike',
          from: previous.cpuUsagePercent,
          to: current.cpuUsagePercent,
          timestamp: current.createdAt,
          severity: 'high',
        });
      }

      if (memorySpike) {
        anomalies.push({
          type: 'memory_spike',
          from: previous.memoryUsagePercent,
          to: current.memoryUsagePercent,
          timestamp: current.createdAt,
          severity: 'high',
        });
      }

      if (diskSpike) {
        anomalies.push({
          type: 'disk_spike',
          from: previous.diskUsagePercent,
          to: current.diskUsagePercent,
          timestamp: current.createdAt,
          severity: 'medium',
        });
      }
    }

    return anomalies;
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
