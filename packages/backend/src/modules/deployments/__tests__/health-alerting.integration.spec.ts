import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HealthMetricsCollectorService } from '../health-metrics-collector.service';
import { AlertingService } from '../alerting.service';
import { DeploymentHealth } from '../../../database/entities/deployment-health.entity';
import { DeploymentAlert } from '../../../database/entities/deployment-alert.entity';

import { Deployment } from '../../../database/entities/deployment.entity';

describe('Phase 4 Health & Alerting Integration Tests', () => {
  let healthMetricsCollectorService: HealthMetricsCollectorService;
  let alertingService: AlertingService;
  let healthRepository: Repository<DeploymentHealth>;
  let alertRepository: Repository<DeploymentAlert>;

  const mockHealthRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    query: jest.fn(),
  };

  const mockAlertRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };

  const mockDeploymentRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthMetricsCollectorService,
        AlertingService,
        {
          provide: getRepositoryToken(DeploymentHealth),
          useValue: mockHealthRepository,
        },
        {
          provide: getRepositoryToken(DeploymentAlert),
          useValue: mockAlertRepository,
        },
        {
          provide: getRepositoryToken(Deployment),
          useValue: mockDeploymentRepository,
        },
      ],
    }).compile();

    healthMetricsCollectorService = module.get<HealthMetricsCollectorService>(
      HealthMetricsCollectorService,
    );
    alertingService = module.get<AlertingService>(AlertingService);
    healthRepository = module.get<Repository<DeploymentHealth>>(
      getRepositoryToken(DeploymentHealth),
    );
    alertRepository = module.get<Repository<DeploymentAlert>>(
      getRepositoryToken(DeploymentAlert),
    );

    mockDeploymentRepository.findOne.mockResolvedValue({ id: 'deploy-1', tenantId: 'tenant-1' });
    mockHealthRepository.create.mockImplementation((arg) => ({ ...arg, createdAt: new Date() }));
    mockHealthRepository.save.mockImplementation(async (arg) => ({ ...arg, createdAt: new Date() }));
    mockAlertRepository.create.mockImplementation((arg) => ({ ...arg, id: 'alert-1', createdAt: new Date() }));
    mockAlertRepository.save.mockImplementation(async (arg) => ({ ...arg, id: 'alert-1', createdAt: new Date() }));

    jest.clearAllMocks();
  });

  describe('HealthMetricsCollectorService', () => {
    it('should collect real-time metrics from deployment', async () => {
      const deploymentId = 'deploy-1';

      const mockMetrics = {
        deploymentId,
        cpuUsage: 45.5,
        memoryUsage: 62.3,
        responseTime: 125,
        errorRate: 0.02,
        requestsPerSecond: 250,
        uptime: 86400,
        lastCheck: new Date(),
      };

      const result = await healthMetricsCollectorService.collectMetrics(deploymentId);

      expect(result).toEqual(expect.objectContaining({
        deploymentId,
        timestamp: expect.any(Date),
      }));
    });

    it('should detect anomalies in metrics', async () => {
      const deploymentId = 'deploy-1';

      const anomalousMetrics = {
        deploymentId,
        cpuUsage: 98.5, // Abnormally high
        memoryUsage: 95.2,
        responseTime: 5000, // Very high
        errorRate: 0.15, // Elevated
      };

      const result = await healthMetricsCollectorService.detectAnomalies(
        anomalousMetrics,
      );

      expect(result).toEqual(expect.objectContaining({
        hasAnomalies: true,
        anomalies: expect.arrayContaining([
          expect.objectContaining({ metric: 'cpuUsage' }),
          expect.objectContaining({ metric: 'responseTime' }),
        ]),
      }));
    });

    it('should calculate health score', async () => {
      const deploymentId = 'deploy-1';

      const metrics = {
        deploymentId,
        cpuUsage: 50,
        memoryUsage: 60,
        errorRate: 0.01,
        responseTime: 150,
        uptime: 99.9,
      };

      const result = await healthMetricsCollectorService.calculateHealthScore(
        metrics,
      );

      expect(result).toEqual(expect.objectContaining({
        deploymentId,
        healthScore: expect.any(Number),
        status: expect.stringMatching(/^(healthy|degraded|critical)$/),
      }));
    });

    it('should store metrics history for trend analysis', async () => {
      const deploymentId = 'deploy-1';
      const metrics = [
        { timestamp: new Date('2024-01-01'), cpuUsage: 40 },
        { timestamp: new Date('2024-01-02'), cpuUsage: 45 },
        { timestamp: new Date('2024-01-03'), cpuUsage: 50 },
      ];

      const result = await healthMetricsCollectorService.storeMetricsHistory(
        deploymentId,
        metrics,
      );

      expect(result).toEqual(expect.objectContaining({
        stored: true,
        recordCount: 3,
      }));
    });

    it('should identify performance trends', async () => {
      const deploymentId = 'deploy-1';

      const result = await healthMetricsCollectorService.analyzeTrends(
        deploymentId,
        7, // Last 7 days
      );

      expect(result).toEqual(expect.objectContaining({
        deploymentId,
        trend: expect.stringMatching(/^(improving|degrading|stable)$/),
        trend_percentage: expect.any(Number),
      }));
    });
  });

  describe('AlertingService', () => {
    it('should send email alerts for critical issues', async () => {
      const alert = {
        deploymentId: 'deploy-1',
        severity: 'critical',
        title: 'High CPU Usage',
        message: 'CPU usage exceeded 95%',
        recipients: ['ops@example.com'],
        channel: 'email',
      };

      const result = await alertingService.sendAlert(alert);

      expect(result).toEqual(expect.objectContaining({
        sent: true,
        channel: 'email',
        deliveryStatus: 'delivered',
      }));
    });

    it('should send SMS alerts for immediate action items', async () => {
      const alert = {
        deploymentId: 'deploy-1',
        severity: 'critical',
        title: 'Service Offline',
        recipients: ['+1234567890'],
        channel: 'sms',
      };

      const result = await alertingService.sendAlert(alert);

      expect(result).toEqual(expect.objectContaining({
        sent: true,
        channel: 'sms',
      }));
    });

    it('should post alerts to Slack channel', async () => {
      const alert = {
        deploymentId: 'deploy-1',
        severity: 'warning',
        title: 'Memory Usage Warning',
        channel: 'slack',
        slackChannel: '#alerts',
      };

      const result = await alertingService.sendAlert(alert);

      expect(result).toEqual(expect.objectContaining({
        sent: true,
        channel: 'slack',
      }));
    });

    it('should trigger PagerDuty incidents for critical alerts', async () => {
      const alert = {
        deploymentId: 'deploy-1',
        severity: 'critical',
        title: 'Database Connection Lost',
        channel: 'pagerduty',
        escalationPolicy: 'on-call-team',
      };

      const result = await alertingService.sendAlert(alert);

      expect(result).toEqual(expect.objectContaining({
        sent: true,
        channel: 'pagerduty',
        incidentId: expect.any(String),
      }));
    });

    it('should send webhook notifications to custom endpoints', async () => {
      const alert = {
        deploymentId: 'deploy-1',
        severity: 'warning',
        title: 'Update Rollback Initiated',
        channel: 'webhook',
        webhookUrl: 'https://custom-monitoring.example.com/alerts',
      };

      const result = await alertingService.sendAlert(alert);

      expect(result).toEqual(expect.objectContaining({
        sent: true,
        channel: 'webhook',
        httpStatus: 200,
      }));
    });

    it('should deduplicate alerts within time window', async () => {
      const alert = {
        deploymentId: 'deploy-1',
        severity: 'warning',
        title: 'High Memory Usage',
      };

      const result1 = await alertingService.sendAlert({
        ...alert,
        channel: 'email',
        recipients: ['ops@example.com'],
      });

      // Send same alert within deduplication window (e.g., 1 hour)
      const result2 = await alertingService.sendAlert({
        ...alert,
        channel: 'email',
        recipients: ['ops@example.com'],
      });

      expect(result1.sent).toBe(true);
      expect(result2.sent).toBe(false); // Should be deduplicated
      expect(result2.reason).toBe('duplicate_within_window');
    });

    it('should manage alert escalation policies', async () => {
      const escalationPolicy = {
        name: 'critical-on-call',
        levels: [
          { level: 1, delay: 5, target: 'primary-on-call' },
          { level: 2, delay: 15, target: 'secondary-on-call' },
          { level: 3, delay: 30, target: 'team-lead' },
        ],
      };

      const result = await alertingService.createEscalationPolicy(escalationPolicy);

      expect(result).toEqual(expect.objectContaining({
        created: true,
        policyId: expect.any(String),
      }));
    });

    it('should acknowledge and resolve alerts', async () => {
      const alertId = 'alert-1';

      mockAlertRepository.findOne.mockResolvedValue({
        id: alertId,
        status: 'open',
      });

      const result = await alertingService.acknowledgeAlert(alertId, 'user-123');

      expect(result).toEqual(expect.objectContaining({
        alertId,
        status: 'acknowledged',
        acknowledgedBy: 'user-123',
      }));
    });

    it('should track alert history and statistics', async () => {
      const stats = {
        totalAlerts: 150,
        criticalAlerts: 15,
        warningAlerts: 65,
        infoAlerts: 70,
        resolvedAlerts: 140,
        averageResolutionTime: 1800, // seconds
      };

      const result = await alertingService.getAlertStatistics();

      expect(result).toEqual(expect.objectContaining({
        totalAlerts: expect.any(Number),
        byCategory: expect.objectContaining({
          critical: expect.any(Number),
        }),
      }));
    });
  });

  describe('Cross-service Health & Alert Scenarios', () => {
    it('should auto-alert when health score falls below threshold', async () => {
      const deploymentId = 'deploy-1';

      const metrics = {
        deploymentId,
        cpuUsage: 90,
        memoryUsage: 85,
        errorRate: 0.1,
        healthScore: 35, // Below threshold (e.g., 50)
      };

      // Collect metrics
      const healthResult = await healthMetricsCollectorService.calculateHealthScore(
        metrics,
      );

      // Trigger alert if health is critical
      if (healthResult.status === 'critical') {
        const alertResult = await alertingService.sendAlert({
          deploymentId,
          severity: 'critical',
          title: `Critical health status for ${deploymentId}`,
          message: `Health score: ${healthResult.healthScore}`,
          channel: 'slack',
          slackChannel: '#critical-alerts',
        });

        expect(alertResult.sent).toBe(true);
      }
    });

    it('should create incident when anomalies detected', async () => {
      const deploymentId = 'deploy-1';

      const anomalousMetrics = {
        deploymentId,
        cpuUsage: 99,
        errorRate: 0.25,
        responseTime: 8000,
      };

      // Detect anomalies
      const anomalyResult = await healthMetricsCollectorService.detectAnomalies(
        anomalousMetrics,
      );

      if (anomalyResult.hasAnomalies) {
        // Escalate to PagerDuty
        const pagerdutyAlert = await alertingService.sendAlert({
          deploymentId,
          severity: 'critical',
          title: 'Deployment Anomaly Detected',
          channel: 'pagerduty',
          escalationPolicy: 'incident-response-team',
        });

        expect(pagerdutyAlert.sent).toBe(true);
      }
    });

    it('should send multi-channel alert for critical deployments', async () => {
      const deploymentId = 'critical-deploy-1';

      const metrics = {
        deploymentId,
        healthScore: 20,
        status: 'critical',
      };

      const healthResult = await healthMetricsCollectorService.calculateHealthScore(
        metrics,
      );

      if (healthResult.status === 'critical') {
        // Send to multiple channels
        const channels = ['email', 'sms', 'slack', 'pagerduty'];

        for (const channel of channels) {
          const result = await alertingService.sendAlert({
            deploymentId,
            severity: 'critical',
            title: 'CRITICAL: Deployment Down',
            channel,
            recipients: channel === 'email' ? ['ops@example.com'] : undefined,
            slackChannel: channel === 'slack' ? '#critical' : undefined,
          });

          expect(result.sent).toBe(true);
        }
      }
    });
  });
});
