import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface RevenueOverview {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  churnedTenants: number;
  averageRevenuePerTenant: number;
  growth: { period: string; mrr: number }[];
}

export interface ChurnAnalytics {
  churnRate: number; // percentage
  atRiskTenants: Array<{
    tenantId: string;
    name: string;
    riskScore: number;
    riskFactors: string[];
    lastLoginDaysAgo: number;
    activeUsers: number;
    totalUsers: number;
  }>;
}

export interface TenantUsageMetrics {
  tenantId: string;
  organizationName: string;
  status: string;
  activeUsers: number;
  totalUsers: number;
  totalPatients: number;
  totalEncounters: number;
  encountersLast30Days: number;
  lastActivityAt: Date | null;
  licenseType: string;
  licenseDaysRemaining: number;
  storageEstimateMb: number;
}

@Injectable()
export class RevenueAnalyticsService {
  private readonly logger = new Logger(RevenueAnalyticsService.name);

  constructor(private readonly dataSource: DataSource) {}

  async getRevenueOverview(): Promise<RevenueOverview> {
    try {
      const [tenantStats] = await this.dataSource.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active' AND deleted_at IS NULL)::int AS "activeTenants",
          COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS "totalTenants",
          COUNT(*) FILTER (WHERE status = 'suspended' AND deleted_at IS NULL)::int AS "churnedTenants"
        FROM tenants
      `);

      const [licenseStats] = await this.dataSource.query(`
        SELECT
          COUNT(*) FILTER (WHERE license_type = 'trial' AND status = 'active')::int AS "trialCount",
          COUNT(*) FILTER (WHERE license_type = 'standard' AND status = 'active')::int AS "standardCount",
          COUNT(*) FILTER (WHERE license_type = 'professional' AND status = 'active')::int AS "professionalCount",
          COUNT(*) FILTER (WHERE license_type = 'enterprise' AND status = 'active')::int AS "enterpriseCount"
        FROM licenses WHERE deleted_at IS NULL
      `);

      // Estimate MRR based on tier pricing (configurable defaults)
      const tierPricing: Record<string, number> = {
        trial: 0,
        standard: 99,
        professional: 299,
        enterprise: 999,
      };

      const mrr =
        (licenseStats?.standardCount || 0) * tierPricing.standard +
        (licenseStats?.professionalCount || 0) * tierPricing.professional +
        (licenseStats?.enterpriseCount || 0) * tierPricing.enterprise;

      // Monthly MRR growth (last 6 months)
      const growth = await this.dataSource
        .query(
          `
        SELECT
          TO_CHAR(DATE_TRUNC('month', l.created_at), 'YYYY-MM') AS period,
          COUNT(*)::int AS new_licenses
        FROM licenses l
        WHERE l.deleted_at IS NULL AND l.status = 'active' AND l.created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', l.created_at)
        ORDER BY period
      `,
        )
        .catch(() => []);

      return {
        mrr,
        arr: mrr * 12,
        totalTenants: Number(tenantStats?.totalTenants || 0),
        activeTenants: Number(tenantStats?.activeTenants || 0),
        trialTenants: Number(licenseStats?.trialCount || 0),
        churnedTenants: Number(tenantStats?.churnedTenants || 0),
        averageRevenuePerTenant:
          tenantStats?.activeTenants > 0 ? Math.round(mrr / tenantStats.activeTenants) : 0,
        growth: growth.map((g: any) => ({ period: g.period, mrr: g.new_licenses })),
      };
    } catch (err) {
      this.logger.warn(`Revenue overview query failed: ${(err as Error).message}`);
      return {
        mrr: 0,
        arr: 0,
        totalTenants: 0,
        activeTenants: 0,
        trialTenants: 0,
        churnedTenants: 0,
        averageRevenuePerTenant: 0,
        growth: [],
      };
    }
  }

  async getChurnAnalytics(): Promise<ChurnAnalytics> {
    try {
      const atRisk = await this.dataSource
        .query(
          `
        WITH tenant_activity AS (
          SELECT
            t.id AS tenant_id,
            t.name,
            t.status,
            COUNT(DISTINCT u.id) FILTER (WHERE u.deleted_at IS NULL) AS total_users,
            COUNT(DISTINCT u.id) FILTER (WHERE u.deleted_at IS NULL AND u.status = 'active') AS active_users,
            MAX(lh.login_at) AS last_login,
            COUNT(e.id) FILTER (WHERE e.created_at >= NOW() - INTERVAL '30 days') AS recent_encounters
          FROM tenants t
          LEFT JOIN users u ON u.tenant_id = t.id
          LEFT JOIN login_history lh ON lh.user_id = u.id
          LEFT JOIN encounters e ON e.tenant_id = t.id
          WHERE t.deleted_at IS NULL AND t.status = 'active'
          GROUP BY t.id, t.name, t.status
        )
        SELECT
          tenant_id,
          name,
          total_users,
          active_users,
          last_login,
          recent_encounters,
          EXTRACT(EPOCH FROM (NOW() - COALESCE(last_login, '2000-01-01'))) / 86400 AS days_since_login
        FROM tenant_activity
        WHERE last_login IS NULL OR last_login < NOW() - INTERVAL '14 days' OR recent_encounters = 0
        ORDER BY days_since_login DESC
        LIMIT 50
      `,
        )
        .catch(() => []);

      const totalActive = await this.dataSource
        .query(
          `
        SELECT COUNT(*)::int AS count FROM tenants WHERE status = 'active' AND deleted_at IS NULL
      `,
        )
        .catch(() => [{ count: 0 }]);

      const churned = await this.dataSource
        .query(
          `
        SELECT COUNT(*)::int AS count FROM tenants WHERE status = 'suspended' AND deleted_at IS NULL
        AND updated_at >= NOW() - INTERVAL '30 days'
      `,
        )
        .catch(() => [{ count: 0 }]);

      const churnRate =
        totalActive[0]?.count > 0
          ? Math.round((churned[0]?.count / totalActive[0]?.count) * 10000) / 100
          : 0;

      return {
        churnRate,
        atRiskTenants: atRisk.map((t: any) => {
          const riskFactors: string[] = [];
          const daysSinceLogin = Math.round(Number(t.days_since_login));
          if (daysSinceLogin > 30) riskFactors.push('No login in 30+ days');
          else if (daysSinceLogin > 14) riskFactors.push('No login in 14+ days');
          if (Number(t.recent_encounters) === 0) riskFactors.push('No encounters in 30 days');
          if (Number(t.active_users) === 0) riskFactors.push('No active users');
          if (Number(t.active_users) < Number(t.total_users) * 0.3)
            riskFactors.push('Low user engagement (<30%)');

          return {
            tenantId: t.tenant_id,
            name: t.name,
            riskScore: Math.min(100, riskFactors.length * 25),
            riskFactors,
            lastLoginDaysAgo: daysSinceLogin,
            activeUsers: Number(t.active_users),
            totalUsers: Number(t.total_users),
          };
        }),
      };
    } catch (err) {
      this.logger.warn(`Churn analytics query failed: ${(err as Error).message}`);
      return { churnRate: 0, atRiskTenants: [] };
    }
  }

  async getTenantUsageMetrics(tenantId?: string): Promise<TenantUsageMetrics[]> {
    try {
      const whereClause = tenantId ? 'AND t.id = $1' : '';
      const params = tenantId ? [tenantId] : [];

      const rows = await this.dataSource.query(
        `
        SELECT
          t.id AS "tenantId",
          t.name AS "organizationName",
          t.status,
          COUNT(DISTINCT u.id) FILTER (WHERE u.deleted_at IS NULL AND u.status = 'active')::int AS "activeUsers",
          COUNT(DISTINCT u.id) FILTER (WHERE u.deleted_at IS NULL)::int AS "totalUsers",
          (SELECT COUNT(*)::int FROM patients p WHERE p.tenant_id = t.id AND p.deleted_at IS NULL) AS "totalPatients",
          (SELECT COUNT(*)::int FROM encounters e WHERE e.tenant_id = t.id AND e.deleted_at IS NULL) AS "totalEncounters",
          (SELECT COUNT(*)::int FROM encounters e WHERE e.tenant_id = t.id AND e.deleted_at IS NULL AND e.created_at >= NOW() - INTERVAL '30 days') AS "encountersLast30Days",
          (SELECT MAX(lh.login_at) FROM login_history lh INNER JOIN users lu ON lu.id = lh.user_id WHERE lu.tenant_id = t.id) AS "lastActivityAt",
          COALESCE(l.license_type, 'none') AS "licenseType",
          CASE WHEN l.expires_at IS NOT NULL THEN EXTRACT(EPOCH FROM (l.expires_at - NOW())) / 86400 ELSE 0 END AS "licenseDaysRemaining"
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id
        LEFT JOIN licenses l ON l.tenant_id = t.id AND l.status = 'active'
        WHERE t.deleted_at IS NULL ${whereClause}
        GROUP BY t.id, t.name, t.status, l.license_type, l.expires_at
        ORDER BY "totalEncounters" DESC
      `,
        params,
      );

      return rows.map((r: any) => ({
        ...r,
        activeUsers: Number(r.activeUsers),
        totalUsers: Number(r.totalUsers),
        totalPatients: Number(r.totalPatients),
        totalEncounters: Number(r.totalEncounters),
        encountersLast30Days: Number(r.encountersLast30Days),
        licenseDaysRemaining: Math.max(0, Math.round(Number(r.licenseDaysRemaining))),
        storageEstimateMb: 0, // Would need pg_total_relation_size per schema
      }));
    } catch (err) {
      this.logger.warn(`Tenant usage metrics query failed: ${(err as Error).message}`);
      return [];
    }
  }

  async getTrialConversionMetrics(): Promise<{
    totalTrials: number;
    convertedTrials: number;
    conversionRate: number;
    activeTrials: Array<{
      tenantId: string;
      name: string;
      trialDaysRemaining: number;
      activeUsers: number;
      totalEncounters: number;
    }>;
  }> {
    try {
      const [stats] = await this.dataSource
        .query(
          `
        SELECT
          COUNT(*) FILTER (WHERE license_type = 'trial')::int AS "totalTrials",
          COUNT(*) FILTER (WHERE license_type != 'trial' AND tenant_id IN (
            SELECT tenant_id FROM licenses WHERE license_type = 'trial'
          ))::int AS "convertedTrials"
        FROM licenses WHERE deleted_at IS NULL
      `,
        )
        .catch(() => [{ totalTrials: 0, convertedTrials: 0 }]);

      const activeTrials = await this.dataSource
        .query(
          `
        SELECT
          l.tenant_id AS "tenantId",
          t.name,
          EXTRACT(EPOCH FROM (l.expires_at - NOW())) / 86400 AS "trialDaysRemaining",
          (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id AND u.status = 'active' AND u.deleted_at IS NULL) AS "activeUsers",
          (SELECT COUNT(*)::int FROM encounters e WHERE e.tenant_id = t.id AND e.deleted_at IS NULL) AS "totalEncounters"
        FROM licenses l
        JOIN tenants t ON t.id = l.tenant_id
        WHERE l.license_type = 'trial' AND l.status = 'active' AND l.deleted_at IS NULL
        ORDER BY "trialDaysRemaining" ASC
      `,
        )
        .catch(() => []);

      return {
        totalTrials: Number(stats?.totalTrials || 0),
        convertedTrials: Number(stats?.convertedTrials || 0),
        conversionRate:
          stats?.totalTrials > 0
            ? Math.round((stats.convertedTrials / stats.totalTrials) * 100)
            : 0,
        activeTrials: activeTrials.map((t: any) => ({
          ...t,
          trialDaysRemaining: Math.max(0, Math.round(Number(t.trialDaysRemaining))),
          activeUsers: Number(t.activeUsers),
          totalEncounters: Number(t.totalEncounters),
        })),
      };
    } catch (err) {
      this.logger.warn(`Trial conversion metrics failed: ${(err as Error).message}`);
      return { totalTrials: 0, convertedTrials: 0, conversionRate: 0, activeTrials: [] };
    }
  }
}
