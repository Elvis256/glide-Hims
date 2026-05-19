import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SpendAnalyticsService } from '../spend-analytics.service';
import { SupplierAnalyticsService } from '../supplier-analytics.service';
import { ApprovalAnalyticsService } from '../approval-analytics.service';
import { PurchaseOrder, POStatus } from '../../../database/entities/purchase-order.entity';
import { GoodsReceiptNote } from '../../../database/entities/goods-receipt.entity';
import { Supplier } from '../../../database/entities/supplier.entity';
import { Item } from '../../../database/entities/inventory.entity';

/**
 * Regression tests for procurement analytics tenant scoping and removal of
 * Math.random()-fabricated metrics. The previous implementation:
 *   - Did not accept or apply tenantId on any query (cross-tenant leak)
 *   - Fabricated category assignment, trend, budget, onTimeDeliveryRate,
 *     qualityScore, responseTime, and forecast confidence with Math.random()
 *
 * Audit refs: BUG-012 (analytics tenant leak), BUG-025 (Math.random metrics).
 */
describe('procurement analytics — tenant scoping & determinism', () => {
  const fakeRepo = () => ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    query: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  });

  let spend: SpendAnalyticsService;
  let suppliers: SupplierAnalyticsService;
  let approvals: ApprovalAnalyticsService;
  let poRepo: any;
  let grnRepo: any;
  let supplierRepo: any;

  beforeEach(async () => {
    poRepo = fakeRepo();
    grnRepo = fakeRepo();
    supplierRepo = fakeRepo();
    const itemRepo = fakeRepo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        SpendAnalyticsService,
        SupplierAnalyticsService,
        ApprovalAnalyticsService,
        { provide: getRepositoryToken(PurchaseOrder), useValue: poRepo },
        { provide: getRepositoryToken(GoodsReceiptNote), useValue: grnRepo },
        { provide: getRepositoryToken(Supplier), useValue: supplierRepo },
        { provide: getRepositoryToken(Item), useValue: itemRepo },
      ],
    }).compile();

    spend = moduleRef.get(SpendAnalyticsService);
    suppliers = moduleRef.get(SupplierAnalyticsService);
    approvals = moduleRef.get(ApprovalAnalyticsService);
  });

  describe('SpendAnalyticsService', () => {
    it('rejects missing tenantId on every public method', async () => {
      await expect(spend.getCategorySpend(undefined)).rejects.toBeInstanceOf(BadRequestException);
      await expect(spend.getDepartmentSpend(undefined)).rejects.toBeInstanceOf(BadRequestException);
      await expect(spend.getSpendTrends(undefined)).rejects.toBeInstanceOf(BadRequestException);
      await expect(spend.getBudgetUtilization(undefined)).rejects.toBeInstanceOf(BadRequestException);
      await expect(spend.getSpendForecast(undefined)).rejects.toBeInstanceOf(BadRequestException);
      await expect(spend.getTopSpendItems(undefined)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('passes tenantId through to the underlying SQL', async () => {
      const tid = 't-123';
      await spend.getCategorySpend(tid);
      expect(poRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('po.tenant_id = $1'),
        expect.arrayContaining([tid]),
      );
    });

    it('returns null confidence when there is no historical spend (no fabrication)', async () => {
      // every monthly find() returns [] → no trend data
      const forecasts = await spend.getSpendForecast('t-1', 3);
      expect(forecasts).toHaveLength(3);
      for (const f of forecasts) {
        expect(f.confidence).toBeNull();
        expect(f.forecastedSpend).toBe(0);
      }
    });

    it('forecast is deterministic across repeated calls', async () => {
      const a = await spend.getSpendForecast('t-1', 2);
      const b = await spend.getSpendForecast('t-1', 2);
      expect(a.map((x) => x.forecastedSpend)).toEqual(b.map((x) => x.forecastedSpend));
      expect(a.map((x) => x.confidence)).toEqual(b.map((x) => x.confidence));
    });

    it('coerces string query params for months/limit (no NaN dates)', async () => {
      const t = 't-1';
      // simulate NestJS @Query passing a string
      await expect(spend.getSpendTrends(t, '6' as any)).resolves.toHaveLength(6);
      await expect(spend.getTopSpendItems(t, '5' as any)).resolves.toBeDefined();
    });
  });

  describe('SupplierAnalyticsService', () => {
    it('rejects missing tenantId', async () => {
      await expect(suppliers.getSupplierMetrics(undefined)).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        suppliers.getSupplierSpendTrends(undefined, 'sup-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        suppliers.getSupplierRiskScore(undefined, 'sup-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('scopes supplier lookup by tenantId (cannot read another tenant\'s supplier)', async () => {
      supplierRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        suppliers.getSupplierSpendTrends('t-1', 'sup-other-tenant'),
      ).rejects.toThrow(/Supplier not found/);
      expect(supplierRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'sup-other-tenant', tenantId: 't-1' },
      });
    });
  });

  describe('ApprovalAnalyticsService', () => {
    it('scopes pending PO query by tenantId when supplied', async () => {
      await approvals.detectBottlenecks('t-1');
      expect(poRepo.find).toHaveBeenCalledWith({
        where: { status: POStatus.PENDING_APPROVAL, tenantId: 't-1' },
      });
    });

    it('returns a single aggregate bottleneck row (no triple-counting)', async () => {
      const oldCreatedAt = new Date(Date.now() - 80 * 60 * 60 * 1000); // 80h ago
      poRepo.find.mockResolvedValueOnce([
        { createdAt: oldCreatedAt },
        { createdAt: new Date() },
        { createdAt: new Date() },
      ]);
      const out = await approvals.detectBottlenecks('t-1');
      expect(out).toHaveLength(1);
      expect(out[0].pendingCount).toBe(3);
      expect(out[0].severity).toBe('critical');
    });
  });
});
