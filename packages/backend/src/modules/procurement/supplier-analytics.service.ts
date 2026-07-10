import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PurchaseOrder, POStatus } from '../../database/entities/purchase-order.entity';
import { GoodsReceiptNote } from '../../database/entities/goods-receipt.entity';
import { Supplier } from '../../database/entities/supplier.entity';

interface SupplierMetric {
  supplierId: string;
  supplierName: string;
  totalSpend: number;
  orderCount: number;
  avgOrderValue: number;
  /**
   * % of GRNs for this supplier received on/before PO expected_delivery.
   * `null` when expected_delivery was never set on any of the supplier's POs,
   * or when no GRNs exist for the period.
   */
  onTimeDeliveryRate: number | null;
  /**
   * sum(quantity_accepted) / sum(quantity_received) * 100 across GRN items.
   * `null` when no GRN inspection data exists.
   */
  qualityScore: number | null;
  /** Reserved for future RFQ-quote turnaround metric. Always null for now. */
  responseTime: number | null;
  lastInteraction: Date | null;
}

interface SupplierTrend {
  supplierId: string;
  supplierName: string;
  period: string;
  spend: number;
  orderCount: number;
  trend: 'increasing' | 'decreasing' | 'stable' | null;
}

@Injectable()
export class SupplierAnalyticsService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private poRepository: Repository<PurchaseOrder>,
    @InjectRepository(GoodsReceiptNote)
    private grnRepository: Repository<GoodsReceiptNote>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
  ) {}

  private requireTenant(tenantId?: string): string {
    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }
    return tenantId;
  }

  async getSupplierMetrics(
    tenantId: string | undefined,
    startDate?: Date,
    endDate?: Date,
  ): Promise<SupplierMetric[]> {
    const tid = this.requireTenant(tenantId);

    let query = this.poRepository
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .where('po.tenantId = :tid', { tid })
      .andWhere('po.status IN (:...statuses)', {
        statuses: [POStatus.APPROVED, POStatus.FULLY_RECEIVED],
      });

    if (startDate && endDate) {
      query = query.andWhere('po.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const orders = await query.getMany();
    const metricsMap = new Map<string, SupplierMetric>();

    for (const order of orders) {
      const supplierId = order.supplierId || 'unknown';
      const supplierName = order.supplier?.name || 'Unknown Supplier';

      if (!metricsMap.has(supplierId)) {
        metricsMap.set(supplierId, {
          supplierId,
          supplierName,
          totalSpend: 0,
          orderCount: 0,
          avgOrderValue: 0,
          onTimeDeliveryRate: null,
          qualityScore: null,
          responseTime: null,
          lastInteraction: null,
        });
      }

      const metric = metricsMap.get(supplierId)!;
      metric.totalSpend += parseFloat(String(order.totalAmount || 0));
      metric.orderCount += 1;
      const orderTime = order.createdAt?.getTime() || 0;
      if (!metric.lastInteraction || orderTime > metric.lastInteraction.getTime()) {
        metric.lastInteraction = new Date(orderTime);
      }
    }

    const supplierIds = Array.from(metricsMap.keys()).filter((id) => id !== 'unknown');
    if (supplierIds.length > 0) {
      await this.attachDeliveryAndQuality(tid, supplierIds, metricsMap, startDate, endDate);
    }

    for (const metric of metricsMap.values()) {
      metric.avgOrderValue = metric.orderCount > 0 ? metric.totalSpend / metric.orderCount : 0;
    }

    return Array.from(metricsMap.values()).sort((a, b) => b.totalSpend - a.totalSpend);
  }

  private async attachDeliveryAndQuality(
    tenantId: string,
    supplierIds: string[],
    metricsMap: Map<string, SupplierMetric>,
    startDate?: Date,
    endDate?: Date,
  ): Promise<void> {
    const params: any[] = [tenantId, supplierIds];
    let dateClause = '';
    if (startDate && endDate) {
      dateClause = `AND grn.received_at BETWEEN $3 AND $4`;
      params.push(startDate, endDate);
    }

    const deliveryRows: Array<{
      supplier_id: string;
      total: string;
      on_time: string;
      with_expected: string;
    }> = await this.grnRepository.query(
      `SELECT grn.supplier_id,
              COUNT(*)::int AS total,
              SUM(CASE WHEN po.expected_delivery IS NOT NULL
                            AND grn.received_at::date <= po.expected_delivery
                       THEN 1 ELSE 0 END)::int AS on_time,
              SUM(CASE WHEN po.expected_delivery IS NOT NULL THEN 1 ELSE 0 END)::int AS with_expected
       FROM goods_receipt_notes grn
       JOIN purchase_orders po ON po.id = grn.purchase_order_id
       WHERE grn.tenant_id = $1
         AND grn.supplier_id = ANY($2)
         AND grn.deleted_at IS NULL
         ${dateClause}
       GROUP BY grn.supplier_id`,
      params,
    );

    for (const row of deliveryRows) {
      const metric = metricsMap.get(row.supplier_id);
      if (!metric) continue;
      const withExpected = Number(row.with_expected || 0);
      const onTime = Number(row.on_time || 0);
      metric.onTimeDeliveryRate = withExpected > 0 ? (onTime / withExpected) * 100 : null;
    }

    const qualityRows: Array<{
      supplier_id: string;
      total_received: string;
      total_accepted: string;
    }> = await this.grnRepository.query(
      `SELECT grn.supplier_id,
              SUM(gri.quantity_received)::numeric AS total_received,
              SUM(COALESCE(gri.quantity_accepted, gri.quantity_received))::numeric AS total_accepted
       FROM goods_receipt_notes grn
       JOIN goods_receipt_items gri ON gri.goods_receipt_note_id = grn.id
       WHERE grn.tenant_id = $1
         AND grn.supplier_id = ANY($2)
         AND grn.deleted_at IS NULL
         AND grn.inspected_at IS NOT NULL
         ${dateClause}
       GROUP BY grn.supplier_id`,
      params,
    );

    for (const row of qualityRows) {
      const metric = metricsMap.get(row.supplier_id);
      if (!metric) continue;
      const received = Number(row.total_received || 0);
      const accepted = Number(row.total_accepted || 0);
      metric.qualityScore = received > 0 ? (accepted / received) * 100 : null;
    }
  }

  async getSupplierSpendTrends(
    tenantId: string | undefined,
    supplierId: string,
    months: number = 12,
  ): Promise<SupplierTrend[]> {
    const tid = this.requireTenant(tenantId);
    const m = Math.max(1, Math.min(60, Math.floor(Number(months) || 12)));
    const trends: SupplierTrend[] = [];
    const now = new Date();

    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId, tenantId: tid },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    let prevSpend: number | null = null;
    for (let i = m - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const orders = await this.poRepository.find({
        where: {
          tenantId: tid,
          supplierId,
          createdAt: Between(monthStart, monthEnd),
          status: POStatus.APPROVED as any,
        },
      });

      const spend = orders.reduce((sum, o) => sum + parseFloat(String(o.totalAmount || 0)), 0);
      const period = monthStart.toISOString().slice(0, 7);

      let trend: 'increasing' | 'decreasing' | 'stable' | null = null;
      if (prevSpend !== null && prevSpend > 0) {
        const delta = (spend - prevSpend) / prevSpend;
        if (delta > 0.05) trend = 'increasing';
        else if (delta < -0.05) trend = 'decreasing';
        else trend = 'stable';
      }

      trends.push({
        supplierId,
        supplierName: supplier.name || 'Unknown',
        period,
        spend,
        orderCount: orders.length,
        trend,
      });
      prevSpend = spend;
    }

    return trends;
  }

  async getTopSuppliers(
    tenantId: string | undefined,
    limit: number = 10,
  ): Promise<SupplierMetric[]> {
    const cap = Math.max(1, Math.min(100, Math.floor(Number(limit) || 10)));
    const metrics = await this.getSupplierMetrics(tenantId);
    return metrics.slice(0, cap);
  }

  async getSupplierPerformanceComparison(tenantId: string | undefined): Promise<{
    topPerformers: SupplierMetric[];
    needsImprovement: SupplierMetric[];
  }> {
    const metrics = await this.getSupplierMetrics(tenantId);
    const scored = metrics.filter((m) => m.qualityScore !== null);
    const avgQualityScore =
      scored.length > 0
        ? scored.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / scored.length
        : 0;

    const topPerformers = metrics
      .filter((m) => (m.qualityScore ?? 0) >= avgQualityScore && (m.onTimeDeliveryRate ?? 0) >= 98)
      .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0))
      .slice(0, 5);

    const needsImprovement = metrics
      .filter(
        (m) =>
          (m.qualityScore !== null && (m.qualityScore ?? 0) < avgQualityScore) ||
          (m.onTimeDeliveryRate !== null && (m.onTimeDeliveryRate ?? 0) < 95),
      )
      .sort((a, b) => (a.qualityScore ?? 0) - (b.qualityScore ?? 0))
      .slice(0, 5);

    return { topPerformers, needsImprovement };
  }

  async getSupplierRiskScore(
    tenantId: string | undefined,
    supplierId: string,
  ): Promise<{ score: number; factors: string[] }> {
    const tid = this.requireTenant(tenantId);
    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId, tenantId: tid },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const metrics = await this.getSupplierMetrics(tid);
    const supplierMetrics = metrics.find((m) => m.supplierId === supplierId);

    if (!supplierMetrics) {
      return { score: 0, factors: [] };
    }

    let riskScore = 0;
    const factors: string[] = [];

    if (supplierMetrics.qualityScore !== null && supplierMetrics.qualityScore < 85) {
      riskScore += 30;
      factors.push('Low quality score');
    }

    if (supplierMetrics.onTimeDeliveryRate !== null && supplierMetrics.onTimeDeliveryRate < 95) {
      riskScore += 25;
      factors.push('Late deliveries');
    }

    if (supplierMetrics.orderCount < 5) {
      riskScore += 15;
      factors.push('Low order frequency');
    }

    if (supplierMetrics.lastInteraction) {
      const daysSinceLastOrder = Math.floor(
        (Date.now() - supplierMetrics.lastInteraction.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceLastOrder > 180) {
        riskScore += 20;
        factors.push('Inactive supplier (>180 days)');
      }
    }

    return {
      score: Math.min(100, riskScore),
      factors,
    };
  }
}
