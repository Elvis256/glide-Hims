import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../../database/entities/supplier.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { GoodsReceiptNote, GoodsReceiptItem } from '../../database/entities/goods-receipt.entity';
import { InvoiceMatch } from '../../database/entities/invoice-match.entity';

export interface ScoreBreakdown {
  delivery: number;
  quality: number;
  invoiceAccuracy: number;
  overall: number;
}

export interface SupplierScorecard {
  supplier: {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
  };
  scores: ScoreBreakdown;
  metrics: {
    totalPOs: number;
    deliveredOnTime: number;
    totalGRNItems: number;
    acceptedItems: number;
    rejectedItems: number;
    totalInvoices: number;
    matchedInvoices: number;
  };
  recentPOs: {
    id: string;
    orderNumber: string;
    orderDate: Date;
    expectedDelivery: Date | null;
    status: string;
    totalAmount: number;
  }[];
  periodFrom: string | null;
  periodTo: string | null;
}

export interface SupplierRanking {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierType: string;
  supplierStatus: string;
  scores: ScoreBreakdown;
  totalPOs: number;
  rank: number;
}

// Weights for composite score
const DELIVERY_WEIGHT = 0.4;
const QUALITY_WEIGHT = 0.35;
const INVOICE_WEIGHT = 0.25;

@Injectable()
export class SupplierScoringService {
  constructor(
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
    @InjectRepository(GoodsReceiptNote) private grnRepo: Repository<GoodsReceiptNote>,
    @InjectRepository(GoodsReceiptItem) private grnItemRepo: Repository<GoodsReceiptItem>,
    @InjectRepository(InvoiceMatch) private invoiceMatchRepo: Repository<InvoiceMatch>,
  ) {}

  async calculateScore(
    supplierId: string,
    tenantId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{ scores: ScoreBreakdown; metrics: SupplierScorecard['metrics'] }> {
    const deliveryResult = await this.calculateDeliveryScore(supplierId, tenantId, dateFrom, dateTo);
    const qualityResult = await this.calculateQualityScore(supplierId, tenantId, dateFrom, dateTo);
    const invoiceResult = await this.calculateInvoiceAccuracyScore(supplierId, tenantId, dateFrom, dateTo);

    const overall = Math.round(
      deliveryResult.score * DELIVERY_WEIGHT +
      qualityResult.score * QUALITY_WEIGHT +
      invoiceResult.score * INVOICE_WEIGHT,
    );

    return {
      scores: {
        delivery: deliveryResult.score,
        quality: qualityResult.score,
        invoiceAccuracy: invoiceResult.score,
        overall,
      },
      metrics: {
        totalPOs: deliveryResult.totalPOs,
        deliveredOnTime: deliveryResult.onTime,
        totalGRNItems: qualityResult.totalItems,
        acceptedItems: qualityResult.accepted,
        rejectedItems: qualityResult.rejected,
        totalInvoices: invoiceResult.totalInvoices,
        matchedInvoices: invoiceResult.matched,
      },
    };
  }

  async getSupplierScorecard(
    supplierId: string,
    tenantId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<SupplierScorecard> {
    const supplier = await this.supplierRepo.findOneOrFail({ where: { id: supplierId, ...(tenantId ? { tenantId } : {}) } });
    const { scores, metrics } = await this.calculateScore(supplierId, tenantId, dateFrom, dateTo);

    // Recent POs
    const recentPOQuery = this.poRepo.createQueryBuilder('po')
      .where('po.supplier_id = :supplierId', { supplierId })
      .orderBy('po.order_date', 'DESC')
      .limit(10);

    if (tenantId) recentPOQuery.andWhere('po.tenant_id = :tenantId', { tenantId });

    const recentPOs = await recentPOQuery.getMany();

    return {
      supplier: {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        type: supplier.type,
        status: supplier.status,
      },
      scores,
      metrics,
      recentPOs: recentPOs.map(po => ({
        id: po.id,
        orderNumber: po.orderNumber,
        orderDate: po.orderDate,
        expectedDelivery: po.expectedDelivery || null,
        status: po.status,
        totalAmount: Number(po.totalAmount),
      })),
      periodFrom: dateFrom || null,
      periodTo: dateTo || null,
    };
  }

  async getSupplierRankings(tenantId?: string): Promise<SupplierRanking[]> {
    const query = this.supplierRepo.createQueryBuilder('s');
    if (tenantId) query.where('s.tenant_id = :tenantId', { tenantId });

    const suppliers = await query.getMany();

    const rankings: SupplierRanking[] = [];

    for (const supplier of suppliers) {
      const { scores, metrics } = await this.calculateScore(supplier.id, tenantId);
      rankings.push({
        supplierId: supplier.id,
        supplierCode: supplier.code,
        supplierName: supplier.name,
        supplierType: supplier.type,
        supplierStatus: supplier.status,
        scores,
        totalPOs: metrics.totalPOs,
        rank: 0,
      });
    }

    // Sort by overall score descending, then assign ranks
    rankings.sort((a, b) => b.scores.overall - a.scores.overall);
    rankings.forEach((r, i) => { r.rank = i + 1; });

    return rankings;
  }

  // ── Delivery Score: % of POs delivered on time ──────────────────────────

  private async calculateDeliveryScore(
    supplierId: string,
    tenantId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{ score: number; totalPOs: number; onTime: number }> {
    // Get POs that have at least been partially received and have an expectedDelivery date
    const query = this.poRepo.createQueryBuilder('po')
      .where('po.supplier_id = :supplierId', { supplierId })
      .andWhere('po.expected_delivery IS NOT NULL')
      .andWhere('po.status IN (:...statuses)', {
        statuses: ['partially_received', 'fully_received', 'closed'],
      });

    if (tenantId) query.andWhere('po.tenant_id = :tenantId', { tenantId });
    if (dateFrom) query.andWhere('po.order_date >= :dateFrom', { dateFrom });
    if (dateTo) query.andWhere('po.order_date <= :dateTo', { dateTo });

    const pos = await query.getMany();

    if (pos.length === 0) return { score: 100, totalPOs: 0, onTime: 0 };

    let onTimeCount = 0;
    for (const po of pos) {
      // Find earliest GRN receivedAt for this PO
      const grnQuery = this.grnRepo.createQueryBuilder('grn')
        .where('grn.purchase_order_id = :poId', { poId: po.id })
        .andWhere('grn.status != :cancelled', { cancelled: 'cancelled' })
        .orderBy('grn.received_at', 'ASC')
        .limit(1);

      if (tenantId) grnQuery.andWhere('grn.tenant_id = :tenantId', { tenantId });

      const grn = await grnQuery.getOne();

      if (grn) {
        const receivedDate = new Date(grn.receivedAt);
        const expectedDate = new Date(po.expectedDelivery!);
        if (receivedDate <= expectedDate) {
          onTimeCount++;
        }
      }
      // If no GRN found, PO is overdue (not on time)
    }

    const score = Math.round((onTimeCount / pos.length) * 100);
    return { score, totalPOs: pos.length, onTime: onTimeCount };
  }

  // ── Quality Score: % of GRN items accepted vs rejected ─────────────────

  private async calculateQualityScore(
    supplierId: string,
    tenantId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{ score: number; totalItems: number; accepted: number; rejected: number }> {
    // Get all GRNs for this supplier
    const grnQuery = this.grnRepo.createQueryBuilder('grn')
      .where('grn.supplier_id = :supplierId', { supplierId })
      .andWhere('grn.status != :cancelled', { cancelled: 'cancelled' });

    if (tenantId) grnQuery.andWhere('grn.tenant_id = :tenantId', { tenantId });
    if (dateFrom) grnQuery.andWhere('grn.received_at >= :dateFrom', { dateFrom });
    if (dateTo) grnQuery.andWhere('grn.received_at <= :dateTo', { dateTo });

    const grns = await grnQuery.getMany();
    if (grns.length === 0) return { score: 100, totalItems: 0, accepted: 0, rejected: 0 };

    const grnIds = grns.map(g => g.id);

    // Sum accepted and rejected across all GRN items
    const result = await this.grnItemRepo.createQueryBuilder('gi')
      .select('COALESCE(SUM(gi.quantity_received), 0)', 'totalReceived')
      .addSelect('COALESCE(SUM(gi.quantity_accepted), 0)', 'totalAccepted')
      .addSelect('COALESCE(SUM(gi.quantity_rejected), 0)', 'totalRejected')
      .where('gi.goods_receipt_note_id IN (:...grnIds)', { grnIds })
      .getRawOne();

    const totalReceived = Number(result?.totalReceived) || 0;
    const totalAccepted = Number(result?.totalAccepted) || 0;
    const totalRejected = Number(result?.totalRejected) || 0;

    // If quantityAccepted is null, approximate from received - rejected
    const effectiveAccepted = totalAccepted > 0 ? totalAccepted : Math.max(totalReceived - totalRejected, 0);
    const effectiveTotal = totalAccepted > 0 ? (totalAccepted + totalRejected) : totalReceived;

    if (effectiveTotal === 0) return { score: 100, totalItems: 0, accepted: 0, rejected: 0 };

    const score = Math.round((effectiveAccepted / effectiveTotal) * 100);
    return { score, totalItems: effectiveTotal, accepted: effectiveAccepted, rejected: totalRejected };
  }

  // ── Invoice Accuracy: % of invoices matched without discrepancy ────────

  private async calculateInvoiceAccuracyScore(
    supplierId: string,
    tenantId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{ score: number; totalInvoices: number; matched: number }> {
    const query = this.invoiceMatchRepo.createQueryBuilder('im')
      .where('im.supplier_id = :supplierId', { supplierId });

    if (tenantId) query.andWhere('im.tenant_id = :tenantId', { tenantId });
    if (dateFrom) query.andWhere('im.invoice_date >= :dateFrom', { dateFrom });
    if (dateTo) query.andWhere('im.invoice_date <= :dateTo', { dateTo });

    const invoices = await query.getMany();
    if (invoices.length === 0) return { score: 100, totalInvoices: 0, matched: 0 };

    // "matched" = status is MATCHED, APPROVED, or PAID (no discrepancy)
    const matchedCount = invoices.filter(
      inv => ['matched', 'approved', 'paid'].includes(inv.status),
    ).length;

    const score = Math.round((matchedCount / invoices.length) * 100);
    return { score, totalInvoices: invoices.length, matched: matchedCount };
  }
}
