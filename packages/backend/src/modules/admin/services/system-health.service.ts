import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as os from 'os';
import { SystemMetric } from '../../../database/entities/system-metric.entity';
import { AlertRule } from '../../../database/entities/alert-rule.entity';
import { SystemAlert } from '../../../database/entities/system-alert.entity';
import { Session } from '../../../database/entities/session.entity';
import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service';
import { InAppNotificationType } from '../../../database/entities/in-app-notification.entity';

@Injectable()
export class SystemHealthService {
  private readonly logger = new Logger(SystemHealthService.name);

  /** Snapshot of previous CPU times for delta-based CPU usage calculation */
  private previousCpuTimes: { idle: number; total: number } | null = null;

  constructor(
    @InjectRepository(SystemMetric)
    private readonly metricRepo: Repository<SystemMetric>,
    @InjectRepository(AlertRule)
    private readonly alertRuleRepo: Repository<AlertRule>,
    @InjectRepository(SystemAlert)
    private readonly alertRepo: Repository<SystemAlert>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly notificationsService?: InAppNotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Cron: Collect system metrics every 60 seconds
  // ---------------------------------------------------------------------------
  @Cron(CronExpression.EVERY_MINUTE)
  async collectMetrics(): Promise<void> {
    this.logger.debug('Collecting system metrics...');
    const now = new Date();

    const collectors: Array<() => Promise<void>> = [
      () => this.collectCpuMetric(now),
      () => this.collectMemoryMetrics(now),
      () => this.collectDiskMetric(now),
      () => this.collectDbConnectionMetric(now),
      () => this.collectActiveUsersMetric(now),
      () => this.collectTenantCountMetric(now),
      () => this.collectApiLatencyMetric(now),
    ];

    for (const collector of collectors) {
      try {
        await collector();
      } catch (err) {
        this.logger.error(
          `Metric collection error: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    // Evaluate alert rules after metrics are collected
    try {
      await this.checkAlertRules();
    } catch (err) {
      this.logger.error(
        `Alert rule evaluation error: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Cron: Purge metrics older than 7 days (runs at 3 AM daily)
  // ---------------------------------------------------------------------------
  @Cron('0 3 * * *')
  async purgeOldMetrics(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await this.metricRepo.delete({
        recordedAt: LessThan(cutoff),
      });
      this.logger.log(`Purged ${result.affected ?? 0} old system metrics (older than 7 days)`);
    } catch (err) {
      this.logger.error(
        `Failed to purge old metrics: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Individual metric collectors
  // ---------------------------------------------------------------------------

  private async collectCpuMetric(recordedAt: Date): Promise<void> {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
      idle += cpu.times.idle;
      total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
    }

    let usagePercent: number;
    if (this.previousCpuTimes) {
      const idleDelta = idle - this.previousCpuTimes.idle;
      const totalDelta = total - this.previousCpuTimes.total;
      usagePercent = totalDelta === 0 ? 0 : ((totalDelta - idleDelta) / totalDelta) * 100;
    } else {
      // First run: compute absolute usage
      usagePercent = total === 0 ? 0 : ((total - idle) / total) * 100;
    }
    this.previousCpuTimes = { idle, total };

    await this.saveMetric({
      metricType: 'cpu',
      value: Math.round(usagePercent * 100) / 100,
      unit: 'percent',
      recordedAt,
      metadata: { cores: cpus.length, model: cpus[0]?.model },
    });
  }

  private async collectMemoryMetrics(recordedAt: Date): Promise<void> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = (usedMem / totalMem) * 100;

    const processMemory = process.memoryUsage();

    await this.saveMetric({
      metricType: 'memory',
      value: Math.round(usagePercent * 100) / 100,
      unit: 'percent',
      recordedAt,
      metadata: {
        totalBytes: totalMem,
        usedBytes: usedMem,
        freeBytes: freeMem,
        processRss: processMemory.rss,
        processHeapUsed: processMemory.heapUsed,
        processHeapTotal: processMemory.heapTotal,
        processExternal: processMemory.external,
      },
    });
  }

  private async collectDiskMetric(recordedAt: Date): Promise<void> {
    try {
      const { execSync } = require('child_process');
      const output = execSync('df -B1 / | tail -1', { encoding: 'utf8', timeout: 5000 });
      const parts = output.trim().split(/\s+/);
      // df output: Filesystem 1B-blocks Used Available Use% Mounted
      if (parts.length >= 5) {
        const totalBytes = parseInt(parts[1], 10);
        const usedBytes = parseInt(parts[2], 10);
        const availableBytes = parseInt(parts[3], 10);
        const usagePercent = totalBytes === 0 ? 0 : (usedBytes / totalBytes) * 100;

        await this.saveMetric({
          metricType: 'disk',
          value: Math.round(usagePercent * 100) / 100,
          unit: 'percent',
          recordedAt,
          metadata: {
            totalBytes,
            usedBytes,
            availableBytes,
            mountPoint: '/',
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Disk metric collection failed: ${(err as Error).message}`);
    }
  }

  private async collectDbConnectionMetric(recordedAt: Date): Promise<void> {
    try {
      // Query pg_stat_activity for actual pool stats
      const result = await this.dataSource.query(`
        SELECT
          count(*) FILTER (WHERE state = 'active') AS active_connections,
          count(*) FILTER (WHERE state = 'idle') AS idle_connections,
          count(*) AS total_connections,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      const stats = result[0] || {};
      const totalConnections = parseInt(stats.total_connections, 10) || 0;
      const maxConnections = parseInt(stats.max_connections, 10) || 100;

      await this.saveMetric({
        metricType: 'db_connections',
        value: totalConnections,
        unit: 'count',
        recordedAt,
        metadata: {
          activeConnections: parseInt(stats.active_connections, 10) || 0,
          idleConnections: parseInt(stats.idle_connections, 10) || 0,
          totalConnections,
          maxConnections,
          utilizationPercent:
            maxConnections === 0
              ? 0
              : Math.round((totalConnections / maxConnections) * 10000) / 100,
        },
      });
    } catch (err) {
      this.logger.warn(`DB connection metric collection failed: ${(err as Error).message}`);
    }
  }

  private async collectActiveUsersMetric(recordedAt: Date): Promise<void> {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const activeCount = await this.sessionRepo
        .createQueryBuilder('s')
        .where('s.is_active = true')
        .andWhere('s.expires_at > :now', { now: new Date() })
        .andWhere('s.last_activity_at > :since', { since: fifteenMinutesAgo })
        .getCount();

      await this.saveMetric({
        metricType: 'active_users',
        value: activeCount,
        unit: 'count',
        recordedAt,
      });
    } catch (err) {
      this.logger.warn(`Active users metric collection failed: ${(err as Error).message}`);
    }
  }

  private async collectTenantCountMetric(recordedAt: Date): Promise<void> {
    try {
      const result = await this.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM tenants WHERE status = 'active' AND deleted_at IS NULL`,
      );
      const totalCount = result[0]?.count || 0;

      await this.saveMetric({
        metricType: 'tenant_count',
        value: totalCount,
        unit: 'count',
        recordedAt,
      });
    } catch (err) {
      this.logger.warn(`Tenant count metric collection failed: ${(err as Error).message}`);
    }
  }

  private async collectApiLatencyMetric(recordedAt: Date): Promise<void> {
    // Measure DB round-trip as a proxy for API latency
    try {
      const start = Date.now();
      await this.dataSource.query('SELECT 1');
      const latencyMs = Date.now() - start;

      await this.saveMetric({
        metricType: 'api_latency',
        value: latencyMs,
        unit: 'ms',
        recordedAt,
        metadata: { type: 'db_roundtrip' },
      });
    } catch (err) {
      this.logger.warn(`API latency metric collection failed: ${(err as Error).message}`);
    }
  }

  private async saveMetric(data: Partial<SystemMetric>): Promise<void> {
    // System-level metrics: no tenant context
    const metric = this.metricRepo.create({ ...data, tenantId: undefined });
    await this.metricRepo.save(metric);
  }

  // ---------------------------------------------------------------------------
  // Public API: getSystemMetrics
  // ---------------------------------------------------------------------------
  async getSystemMetrics(hours = 1): Promise<Record<string, any>> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Fetch the latest metric for each metric type
    const latestMetrics = await this.dataSource.query(
      `
      SELECT DISTINCT ON (metric_type)
        id, metric_type AS "metricType", value, unit, metadata, recorded_at AS "recordedAt"
      FROM system_metrics
      WHERE recorded_at >= $1
        AND deleted_at IS NULL
      ORDER BY metric_type, recorded_at DESC
    `,
      [since],
    );

    const metricsMap: Record<string, any> = {};
    for (const m of latestMetrics) {
      metricsMap[m.metricType] = {
        value: parseFloat(m.value),
        unit: m.unit,
        metadata: m.metadata,
        recordedAt: m.recordedAt,
      };
    }

    return {
      collectedAt: new Date(),
      lookbackHours: hours,
      metrics: metricsMap,
      summary: {
        cpuUsage: metricsMap['cpu']?.value ?? null,
        memoryUsage: metricsMap['memory']?.value ?? null,
        diskUsage: metricsMap['disk']?.value ?? null,
        dbConnections: metricsMap['db_connections']?.value ?? null,
        activeUsers: metricsMap['active_users']?.value ?? null,
        tenantCount: metricsMap['tenant_count']?.value ?? null,
        apiLatencyMs: metricsMap['api_latency']?.value ?? null,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Public API: getMetricHistory
  // ---------------------------------------------------------------------------
  async getMetricHistory(metricType: string, hours = 24): Promise<any[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const rows = await this.metricRepo
      .createQueryBuilder('m')
      .where('m.metric_type = :metricType', { metricType })
      .andWhere('m.recorded_at >= :since', { since })
      .orderBy('m.recorded_at', 'ASC')
      .getMany();

    return rows.map((r) => ({
      value: parseFloat(String(r.value)),
      unit: r.unit,
      metadata: r.metadata,
      recordedAt: r.recordedAt,
    }));
  }

  // ---------------------------------------------------------------------------
  // Public API: getTenantResourceUsage
  // ---------------------------------------------------------------------------
  async getTenantResourceUsage(tenantId?: string): Promise<any> {
    if (tenantId) {
      return this.getSingleTenantUsage(tenantId);
    }

    // All tenants summary
    const tenants = await this.dataSource.query(
      `SELECT id, name, status FROM tenants WHERE status = 'active' AND deleted_at IS NULL ORDER BY created_at DESC`,
    );

    const results = [];
    for (const tenant of tenants) {
      try {
        const usage = await this.getSingleTenantUsage(tenant.id);
        results.push(usage);
      } catch (err) {
        this.logger.warn(`Failed to get usage for tenant ${tenant.id}: ${(err as Error).message}`);
        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          error: 'Failed to retrieve usage',
        });
      }
    }

    return {
      totalTenants: tenants.length,
      tenants: results,
    };
  }

  private async getSingleTenantUsage(tenantId: string): Promise<Record<string, any>> {
    const rows = await this.dataSource.query(
      `SELECT id, name, status FROM tenants WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [tenantId],
    );
    const tenant = rows[0];
    if (!tenant) {
      return { tenantId, error: 'Tenant not found' };
    }

    // Run counts in parallel for performance
    const [userCount, patientCount, encounterCount] = await Promise.all([
      this.safeCount('users', tenantId),
      this.safeCount('patients', tenantId),
      this.safeCount('encounters', tenantId),
    ]);

    // Estimate storage usage based on row counts
    const storageEstimateBytes = this.estimateStorage(userCount, patientCount, encounterCount);

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantStatus: tenant.status,
      billingPlan: tenant.billing_plan,
      resourceUsage: {
        users: userCount,
        patients: patientCount,
        encounters: encounterCount,
        estimatedStorageBytes: storageEstimateBytes,
        estimatedStorageMB: Math.round((storageEstimateBytes / (1024 * 1024)) * 100) / 100,
      },
      createdAt: tenant.created_at,
    };
  }

  private async safeCount(tableName: string, tenantId: string): Promise<number> {
    try {
      const result = await this.dataSource.query(
        `SELECT count(*)::int AS count FROM "${tableName}" WHERE tenant_id = $1 AND deleted_at IS NULL`,
        [tenantId],
      );
      return result[0]?.count ?? 0;
    } catch {
      return 0;
    }
  }

  private estimateStorage(userCount: number, patientCount: number, encounterCount: number): number {
    // Rough estimates per row in bytes
    const USER_ROW_SIZE = 2048;
    const PATIENT_ROW_SIZE = 4096;
    const ENCOUNTER_ROW_SIZE = 8192;

    return (
      userCount * USER_ROW_SIZE +
      patientCount * PATIENT_ROW_SIZE +
      encounterCount * ENCOUNTER_ROW_SIZE
    );
  }

  // ---------------------------------------------------------------------------
  // Alert Rule Evaluation
  // ---------------------------------------------------------------------------
  async checkAlertRules(): Promise<void> {
    const rules = await this.alertRuleRepo.find({ where: { enabled: true } });
    if (rules.length === 0) return;

    for (const rule of rules) {
      try {
        await this.evaluateRule(rule);
      } catch (err) {
        this.logger.error(
          `Failed to evaluate alert rule "${rule.name}" (${rule.id}): ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }
  }

  private async evaluateRule(rule: AlertRule): Promise<void> {
    // Get the latest metric of the matching type
    const latestMetric = await this.metricRepo
      .createQueryBuilder('m')
      .where('m.metric_type = :type', { type: rule.metricType })
      .orderBy('m.recorded_at', 'DESC')
      .getOne();

    if (!latestMetric) return;

    const value = parseFloat(String(latestMetric.value));
    const threshold = parseFloat(String(rule.threshold));
    const breached = this.isThresholdBreached(value, rule.operator, threshold);

    if (!breached) return;

    // Check cooldown
    if (rule.lastTriggeredAt) {
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      const elapsed = Date.now() - new Date(rule.lastTriggeredAt).getTime();
      if (elapsed < cooldownMs) return;
    }

    // Create alert
    const alert = this.alertRepo.create({
      ruleId: rule.id,
      title: `Alert: ${rule.name}`,
      message: `Metric "${rule.metricType}" value ${value} ${this.operatorLabel(rule.operator)} threshold ${threshold}`,
      severity: rule.severity,
      status: 'open',
      metricType: rule.metricType,
      metricValue: value,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        operator: rule.operator,
        threshold,
        actualValue: value,
        recordedAt: latestMetric.recordedAt,
      },
    });
    await this.alertRepo.save(alert);

    // Update rule last triggered timestamp
    await this.alertRuleRepo.update(rule.id, { lastTriggeredAt: new Date() });

    this.logger.warn(
      `Alert triggered: "${rule.name}" - ${rule.metricType} = ${value} (threshold: ${rule.operator} ${threshold})`,
    );

    // Send in-app notifications if the channel is configured
    if (
      this.notificationsService &&
      rule.notifyChannels &&
      rule.notifyChannels.includes('in_app')
    ) {
      try {
        await this.sendAlertNotifications(alert, rule);
      } catch (err) {
        this.logger.error(`Failed to send alert notification: ${(err as Error).message}`);
      }
    }
  }

  private isThresholdBreached(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  private operatorLabel(op: string): string {
    const labels: Record<string, string> = {
      gt: '>',
      lt: '<',
      gte: '>=',
      lte: '<=',
      eq: '==',
    };
    return labels[op] || op;
  }

  private async sendAlertNotifications(alert: SystemAlert, rule: AlertRule): Promise<void> {
    if (!this.notificationsService) return;

    // Notify system admins by finding users with the 'Admin' or 'System Admin' role
    try {
      const adminUserIds = await this.notificationsService.getUserIdsByRole([
        'admin',
        'system admin',
        'super admin',
      ]);

      if (adminUserIds.length > 0) {
        await this.notificationsService.notifyMany(adminUserIds, {
          type: InAppNotificationType.GENERAL,
          title: `System Alert: ${rule.name}`,
          message: alert.message,
          metadata: {
            referenceType: 'system_alert',
            referenceId: alert.id,
            severity: alert.severity,
            metricType: alert.metricType,
            metricValue: alert.metricValue,
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to send in-app alert notifications: ${(err as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Alert CRUD
  // ---------------------------------------------------------------------------
  async getAlerts(filters: {
    status?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: SystemAlert[]; total: number }> {
    const qb = this.alertRepo.createQueryBuilder('a');

    if (filters.status) {
      qb.andWhere('a.status = :status', { status: filters.status });
    }
    if (filters.severity) {
      qb.andWhere('a.severity = :severity', { severity: filters.severity });
    }

    const limit = Math.min(filters.limit || 50, 500);
    const offset = filters.offset || 0;

    const [data, total] = await qb
      .orderBy('a.createdAt', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return { data, total };
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<SystemAlert> {
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new Error('Alert not found');
    }
    if (alert.status === 'resolved') {
      throw new Error('Alert is already resolved');
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();
    return this.alertRepo.save(alert);
  }

  async resolveAlert(alertId: string, userId: string): Promise<SystemAlert> {
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new Error('Alert not found');
    }
    if (alert.status === 'resolved') {
      throw new Error('Alert is already resolved');
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    if (!alert.acknowledgedBy) {
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
    }
    return this.alertRepo.save(alert);
  }

  // ---------------------------------------------------------------------------
  // Alert Rules CRUD
  // ---------------------------------------------------------------------------
  async getAlertRules(): Promise<AlertRule[]> {
    return this.alertRuleRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createAlertRule(data: Partial<AlertRule>): Promise<AlertRule> {
    const rule = this.alertRuleRepo.create(data);
    return this.alertRuleRepo.save(rule);
  }

  async updateAlertRule(id: string, data: Partial<AlertRule>): Promise<AlertRule> {
    const rule = await this.alertRuleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new Error('Alert rule not found');
    }
    Object.assign(rule, data);
    return this.alertRuleRepo.save(rule);
  }

  async deleteAlertRule(id: string): Promise<void> {
    const rule = await this.alertRuleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new Error('Alert rule not found');
    }
    await this.alertRuleRepo.softRemove(rule);
  }
}
