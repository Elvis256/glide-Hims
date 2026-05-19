import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PurchaseOrder, POStatus } from '../../database/entities/purchase-order.entity';
import { Item } from '../../database/entities/inventory.entity';

interface CategorySpend {
  category: string;
  totalSpend: number;
  orderCount: number;
  avgOrderValue: number;
  percentOfTotal: number;
  /**
   * trend is computed from spend in this period vs the same-length prior
   * period. Returns null when there is no prior period data.
   */
  trend: 'up' | 'down' | 'stable' | null;
}

interface DepartmentSpend {
  departmentId: string;
  departmentName: string;
  totalSpend: number;
  orderCount: number;
  avgOrderValue: number;
  /**
   * budget is sourced from the optional budgets table; null when no budget
   * is configured for the department. UI must render 'not configured' in
   * that case rather than fabricating a number.
   */
  budget: number | null;
  utilization: number | null;
}

interface SpendTrend {
  period: string;
  totalSpend: number;
  orderCount: number;
  avgOrderValue: number;
}

@Injectable()
export class SpendAnalyticsService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private poRepository: Repository<PurchaseOrder>,
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
  ) {}

  private requireTenant(tenantId?: string): string {
    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }
    return tenantId;
  }

  /**
   * Category spend — aggregates approved/fully-received POs by item category.
   * Uses an INNER JOIN on purchase_order_items → items → item_categories so
   * each PO line contributes to the correct category. POs without categorised
   * items fall under 'Uncategorised'. Removes the previous Math.random() bug
   * where every PO was assigned a random category on each call.
   */
  async getCategorySpend(
    tenantId: string | undefined,
    startDate?: Date,
    endDate?: Date,
  ): Promise<CategorySpend[]> {
    const tid = this.requireTenant(tenantId);

    const params: any[] = [tid];
    let dateClause = '';
    if (startDate && endDate) {
      dateClause = `AND po.created_at BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }

    const rows: Array<{ category: string; total_spend: string; order_count: string }> =
      await this.poRepository.query(
        `SELECT COALESCE(ic.name, 'Uncategorised') AS category,
                SUM(poi.line_total)::numeric AS total_spend,
                COUNT(DISTINCT po.id)::int AS order_count
         FROM purchase_orders po
         JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
         LEFT JOIN items i ON i.id::text = poi.item_id
         LEFT JOIN item_categories ic ON ic.id = i.category_id
         WHERE po.tenant_id = $1
           AND po.status IN ('approved', 'fully_received')
           AND po.deleted_at IS NULL
           ${dateClause}
         GROUP BY ic.name
         ORDER BY total_spend DESC`,
        params,
      );

    const totalSpend = rows.reduce((s, r) => s + Number(r.total_spend || 0), 0);

    const priorCategoryTotals = await this.getPriorPeriodCategoryTotals(
      tid,
      startDate,
      endDate,
    );

    return rows.map((r) => {
      const current = Number(r.total_spend || 0);
      const prior = priorCategoryTotals.get(r.category);
      let trend: 'up' | 'down' | 'stable' | null = null;
      if (prior !== undefined && prior > 0) {
        const delta = (current - prior) / prior;
        if (delta > 0.05) trend = 'up';
        else if (delta < -0.05) trend = 'down';
        else trend = 'stable';
      }
      return {
        category: r.category,
        totalSpend: current,
        orderCount: Number(r.order_count || 0),
        avgOrderValue: r.order_count ? current / Number(r.order_count) : 0,
        percentOfTotal: totalSpend > 0 ? (current / totalSpend) * 100 : 0,
        trend,
      };
    });
  }

  private async getPriorPeriodCategoryTotals(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Map<string, number>> {
    if (!startDate || !endDate) return new Map();
    const spanMs = endDate.getTime() - startDate.getTime();
    const priorEnd = new Date(startDate.getTime());
    const priorStart = new Date(startDate.getTime() - spanMs);
    const rows: Array<{ category: string; total_spend: string }> =
      await this.poRepository.query(
        `SELECT COALESCE(ic.name, 'Uncategorised') AS category,
                SUM(poi.line_total)::numeric AS total_spend
         FROM purchase_orders po
         JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
         LEFT JOIN items i ON i.id::text = poi.item_id
         LEFT JOIN item_categories ic ON ic.id = i.category_id
         WHERE po.tenant_id = $1
           AND po.status IN ('approved', 'fully_received')
           AND po.deleted_at IS NULL
           AND po.created_at BETWEEN $2 AND $3
         GROUP BY ic.name`,
        [tenantId, priorStart, priorEnd],
      );
    return new Map(rows.map((r) => [r.category, Number(r.total_spend || 0)]));
  }

  /**
   * Department spend. Budget is fetched from the optional department_budgets
   * table when present; otherwise reported as null. Previous implementation
   * fabricated budgets with Math.random()*400000, distorting utilisation.
   */
  async getDepartmentSpend(
    tenantId: string | undefined,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DepartmentSpend[]> {
    const tid = this.requireTenant(tenantId);

    const params: any[] = [tid];
    let dateClause = '';
    if (startDate && endDate) {
      dateClause = `AND po.created_at BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }

    const rows: Array<{
      department_id: string | null;
      department_name: string | null;
      total_spend: string;
      order_count: string;
    }> = await this.poRepository.query(
      `SELECT po.department_id,
              d.name AS department_name,
              SUM(po.total_amount)::numeric AS total_spend,
              COUNT(*)::int AS order_count
       FROM purchase_orders po
       LEFT JOIN departments d ON d.id = po.department_id
       WHERE po.tenant_id = $1
         AND po.status IN ('approved', 'fully_received')
         AND po.deleted_at IS NULL
         ${dateClause}
       GROUP BY po.department_id, d.name
       ORDER BY total_spend DESC`,
      params,
    );

    const budgets = await this.getDepartmentBudgets(tid, startDate, endDate);

    return rows.map((r) => {
      const totalSpend = Number(r.total_spend || 0);
      const orderCount = Number(r.order_count || 0);
      const budget = r.department_id ? budgets.get(r.department_id) ?? null : null;
      return {
        departmentId: r.department_id ?? 'unassigned',
        departmentName: r.department_name ?? 'Unassigned',
        totalSpend,
        orderCount,
        avgOrderValue: orderCount > 0 ? totalSpend / orderCount : 0,
        budget,
        utilization: budget && budget > 0 ? (totalSpend / budget) * 100 : null,
      };
    });
  }

  private async getDepartmentBudgets(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Map<string, number>> {
    // Optional department_budgets table — silently returns empty map when the
    // table doesn't exist (older deployments) so the analytics still render.
    try {
      const rows: Array<{ department_id: string; amount: string }> =
        await this.poRepository.query(
          `SELECT department_id, SUM(amount)::numeric AS amount
           FROM department_budgets
           WHERE tenant_id = $1
             ${startDate && endDate ? 'AND period_start <= $3 AND period_end >= $2' : ''}
           GROUP BY department_id`,
          startDate && endDate ? [tenantId, startDate, endDate] : [tenantId],
        );
      return new Map(rows.map((r) => [r.department_id, Number(r.amount || 0)]));
    } catch {
      return new Map();
    }
  }

  async getSpendTrends(tenantId: string | undefined, months: number = 12): Promise<SpendTrend[]> {
    const tid = this.requireTenant(tenantId);
    const m = Math.max(1, Math.min(60, Math.floor(Number(months) || 12)));
    const trends: SpendTrend[] = [];
    const now = new Date();

    for (let i = m - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const monthOrders = await this.poRepository.find({
        where: {
          tenantId: tid,
          createdAt: Between(monthStart, monthEnd),
          status: POStatus.APPROVED as any,
        },
      });

      const totalSpend = monthOrders.reduce(
        (sum, o) => sum + parseFloat(String(o.totalAmount || 0)),
        0,
      );
      const orderCount = monthOrders.length;

      trends.push({
        period: monthStart.toISOString().slice(0, 7),
        totalSpend,
        orderCount,
        avgOrderValue: orderCount > 0 ? totalSpend / orderCount : 0,
      });
    }

    return trends;
  }

  async getBudgetUtilization(tenantId: string | undefined): Promise<{
    totalBudget: number;
    totalSpend: number;
    remaining: number;
    utilizationRate: number | null;
    byDepartment: DepartmentSpend[];
  }> {
    const departments = await this.getDepartmentSpend(tenantId);

    const totalBudget = departments.reduce((sum, d) => sum + (d.budget ?? 0), 0);
    const totalSpend = departments.reduce((sum, d) => sum + d.totalSpend, 0);
    const remaining = totalBudget - totalSpend;

    return {
      totalBudget,
      totalSpend,
      remaining,
      utilizationRate: totalBudget > 0 ? (totalSpend / totalBudget) * 100 : null,
      byDepartment: departments,
    };
  }

  /**
   * Naïve forecast: rolls forward the trailing 6-month average. Confidence is
   * derived from the coefficient of variation of recent monthly spend — high
   * variance → low confidence. Previous implementation returned
   * `75 + Math.random() * 15` which was meaningless.
   */
  async getSpendForecast(
    tenantId: string | undefined,
    months: number = 3,
  ): Promise<{ period: string; forecastedSpend: number; confidence: number | null }[]> {
    const tid = this.requireTenant(tenantId);
    const horizon = Math.max(1, Math.min(12, Math.floor(Number(months) || 3)));
    const trends = await this.getSpendTrends(tid, 12);
    const recent = trends.slice(-6).filter((t) => t.totalSpend > 0);

    if (recent.length === 0) {
      return Array.from({ length: horizon }, (_, i) => {
        const m = new Date();
        m.setMonth(m.getMonth() + i + 1);
        return { period: m.toISOString().slice(0, 7), forecastedSpend: 0, confidence: null };
      });
    }

    const avg = recent.reduce((s, t) => s + t.totalSpend, 0) / recent.length;
    const variance =
      recent.reduce((s, t) => s + (t.totalSpend - avg) ** 2, 0) / recent.length;
    const stdDev = Math.sqrt(variance);
    const cv = avg > 0 ? stdDev / avg : 1;
    const confidence = Math.max(0, Math.min(99, 100 * (1 - cv)));

    const forecasts: { period: string; forecastedSpend: number; confidence: number | null }[] = [];
    for (let i = 1; i <= horizon; i++) {
      const m = new Date();
      m.setMonth(m.getMonth() + i);
      forecasts.push({
        period: m.toISOString().slice(0, 7),
        forecastedSpend: avg,
        confidence: Number(confidence.toFixed(1)),
      });
    }
    return forecasts;
  }

  async getTopSpendItems(
    tenantId: string | undefined,
    limit: number = 10,
  ): Promise<Array<{ supplierId: string; supplierName: string; totalSpend: number }>> {
    const tid = this.requireTenant(tenantId);
    const cap = Math.max(1, Math.min(100, Math.floor(Number(limit) || 10)));

    const rows: Array<{ supplier_id: string; supplier_name: string; total_spend: string }> =
      await this.poRepository.query(
        `SELECT po.supplier_id,
                COALESCE(s.name, 'Unknown') AS supplier_name,
                SUM(po.total_amount)::numeric AS total_spend
         FROM purchase_orders po
         LEFT JOIN suppliers s ON s.id = po.supplier_id
         WHERE po.tenant_id = $1
           AND po.status = 'approved'
           AND po.deleted_at IS NULL
         GROUP BY po.supplier_id, s.name
         ORDER BY total_spend DESC
         LIMIT $2`,
        [tid, cap],
      );

    return rows.map((r) => ({
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      totalSpend: Number(r.total_spend || 0),
    }));
  }
}
