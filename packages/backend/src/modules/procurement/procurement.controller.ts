import { Controller, Get, Post, Put, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { ProcurementService } from './procurement.service';
import { ProcurementGLIntegrationService } from './procurement-gl-integration.service';
import { SupplierAnalyticsService } from './supplier-analytics.service';
import { ApprovalAnalyticsService } from './approval-analytics.service';
import { SpendAnalyticsService } from './spend-analytics.service';
import {
  CreatePurchaseRequestDto,
  CreatePRItemDto,
  ApprovePRDto,
  RejectPRDto,
  CreatePurchaseOrderDto,
  CreatePOFromPRDto,
  CreatePOFromQuotationDto,
  CreateGoodsReceiptDto,
  InspectGRNDto,
  CreateGRNFromPODto,
} from './dto/procurement.dto';
import {
  PostReceiptToGLDto,
  EncumbranceDto,
  ThreeWayMatchDto,
} from './dto/procurement-gl-integration.dto';
import { PRStatus, PRPriority } from '../../database/entities/purchase-request.entity';
import { POStatus } from '../../database/entities/purchase-order.entity';
import { GRNStatus } from '../../database/entities/goods-receipt.entity';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@UseGuards(ModuleGuard)
@RequireModule('stores')
@Controller('procurement')
export class ProcurementController {
  constructor(
    private readonly procurementService: ProcurementService,
    private readonly glIntegrationService: ProcurementGLIntegrationService,
    private readonly supplierAnalytics: SupplierAnalyticsService,
    private readonly approvalAnalytics: ApprovalAnalyticsService,
    private readonly spendAnalytics: SpendAnalyticsService,
  ) {}

  // ============ DASHBOARD ============

  @Get('dashboard')
  @AuthWithPermissions('procurement.read')
  getDashboard(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.procurementService.getDashboard(facilityId, req.user?.tenantId);
  }

  // ============ TRACE (PR -> PO -> GRN -> Invoice) ============

  @Get('trace/search')
  @AuthWithPermissions('procurement.read')
  searchTraceDocuments(@Query('q') q: string, @Request() req: any) {
    if (!q || q.trim().length < 2) return [];
    return this.procurementService.searchTraceDocuments(q.trim(), req.user?.tenantId);
  }

  @Get('trace/:type/:id')
  @AuthWithPermissions('procurement.read')
  traceProcurement(
    @Param('type') type: 'pr' | 'po' | 'grn' | 'invoice',
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.procurementService.traceProcurement(type, id, req.user?.tenantId);
  }

  // ============ AUTO-REORDER ============

  @Get('reorder/preview')
  @AuthWithPermissions('procurement.read')
  previewReorder(@Query('facilityId') facilityId: string | undefined, @Request() req: any) {
    return this.procurementService.runAutoReorderDraftPRs({
      tenantId: req.user?.tenantId,
      facilityId,
      dryRun: true,
    });
  }

  @Post('reorder/run')
  @AuthWithPermissions('procurement.create')
  runReorder(@Body() body: { facilityId?: string }, @Request() req: any) {
    return this.procurementService.runAutoReorderDraftPRs({
      tenantId: req.user?.tenantId,
      facilityId: body?.facilityId,
      userId: req.user?.id,
    });
  }

  // ============ PURCHASE REQUESTS ============

  @Post('purchase-requests')
  @AuthWithPermissions('procurement.create')
  createPurchaseRequest(@Body() dto: CreatePurchaseRequestDto, @Request() req: any) {
    return this.procurementService.createPurchaseRequest(dto, req.user.id, req.user?.tenantId);
  }

  @Get('purchase-requests')
  @AuthWithPermissions('procurement.read')
  getPurchaseRequests(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: PRStatus,
    @Query('priority') priority?: PRPriority,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: any,
  ) {
    return this.procurementService.getPurchaseRequests(
      facilityId,
      { status, priority, startDate, endDate },
      req?.user?.tenantId,
    );
  }

  @Get('purchase-requests/:id')
  @AuthWithPermissions('procurement.read')
  getPurchaseRequest(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.getPurchaseRequest(id, req.user?.tenantId);
  }

  @Post('purchase-requests/:id/items')
  @AuthWithPermissions('procurement.update')
  addPurchaseRequestItems(
    @Param('id') id: string,
    @Body('items') items: CreatePRItemDto[],
    @Request() req: any,
  ) {
    return this.procurementService.addPurchaseRequestItems(id, items, req.user?.tenantId);
  }

  @Put('purchase-requests/:id/items/:itemId')
  @AuthWithPermissions('procurement.update')
  updatePurchaseRequestItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { quantityRequested?: number; unitPriceEstimated?: number },
    @Request() req: any,
  ) {
    return this.procurementService.updatePurchaseRequestItem(
      id,
      itemId,
      body,
      req.user?.tenantId,
    );
  }

  @Put('purchase-requests/:id/items/:itemId/remove')
  @AuthWithPermissions('procurement.update')
  removePurchaseRequestItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Request() req: any,
  ) {
    return this.procurementService.removePurchaseRequestItem(id, itemId, req.user?.tenantId);
  }

  @Put('purchase-requests/:id/submit')
  @AuthWithPermissions('procurement.update')
  submitPurchaseRequest(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.submitPurchaseRequest(id, req.user?.tenantId);
  }

  @Put('purchase-requests/:id/approve')
  @AuthWithPermissions('procurement.approve')
  approvePurchaseRequest(@Param('id') id: string, @Body() dto: ApprovePRDto, @Request() req: any) {
    return this.procurementService.approvePurchaseRequest(id, dto, req.user.id, req.user?.tenantId);
  }

  @Put('purchase-requests/:id/reject')
  @AuthWithPermissions('procurement.approve')
  rejectPurchaseRequest(@Param('id') id: string, @Body() dto: RejectPRDto, @Request() req: any) {
    return this.procurementService.rejectPurchaseRequest(id, dto, req.user.id, req.user?.tenantId);
  }

  // ============ PURCHASE ORDERS ============

  @Post('purchase-orders')
  @AuthWithPermissions('procurement.create')
  createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @Request() req: any) {
    return this.procurementService.createPurchaseOrder(dto, req.user.id, req.user?.tenantId);
  }

  @Post('purchase-orders/from-pr')
  @AuthWithPermissions('procurement.create')
  createPOFromPR(@Body() dto: CreatePOFromPRDto, @Request() req: any) {
    return this.procurementService.createPOFromPR(dto, req.user.id, req.user?.tenantId);
  }

  @Post('purchase-orders/from-quotation')
  @AuthWithPermissions('procurement.create')
  createPOFromQuotation(@Body() dto: CreatePOFromQuotationDto, @Request() req: any) {
    return this.procurementService.createPOFromQuotation(dto, req.user.id, req.user?.tenantId);
  }

  @Get('purchase-orders')
  @AuthWithPermissions('procurement.read')
  getPurchaseOrders(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: POStatus,
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: any,
  ) {
    return this.procurementService.getPurchaseOrders(
      facilityId,
      { status, supplierId, startDate, endDate },
      req?.user?.tenantId,
    );
  }

  @Get('purchase-orders/:id')
  @AuthWithPermissions('procurement.read')
  getPurchaseOrder(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.getPurchaseOrder(id, req.user?.tenantId);
  }

  @Put('purchase-orders/:id/approve')
  @AuthWithPermissions('procurement.approve')
  approvePurchaseOrder(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.approvePurchaseOrder(
      id,
      req.user.id,
      req.user?.tenantId,
      req.user?.roles,
    );
  }

  @Put('purchase-orders/:id/send')
  @AuthWithPermissions('procurement.update')
  sendPurchaseOrder(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.sendPurchaseOrder(id, req.user?.tenantId);
  }

  @Put('purchase-orders/:id/cancel')
  @AuthWithPermissions('procurement.update')
  cancelPurchaseOrder(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.cancelPurchaseOrder(id, req.user?.tenantId);
  }

  // ============ GOODS RECEIPT NOTES ============

  @Post('goods-receipts')
  @AuthWithPermissions('procurement.create')
  createGoodsReceipt(@Body() dto: CreateGoodsReceiptDto, @Request() req: any) {
    return this.procurementService.createGoodsReceipt(dto, req.user.id, req.user?.tenantId);
  }

  @Post('goods-receipts/from-po')
  @AuthWithPermissions('procurement.create')
  createGRNFromPO(@Body() body: CreateGRNFromPODto, @Request() req: any) {
    return this.procurementService.createGRNFromPO(
      body.purchaseOrderId,
      body.receivedItems,
      req.user.id,
      req.user?.tenantId,
      body.storeId,
    );
  }

  @Get('goods-receipts')
  @AuthWithPermissions('procurement.read')
  getGoodsReceipts(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: GRNStatus,
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: any,
  ) {
    return this.procurementService.getGoodsReceipts(
      facilityId,
      { status, supplierId, startDate, endDate },
      req?.user?.tenantId,
    );
  }

  @Get('goods-receipts/:id')
  @AuthWithPermissions('procurement.read')
  getGoodsReceipt(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.getGoodsReceipt(id, req.user?.tenantId);
  }

  @Put('goods-receipts/:id/inspect')
  @AuthWithPermissions('procurement.update')
  inspectGoodsReceipt(@Param('id') id: string, @Body() dto: InspectGRNDto, @Request() req: any) {
    return this.procurementService.inspectGoodsReceipt(id, dto, req.user.id, req.user?.tenantId);
  }

  @Put('goods-receipts/:id/approve')
  @AuthWithPermissions('procurement.approve')
  approveGoodsReceipt(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.approveGoodsReceipt(id, req.user.id, req.user?.tenantId);
  }

  @Put('goods-receipts/:id/post')
  @AuthWithPermissions('procurement.update')
  postGoodsReceipt(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.postGoodsReceipt(id, req.user.id, req.user?.tenantId);
  }

  // ============ GL INTEGRATION ============

  @Post('grn/:id/post-to-gl')
  @AuthWithPermissions('procurement.post_to_gl')
  async postGRNToGL(@Param('id') id: string, @Request() req: any) {
    return this.glIntegrationService.postGRNReceiptToGL(id, req.user.id);
  }

  @Get('budget/encumbrances')
  @AuthWithPermissions('procurement.read')
  async getEncumbrances() {
    return this.glIntegrationService.getIntegrationSummary();
  }

  @Get('budget/encumbrances/:departmentId')
  @AuthWithPermissions('procurement.read')
  async getDepartmentEncumbrances(@Param('departmentId') departmentId: string) {
    return this.glIntegrationService.getDepartmentEncumbrances(departmentId);
  }

  @Post('po/:id/encumber')
  @AuthWithPermissions('procurement.create')
  async encumberBudget(
    @Param('id') poId: string,
    @Body() dto: EncumbranceDto,
    @Request() req: any,
  ) {
    return this.glIntegrationService.encumberBudgetForPO(poId, dto.departmentId);
  }

  @Get('reconciliation/three-way-match')
  @AuthWithPermissions('procurement.read')
  async getThreeWayMatches(
    @Query('poId') poId: string,
    @Query('grnId') grnId: string,
    @Query('invoiceId') invoiceId: string,
  ) {
    return this.glIntegrationService.validateThreeWayMatch(poId, grnId, invoiceId);
  }

  @Get('gl-integration/summary')
  @AuthWithPermissions('procurement.read')
  async getGLIntegrationSummary() {
    return this.glIntegrationService.getIntegrationSummary();
  }

  @Get('reconciliation/report')
  @AuthWithPermissions('procurement.read')
  async getReconciliationReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.glIntegrationService.getReconciliationReport(
      new Date(startDate),
      new Date(endDate),
      departmentId,
    );
  }

  // ============ APPROVALS ============

  @Get('approvals/pending')
  @AuthWithPermissions('procurement.approve')
  async getPendingApprovals(
    @Query('facilityId') facilityId: string,
    @Query('role') role?: string,
  ) {
    // Return empty pending approvals for now
    return {
      data: [],
    };
  }

  @Get('approvals/summary')
  @AuthWithPermissions('procurement.approve')
  async getApprovalSummary(@Query('facilityId') facilityId: string) {
    const bottlenecks = await this.approvalAnalytics.detectBottlenecks();
    
    return {
      data: {
        pending: 0,
        approved: 0,
        rejected: 0,
        avgApprovalDays: 0,
        bottlenecks: bottlenecks.length,
        escalations: 0,
        escalationList: [],
      },
    };
  }

  @Get('approvals/bottlenecks')
  @AuthWithPermissions('procurement.read')
  async getApprovalBottlenecks(@Query('facilityId') facilityId: string) {
    const bottlenecks = await this.approvalAnalytics.detectBottlenecks();
    return {
      data: bottlenecks || [],
    };
  }

  @Get('approvals/escalations')
  @AuthWithPermissions('procurement.approve')
  async getApprovalEscalations(
    @Query('facilityId') facilityId: string,
    @Query('days') days: number = 5,
  ) {
    return {
      data: [],
    };
  }

  @Get('approvals/supplier-risks')
  @AuthWithPermissions('procurement.read')
  async getSupplierRisks(@Query('facilityId') facilityId: string) {
    return {
      data: [],
    };
  }

  // ============ ANALYTICS - SUPPLIERS ============

  @Get('analytics/suppliers/metrics')
  @AuthWithPermissions('procurement.analytics')
  async getSupplierMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    return this.supplierAnalytics.getSupplierMetrics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('analytics/suppliers/spend-trends')
  @AuthWithPermissions('procurement.analytics')
  async getSupplierSpendTrends(
    @Query('supplierId') supplierId: string,
    @Query('months') months: number = 12,
  ): Promise<any> {
    if (!supplierId) {
      return { error: 'supplierId is required' };
    }
    return this.supplierAnalytics.getSupplierSpendTrends(supplierId, months);
  }

  @Get('analytics/suppliers/top-suppliers')
  @AuthWithPermissions('procurement.analytics')
  async getTopSuppliers(@Query('limit') limit: number = 10): Promise<any> {
    return this.supplierAnalytics.getTopSuppliers(limit);
  }

  @Get('analytics/suppliers/performance-comparison')
  @AuthWithPermissions('procurement.analytics')
  async getSupplierPerformanceComparison(): Promise<any> {
    return this.supplierAnalytics.getSupplierPerformanceComparison();
  }

  @Get('analytics/suppliers/risk-score')
  @AuthWithPermissions('procurement.analytics')
  async getSupplierRiskScore(@Query('supplierId') supplierId: string): Promise<any> {
    if (!supplierId) {
      return { error: 'supplierId is required' };
    }
    return this.supplierAnalytics.getSupplierRiskScore(supplierId);
  }

  // ============ ANALYTICS - APPROVALS ============

  @Get('analytics/approvals/bottlenecks')
  @AuthWithPermissions('procurement.analytics')
  async detectApprovalBottlenecks(): Promise<any> {
    return this.approvalAnalytics.detectBottlenecks();
  }

  @Get('analytics/approvals/time-metrics')
  @AuthWithPermissions('procurement.analytics')
  async getApprovalTimeMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    return this.approvalAnalytics.getApprovalTimeMetrics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('analytics/approvals/trends')
  @AuthWithPermissions('procurement.analytics')
  async getApprovalTrends(@Query('days') days: number = 30): Promise<any> {
    return this.approvalAnalytics.getApprovalTrends(days);
  }

  @Get('analytics/approvals/sla-compliance')
  @AuthWithPermissions('procurement.analytics')
  async getApprovalSLACompliance(): Promise<any> {
    return this.approvalAnalytics.getApprovalSLACompliance();
  }

  @Get('analytics/approvals/workload')
  @AuthWithPermissions('procurement.analytics')
  async getApprovalWorkload(): Promise<any> {
    return this.approvalAnalytics.getApprovalWorkload();
  }

  // ============ ANALYTICS - SPEND ============

  @Get('analytics/spend/by-category')
  @AuthWithPermissions('procurement.analytics')
  async getSpendByCategory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    return this.spendAnalytics.getCategorySpend(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('analytics/spend/by-department')
  @AuthWithPermissions('procurement.analytics')
  async getSpendByDepartment(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    return this.spendAnalytics.getDepartmentSpend(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('analytics/spend/trends')
  @AuthWithPermissions('procurement.analytics')
  async getSpendTrends(@Query('months') months: number = 12): Promise<any> {
    return this.spendAnalytics.getSpendTrends(months);
  }

  @Get('analytics/spend/budget-utilization')
  @AuthWithPermissions('procurement.analytics')
  async getBudgetUtilization(): Promise<any> {
    return this.spendAnalytics.getBudgetUtilization();
  }

  @Get('analytics/spend/forecast')
  @AuthWithPermissions('procurement.analytics')
  async getSpendForecast(@Query('months') months: number = 3): Promise<any> {
    return this.spendAnalytics.getSpendForecast(months);
  }

  @Get('analytics/spend/top-items')
  @AuthWithPermissions('procurement.analytics')
  async getTopSpendItems(@Query('limit') limit: number = 10): Promise<any> {
    return this.spendAnalytics.getTopSpendItems(limit);
  }
}
