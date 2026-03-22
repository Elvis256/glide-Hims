import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescription, PrescriptionStatus } from '../../database/entities/prescription.entity';
import { StockBalance, Item, ExpiryAlert, ExpiryAlertStatus } from '../../database/entities/inventory.entity';
import { BatchStockBalance } from '../../database/entities/batch-stock.entity';
import { PharmacySale, PharmacySaleItem, SaleStatus } from '../../database/entities/pharmacy-sale.entity';

export interface DashboardKPIs {
  queue: {
    pendingCount: number;
    avgWaitMinutes: number | null;
  };
  stockAlerts: {
    lowStockCount: number;
    expiringSoonCount: number;
    outOfStockCount: number;
  };
  revenue: {
    todayTotal: number;
    monthTotal: number;
    avgTransactionValue: number;
  };
  dispensing: {
    totalDispensedToday: number;
    controlledSubstancesToday: number;
  };
  recentActivity: {
    id: string;
    type: 'sale' | 'dispensing';
    reference: string;
    description: string;
    amount: number;
    timestamp: string;
  }[];
}

@Injectable()
export class PharmacyDashboardService {
  constructor(
    @InjectRepository(Prescription) private prescriptionRepo: Repository<Prescription>,
    @InjectRepository(StockBalance) private stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(Item) private itemRepo: Repository<Item>,
    @InjectRepository(ExpiryAlert) private expiryAlertRepo: Repository<ExpiryAlert>,
    @InjectRepository(BatchStockBalance) private batchStockRepo: Repository<BatchStockBalance>,
    @InjectRepository(PharmacySale) private saleRepo: Repository<PharmacySale>,
    @InjectRepository(PharmacySaleItem) private saleItemRepo: Repository<PharmacySaleItem>,
  ) {}

  async getDashboardKPIs(tenantId?: string, facilityId?: string): Promise<DashboardKPIs> {
    const [queue, stockAlerts, revenue, dispensing, recentActivity] = await Promise.all([
      this.getQueueKPIs(tenantId, facilityId),
      this.getStockAlertKPIs(tenantId, facilityId),
      this.getRevenueKPIs(tenantId, facilityId),
      this.getDispensingKPIs(tenantId, facilityId),
      this.getRecentActivity(tenantId, facilityId),
    ]);

    return { queue, stockAlerts, revenue, dispensing, recentActivity };
  }

  // ── Queue Stats ─────────────────────────────────────────────────────────

  private async getQueueKPIs(tenantId?: string, facilityId?: string): Promise<DashboardKPIs['queue']> {
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Pending prescriptions — only count those from last 48 hours as active queue
    const pendingQuery = this.prescriptionRepo.createQueryBuilder('p')
      .where('p.status IN (:...statuses)', {
        statuses: [PrescriptionStatus.PENDING, PrescriptionStatus.DISPENSING, PrescriptionStatus.PARTIALLY_DISPENSED],
      })
      .andWhere('p.created_at >= :cutoff', { cutoff: cutoff48h.toISOString() });

    if (tenantId) pendingQuery.andWhere('p.tenant_id = :tenantId', { tenantId });

    const pendingCount = await pendingQuery.getCount();

    // Average wait time — only for recent prescriptions to avoid stale data skewing
    const waitQuery = this.prescriptionRepo.createQueryBuilder('p')
      .select('AVG(EXTRACT(EPOCH FROM (COALESCE(p.dispensing_started_at, NOW()) - p.created_at)) / 60)', 'avgWait')
      .where('p.status IN (:...statuses)', {
        statuses: [PrescriptionStatus.PENDING, PrescriptionStatus.DISPENSING, PrescriptionStatus.PARTIALLY_DISPENSED],
      })
      .andWhere('p.created_at >= :cutoff', { cutoff: cutoff48h.toISOString() });

    if (tenantId) waitQuery.andWhere('p.tenant_id = :tenantId', { tenantId });

    const waitResult = await waitQuery.getRawOne();
    const avgWaitMinutes = waitResult?.avgWait ? Math.round(Number(waitResult.avgWait)) : null;

    return { pendingCount, avgWaitMinutes };
  }

  // ── Stock Alert KPIs ────────────────────────────────────────────────────

  private async getStockAlertKPIs(tenantId?: string, facilityId?: string): Promise<DashboardKPIs['stockAlerts']> {
    // Low stock: items where totalQuantity <= reorderLevel and reorderLevel > 0
    const lowStockQuery = this.stockBalanceRepo.createQueryBuilder('sb')
      .innerJoin(Item, 'i', 'i.id = sb.item_id')
      .where('sb.total_quantity <= i.reorder_level')
      .andWhere('sb.total_quantity > 0')
      .andWhere('i.reorder_level > 0');

    if (tenantId) lowStockQuery.andWhere('sb.tenant_id = :tenantId', { tenantId });
    if (facilityId) lowStockQuery.andWhere('sb.facility_id = :facilityId', { facilityId });

    const lowStockCount = await lowStockQuery.getCount();

    // Out of stock
    const outOfStockQuery = this.stockBalanceRepo.createQueryBuilder('sb')
      .where('sb.total_quantity <= 0');

    if (tenantId) outOfStockQuery.andWhere('sb.tenant_id = :tenantId', { tenantId });
    if (facilityId) outOfStockQuery.andWhere('sb.facility_id = :facilityId', { facilityId });

    const outOfStockCount = await outOfStockQuery.getCount();

    // Expiring soon (within 90 days) — check expiry alerts first, fall back to batch stock
    const threshold90d = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const now = new Date();

    let expiringSoonCount = 0;
    try {
      const expiringSoonQuery = this.expiryAlertRepo.createQueryBuilder('ea')
        .where('ea.status IN (:...statuses)', {
          statuses: [ExpiryAlertStatus.ACTIVE, ExpiryAlertStatus.NEAR_EXPIRY],
        })
        .andWhere('ea.expiry_date <= :threshold', { threshold: threshold90d })
        .andWhere('ea.expiry_date > :now', { now });

      if (tenantId) expiringSoonQuery.andWhere('ea.tenant_id = :tenantId', { tenantId });
      if (facilityId) expiringSoonQuery.andWhere('ea.facility_id = :facilityId', { facilityId });

      expiringSoonCount = await expiringSoonQuery.getCount();
    } catch {
      // ExpiryAlert table may not exist yet
    }

    // If no expiry alerts, query batch_stock_balances directly
    if (expiringSoonCount === 0) {
      const batchExpiryQuery = this.batchStockRepo.createQueryBuilder('bs')
        .where('bs.expiry_date <= :threshold', { threshold: threshold90d })
        .andWhere('bs.expiry_date > :now', { now })
        .andWhere('bs.quantity > 0')
        .andWhere('bs.status = :status', { status: 'active' });

      if (tenantId) batchExpiryQuery.andWhere('bs.tenant_id = :tenantId', { tenantId });
      if (facilityId) batchExpiryQuery.andWhere('bs.facility_id = :facilityId', { facilityId });

      expiringSoonCount = await batchExpiryQuery.getCount();
    }

    return { lowStockCount, expiringSoonCount, outOfStockCount };
  }

  // ── Revenue KPIs ────────────────────────────────────────────────────────

  private async getRevenueKPIs(tenantId?: string, facilityId?: string): Promise<DashboardKPIs['revenue']> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's sales
    const todayQuery = this.saleRepo.createQueryBuilder('s')
      .select('COALESCE(SUM(s.total_amount), 0)', 'total')
      .addSelect('COUNT(s.id)', 'count')
      .where('s.status = :status', { status: SaleStatus.COMPLETED })
      .andWhere('s.created_at >= :today', { today: today.toISOString() })
      .andWhere('s.created_at < :tomorrow', { tomorrow: tomorrow.toISOString() });

    if (tenantId) todayQuery.andWhere('s.tenant_id = :tenantId', { tenantId });

    const todayResult = await todayQuery.getRawOne();
    const todayTotal = Number(todayResult?.total) || 0;
    const todayCount = Number(todayResult?.count) || 0;

    // This month's sales
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthQuery = this.saleRepo.createQueryBuilder('s')
      .select('COALESCE(SUM(s.total_amount), 0)', 'total')
      .addSelect('COUNT(s.id)', 'count')
      .where('s.status = :status', { status: SaleStatus.COMPLETED })
      .andWhere('s.created_at >= :monthStart', { monthStart: monthStart.toISOString() });

    if (tenantId) monthQuery.andWhere('s.tenant_id = :tenantId', { tenantId });

    const monthResult = await monthQuery.getRawOne();
    const monthTotal = Number(monthResult?.total) || 0;
    const monthCount = Number(monthResult?.count) || 0;

    const avgTransactionValue = monthCount > 0 ? Math.round((monthTotal / monthCount) * 100) / 100 : 0;

    return { todayTotal, monthTotal, avgTransactionValue };
  }

  // ── Dispensing KPIs ─────────────────────────────────────────────────────

  private async getDispensingKPIs(tenantId?: string, facilityId?: string): Promise<DashboardKPIs['dispensing']> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Total dispensed today
    const dispensedQuery = this.prescriptionRepo.createQueryBuilder('p')
      .where('p.status = :status', { status: PrescriptionStatus.DISPENSED })
      .andWhere('p.dispensed_at >= :today', { today: today.toISOString() });

    if (tenantId) dispensedQuery.andWhere('p.tenant_id = :tenantId', { tenantId });

    const totalDispensedToday = await dispensedQuery.getCount();

    // Controlled substances dispensed today: count completed sale items
    // where the item is marked as controlled
    const controlledQuery = this.saleItemRepo.createQueryBuilder('si')
      .innerJoin(PharmacySale, 's', 's.id = si.sale_id')
      .innerJoin(Item, 'i', 'i.id = si.item_id::uuid')
      .where('s.status = :status', { status: SaleStatus.COMPLETED })
      .andWhere('s.created_at >= :today', { today: today.toISOString() })
      .andWhere('i.is_controlled = :isControlled', { isControlled: true });

    if (tenantId) controlledQuery.andWhere('s.tenant_id = :tenantId', { tenantId });

    const controlledSubstancesToday = await controlledQuery.getCount();

    return { totalDispensedToday, controlledSubstancesToday };
  }

  // ── Recent Activity ─────────────────────────────────────────────────────

  private async getRecentActivity(
    tenantId?: string,
    facilityId?: string,
  ): Promise<DashboardKPIs['recentActivity']> {
    // Recent completed sales
    const salesQuery = this.saleRepo.createQueryBuilder('s')
      .where('s.status = :status', { status: SaleStatus.COMPLETED })
      .orderBy('s.created_at', 'DESC')
      .limit(10);

    if (tenantId) salesQuery.andWhere('s.tenant_id = :tenantId', { tenantId });

    const recentSales = await salesQuery.getMany();

    return recentSales.map(sale => ({
      id: sale.id,
      type: 'sale' as const,
      reference: sale.saleNumber,
      description: `${sale.saleType} sale — ${sale.paymentMethod || 'pending'}`,
      amount: Number(sale.totalAmount),
      timestamp: sale.createdAt.toISOString(),
    }));
  }
}
