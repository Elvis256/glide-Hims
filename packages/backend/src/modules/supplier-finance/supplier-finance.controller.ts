import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SupplierFinanceService } from './supplier-finance.service';
import { PaymentVoucherStatus, PaymentMethod } from '../../database/entities/supplier-payment.entity';
import { CreditNoteType, CreditNoteStatus } from '../../database/entities/supplier-credit-note.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Supplier Finance')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('supplier-finance')
export class SupplierFinanceController {
  constructor(private readonly supplierFinanceService: SupplierFinanceService) {}

  // ==================== PAYMENT VOUCHERS ====================

  @Post('payments')
  @ApiOperation({ summary: 'Create payment voucher' })
  async createPaymentVoucher(@Body() data: any, @CurrentUser() user: any) {
    return this.supplierFinanceService.createPaymentVoucher(data, user.id);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List payment vouchers' })
  async listPaymentVouchers(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: PaymentVoucherStatus,
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.supplierFinanceService.listPaymentVouchers(facilityId, {
      status,
      supplierId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Get payment voucher' })
  async getPaymentVoucher(@Param('id') id: string) {
    return this.supplierFinanceService.getPaymentVoucher(id);
  }

  @Post('payments/:id/submit')
  @ApiOperation({ summary: 'Submit payment voucher for approval' })
  async submitPaymentVoucher(@Param('id') id: string) {
    return this.supplierFinanceService.submitPaymentVoucher(id);
  }

  @Post('payments/:id/approve')
  @ApiOperation({ summary: 'Approve payment voucher' })
  async approvePaymentVoucher(@Param('id') id: string, @CurrentUser() user: any) {
    return this.supplierFinanceService.approvePaymentVoucher(id, user.id);
  }

  @Post('payments/:id/process')
  @ApiOperation({ summary: 'Process payment (mark as paid)' })
  async processPayment(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() data?: { chequeNumber?: string; bankReference?: string },
  ) {
    return this.supplierFinanceService.processPayment(id, user.id, data);
  }

  @Post('payments/:id/cancel')
  @ApiOperation({ summary: 'Cancel payment voucher' })
  async cancelPaymentVoucher(@Param('id') id: string) {
    return this.supplierFinanceService.cancelPaymentVoucher(id);
  }

  // ==================== CREDIT/DEBIT NOTES ====================

  @Post('credit-notes')
  @ApiOperation({ summary: 'Create credit/debit note' })
  async createCreditNote(@Body() data: any, @CurrentUser() user: any) {
    return this.supplierFinanceService.createCreditNote(data, user.id);
  }

  @Get('credit-notes')
  @ApiOperation({ summary: 'List credit/debit notes' })
  async listCreditNotes(
    @Query('facilityId') facilityId: string,
    @Query('noteType') noteType?: CreditNoteType,
    @Query('status') status?: CreditNoteStatus,
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.supplierFinanceService.listCreditNotes(facilityId, {
      noteType,
      status,
      supplierId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('credit-notes/:id')
  @ApiOperation({ summary: 'Get credit/debit note' })
  async getCreditNote(@Param('id') id: string) {
    return this.supplierFinanceService.getCreditNote(id);
  }

  @Post('credit-notes/:id/approve')
  @ApiOperation({ summary: 'Approve credit/debit note' })
  async approveCreditNote(@Param('id') id: string, @CurrentUser() user: any) {
    return this.supplierFinanceService.approveCreditNote(id, user.id);
  }

  @Post('credit-notes/:id/apply')
  @ApiOperation({ summary: 'Apply credit note to payment' })
  async applyCreditNote(
    @Param('id') id: string,
    @Body() data: { paymentVoucherId: string; amount: number },
  ) {
    return this.supplierFinanceService.applyCreditNote(id, data.paymentVoucherId, data.amount);
  }

  @Post('credit-notes/:id/cancel')
  @ApiOperation({ summary: 'Cancel credit/debit note' })
  async cancelCreditNote(@Param('id') id: string) {
    return this.supplierFinanceService.cancelCreditNote(id);
  }

  // ==================== REPORTS ====================

  @Get('reports/supplier-ledger/:supplierId')
  @ApiOperation({ summary: 'Get supplier ledger' })
  async getSupplierLedger(
    @Param('supplierId') supplierId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.supplierFinanceService.getSupplierLedger(
      supplierId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('reports/aging')
  @ApiOperation({ summary: 'Get supplier aging report' })
  async getSupplierAgingReport(@Query('facilityId') facilityId: string) {
    return this.supplierFinanceService.getSupplierAgingReport(facilityId);
  }

  @Get('reports/payment-summary')
  @ApiOperation({ summary: 'Get payment summary' })
  async getPaymentSummary(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.supplierFinanceService.getPaymentSummary(
      facilityId,
      new Date(startDate),
      new Date(endDate),
    );
  }
}
