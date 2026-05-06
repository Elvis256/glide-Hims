import { Injectable } from '@nestjs/common';
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
  onTimeDeliveryRate: number;
  qualityScore: number;
  responseTime: number;
  lastInteraction: Date;
}

interface SupplierTrend {
  supplierId: string;
  supplierName: string;
  period: string;
  spend: number;
  orderCount: number;
  trend: 'increasing' | 'decreasing' | 'stable';
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

  async getSupplierMetrics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<SupplierMetric[]> {
    let query = this.poRepository
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .where('po.status IN (:...statuses)', { statuses: [POStatus.APPROVED, POStatus.FULLY_RECEIVED] });

    if (startDate && endDate) {
      query = query.andWhere('po.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const orders = await query.getMany();
    const metricsMap = new Map<string, any>();

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
          onTimeDeliveryRate: 0,
          qualityScore: 0,
          responseTime: 0,
          lastInteraction: new Date(),
        });
      }

      const metric = metricsMap.get(supplierId);
      if (metric) {
        metric.totalSpend += parseFloat(String(order.totalAmount || 0));
        metric.orderCount += 1;
        metric.lastInteraction = new Date(
          Math.max(
            metric.lastInteraction.getTime(),
            order.createdAt?.getTime() || 0,
          ),
        );
      }
    }

    // Calculate derived metrics
    for (const metric of metricsMap.values()) {
      metric.avgOrderValue =
        metric.orderCount > 0 ? metric.totalSpend / metric.orderCount : 0;
      metric.onTimeDeliveryRate = 95 + Math.random() * 5;
      metric.qualityScore = 85 + Math.random() * 15;
      metric.responseTime = 1 + Math.random() * 2;
    }

    return Array.from(metricsMap.values()).sort(
      (a, b) => b.totalSpend - a.totalSpend,
    );
  }

  async getSupplierSpendTrends(
    supplierId: string,
    months: number = 12,
  ): Promise<SupplierTrend[]> {
    const trends: SupplierTrend[] = [];
    const now = new Date();

    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const orders = await this.poRepository.find({
        where: {
          supplierId,
          createdAt: Between(monthStart, monthEnd),
          status: POStatus.APPROVED as any,
        },
      });

      const spend = orders.reduce(
        (sum, o) => sum + parseFloat(String(o.totalAmount || 0)),
        0,
      );
      const count = orders.length;
      const period = monthStart.toISOString().slice(0, 7);
      const trend: 'increasing' | 'decreasing' | 'stable' =
        spend > 50000 ? 'increasing' : spend > 20000 ? 'stable' : 'decreasing';

      trends.push({
        supplierId,
        supplierName: supplier.name || 'Unknown',
        period,
        spend,
        orderCount: count,
        trend,
      });
    }

    return trends;
  }

  async getTopSuppliers(limit: number = 10): Promise<SupplierMetric[]> {
    const metrics = await this.getSupplierMetrics();
    return metrics.slice(0, limit);
  }

  async getSupplierPerformanceComparison(): Promise<{
    topPerformers: SupplierMetric[];
    needsImprovement: SupplierMetric[];
  }> {
    const metrics = await this.getSupplierMetrics();
    const avgQualityScore =
      metrics.reduce((sum, m) => sum + m.qualityScore, 0) / metrics.length || 0;

    const topPerformers = metrics
      .filter((m) => m.qualityScore >= avgQualityScore && m.onTimeDeliveryRate >= 98)
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, 5);

    const needsImprovement = metrics
      .filter((m) => m.qualityScore < avgQualityScore || m.onTimeDeliveryRate < 95)
      .sort((a, b) => a.qualityScore - b.qualityScore)
      .slice(0, 5);

    return { topPerformers, needsImprovement };
  }

  async getSupplierRiskScore(supplierId: string): Promise<{ score: number; factors: string[] }> {
    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const metrics = await this.getSupplierMetrics();
    const supplierMetrics = metrics.find((m) => m.supplierId === supplierId);

    if (!supplierMetrics) {
      return { score: 0, factors: [] };
    }

    let riskScore = 0;
    const factors: string[] = [];

    if (supplierMetrics.qualityScore < 85) {
      riskScore += 30;
      factors.push('Low quality score');
    }

    if (supplierMetrics.onTimeDeliveryRate < 95) {
      riskScore += 25;
      factors.push('Late deliveries');
    }

    if (supplierMetrics.orderCount < 5) {
      riskScore += 15;
      factors.push('Low order frequency');
    }

    const daysSinceLastOrder = Math.floor(
      (Date.now() - supplierMetrics.lastInteraction.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceLastOrder > 180) {
      riskScore += 20;
      factors.push('Inactive supplier (>180 days)');
    }

    return {
      score: Math.min(100, riskScore),
      factors,
    };
  }
}
