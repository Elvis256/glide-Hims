import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { ProcurementService } from './procurement.service';
import {
  CreatePurchaseRequestDto,
  ApprovePRDto,
  RejectPRDto,
  CreatePurchaseOrderDto,
  CreatePOFromPRDto,
  CreatePOFromQuotationDto,
  CreateGoodsReceiptDto,
  InspectGRNDto,
} from './dto/procurement.dto';
import { PRStatus, PRPriority } from '../../database/entities/purchase-request.entity';
import { POStatus } from '../../database/entities/purchase-order.entity';
import { GRNStatus } from '../../database/entities/goods-receipt.entity';

@Controller('procurement')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  // ============ DASHBOARD ============

  @Get('dashboard')
  @AuthWithPermissions('procurement.read')
  getDashboard(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.procurementService.getDashboard(facilityId, req.user?.tenantId);
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
    return this.procurementService.getPurchaseRequests(facilityId, { status, priority, startDate, endDate }, req?.user?.tenantId);
  }

  @Get('purchase-requests/:id')
  @AuthWithPermissions('procurement.read')
  getPurchaseRequest(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.getPurchaseRequest(id, req.user?.tenantId);
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
    return this.procurementService.getPurchaseOrders(facilityId, { status, supplierId, startDate, endDate }, req?.user?.tenantId);
  }

  @Get('purchase-orders/:id')
  @AuthWithPermissions('procurement.read')
  getPurchaseOrder(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.getPurchaseOrder(id, req.user?.tenantId);
  }

  @Put('purchase-orders/:id/approve')
  @AuthWithPermissions('procurement.approve')
  approvePurchaseOrder(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.approvePurchaseOrder(id, req.user.id, req.user?.tenantId, req.user?.roles);
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
  createGRNFromPO(
    @Body() body: { purchaseOrderId: string; receivedItems: { itemId: string; quantityReceived: number; batchNumber?: string; expiryDate?: string }[] },
    @Request() req: any,
  ) {
    return this.procurementService.createGRNFromPO(body.purchaseOrderId, body.receivedItems, req.user.id, req.user?.tenantId);
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
    return this.procurementService.getGoodsReceipts(facilityId, { status, supplierId, startDate, endDate }, req?.user?.tenantId);
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
}
