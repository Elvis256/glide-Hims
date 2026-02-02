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
    return this.billingService.createInvoice(dto, req.user.id);
  }

  @Get('invoices')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'List invoices' })
  findAll(@Query() query: InvoiceQueryDto) {
    return this.billingService.findAll(query);
  }

  @Get('invoices/pending')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get pending invoices (cashier queue)' })
  getPending() {
    return this.billingService.getPendingInvoices();
  }

  @Get('invoices/number/:invoiceNumber')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get invoice by number' })
  findByNumber(@Param('invoiceNumber') invoiceNumber: string) {
    return this.billingService.findByInvoiceNumber(invoiceNumber);
  }

  @Get('invoices/:id')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get invoice by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.findInvoice(id);
  }

  @Post('invoices/:id/items')
  @AuthWithPermissions('billing.update')
  @ApiOperation({ summary: 'Add item to invoice' })
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddInvoiceItemDto,
  ) {
    return this.billingService.addItem(id, dto);
  }

  @Patch('invoices/:id/cancel')
  @AuthWithPermissions('billing.update')
  @ApiOperation({ summary: 'Cancel invoice' })
  cancelInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    return this.billingService.cancelInvoice(id, reason);
  }

  @Patch('invoices/:id/refund')
  @AuthWithPermissions('billing.update')
  @ApiOperation({ summary: 'Refund invoice' })
  refundInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    return this.billingService.refundInvoice(id, reason);
  }

  @Get('invoices/:id/payments')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get payments for an invoice' })
  getPayments(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.getPaymentsByInvoice(id);
  }

  @Get('payments')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'List all payments' })
  listPayments(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('method') method?: string,
  ) {
    return this.billingService.listPayments({ startDate, endDate, method });
  }

  @Post('payments')
  @AuthWithPermissions('billing.create')
  @ApiOperation({ summary: 'Record payment' })
  recordPayment(@Body() dto: CreatePaymentDto, @Request() req: any) {
    return this.billingService.recordPayment(dto, req.user.id);
  }

  @Patch('payments/:id/void')
  @AuthWithPermissions('billing.update')
  @ApiOperation({ summary: 'Void a payment' })
  voidPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    return this.billingService.voidPayment(id, reason);
  }

  @Get('revenue/daily')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get daily revenue summary' })
  getDailyRevenue(@Query('date') date?: string) {
    const reportDate = date ? new Date(date) : new Date();
    return this.billingService.getDailyRevenue(reportDate);
  }

  @Get('revenue/dashboard')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get revenue dashboard with trends and breakdowns' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['daily', 'weekly', 'monthly'] })
  getRevenueDashboard(
    @Query('facilityId') facilityId: string,
    @Query('period') period?: 'daily' | 'weekly' | 'monthly',
  ) {
    return this.billingService.getRevenueDashboard(facilityId, period || 'monthly');
  }
}
