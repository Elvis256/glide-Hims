import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PatientFinanceService } from './patient-finance.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import {
  CreateCreditNoteDto,
  ApplyCreditNoteToInvoiceDto,
  CreateDepositDto,
  ApplyDepositDto,
  RequestWaiverDto,
  ApproveWaiverDto,
  RejectWaiverDto,
} from './dto/finance.dto';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('Patient Finance')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('finance')
@Controller('finance/patient')
export class PatientFinanceController {
  constructor(private readonly patientFinanceService: PatientFinanceService) {}

  // ============ CREDIT NOTES ============

  @Post('credit-notes')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Create a credit note' })
  async createCreditNote(@Body() body: CreateCreditNoteDto, @Request() req: any) {
    return this.patientFinanceService.createCreditNote(
      {
        patientId: body.patientId,
        invoiceId: body.invoiceId,
        noteNumber: body.noteNumber ?? '',
        amount: body.amount,
        reason: body.reason,
        issuedById: body.issuedById ?? req.user?.id,
        facilityId: body.facilityId ?? '',
      },
      req.user?.tenantId,
    );
  }

  @Get('credit-notes')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'List credit notes' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'facilityId', required: false })
  async findAllCreditNotes(
    @Query('patientId') patientId?: string,
    @Query('facilityId') facilityId?: string,
    @Request() req?: any,
  ) {
    return this.patientFinanceService.findAllCreditNotes(
      patientId,
      facilityId,
      req?.user?.tenantId,
    );
  }

  @Post('credit-notes/:id/apply')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Apply a credit note to an invoice' })
  async applyCreditNote(
    @Param('id') id: string,
    @Body() body: ApplyCreditNoteToInvoiceDto,
    @Request() req: any,
  ) {
    return this.patientFinanceService.applyCreditNote(
      id,
      body.invoiceId,
      body.amount,
      req.user?.tenantId,
    );
  }

  // ============ DEPOSITS ============

  @Post('deposits')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Create a patient deposit' })
  async createDeposit(@Body() body: CreateDepositDto, @Request() req: any) {
    return this.patientFinanceService.createDeposit(
      {
        patientId: body.patientId,
        depositNumber: body.depositNumber ?? '',
        amount: body.amount,
        paymentMethod: body.paymentMethod ?? '',
        facilityId: body.facilityId ?? '',
        receivedById: body.receivedById ?? req.user?.id,
        notes: body.notes,
      },
      req.user?.tenantId,
    );
  }

  @Get(':patientId/deposits')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get deposits for a patient' })
  async getPatientDeposits(@Param('patientId') patientId: string, @Request() req: any) {
    return this.patientFinanceService.getPatientDeposits(patientId, req.user?.tenantId);
  }

  @Post('deposits/:id/apply')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Apply a deposit to an invoice' })
  async applyDeposit(@Param('id') id: string, @Body() body: ApplyDepositDto, @Request() req: any) {
    return this.patientFinanceService.applyDeposit(
      id,
      body.invoiceId,
      body.amount,
      body.appliedById ?? req.user?.id,
      req.user?.tenantId,
    );
  }

  @Get(':patientId/balance')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get patient deposit balance' })
  async getPatientBalance(@Param('patientId') patientId: string, @Request() req: any) {
    return this.patientFinanceService.getPatientBalance(patientId, req.user?.tenantId);
  }

  // ============ WAIVERS ============

  @Post('waivers')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Request a waiver' })
  async requestWaiver(@Body() body: RequestWaiverDto, @Request() req: any) {
    return this.patientFinanceService.requestWaiver(
      {
        invoiceId: body.invoiceId,
        patientId: body.patientId,
        requestedAmount: body.requestedAmount,
        reason: body.reason,
        requestedById: body.requestedById ?? req.user?.id,
        facilityId: body.facilityId ?? '',
      },
      req.user?.tenantId,
    );
  }

  @Get('waivers')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'List waivers' })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAllWaivers(
    @Query('facilityId') facilityId?: string,
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    return this.patientFinanceService.findAllWaivers(facilityId, status, req?.user?.tenantId);
  }

  @Patch('waivers/:id/approve')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Approve a waiver' })
  async approveWaiver(
    @Param('id') id: string,
    @Body() body: ApproveWaiverDto,
    @Request() req: any,
  ) {
    return this.patientFinanceService.approveWaiver(
      id,
      body.userId ?? req.user?.id,
      body.amount ?? 0,
      body.notes,
      req.user?.tenantId,
    );
  }

  @Patch('waivers/:id/reject')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Reject a waiver' })
  async rejectWaiver(@Param('id') id: string, @Body() body: RejectWaiverDto, @Request() req: any) {
    return this.patientFinanceService.rejectWaiver(
      id,
      body.userId ?? req.user?.id,
      body.reason,
      req.user?.tenantId,
    );
  }
}
