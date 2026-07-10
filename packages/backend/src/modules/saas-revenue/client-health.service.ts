import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { ClientHealthScore, HealthStatus } from './client-health.entity';
import { SaasSubscription, SaasInvoice } from './saas.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { Deployment, DeploymentStatus } from '../../database/entities/deployment.entity';

@Injectable()
export class ClientHealthService {
  private readonly logger = new Logger(ClientHealthService.name);

  constructor(
    @InjectRepository(ClientHealthScore) private readonly scores: Repository<ClientHealthScore>,
    @InjectRepository(SaasSubscription) private readonly subs: Repository<SaasSubscription>,
    @InjectRepository(SaasInvoice) private readonly invoices: Repository<SaasInvoice>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(Deployment) private readonly deployments: Repository<Deployment>,
    private readonly events: EventEmitter2,
  ) {}

  async listHealthScores() {
    const rows = await this.scores.find({ order: { overallScore: 'ASC' } });
    if (rows.length === 0) return [];

    // Enrich with tenant names
    const tenantIds = [...new Set(rows.map((r) => r.tenantId))];
    const tenantEntities = await this.tenants.find({
      where: tenantIds.map((id) => ({ id })),
      select: ['id', 'name', 'slug'],
    });
    const tmap = new Map(
      tenantEntities.map((t) => [t.id, { id: t.id, name: t.name, slug: t.slug }]),
    );

    return rows.map((r) => ({ ...r, tenant: tmap.get(r.tenantId) ?? null }));
  }

  async getHealthScore(tenantId: string): Promise<ClientHealthScore> {
    const score = await this.scores.findOne({ where: { tenantId } });
    if (!score) throw new NotFoundException('Health score not found for tenant');
    return score;
  }

  async getDashboard() {
    const all = await this.scores.find();
    const healthy = all.filter((s) => s.healthStatus === 'healthy').length;
    const atRisk = all.filter((s) => s.healthStatus === 'at_risk').length;
    const critical = all.filter((s) => s.healthStatus === 'critical').length;
    const avgScore =
      all.length > 0 ? Math.round(all.reduce((sum, s) => sum + s.overallScore, 0) / all.length) : 0;
    return { total: all.length, healthy, atRisk, critical, avgScore };
  }

  async recalculateAll() {
    const activeSubs = await this.subs.find({ where: { status: 'active' } });
    let calculated = 0;
    for (const sub of activeSubs) {
      await this.calculateForTenant(sub.tenantId, sub.id);
      calculated++;
    }
    this.logger.log(`Recalculated health scores for ${calculated} tenants`);
    return { calculated };
  }

  async calculateForTenant(tenantId: string, subscriptionId?: string): Promise<ClientHealthScore> {
    // Payment score: based on invoice payment history
    let paymentScore = 70; // default
    if (subscriptionId) {
      const invoices = await this.invoices.find({
        where: { subscriptionId },
        order: { issuedAt: 'DESC' },
        take: 12,
      });
      if (invoices.length > 0) {
        const paidOnTime = invoices.filter((inv) => inv.status === 'paid').length;
        paymentScore = Math.round((paidOnTime / invoices.length) * 100);
      }
    }

    // Usage score: simplified — based on subscription being active
    const sub = subscriptionId ? await this.subs.findOne({ where: { id: subscriptionId } }) : null;
    const usageScore = sub?.status === 'active' ? 80 : sub?.status === 'past_due' ? 40 : 20;

    // Deployment score: based on deployment status and last health check.
    // Tenants with no deployments or only pending deployments get a neutral default.
    let deploymentScore = 75; // default if no deployments or all pending
    const tenantDeployments = await this.deployments.find({ where: { tenantId } });
    if (tenantDeployments.length > 0) {
      let activeCount = 0;
      let healthyCount = 0;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      for (const d of tenantDeployments) {
        if (d.status === DeploymentStatus.ACTIVE) {
          activeCount++;
          if (d.lastHealthCheck && d.lastHealthCheck >= oneDayAgo) {
            healthyCount++;
          }
        }
      }
      // Only score deployments if at least one has been activated;
      // all-pending means setup is still in progress — use neutral default.
      if (activeCount > 0) {
        const activeRatio = activeCount / tenantDeployments.length;
        const healthyRatio = healthyCount / activeCount;
        deploymentScore = Math.round(activeRatio * 50 + healthyRatio * 50);
      }
    }

    // Support score: default (would pull from support requests)
    const supportScore = 80;

    // Adoption score: default (would pull from enabled modules vs usage)
    const adoptionScore = 70;

    // Overall weighted
    const overallScore = Math.round(
      paymentScore * 0.3 +
        usageScore * 0.25 +
        deploymentScore * 0.2 +
        supportScore * 0.15 +
        adoptionScore * 0.1,
    );

    const healthStatus: HealthStatus =
      overallScore >= 70 ? 'healthy' : overallScore >= 40 ? 'at_risk' : 'critical';

    const alerts: Array<{ level: string; message: string; createdAt: string }> = [];
    if (paymentScore < 50)
      alerts.push({
        level: 'warning',
        message: 'Low payment score — past-due invoices',
        createdAt: new Date().toISOString(),
      });
    if (usageScore < 40)
      alerts.push({
        level: 'critical',
        message: 'Low usage — subscription may be inactive',
        createdAt: new Date().toISOString(),
      });

    // Upsert
    let existing = await this.scores.findOne({ where: { tenantId } });
    if (!existing) {
      existing = this.scores.create({ tenantId });
    }
    existing.subscriptionId = subscriptionId ?? existing.subscriptionId;
    existing.overallScore = overallScore;
    existing.healthStatus = healthStatus;
    existing.usageScore = usageScore;
    existing.paymentScore = paymentScore;
    existing.supportScore = supportScore;
    existing.adoptionScore = adoptionScore;
    existing.deploymentScore = deploymentScore;
    existing.alerts = alerts;
    existing.lastCalculatedAt = new Date();
    existing.componentDetails = {
      paymentScore,
      usageScore,
      deploymentScore,
      supportScore,
      adoptionScore,
    };

    const saved = await this.scores.save(existing);

    if (healthStatus === 'critical') {
      this.events.emit('client_health.critical', { tenantId, overallScore });
    }

    return saved;
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cronRecalculateAllScores() {
    await this.recalculateAll();
  }

  async initializeForTenant(tenantId: string, subscriptionId?: string): Promise<ClientHealthScore> {
    return this.calculateForTenant(tenantId, subscriptionId);
  }
}
