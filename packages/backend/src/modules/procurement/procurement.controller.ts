import { Controller, Get, Post, Put, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { ProcurementService } from './procurement.service';
import { ProcurementGLIntegrationService } from './procurement-gl-integration.service';
import { SupplierAnalyticsService } from './supplier-analytics.service';
import { ApprovalAnalyticsService } from './approval-analytics.service';
import { SpendAnalyticsService } from './spend-analytics.service';
import {
  CreatePurchaseRequestDto,
  UpdatePurchaseRequestDto,
  CreatePRItemDto,
  ApprovePRDto,
  RejectPRDto,
  CreatePurchaseOrderDto,
  CreatePOFromPRDto,
  CreatePOFromQuotationDto,
  CreateGoodsReceiptDto,
  InspectGRNDto,
  CreateGRNFromPODto,
  ListPurchaseRequestsQueryDto,
  ListPurchaseOrdersQueryDto,
  ListGoodsReceiptsQueryDto,
  FacilityIdQueryDto,
  OptionalFacilityIdQueryDto,
  TraceSearchQueryDto,
  RunReorderBodyDto,
  ThreeWayMatchQueryDto,
  ReconciliationReportQueryDto,
  DateRangeQueryDto,
  SupplierSpendTrendsQueryDto,
  SupplierIdQueryDto,
  LimitQueryDto,
  MonthsQueryDto,
  DaysQueryDto,
  UpdatePRItemBodyDto,
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
  getDashboard(@Query() query: FacilityIdQueryDto, @Request() req: any) {
    return this.procurementService.getDashboard(query.facilityId, req.user?.tenantId);
  }

  // ============ TRACE (PR -> PO -> GRN -> Invoice) ============

  @Get('trace/search')
  @AuthWithPermissions('procurement.read')
  searchTraceDocuments(@Query() query: TraceSearchQueryDto, @Request() req: any) {
    const q = query.q;
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
  previewReorder(@Query() query: OptionalFacilityIdQueryDto, @Request() req: any) {
    return this.procurementService.runAutoReorderDraftPRs({
      tenantId: req.user?.tenantId,
      facilityId: query.facilityId,
      dryRun: true,
    });
  }

  @Post('reorder/run')
  @AuthWithPermissions('procurement.create')
  runReorder(@Body() body: RunReorderBodyDto, @Request() req: any) {
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
    @Query() query: ListPurchaseRequestsQueryDto,
    @Request() req?: any,
  ) {
    const { facilityId, status, priority, startDate, endDate } = query;
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

  @Put('purchase-requests/:id')
  @AuthWithPermissions('procurement.update')
  updatePurchaseRequest(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseRequestDto,
    @Request() req: any,
  ) {
    return this.procurementService.updatePurchaseRequest(id, dto, req.user?.tenantId);
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
    @Body() body: UpdatePRItemBodyDto,
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
    return this.procurementService.approvePurchaseRequest(id, dto, req.user.id, req.user?.tenantId, req.user?.roles);
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
    @Query() query: ListPurchaseOrdersQueryDto,
    @Request() req?: any,
  ) {
    const { facilityId, status, supplierId, startDate, endDate } = query;
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

  @Get('purchase-orders/:id/approval-chain')
  @AuthWithPermissions('procurement.read')
  getPOApprovalChain(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.getEnrichedApprovalChain(id, req.user?.tenantId);
  }

  @Get('purchase-requests/:id/approval-chain')
  @AuthWithPermissions('procurement.read')
  getPRApprovalChain(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.getEnrichedApprovalChain(id, req.user?.tenantId);
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
    @Query() query: ListGoodsReceiptsQueryDto,
    @Request() req?: any,
  ) {
    const { facilityId, status, supplierId, startDate, endDate } = query;
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
    return this.glIntegrationService.postGRNReceiptToGL(id, req.user.id, req.user?.tenantId);
  }

  @Get('budget/encumbrances')
  @AuthWithPermissions('procurement.read')
  async getEncumbrances(@Request() req: any) {
    return this.glIntegrationService.getIntegrationSummary(req.user?.tenantId);
  }

  @Get('budget/encumbrances/:departmentId')
  @AuthWithPermissions('procurement.read')
  async getDepartmentEncumbrances(
    @Param('departmentId') departmentId: string,
    @Request() req: any,
  ) {
    return this.glIntegrationService.getDepartmentEncumbrances(departmentId, req.user?.tenantId);
  }

  @Post('po/:id/encumber')
  @AuthWithPermissions('procurement.create')
  async encumberBudget(
    @Param('id') poId: string,
    @Body() dto: EncumbranceDto,
    @Request() req: any,
  ) {
    return this.glIntegrationService.encumberBudgetForPO(poId, dto.departmentId, req.user?.tenantId);
  }

  @Get('reconciliation/three-way-match')
  @AuthWithPermissions('procurement.read')
  async getThreeWayMatches(
    @Query() query: ThreeWayMatchQueryDto,
    @Request() req: any,
  ) {
    return this.glIntegrationService.validateThreeWayMatch(
      query.poId,
      query.grnId,
      query.invoiceId,
      req.user?.tenantId,
    );
  }

  @Get('gl-integration/summary')
  @AuthWithPermissions('procurement.read')
  async getGLIntegrationSummary(@Request() req: any) {
    return this.glIntegrationService.getIntegrationSummary(req.user?.tenantId);
  }

  @Get('reconciliation/report')
  @AuthWithPermissions('procurement.read')
  async getReconciliationReport(
    @Query() query: ReconciliationReportQueryDto,
    @Request() req: any,
  ) {
    return this.glIntegrationService.getReconciliationReport(
      new Date(query.startDate),
      new Date(query.endDate),
      query.departmentId,
      req.user?.tenantId,
    );
  }

  // ============ APPROVALS ============
  // The pending/summary/bottlenecks/escalations/history endpoints live in
  // approval-dashboard.controller.ts (mounted on the same /procurement/approvals
  // path) — those are the real implementations. Keeping the supplier-risks
  // route there now too; the legacy stubs that used to live here have been
  // removed (see audit Phase 1.1).

  // ============ ANALYTICS - SUPPLIERS ============

  @Get('analytics/suppliers/metrics')
  @AuthWithPermissions('procurement.analytics')
  async getSupplierMetrics(
    @Request() req: any,
    @Query() query: DateRangeQueryDto,
  ): Promise<any> {
    return this.supplierAnalytics.getSupplierMetrics(
      req.user?.tenantId,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
    );
  }

  @Get('analytics/suppliers/spend-trends')
  @AuthWithPermissions('procurement.analytics')
  async getSupplierSpendTrends(
    @Request() req: any,
    @Query() query: SupplierSpendTrendsQueryDto,
  ): Promise<any> {
    return this.supplierAnalytics.getSupplierSpendTrends(
      req.user?.tenantId,
      query.supplierId,
      query.months ?? 12,
    );
  }

  @Get('analytics/suppliers/top-suppliers')
  @AuthWithPermissions('procurement.analytics')
  async getTopSuppliers(@Request() req: any, @Query() query: LimitQueryDto): Promise<any> {
    return this.supplierAnalytics.getTopSuppliers(req.user?.tenantId, query.limit ?? 10);
  }

  @Get('analytics/suppliers/performance-comparison')
  @AuthWithPermissions('procurement.analytics')
  async getSupplierPerformanceComparison(@Request() req: any): Promise<any> {
    return this.supplierAnalytics.getSupplierPerformanceComparison(req.user?.tenantId);
  }

  @Get('analytics/suppliers/risk-score')
  @AuthWithPermissions('procurement.analytics')
  async getSupplierRiskScore(
    @Request() req: any,
    @Query() query: SupplierIdQueryDto,
  ): Promise<any> {
    return this.supplierAnalytics.getSupplierRiskScore(req.user?.tenantId, query.supplierId);
  }

  // ============ ANALYTICS - APPROVALS ============

  @Get('analytics/approvals/bottlenecks')
  @AuthWithPermissions('procurement.analytics')
  async detectApprovalBottlenecks(@Request() req: any): Promise<any> {
    return this.approvalAnalytics.detectBottlenecks(req.user?.tenantId);
  }

  @Get('analytics/approvals/time-metrics')
  @AuthWithPermissions('procurement.analytics')
  async getApprovalTimeMetrics(
    @Request() req: any,
    @Query() query: DateRangeQueryDto,
  ): Promise<any> {
    return this.approvalAnalytics.getApprovalTimeMetrics(
      req.user?.tenantId,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
    );
  }

  @Get('analytics/approvals/trends')
  @AuthWithPermissions('procurement.analytics')
  async getApprovalTrends(@Request() req: any, @Query() query: DaysQueryDto): Promise<any> {
    return this.approvalAnalytics.getApprovalTrends(req.user?.tenantId, query.days ?? 30);
  }

  @Get('analytics/approvals/sla-compliance')
  @AuthWithPermissions('procurement.analytics')
  async getApprovalSLACompliance(@Request() req: any): Promise<any> {
    return this.approvalAnalytics.getApprovalSLACompliance(req.user?.tenantId);
  }

  @Get('analytics/approvals/workload')
  @AuthWithPermissions('procurement.analytics')
  async getApprovalWorkload(@Request() req: any): Promise<any> {
    return this.approvalAnalytics.getApprovalWorkload(req.user?.tenantId);
  }

  // ============ ANALYTICS - SPEND ============

  @Get('analytics/spend/by-category')
  @AuthWithPermissions('procurement.analytics')
  async getSpendByCategory(
    @Request() req: any,
    @Query() query: DateRangeQueryDto,
  ): Promise<any> {
    return this.spendAnalytics.getCategorySpend(
      req.user?.tenantId,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
    );
  }

  @Get('analytics/spend/by-department')
  @AuthWithPermissions('procurement.analytics')
  async getSpendByDepartment(
    @Request() req: any,
    @Query() query: DateRangeQueryDto,
  ): Promise<any> {
    return this.spendAnalytics.getDepartmentSpend(
      req.user?.tenantId,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
    );
  }

  @Get('analytics/spend/trends')
  @AuthWithPermissions('procurement.analytics')
  async getSpendTrends(@Request() req: any, @Query() query: MonthsQueryDto): Promise<any> {
    return this.spendAnalytics.getSpendTrends(req.user?.tenantId, query.months ?? 12);
  }

  @Get('analytics/spend/budget-utilization')
  @AuthWithPermissions('procurement.analytics')
  async getBudgetUtilization(@Request() req: any): Promise<any> {
    return this.spendAnalytics.getBudgetUtilization(req.user?.tenantId);
  }

  @Get('analytics/spend/forecast')
  @AuthWithPermissions('procurement.analytics')
  async getSpendForecast(@Request() req: any, @Query() query: MonthsQueryDto): Promise<any> {
    return this.spendAnalytics.getSpendForecast(req.user?.tenantId, query.months ?? 3);
  }

  @Get('analytics/spend/top-items')
  @AuthWithPermissions('procurement.analytics')
  async getTopSpendItems(@Request() req: any, @Query() query: LimitQueryDto): Promise<any> {
    return this.spendAnalytics.getTopSpendItems(req.user?.tenantId, query.limit ?? 10);
  }
}
