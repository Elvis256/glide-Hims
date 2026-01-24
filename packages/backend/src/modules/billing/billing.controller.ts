import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateInvoiceDto, AddInvoiceItemDto, CreatePaymentDto, InvoiceQueryDto } from './billing.dto';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('invoices')
  @Auth('Cashier', 'Admin', 'Super Admin')
  @ApiOperation({ summary: 'Create invoice' })
  createInvoice(@Body() dto: CreateInvoiceDto, @Request() req: any) {
    return this.billingService.createInvoice(dto, req.user.id);
  }

  @Get('invoices')
  @Auth()
  @ApiOperation({ summary: 'List invoices' })
  findAll(@Query() query: InvoiceQueryDto) {
    return this.billingService.findAll(query);
  }

  @Get('invoices/pending')
  @Auth('Cashier', 'Admin', 'Super Admin')
  @ApiOperation({ summary: 'Get pending invoices (cashier queue)' })
  getPending() {
    return this.billingService.getPendingInvoices();
  }

  @Get('invoices/number/:invoiceNumber')
  @Auth()
  @ApiOperation({ summary: 'Get invoice by number' })
  findByNumber(@Param('invoiceNumber') invoiceNumber: string) {
    return this.billingService.findByInvoiceNumber(invoiceNumber);
  }

  @Get('invoices/:id')
  @Auth()
  @ApiOperation({ summary: 'Get invoice by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.findInvoice(id);
  }

  @Post('invoices/:id/items')
  @Auth('Cashier', 'Admin', 'Super Admin')
  @ApiOperation({ summary: 'Add item to invoice' })
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddInvoiceItemDto,
  ) {
    return this.billingService.addItem(id, dto);
  }

  @Get('invoices/:id/payments')
  @Auth()
  @ApiOperation({ summary: 'Get payments for an invoice' })
  getPayments(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.getPaymentsByInvoice(id);
  }

  @Post('payments')
  @Auth('Cashier', 'Admin', 'Super Admin')
  @ApiOperation({ summary: 'Record payment' })
  recordPayment(@Body() dto: CreatePaymentDto, @Request() req: any) {
    return this.billingService.recordPayment(dto, req.user.id);
  }

  @Get('revenue/daily')
  @Auth('Cashier', 'Accountant', 'Admin', 'Super Admin')
  @ApiOperation({ summary: 'Get daily revenue summary' })
  getDailyRevenue(@Query('date') date?: string) {
    const reportDate = date ? new Date(date) : new Date();
    return this.billingService.getDailyRevenue(reportDate);
  }
}
