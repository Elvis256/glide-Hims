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
import { Auth } from '../auth/decorators/auth.decorator';
import { ProcurementService } from './procurement.service';
import {
  CreatePurchaseRequestDto,
  ApprovePRDto,
  RejectPRDto,
  CreatePurchaseOrderDto,
  CreatePOFromPRDto,
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
  @Auth()
  getDashboard(@Query('facilityId') facilityId: string) {
    return this.procurementService.getDashboard(facilityId);
  }

  // ============ PURCHASE REQUESTS ============

  @Post('purchase-requests')
  @Auth()
  createPurchaseRequest(@Body() dto: CreatePurchaseRequestDto, @Request() req: any) {
    return this.procurementService.createPurchaseRequest(dto, req.user.id);
  }

  @Get('purchase-requests')
  @Auth()
  getPurchaseRequests(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: PRStatus,
    @Query('priority') priority?: PRPriority,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.procurementService.getPurchaseRequests(facilityId, { status, priority, startDate, endDate });
  }

  @Get('purchase-requests/:id')
  @Auth()
  getPurchaseRequest(@Param('id') id: string) {
    return this.procurementService.getPurchaseRequest(id);
  }

  @Put('purchase-requests/:id/submit')
  @Auth()
  submitPurchaseRequest(@Param('id') id: string) {
    return this.procurementService.submitPurchaseRequest(id);
  }

  @Put('purchase-requests/:id/approve')
  @Auth('Admin', 'Procurement Manager')
  approvePurchaseRequest(@Param('id') id: string, @Body() dto: ApprovePRDto, @Request() req: any) {
    return this.procurementService.approvePurchaseRequest(id, dto, req.user.id);
  }

  @Put('purchase-requests/:id/reject')
  @Auth('Admin', 'Procurement Manager')
  rejectPurchaseRequest(@Param('id') id: string, @Body() dto: RejectPRDto, @Request() req: any) {
    return this.procurementService.rejectPurchaseRequest(id, dto, req.user.id);
  }

  // ============ PURCHASE ORDERS ============

  @Post('purchase-orders')
  @Auth('Admin', 'Procurement', 'Storekeeper')
  createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @Request() req: any) {
    return this.procurementService.createPurchaseOrder(dto, req.user.id);
  }

  @Post('purchase-orders/from-pr')
  @Auth('Admin', 'Procurement', 'Storekeeper')
  createPOFromPR(@Body() dto: CreatePOFromPRDto, @Request() req: any) {
    return this.procurementService.createPOFromPR(dto, req.user.id);
  }

  @Get('purchase-orders')
  @Auth()
  getPurchaseOrders(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: POStatus,
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.procurementService.getPurchaseOrders(facilityId, { status, supplierId, startDate, endDate });
  }

  @Get('purchase-orders/:id')
  @Auth()
  getPurchaseOrder(@Param('id') id: string) {
    return this.procurementService.getPurchaseOrder(id);
  }

  @Put('purchase-orders/:id/approve')
  @Auth('Admin', 'Procurement Manager')
  approvePurchaseOrder(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.approvePurchaseOrder(id, req.user.id);
  }

  @Put('purchase-orders/:id/send')
  @Auth('Admin', 'Procurement')
  sendPurchaseOrder(@Param('id') id: string) {
    return this.procurementService.sendPurchaseOrder(id);
  }

  @Put('purchase-orders/:id/cancel')
  @Auth('Admin', 'Procurement Manager')
  cancelPurchaseOrder(@Param('id') id: string) {
    return this.procurementService.cancelPurchaseOrder(id);
  }

  // ============ GOODS RECEIPT NOTES ============

  @Post('goods-receipts')
  @Auth('Admin', 'Storekeeper', 'Procurement')
  createGoodsReceipt(@Body() dto: CreateGoodsReceiptDto, @Request() req: any) {
    return this.procurementService.createGoodsReceipt(dto, req.user.id);
  }

  @Post('goods-receipts/from-po')
  @Auth('Admin', 'Storekeeper', 'Procurement')
  createGRNFromPO(
    @Body() body: { purchaseOrderId: string; receivedItems: { itemId: string; quantityReceived: number; batchNumber?: string; expiryDate?: string }[] },
    @Request() req: any,
  ) {
    return this.procurementService.createGRNFromPO(body.purchaseOrderId, body.receivedItems, req.user.id);
  }

  @Get('goods-receipts')
  @Auth()
  getGoodsReceipts(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: GRNStatus,
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.procurementService.getGoodsReceipts(facilityId, { status, supplierId, startDate, endDate });
  }

  @Get('goods-receipts/:id')
  @Auth()
  getGoodsReceipt(@Param('id') id: string) {
    return this.procurementService.getGoodsReceipt(id);
  }

  @Put('goods-receipts/:id/inspect')
  @Auth('Admin', 'Storekeeper', 'Quality Control')
  inspectGoodsReceipt(@Param('id') id: string, @Body() dto: InspectGRNDto, @Request() req: any) {
    return this.procurementService.inspectGoodsReceipt(id, dto, req.user.id);
  }

  @Put('goods-receipts/:id/approve')
  @Auth('Admin', 'Procurement Manager')
  approveGoodsReceipt(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.approveGoodsReceipt(id, req.user.id);
  }

  @Put('goods-receipts/:id/post')
  @Auth('Admin', 'Storekeeper', 'Procurement')
  postGoodsReceipt(@Param('id') id: string, @Request() req: any) {
    return this.procurementService.postGoodsReceipt(id, req.user.id);
  }
}
