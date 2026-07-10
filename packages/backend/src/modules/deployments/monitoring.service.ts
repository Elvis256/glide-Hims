import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeploymentHealth, HealthStatus } from '../../database/entities/deployment-health.entity';
import {
  DeploymentAlert,
  AlertSeverity,
  AlertStatus,
} from '../../database/entities/deployment-alert.entity';
import { Deployment, DeploymentStatus } from '../../database/entities/deployment.entity';

@Injectable()
export class MonitoringService {
  constructor(
    @InjectRepository(DeploymentHealth)
    private healthRepository: Repository<DeploymentHealth>,
    @InjectRepository(DeploymentAlert)
    private alertRepository: Repository<DeploymentAlert>,
    @InjectRepository(Deployment)
    private deploymentRepository: Repository<Deployment>,
  ) {}

  async recordHealthMetrics(
    tenantId: string,
    deploymentId: string,
    metrics: {
      cpuUsagePercent?: number;
      memoryUsagePercent?: number;
      diskUsagePercent?: number;
      uptime?: number;
      uptimePercentage?: number;
      errorRatePercent?: number;
    },
  ): Promise<DeploymentHealth> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId, tenantId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    const healthStatus = this.calculateHealthStatus(metrics);

    const health = this.healthRepository.create({
      deploymentId,
      status: healthStatus,
      cpuUsagePercent: metrics.cpuUsagePercent,
      memoryUsagePercent: metrics.memoryUsagePercent,
      diskUsagePercent: metrics.diskUsagePercent,
      uptime: metrics.uptime,
      uptimePercentage: metrics.uptimePercentage,
      errorRatePercent: metrics.errorRatePercent,
    });

    // Update deployment's last health check; flip PENDING → ACTIVE on first heartbeat.
    deployment.lastHealthCheck = new Date();
    if (deployment.status === DeploymentStatus.PENDING) {
      deployment.status = DeploymentStatus.ACTIVE;
    }
    await this.deploymentRepository.save(deployment);

    return this.healthRepository.save(health);
  }

  async createAlert(
    tenantId: string,
    deploymentId: string,
    title: string,
    severity: AlertSeverity,
  ): Promise<DeploymentAlert> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId, tenantId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    const alert = this.alertRepository.create({
      deploymentId,
      title,
      severity,
      status: AlertStatus.OPEN,
    });

    return this.alertRepository.save(alert);
  }

  async resolveAlert(tenantId: string, alertId: string): Promise<DeploymentAlert> {
    const alert = await this.alertRepository.findOne({
      where: { id: alertId },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    alert.status = AlertStatus.RESOLVED;
    return this.alertRepository.save(alert);
  }

  async getDeploymentStatus(tenantId: string, deploymentId: string): Promise<any> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId, tenantId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    const latestHealth = await this.healthRepository.findOne({
      where: { deploymentId },
      order: { createdAt: 'DESC' },
    });

    const openAlerts = await this.alertRepository.find({
      where: { deploymentId, status: AlertStatus.OPEN },
    });

    return {
      id: deployment.id,
      name: deployment.name,
      status: deployment.status,
      health: latestHealth
        ? {
            status: latestHealth.status,
            cpuUsage: latestHealth.cpuUsagePercent,
            memoryUsage: latestHealth.memoryUsagePercent,
            diskUsage: latestHealth.diskUsagePercent,
            uptimePercentage: latestHealth.uptimePercentage,
          }
        : null,
      alerts: openAlerts.map((a) => ({
        id: a.id,
        title: a.title,
        severity: a.severity,
      })),
      openAlertCount: openAlerts.length,
      lastHealthCheckAt: deployment.lastHealthCheck,
    };
  }

  async getHealthHistory(
    tenantId: string,
    deploymentId: string,
    limit = 100,
  ): Promise<DeploymentHealth[]> {
    return this.healthRepository.find({
      where: { deploymentId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getAlerts(
    tenantId: string,
    deploymentId?: string,
    filters?: { severity?: AlertSeverity; status?: AlertStatus },
  ): Promise<DeploymentAlert[]> {
    const query = this.alertRepository.createQueryBuilder('a');

    if (deploymentId) {
      query.where('a.deploymentId = :deploymentId', { deploymentId });
    }

    if (filters?.severity) {
      query.andWhere('a.severity = :severity', { severity: filters.severity });
    }

    if (filters?.status) {
      query.andWhere('a.status = :status', { status: filters.status });
    }

    return query.orderBy('a.createdAt', 'DESC').getMany();
  }

  private calculateHealthStatus(metrics: any): HealthStatus {
    const criticalThresholds = {
      cpu: 90,
      memory: 85,
      disk: 90,
      errorRate: 5,
    };

    const warningThresholds = {
      cpu: 70,
      memory: 70,
      disk: 75,
      errorRate: 2,
    };

    // Check critical conditions
    if (
      metrics.cpuUsagePercent > criticalThresholds.cpu ||
      metrics.memoryUsagePercent > criticalThresholds.memory ||
      metrics.diskUsagePercent > criticalThresholds.disk ||
      metrics.errorRatePercent > criticalThresholds.errorRate
    ) {
      return HealthStatus.CRITICAL;
    }

    // Check warning conditions
    if (
      metrics.cpuUsagePercent > warningThresholds.cpu ||
      metrics.memoryUsagePercent > warningThresholds.memory ||
      metrics.diskUsagePercent > warningThresholds.disk ||
      metrics.errorRatePercent > warningThresholds.errorRate
    ) {
      return HealthStatus.WARNING;
    }

    return HealthStatus.HEALTHY;
  }
}
