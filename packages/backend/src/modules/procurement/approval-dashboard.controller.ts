import { Controller, Get, Query, UseGuards, Request, Param } from '@nestjs/common';
import { ApprovalDashboardService } from './approval-dashboard.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@UseGuards(ModuleGuard)
@RequireModule('stores')
@Controller('procurement/approvals')
export class ApprovalDashboardController {
  constructor(private readonly dashboardService: ApprovalDashboardService) {}

  /**
   * Get pending approvals for user's role
   * Shows all approvals waiting for the user's assigned role
   */
  @Get('pending')
  @AuthWithPermissions('procurement.read')
  async getPendingApprovals(
    @Query('facilityId') facilityId: string,
    @Query('role') role?: string,
    @Request() req?: any,
  ) {
    // Use role from query or from user's roles
    const requiredRole = role || req?.user?.roles?.[0]?.name || 'manager';
    return this.dashboardService.getPendingApprovalsForRole(
      requiredRole,
      facilityId,
      req?.user?.tenantId,
    );
  }

  /**
   * Get approval history for a specific PR or PO
   */
  @Get('history/:documentType/:documentId')
  @AuthWithPermissions('procurement.read')
  async getApprovalHistory(
    @Param('documentType') documentType: 'PR' | 'PO',
    @Param('documentId') documentId: string,
    @Request() req?: any,
  ) {
    return this.dashboardService.getApprovalHistory(
      documentId,
      documentType,
      req?.user?.tenantId,
    );
  }

  /**
   * Get approval bottlenecks for facility
   * Shows levels that are taking >5 days on average
   */
  @Get('bottlenecks')
  @AuthWithPermissions('procurement.read')
  async getBottlenecks(
    @Query('facilityId') facilityId: string,
    @Request() req?: any,
  ) {
    return this.dashboardService.getApprovalBottlenecks(facilityId, req?.user?.tenantId);
  }

  /**
   * Get escalation candidates (approvals pending >N days)
   */
  @Get('escalations')
  @AuthWithPermissions('procurement.read')
  async getEscalations(
    @Query('facilityId') facilityId: string,
    @Query('days') days: number = 5,
    @Request() req?: any,
  ) {
    return this.dashboardService.getEscalationCandidates(
      facilityId,
      days,
      req?.user?.tenantId,
    );
  }

  /**
   * Get dashboard summary
   * High-level metrics: pending, approved, rejected, avg time, bottlenecks, escalations
   */
  @Get('summary')
  @AuthWithPermissions('procurement.read')
  async getDashboardSummary(
    @Query('facilityId') facilityId: string,
    @Request() req?: any,
  ) {
    try {
      const summary = await this.dashboardService.getDashboardSummary(
        facilityId,
        req?.user?.tenantId,
      );
      return {
        ...summary,
        budgetAvailable: 0,
        budgetAllocated: 0,
      };
    } catch (err) {
      return {
        pending: 0,
        approved: 0,
        rejected: 0,
        avgApprovalDays: 0,
        bottlenecks: 0,
        escalations: 0,
        escalationList: [],
        budgetAvailable: 0,
        budgetAllocated: 0,
      };
    }
  }

  /**
   * Supplier risk summary surfaced on the Approval dashboard.
   * Currently returns an empty list as the supplier-risk model is being
   * rebuilt; previously lived as a stub on procurement.controller.ts.
   */
  @Get('supplier-risks')
  @AuthWithPermissions('procurement.read')
  async getSupplierRisks(@Query('facilityId') _facilityId: string) {
    return { data: [] };
  }
}
