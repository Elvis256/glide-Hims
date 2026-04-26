import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeploymentAlert, AlertSeverity, AlertStatus } from '../../database/entities/deployment-alert.entity';
import { Deployment } from '../../database/entities/deployment.entity';

export enum AlertChannel {
  EMAIL = 'email',
  SMS = 'sms',
  SLACK = 'slack',
  PAGERDUTY = 'pagerduty',
  WEBHOOK = 'webhook',
}

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private alertChannelHandlers: Map<AlertChannel, (alert: DeploymentAlert, config: any) => Promise<void>>;

  constructor(
    @InjectRepository(DeploymentAlert)
    private alertRepository: Repository<DeploymentAlert>,
    @InjectRepository(Deployment)
    private deploymentRepository: Repository<Deployment>,
  ) {
    this.initializeChannelHandlers();
  }

  private initializeChannelHandlers(): void {
    this.alertChannelHandlers = new Map([
      [AlertChannel.EMAIL, this.sendEmailAlert.bind(this)],
      [AlertChannel.SMS, this.sendSmsAlert.bind(this)],
      [AlertChannel.SLACK, this.sendSlackAlert.bind(this)],
      [AlertChannel.PAGERDUTY, this.sendPagerDutyAlert.bind(this)],
      [AlertChannel.WEBHOOK, this.sendWebhookAlert.bind(this)],
    ]);
  }

  /**
   * Send alert through specified channels
   */
  async sendAlert(
    deploymentId: string,
    title: string,
    severity: AlertSeverity,
    channels: AlertChannel[] = [AlertChannel.EMAIL],
    config?: any,
  ): Promise<any> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const alert = this.alertRepository.create({
      deploymentId,
      title,
      severity,
      status: AlertStatus.OPEN,
      metadata: { channels, sentAt: new Date() },
    });

    const saved = await this.alertRepository.save(alert);

    const results = [];

    for (const channel of channels) {
      try {
        const handler = this.alertChannelHandlers.get(channel);
        if (handler) {
          await handler(saved, config);
          results.push({ channel, success: true });
        }
      } catch (error) {
        this.logger.error(`Failed to send alert via ${channel}`, error);
        results.push({ channel, success: false, error: error.message });
      }
    }

    return {
      alertId: saved.id,
      deploymentId,
      title,
      severity,
      channels: results,
    };
  }

  /**
   * Escalate alert if not acknowledged within threshold
   */
  async escalateAlert(alertId: string): Promise<DeploymentAlert> {
    const alert = await this.alertRepository.findOne({
      where: { id: alertId },
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    if (alert.status === AlertStatus.OPEN) {
      alert.status = AlertStatus.ESCALATED;
      alert.metadata = alert.metadata || {};
      alert.metadata.escalatedAt = new Date();
    }

    return this.alertRepository.save(alert);
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<DeploymentAlert> {
    const alert = await this.alertRepository.findOne({
      where: { id: alertId },
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.metadata = alert.metadata || {};
    alert.metadata.acknowledgedAt = new Date();
    alert.metadata.acknowledgedBy = acknowledgedBy;

    return this.alertRepository.save(alert);
  }

  /**
   * Get active alerts by severity
   */
  async getAlertsBySeverity(severity: AlertSeverity): Promise<DeploymentAlert[]> {
    return this.alertRepository.find({
      where: { severity, status: AlertStatus.OPEN },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get escalated alerts
   */
  async getEscalatedAlerts(): Promise<DeploymentAlert[]> {
    return this.alertRepository.find({
      where: { status: AlertStatus.ESCALATED },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Generate alert summary for dashboard
   */
  async generateAlertSummary(): Promise<any> {
    const openAlerts = await this.alertRepository.find({
      where: { status: AlertStatus.OPEN },
    });

    const escalatedAlerts = await this.alertRepository.find({
      where: { status: AlertStatus.ESCALATED },
    });

    const critical = openAlerts.filter((a) => a.severity === AlertSeverity.CRITICAL);
    const warning = openAlerts.filter((a) => a.severity === AlertSeverity.WARNING);
    const info = openAlerts.filter((a) => a.severity === AlertSeverity.INFO);

    return {
      summary: {
        total: openAlerts.length,
        critical: critical.length,
        warning: warning.length,
        info: info.length,
        escalated: escalatedAlerts.length,
      },
      criticalAlerts: critical.slice(0, 5),
      recentAlerts: openAlerts.slice(0, 10),
      timestamp: new Date(),
    };
  }

  // Channel-specific implementations (simulated for demo)

  private async sendEmailAlert(alert: DeploymentAlert, config: any): Promise<void> {
    // In production, integrate with email service
    this.logger.log(`[EMAIL] Sending alert to recipients: ${JSON.stringify(config?.recipients)}`);
  }

  private async sendSmsAlert(alert: DeploymentAlert, config: any): Promise<void> {
    // In production, integrate with SMS service
    this.logger.log(`[SMS] Sending alert to phone: ${config?.phoneNumber}`);
  }

  private async sendSlackAlert(alert: DeploymentAlert, config: any): Promise<void> {
    // In production, integrate with Slack webhook
    this.logger.log(`[SLACK] Sending alert to channel: ${config?.channel}`);
  }

  private async sendPagerDutyAlert(alert: DeploymentAlert, config: any): Promise<void> {
    // In production, integrate with PagerDuty API
    this.logger.log(`[PAGERDUTY] Creating incident for service: ${config?.serviceId}`);
  }

  private async sendWebhookAlert(alert: DeploymentAlert, config: any): Promise<void> {
    // In production, POST to webhook URL
    this.logger.log(`[WEBHOOK] Sending alert to: ${config?.webhookUrl}`);
  }
}
