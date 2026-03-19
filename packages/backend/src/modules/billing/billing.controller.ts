import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateInvoiceDto, AddInvoiceItemDto, CreatePaymentDto, InvoiceQueryDto } from './billing.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('invoices')
  @AuthWithPermissions('billing.create')
  @ApiOperation({ summary: 'Create invoice' })
  createInvoice(@Body() dto: CreateInvoiceDto, @Request() req: any) {
    return this.billingService.createInvoice(dto, req.user.id, req.user?.tenantId);
  }

  @Get('invoices')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'List invoices' })
  findAll(@Query() query: InvoiceQueryDto, @Request() req: any) {
    return this.billingService.findAll(query, req.user?.tenantId);
  }

  @Get('invoices/pending')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get pending invoices (cashier queue)' })
  getPending(@Request() req: any) {
    return this.billingService.getPendingInvoices(req.user?.tenantId);
  }

  @Get('invoices/number/:invoiceNumber')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get invoice by number' })
  findByNumber(@Param('invoiceNumber') invoiceNumber: string, @Request() req: any) {
    return this.billingService.findByInvoiceNumber(invoiceNumber, req.user?.tenantId);
  }

  @Get('invoices/:id')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get invoice by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.billingService.findInvoice(id, req.user?.tenantId);
  }

  @Post('invoices/:id/items')
  @AuthWithPermissions('billing.update')
  @ApiOperation({ summary: 'Add item to invoice' })
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddInvoiceItemDto,
    @Request() req?: any,
  ) {
    return this.billingService.addItem(id, dto, req?.user?.tenantId);
  }

  @Patch('invoices/:id/cancel')
  @AuthWithPermissions('billing.update')
  @ApiOperation({ summary: 'Cancel invoice' })
  cancelInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
    @Request() req?: any,
  ) {
    return this.billingService.cancelInvoice(id, reason, req?.user?.tenantId);
  }

  @Patch('invoices/:id/refund')
  @AuthWithPermissions('billing.update')
  @ApiOperation({ summary: 'Refund invoice' })
  refundInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
    @Request() req?: any,
  ) {
    return this.billingService.refundInvoice(id, reason, req?.user?.id, req?.user?.tenantId);
  }

  @Get('invoices/:id/payments')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get payments for an invoice' })
  getPayments(@Param('id', ParseUUIDPipe) id: string, @Request() req?: any) {
    return this.billingService.getPaymentsByInvoice(id, req?.user?.tenantId);
  }

  @Get('payments')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'List all payments' })
  listPayments(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('method') method?: string,
    @Request() req?: any,
  ) {
    return this.billingService.listPayments({ startDate, endDate, method }, req?.user?.tenantId);
  }

  @Get('payments/:id')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get single payment / receipt by ID' })
  getPayment(@Param('id', ParseUUIDPipe) id: string, @Request() req?: any) {
    return this.billingService.getPayment(id, req?.user?.tenantId);
  }

  @Post('payments')
  @AuthWithPermissions('billing.create')
  @ApiOperation({ summary: 'Record payment' })
  recordPayment(@Body() dto: CreatePaymentDto, @Request() req: any) {
    return this.billingService.recordPayment(dto, req.user.id, req.user?.tenantId);
  }

  @Patch('payments/:id/void')
  @AuthWithPermissions('billing.update')
  @ApiOperation({ summary: 'Void a payment' })
  voidPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Request() req?: any,
  ) {
    return this.billingService.voidPayment(id, reason, req?.user?.id, req?.user?.tenantId);
  }

  @Get('revenue/daily')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get daily revenue summary' })
  getDailyRevenue(@Query('date') date?: string, @Request() req?: any) {
    const reportDate = date ? new Date(date) : new Date();
    return this.billingService.getDailyRevenue(reportDate, req?.user?.tenantId);
  }

  @Get('revenue/dashboard')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get revenue dashboard with trends and breakdowns' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['daily', 'weekly', 'monthly'] })
  getRevenueDashboard(
    @Query('facilityId') facilityId: string,
    @Query('period') period?: 'daily' | 'weekly' | 'monthly',
    @Request() req?: any,
  ) {
    return this.billingService.getRevenueDashboard(facilityId, period || 'monthly', req?.user?.tenantId);
  }

  // ============ WRITE-OFFS ============
  @Patch('invoices/:id/write-off')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Write off an unpaid invoice as bad debt' })
  writeOffInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.billingService.writeOffInvoice(id, reason, req.user.id, req?.user?.tenantId);
  }

  // ============ RECEIPT PRINTING ============
  @Get('receipts/:paymentId/print')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get formatted receipt data for printing' })
  getReceiptPrintData(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Request() req: any,
  ) {
    return this.billingService.getReceiptPrintData(paymentId, req?.user?.tenantId);
  }
}
