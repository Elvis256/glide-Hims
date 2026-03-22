import { Controller, Get, Post, Put, Param, Body, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupplierFinanceService } from './supplier-finance.service';
import { PaymentVoucherStatus, PaymentMethod } from '../../database/entities/supplier-payment.entity';
import { CreditNoteType, CreditNoteStatus } from '../../database/entities/supplier-credit-note.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { ApplyCreditNoteDto } from './dto/supplier-finance.dto';

@ApiTags('Supplier Finance')
@ApiBearerAuth()
@Controller('supplier-finance')
export class SupplierFinanceController {
  constructor(private readonly supplierFinanceService: SupplierFinanceService) {}

  // ==================== PAYMENT VOUCHERS ====================

  @AuthWithPermissions('finance.manage')
  @Post('payments')
  @ApiOperation({ summary: 'Create payment voucher' })
  async createPaymentVoucher(@Body() data: any, @CurrentUser() user: any, @Request() req: any) {
    return this.supplierFinanceService.createPaymentVoucher(data, user.id, req.user?.tenantId);
  }

  @AuthWithPermissions('finance.read')
  @Get('payments')
  @ApiOperation({ summary: 'List payment vouchers' })
  async listPaymentVouchers(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: PaymentVoucherStatus,
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: any,
  ) {
    return this.supplierFinanceService.listPaymentVouchers(facilityId, {
      status,
      supplierId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    }, req?.user?.tenantId);
  }

  @AuthWithPermissions('finance.read')
  @Get('payments/:id')
  @ApiOperation({ summary: 'Get payment voucher' })
  async getPaymentVoucher(@Param('id') id: string, @Request() req: any) {
    return this.supplierFinanceService.getPaymentVoucher(id, req.user?.tenantId);
  }

  @AuthWithPermissions('finance.manage')
  @Post('payments/:id/submit')
  @ApiOperation({ summary: 'Submit payment voucher for approval' })
  async submitPaymentVoucher(@Param('id') id: string, @Request() req: any) {
    return this.supplierFinanceService.submitPaymentVoucher(id, req.user?.tenantId);
  }

  @AuthWithPermissions('finance.manage')
  @Post('payments/:id/approve')
  @ApiOperation({ summary: 'Approve payment voucher' })
  async approvePaymentVoucher(@Param('id') id: string, @CurrentUser() user: any, @Request() req: any) {
    return this.supplierFinanceService.approvePaymentVoucher(id, user.id, req.user?.tenantId);
  }

  @AuthWithPermissions('finance.manage')
  @Post('payments/:id/process')
  @ApiOperation({ summary: 'Process payment (mark as paid)' })
  async processPayment(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() data?: { chequeNumber?: string; bankReference?: string },
    @Request() req?: any,
  ) {
    return this.supplierFinanceService.processPayment(id, user.id, data, req?.user?.tenantId);
  }

  @AuthWithPermissions('finance.manage')
  @Post('payments/:id/cancel')
  @ApiOperation({ summary: 'Cancel payment voucher' })
  async cancelPaymentVoucher(@Param('id') id: string, @Request() req: any) {
    return this.supplierFinanceService.cancelPaymentVoucher(id, req.user?.tenantId);
  }

  // ==================== CREDIT/DEBIT NOTES ====================

  @AuthWithPermissions('finance.manage')
  @Post('credit-notes')
  @ApiOperation({ summary: 'Create credit/debit note' })
  async createCreditNote(@Body() data: any, @CurrentUser() user: any, @Request() req: any) {
    return this.supplierFinanceService.createCreditNote(data, user.id, req.user?.tenantId);
  }

  @AuthWithPermissions('finance.read')
  @Get('credit-notes')
  @ApiOperation({ summary: 'List credit/debit notes' })
  async listCreditNotes(
    @Query('facilityId') facilityId: string,
    @Query('noteType') noteType?: CreditNoteType,
    @Query('status') status?: CreditNoteStatus,
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: any,
  ) {
    return this.supplierFinanceService.listCreditNotes(facilityId, {
      noteType,
      status,
      supplierId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    }, req?.user?.tenantId);
  }

  @AuthWithPermissions('finance.read')
  @Get('credit-notes/:id')
  @ApiOperation({ summary: 'Get credit/debit note' })
  async getCreditNote(@Param('id') id: string, @Request() req: any) {
    return this.supplierFinanceService.getCreditNote(id, req.user?.tenantId);
  }

  @AuthWithPermissions('finance.manage')
  @Post('credit-notes/:id/approve')
  @ApiOperation({ summary: 'Approve credit/debit note' })
  async approveCreditNote(@Param('id') id: string, @CurrentUser() user: any, @Request() req: any) {
    return this.supplierFinanceService.approveCreditNote(id, user.id, req.user?.tenantId);
  }

  @AuthWithPermissions('finance.manage')
  @Post('credit-notes/:id/apply')
  @ApiOperation({ summary: 'Apply credit note to payment' })
  async applyCreditNote(
    @Param('id') id: string,
    @Body() data: ApplyCreditNoteDto,
    @Request() req: any,
  ) {
    return this.supplierFinanceService.applyCreditNote(id, data.paymentVoucherId, data.amount, req.user?.tenantId);
  }

  @AuthWithPermissions('finance.manage')
  @Post('credit-notes/:id/cancel')
  @ApiOperation({ summary: 'Cancel credit/debit note' })
  async cancelCreditNote(@Param('id') id: string, @Request() req: any) {
    return this.supplierFinanceService.cancelCreditNote(id, req.user?.tenantId);
  }

  // ==================== REPORTS ====================

  @AuthWithPermissions('finance.read')
  @Get('reports/supplier-ledger/:supplierId')
  @ApiOperation({ summary: 'Get supplier ledger' })
  async getSupplierLedger(
    @Param('supplierId') supplierId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: any,
  ) {
    return this.supplierFinanceService.getSupplierLedger(
      supplierId,
      new Date(startDate),
      new Date(endDate),
      req.user?.tenantId,
    );
  }

  @AuthWithPermissions('finance.read')
  @Get('reports/aging')
  @ApiOperation({ summary: 'Get supplier aging report' })
  async getSupplierAgingReport(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.supplierFinanceService.getSupplierAgingReport(facilityId, req.user?.tenantId);
  }

  @AuthWithPermissions('finance.read')
  @Get('reports/payment-summary')
  @ApiOperation({ summary: 'Get payment summary' })
  async getPaymentSummary(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: any,
  ) {
    return this.supplierFinanceService.getPaymentSummary(
      facilityId,
      new Date(startDate),
      new Date(endDate),
      req.user?.tenantId,
    );
  }
}
