import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThan, Between } from 'typeorm';
import {
  UsageMeterEvent,
  UsageMeterAggregate,
  UsageQuota,
  UsageAlert,
  UsageMetricType,
  UsageAggregationPeriod,
} from '../../../database/entities/usage-meter.entity';
import { Tenant } from '../../../database/entities/tenant.entity';

export interface UsageCheckResponse {
  allowed: boolean;
  currentUsage: number;
  limit?: number;
  usagePercentage: number;
  period: string;
  message: string;
}

export interface UsageReportResponse {
  tenantId: string;
  metrics: Array<{
    metricType: UsageMetricType;
    hourly?: number;
    daily?: number;
    monthly?: number;
    monthlyLimit?: number;
    usagePercentage: number;
  }>;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalBillableEvents: number;
    alertsTriggered: number;
    quotasExceeded: string[];
  };
}

@Injectable()
export class UsageMeterService {
  constructor(
    @InjectRepository(UsageMeterEvent)
    private eventRepository: Repository<UsageMeterEvent>,
    @InjectRepository(UsageMeterAggregate)
    private aggregateRepository: Repository<UsageMeterAggregate>,
    @InjectRepository(UsageQuota)
    private quotaRepository: Repository<UsageQuota>,
    @InjectRepository(UsageAlert)
    private alertRepository: Repository<UsageAlert>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  /**
   * Record a usage event
   * Called from middleware/services when tenant performs metered action
   */
  async recordUsage(
    tenantId: string,
    metricType: UsageMetricType,
    amount: number = 1,
    billable: boolean = true,
    eventSource?: string,
    metadata?: Record<string, any>,
  ): Promise<UsageMeterEvent> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new BadRequestException(`Tenant ${tenantId} not found`);
    }

    const event = this.eventRepository.create({
      tenantId,
      metricType,
      amount,
      billable,
      eventSource,
      metadata,
    });

    const saved = await this.eventRepository.save(event);

    // Check quotas and trigger alerts if needed
    await this.checkAndAlertQuota(tenantId, metricType);

    return saved;
  }

  /**
   * Check if tenant has exceeded quota for given metric
   * Used to enforce hard limits or show warnings
   */
  async checkQuota(tenantId: string, metricType: UsageMetricType): Promise<UsageCheckResponse> {
    const quota = await this.quotaRepository.findOne({
      where: { tenantId, metricType },
    });

    if (!quota) {
      return {
        allowed: true,
        currentUsage: 0,
        usagePercentage: 0,
        period: 'monthly',
        message: 'No quota configured (unlimited)',
      };
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get current month usage
    const monthlyAggregate = await this.aggregateRepository.findOne({
      where: {
        tenantId,
        metricType,
        period: UsageAggregationPeriod.MONTHLY,
        periodStart: MoreThanOrEqual(monthStart),
      },
    });

    const monthlyUsage = monthlyAggregate?.totalAmount || 0;
    const limit = quota.limitMonthly;

    if (!limit) {
      return {
        allowed: true,
        currentUsage: monthlyUsage,
        usagePercentage: 0,
        period: 'monthly',
        message: 'No limit configured (unlimited)',
      };
    }

    const usagePercentage = (monthlyUsage / limit) * 100;
    const allowed = quota.hardLimit ? monthlyUsage < limit : true;

    return {
      allowed,
      currentUsage: monthlyUsage,
      limit,
      usagePercentage,
      period: 'monthly',
      message: `Using ${usagePercentage.toFixed(1)}% of ${limit} limit`,
    };
  }

  /**
   * Get tenant usage report for specified period
   */
  async getTenantUsageReport(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<UsageReportResponse> {
    const aggregates = await this.aggregateRepository.find({
      where: {
        tenantId,
        period: UsageAggregationPeriod.DAILY,
        periodStart: Between(startDate, endDate),
      },
    });

    const metrics = new Map<UsageMetricType, any>();

    // Initialize metrics
    Object.values(UsageMetricType).forEach((type) => {
      metrics.set(type, {
        metricType: type,
        daily: 0,
        monthly: 0,
        usagePercentage: 0,
      });
    });

    // Aggregate data
    for (const agg of aggregates) {
      const metric = metrics.get(agg.metricType);
      if (metric) {
        metric.daily += agg.totalAmount;
      }
    }

    // Get monthly aggregates
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyAggregates = await this.aggregateRepository.find({
      where: {
        tenantId,
        periodStart: MoreThanOrEqual(monthStart),
      },
    });

    for (const agg of monthlyAggregates) {
      const metric = metrics.get(agg.metricType);
      if (metric) {
        metric.monthly += agg.totalAmount;
      }
    }

    // Add quota information
    const quotas = await this.quotaRepository.find({ where: { tenantId } });
    for (const quota of quotas) {
      const metric = metrics.get(quota.metricType);
      if (metric) {
        metric.monthlyLimit = quota.limitMonthly;
        metric.usagePercentage = quota.limitMonthly
          ? ((metric.monthly / quota.limitMonthly) * 100).toFixed(1)
          : 0;
      }
    }

    // Get active alerts
    const alerts = await this.alertRepository.find({
      where: {
        tenantId,
        resolvedAt: null,
      },
    });

    const billableEvents = await this.eventRepository.count({
      where: {
        tenantId,
        billable: true,
        createdAt: Between(startDate, endDate),
      },
    });

    return {
      tenantId,
      metrics: Array.from(metrics.values()),
      period: { start: startDate, end: endDate },
      summary: {
        totalBillableEvents: billableEvents,
        alertsTriggered: alerts.length,
        quotasExceeded: alerts.filter((a) => a.severity === 'critical').map((a) => a.metricType),
      },
    };
  }

  /**
   * Set usage quota for tenant (usually from SaaS plan)
   */
  async setQuota(
    tenantId: string,
    metricType: UsageMetricType,
    limitMonthly?: number,
    limitDaily?: number,
    hardLimit: boolean = true,
    alertThresholdPct: number = 80,
  ): Promise<UsageQuota> {
    let quota = await this.quotaRepository.findOne({
      where: { tenantId, metricType },
    });

    if (!quota) {
      quota = this.quotaRepository.create({
        tenantId,
        metricType,
      });
    }

    quota.limitMonthly = limitMonthly;
    quota.limitDaily = limitDaily;
    quota.hardLimit = hardLimit;
    quota.alertThresholdPct = alertThresholdPct;

    return this.quotaRepository.save(quota);
  }

  /**
   * Check quota and trigger alert if threshold exceeded
   */
  private async checkAndAlertQuota(
    tenantId: string,
    metricType: UsageMetricType,
  ): Promise<void> {
    const check = await this.checkQuota(tenantId, metricType);
    if (check.usagePercentage === 0) return;

    const quota = await this.quotaRepository.findOne({
      where: { tenantId, metricType },
    });

    if (!quota) return;

    // Determine severity
    let severity: 'info' | 'warning' | 'critical' = 'info';
    if (check.usagePercentage >= 100) {
      severity = 'critical';
    } else if (check.usagePercentage >= quota.alertThresholdPct) {
      severity = 'warning';
    } else {
      return; // Below alert threshold, no alert needed
    }

    // Check if alert already exists for this period
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const existingAlert = await this.alertRepository.findOne({
      where: {
        tenantId,
        metricType,
        resolvedAt: null,
        createdAt: MoreThanOrEqual(monthStart),
      },
    });

    if (existingAlert && existingAlert.severity === severity) {
      return; // Alert already exists, no need to create duplicate
    }

    // Create new alert
    const message = `Tenant has used ${check.usagePercentage.toFixed(1)}% of ${metricType} quota`;

    const alert = this.alertRepository.create({
      tenantId,
      metricType,
      severity,
      currentUsage: check.currentUsage,
      limit: check.limit,
      limitPeriod: 'monthly',
      usagePct: check.usagePercentage,
      message,
    });

    await this.alertRepository.save(alert);

    // If hard limit exceeded, throw error
    if (severity === 'critical' && quota.hardLimit) {
      throw new HttpException(
        `Usage quota exceeded for ${metricType}. Current: ${check.currentUsage}, Limit: ${check.limit}`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Get billing-ready usage summary per tenant
   * Used for invoice generation
   */
  async getBillingUsage(
    tenantId: string,
    billingPeriodStart: Date,
    billingPeriodEnd: Date,
  ): Promise<Array<{ metricType: UsageMetricType; totalAmount: number; unitPrice?: number }>> {
    const events = await this.eventRepository.find({
      where: {
        tenantId,
        billable: true,
        createdAt: Between(billingPeriodStart, billingPeriodEnd),
      },
    });

    const summary = new Map<UsageMetricType, number>();

    for (const event of events) {
      const current = summary.get(event.metricType) || 0;
      summary.set(event.metricType, current + Number(event.amount));
    }

    return Array.from(summary.entries()).map(([metricType, totalAmount]) => ({
      metricType,
      totalAmount,
    }));
  }

  /**
   * Acknowledge a usage alert
   */
  async acknowledgeAlert(alertId: string): Promise<UsageAlert> {
    const alert = await this.alertRepository.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new BadRequestException('Alert not found');
    }

    alert.acknowledged = true;
    return this.alertRepository.save(alert);
  }

  /**
   * Resolve a usage alert
   */
  async resolveAlert(alertId: string): Promise<UsageAlert> {
    const alert = await this.alertRepository.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new BadRequestException('Alert not found');
    }

    alert.resolvedAt = new Date();
    return this.alertRepository.save(alert);
  }

  /**
   * Get active alerts for tenant
   */
  async getActiveAlerts(tenantId: string): Promise<UsageAlert[]> {
    return this.alertRepository.find({
      where: { tenantId, resolvedAt: null },
      order: { createdAt: 'DESC' },
    });
  }
}
