import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PurchaseOrder, POStatus } from '../../database/entities/purchase-order.entity';

export interface ApprovalBottleneck {
  level: number;
  approverRole: string;
  pendingCount: number;
  avgWaitTime: number;
  oldestPendingDate: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ApprovalTimeMetric {
  period: string;
  avgApprovalTime: number;
  medianApprovalTime: number;
  totalApprovals: number;
  fastApprovals: number;
  slowApprovals: number;
}

export interface ApprovalTrend {
  date: string;
  avgTimeToApprove: number;
  approvalRate: number;
  rejectionRate: number;
}

@Injectable()
export class ApprovalAnalyticsService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private poRepository: Repository<PurchaseOrder>,
  ) {}

  private tenantWhere(tenantId: string | undefined): { tenantId?: string } {
    return tenantId ? { tenantId } : {};
  }

  /**
   * Returns a single aggregate bottleneck row for the supplied tenant — the
   * cohort of PENDING_APPROVAL POs and their wait stats. The legacy
   * implementation triple-counted the same orders across three hard-coded
   * approval levels because it sliced `pendingOrders.slice(0, ceil(n/3))`
   * for every level, which inflated every count by 3× and reused the same
   * orders. Until we wire actual approval-chain state, returning the true
   * aggregate is honest.
   */
  async detectBottlenecks(tenantId?: string): Promise<ApprovalBottleneck[]> {
    const pendingOrders = await this.poRepository.find({
      where: { status: POStatus.PENDING_APPROVAL, ...this.tenantWhere(tenantId) },
    });

    if (pendingOrders.length === 0) return [];

    const oldestOrder = pendingOrders.reduce((oldest, current) =>
      (current.createdAt || new Date()) < (oldest.createdAt || new Date())
        ? current
        : oldest,
    );

    const waitTimeHours = Math.floor(
      (Date.now() - (oldestOrder.createdAt?.getTime() || 0)) / (1000 * 60 * 60),
    );

    const avgWaitHours =
      pendingOrders.reduce((sum, o) => {
        const created = o.createdAt?.getTime() || Date.now();
        return sum + (Date.now() - created) / (1000 * 60 * 60);
      }, 0) / pendingOrders.length;

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (waitTimeHours > 72) severity = 'critical';
    else if (waitTimeHours > 48) severity = 'high';
    else if (waitTimeHours > 24) severity = 'medium';

    return [
      {
        level: 0,
        approverRole: 'pending',
        pendingCount: pendingOrders.length,
        avgWaitTime: Math.floor(avgWaitHours),
        oldestPendingDate: oldestOrder.createdAt || new Date(),
        severity,
      },
    ];
  }

  async getApprovalTimeMetrics(
    tenantId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ApprovalTimeMetric[]> {
    const metrics: ApprovalTimeMetric[] = [];
    const actualStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const actualEndDate = endDate || new Date();

    const approvedOrders = await this.poRepository.find({
      where: {
        ...this.tenantWhere(tenantId),
        status: POStatus.APPROVED as any,
        updatedAt: Between(actualStartDate, actualEndDate),
      },
    });

    const groupedByMonth = new Map<string, PurchaseOrder[]>();
    for (const order of approvedOrders) {
      const month = (order.updatedAt || new Date()).toISOString().slice(0, 7);
      if (!groupedByMonth.has(month)) groupedByMonth.set(month, []);
      groupedByMonth.get(month)!.push(order);
    }

    for (const [period, orders] of groupedByMonth) {
      if (orders.length === 0) continue;
      const approvalTimes = orders
        .map((o) => {
          const created = o.createdAt?.getTime() || 0;
          const updated = o.updatedAt?.getTime() || 0;
          return (updated - created) / (1000 * 60 * 60);
        })
        .sort((a, b) => a - b);

      const avgTime = approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length;
      const medianTime = approvalTimes[Math.floor(approvalTimes.length / 2)];
      const fastCount = approvalTimes.filter((t) => t < 4).length;
      const slowCount = approvalTimes.filter((t) => t > 24).length;

      metrics.push({
        period,
        avgApprovalTime: avgTime,
        medianApprovalTime: medianTime,
        totalApprovals: orders.length,
        fastApprovals: fastCount,
        slowApprovals: slowCount,
      });
    }
    return metrics;
  }

  async getApprovalTrends(tenantId?: string, days: number = 30): Promise<ApprovalTrend[]> {
    const d = Math.max(1, Math.min(365, Math.floor(Number(days) || 30)));
    const trends: ApprovalTrend[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - d);

    const orders = await this.poRepository.find({
      where: { ...this.tenantWhere(tenantId), updatedAt: Between(startDate, new Date()) },
    });

    const groupedByDate = new Map<string, PurchaseOrder[]>();
    for (const order of orders) {
      const date = (order.updatedAt || new Date()).toISOString().slice(0, 10);
      if (!groupedByDate.has(date)) groupedByDate.set(date, []);
      groupedByDate.get(date)!.push(order);
    }

    for (const [date, dayOrders] of groupedByDate) {
      const approved = dayOrders.filter((o) => o.status === POStatus.APPROVED).length;
      const cancelled = dayOrders.filter((o) => o.status === POStatus.CANCELLED).length;
      const total = dayOrders.length;

      const avgTime =
        approved > 0
          ? dayOrders
              .filter((o) => o.status === POStatus.APPROVED)
              .reduce((sum, o) => {
                const created = o.createdAt?.getTime() || 0;
                const updated = o.updatedAt?.getTime() || 0;
                return sum + (updated - created) / (1000 * 60 * 60);
              }, 0) / approved
          : 0;

      trends.push({
        date,
        avgTimeToApprove: avgTime,
        approvalRate: total > 0 ? (approved / total) * 100 : 0,
        rejectionRate: total > 0 ? (cancelled / total) * 100 : 0,
      });
    }
    return trends.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async getApprovalSLACompliance(tenantId?: string): Promise<{
    slaTarget: number;
    compliantCount: number;
    nonCompliantCount: number;
    complianceRate: number;
  }> {
    const slaTarget = 48;
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const recentOrders = await this.poRepository.find({
      where: {
        ...this.tenantWhere(tenantId),
        status: POStatus.APPROVED as any,
        updatedAt: Between(last30Days, new Date()),
      },
    });

    let compliant = 0;
    let nonCompliant = 0;

    for (const order of recentOrders) {
      const timeToApprove =
        ((order.updatedAt?.getTime() || 0) - (order.createdAt?.getTime() || 0)) /
        (1000 * 60 * 60);
      if (timeToApprove <= slaTarget) compliant++;
      else nonCompliant++;
    }

    const total = compliant + nonCompliant;
    return {
      slaTarget,
      compliantCount: compliant,
      nonCompliantCount: nonCompliant,
      complianceRate: total > 0 ? (compliant / total) * 100 : 0,
    };
  }

  /**
   * Workload breakdown. byApprover is intentionally empty until approval-
   * chain assignments are persisted on the PO; the legacy implementation
   * hard-coded every order under 'Department Head', which was misleading.
   */
  async getApprovalWorkload(tenantId?: string): Promise<{
    byApprover: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const allOrders = await this.poRepository.find({ where: this.tenantWhere(tenantId) });

    const byStatus: Record<string, number> = {};
    for (const order of allOrders) {
      const status = String(order.status || 'UNKNOWN');
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

    return { byApprover: {}, byStatus };
  }
}
