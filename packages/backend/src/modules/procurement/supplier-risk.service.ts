import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Supplier, SupplierStatus } from '../../database/entities/supplier.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';

/**
 * SupplierRiskService: Validates supplier eligibility for orders
 * Checks supplier status and ordering patterns
 * Completes Direct PO Phase 3 requirements
 */
@Injectable()
export class SupplierRiskService {
  private readonly logger = new Logger(SupplierRiskService.name);

  constructor(
    @InjectRepository(Supplier)
    private supplierRepo: Repository<Supplier>,
    @InjectRepository(PurchaseOrder)
    private poRepo: Repository<PurchaseOrder>,
  ) {}

  /**
   * Validate supplier is eligible for orders
   * Checks: active status, duplicate orders (bulk order scheme detection)
   */
  async validateSupplierForOrder(
    supplierId: string,
    facilityId: string,
    orderAmount: number,
    tenantId?: string,
  ): Promise<{ allowed: boolean; warnings: string[] }> {
    const warnings: string[] = [];

    try {
      // Get supplier details
      const supplierWhere: any = { id: supplierId };
      if (tenantId) supplierWhere.tenantId = tenantId;
      
      const supplier = await this.supplierRepo.findOne({
        where: supplierWhere,
      });

      if (!supplier) {
        return { allowed: false, warnings: ['Supplier not found'] };
      }

      // Check 1: Supplier active status
      if (supplier.status !== SupplierStatus.ACTIVE) {
        warnings.push(
          `Supplier '${supplier.name}' is ${supplier.status.toUpperCase()}. Proceed with caution.`,
        );
      }

      // Check 2: Duplicate supplier orders (bulk order scheme detection)
      const duplicateWhere: any = {
        supplierId,
        facilityId,
        createdAt: Between(
          new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          new Date(),
        ),
      };
      if (tenantId) duplicateWhere.tenantId = tenantId;

      const recentOrders = await this.poRepo.count({
        where: duplicateWhere,
      });

      if (recentOrders >= 3) {
        warnings.push(
          `ALERT: ${recentOrders} orders to supplier '${supplier.name}' in last 24 hours. Possible bulk order scheme.`,
        );
      }

      // Check 3: Large order amount requires additional scrutiny
      if (orderAmount > 50000000 && supplier.status !== SupplierStatus.ACTIVE) {
        warnings.push(
          `Large order ($${orderAmount.toLocaleString()}) to non-active supplier. Requires approval.`,
        );
      }

      return { allowed: true, warnings };
    } catch (error) {
      this.logger.error(`Supplier risk check failed: ${error.message}`, error.stack);
      // Don't block order if risk check fails (graceful degradation)
      return { allowed: true, warnings: ['Risk check unavailable'] };
    }
  }

  /**
   * Check if RFQ is required for order amount
   * Implements competitive bidding requirement (PPDA)
   */
  isRFQRequired(orderAmount: number, threshold: number = 10000000): boolean {
    // RFQ required for orders >10M UGX (can be configured per facility)
    return orderAmount > threshold;
  }

  /**
   * Get supplier risk score (0-100)
   * Higher score = higher risk
   */
  async getSupplierRiskScore(
    supplierId: string,
    tenantId?: string,
  ): Promise<number> {
    try {
      const supplierWhere: any = { id: supplierId };
      if (tenantId) supplierWhere.tenantId = tenantId;

      const supplier = await this.supplierRepo.findOne({
        where: supplierWhere,
      });

      if (!supplier) return 100; // Unknown supplier = high risk

      let score = 0;

      // Status risk
      switch (supplier.status) {
        case SupplierStatus.SUSPENDED:
          score += 60;
          break;
        case SupplierStatus.INACTIVE:
          score += 40;
          break;
        case SupplierStatus.ACTIVE:
          score += 0;
          break;
      }

      // Ensure score stays in 0-100 range
      return Math.min(100, Math.max(0, score));
    } catch (error) {
      this.logger.error(`Risk score calculation failed: ${error.message}`);
      return 50; // Default medium risk on error
    }
  }

  /**
   * Alert on supplier concentration risk
   * Multiple large orders to same supplier may indicate fraud/relationship
   */
  async checkSupplierConcentration(
    supplierId: string,
    facilityId: string,
    orderAmount: number,
    daysLookback: number = 30,
    tenantId?: string,
  ): Promise<{ concentrated: boolean; ordersInPeriod: number; totalAmount: number }> {
    try {
      const lookbackDate = new Date(Date.now() - daysLookback * 24 * 60 * 60 * 1000);

      const poWhere: any = {
        supplierId,
        facilityId,
        createdAt: Between(lookbackDate, new Date()),
      };
      if (tenantId) poWhere.tenantId = tenantId;

      const orders = await this.poRepo.find({
        where: poWhere,
        select: ['id', 'totalAmount'],
      });

      const totalAmount = orders.reduce(
        (sum, po) => sum + Number(po.totalAmount || 0),
        orderAmount, // Include current order
      );

      const ordersInPeriod = orders.length + 1; // Include current order

      // Concentrated if >3 orders or total >100M in 30 days
      const concentrated = ordersInPeriod >= 3 || totalAmount > 100000000;

      if (concentrated) {
        this.logger.warn(
          `Supplier concentration: ${ordersInPeriod} orders totaling ${totalAmount.toLocaleString()} to supplier ${supplierId} in last ${daysLookback} days`,
        );
      }

      return { concentrated, ordersInPeriod, totalAmount };
    } catch (error) {
      this.logger.error(`Concentration check failed: ${error.message}`);
      return { concentrated: false, ordersInPeriod: 0, totalAmount: 0 };
    }
  }

  /**
   * Log supplier risk assessment for audit
   */
  logSupplierRiskAssessment(params: {
    supplierId: string;
    orderAmount: number;
    riskScore: number;
    rfqRequired: boolean;
    warnings: string[];
    approved: boolean;
    userId: string;
    tenantId?: string;
  }): void {
    const { supplierId, orderAmount, riskScore, warnings, approved, userId } = params;

    if (riskScore >= 50 || warnings.length > 0) {
      this.logger.warn(
        `Supplier Risk Assessment: supplierId=${supplierId}, amount=${orderAmount}, score=${riskScore}, approved=${approved}, warnings=[${warnings.join('; ')}], user=${userId}`,
      );
    } else {
      this.logger.debug(
        `Supplier Risk Assessment: supplierId=${supplierId}, amount=${orderAmount}, score=${riskScore}, approved=${approved}, user=${userId}`,
      );
    }
  }
}
