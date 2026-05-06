import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PurchaseOrder, POStatus } from '../../database/entities/purchase-order.entity';

interface ApprovalBottleneck {
  level: number;
  approverRole: string;
  pendingCount: number;
  avgWaitTime: number;
  oldestPendingDate: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ApprovalTimeMetric {
  period: string;
  avgApprovalTime: number;
  medianApprovalTime: number;
  totalApprovals: number;
  fastApprovals: number;
  slowApprovals: number;
}

interface ApprovalTrend {
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

  async detectBottlenecks(): Promise<ApprovalBottleneck[]> {
    const bottlenecks: ApprovalBottleneck[] = [];
    const pendingOrders = await this.poRepository.find({
      where: { status: 'PENDING_APPROVAL' as any },
    });

    const levels = [
      { level: 1, role: 'Department Head' },
      { level: 2, role: 'Finance Manager' },
      { level: 3, role: 'Executive Director' },
    ];

    for (const levelConfig of levels) {
      const levelOrders = pendingOrders.slice(0, Math.ceil(pendingOrders.length / 3));

      if (levelOrders.length > 0) {
        const oldestOrder = levelOrders.reduce((oldest, current) =>
          (current.createdAt || new Date()) < (oldest.createdAt || new Date())
            ? current
            : oldest,
        );

        const waitTime = Math.floor(
          (Date.now() - (oldestOrder.createdAt?.getTime() || 0)) / (1000 * 60 * 60),
        );

        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (waitTime > 72) severity = 'critical';
        else if (waitTime > 48) severity = 'high';
        else if (waitTime > 24) severity = 'medium';

        if (severity !== 'low') {
          bottlenecks.push({
            level: levelConfig.level,
            approverRole: levelConfig.role,
            pendingCount: levelOrders.length,
            avgWaitTime: waitTime,
            oldestPendingDate: oldestOrder.createdAt || new Date(),
            severity,
          });
        }
      }
    }

    return bottlenecks.sort((a, b) => b.avgWaitTime - a.avgWaitTime);
  }

  async getApprovalTimeMetrics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<ApprovalTimeMetric[]> {
    const metrics: ApprovalTimeMetric[] = [];

    const actualStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const actualEndDate = endDate || new Date();

    const approvedOrders = await this.poRepository.find({
      where: {
        status: POStatus.APPROVED as any,
        updatedAt: Between(actualStartDate, actualEndDate),
      },
    });

    const groupedByMonth = new Map<string, any[]>();

    for (const order of approvedOrders) {
      const month = (order.updatedAt || new Date()).toISOString().slice(0, 7);
      if (!groupedByMonth.has(month)) {
        groupedByMonth.set(month, []);
      }
      groupedByMonth.get(month)?.push(order);
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

  async getApprovalTrends(days: number = 30): Promise<ApprovalTrend[]> {
    const trends: ApprovalTrend[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await this.poRepository.find({
      where: {
        updatedAt: Between(startDate, new Date()),
      },
    });

    const groupedByDate = new Map<string, any[]>();

    for (const order of orders) {
      const date = (order.updatedAt || new Date()).toISOString().slice(0, 10);
      if (!groupedByDate.has(date)) {
        groupedByDate.set(date, []);
      }
      groupedByDate.get(date)?.push(order);
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

  async getApprovalSLACompliance(): Promise<{
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
      if (timeToApprove <= slaTarget) {
        compliant++;
      } else {
        nonCompliant++;
      }
    }

    const total = compliant + nonCompliant;

    return {
      slaTarget,
      compliantCount: compliant,
      nonCompliantCount: nonCompliant,
      complianceRate: total > 0 ? (compliant / total) * 100 : 0,
    };
  }

  async getApprovalWorkload(): Promise<{
    byApprover: Map<string, number>;
    byStatus: Map<string, number>;
  }> {
    const allOrders = await this.poRepository.find();

    const byApprover = new Map<string, number>();
    const byStatus = new Map<string, number>();

    for (const order of allOrders) {
      const status = order.status || 'UNKNOWN';
      byStatus.set(String(status), (byStatus.get(String(status)) || 0) + 1);

      const approverRole = 'Department Head';
      byApprover.set(approverRole, (byApprover.get(approverRole) || 0) + 1);
    }

    return { byApprover, byStatus };
  }
}
