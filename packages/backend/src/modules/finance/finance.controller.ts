import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import {
  CreateAccountDto,
  UpdateAccountDto,
  CreateJournalEntryDto,
  CreateFiscalYearDto,
} from './dto/finance.dto';
import { AccountType } from '../../database/entities/chart-of-account.entity';
import { JournalStatus } from '../../database/entities/journal-entry.entity';

const PAYMENT_METHODS_KEY = 'finance_payment_methods';

@ApiTags('Finance & Accounting')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  // ============ DASHBOARD ============
  @Get('dashboard')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get finance dashboard' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getDashboard(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.financeService.getDashboard(facilityId, req.user?.tenantId);
  }

  // ============ CHART OF ACCOUNTS ============
  @Post('accounts')
  @AuthWithPermissions('finance.accounts.create')
  @ApiOperation({ summary: 'Create account' })
  async createAccount(@Body() dto: CreateAccountDto, @Request() req: any) {
    return this.financeService.createAccount(dto, req.user?.tenantId);
  }

  @Get('accounts')
  @AuthWithPermissions('finance.accounts.read')
  @ApiOperation({ summary: 'Get accounts list' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'type', required: false, enum: AccountType })
  @ApiQuery({ name: 'active', required: false })
  async getAccounts(
    @Query('facilityId') facilityId: string,
    @Query('type') type?: AccountType,
    @Query('active') active?: boolean,
    @Request() req?: any,
  ) {
    return this.financeService.getAccounts(facilityId, { type, active }, req?.user?.tenantId);
  }

  @Get('accounts/tree')
  @AuthWithPermissions('finance.accounts.read')
  @ApiOperation({ summary: 'Get accounts as tree' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getAccountTree(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.financeService.getAccountTree(facilityId, req.user?.tenantId);
  }

  @Patch('accounts/:id')
  @AuthWithPermissions('finance.accounts.update')
  @ApiOperation({ summary: 'Update account' })
  async updateAccount(@Param('id') id: string, @Body() dto: UpdateAccountDto, @Request() req: any) {
    return this.financeService.updateAccount(id, dto, req.user?.tenantId);
  }

  @Post('accounts/:id/deactivate')
  @AuthWithPermissions('finance.accounts.delete')
  @ApiOperation({ summary: 'Deactivate account (soft delete)' })
  async deactivateAccount(@Param('id') id: string, @Request() req: any) {
    return this.financeService.deactivateAccount(id, req.user?.tenantId);
  }

  // ============ FISCAL PERIODS ============
  @Post('fiscal-years')
  @AuthWithPermissions('finance.periods.create')
  @ApiOperation({ summary: 'Create fiscal year with 12 periods' })
  async createFiscalYear(@Body() dto: CreateFiscalYearDto, @Request() req: any) {
    return this.financeService.createFiscalYear(dto, req.user?.tenantId);
  }

  @Get('fiscal-periods')
  @AuthWithPermissions('finance.periods.read')
  @ApiOperation({ summary: 'Get fiscal periods' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'year', required: false })
  async getFiscalPeriods(
    @Query('facilityId') facilityId: string,
    @Query('year') year?: number,
    @Request() req?: any,
  ) {
    return this.financeService.getFiscalPeriods(facilityId, year, req?.user?.tenantId);
  }

  @Post('fiscal-periods/:id/close')
  @AuthWithPermissions('finance.periods.close')
  @ApiOperation({ summary: 'Close fiscal period' })
  async closePeriod(@Param('id') id: string, @Request() req: any) {
    return this.financeService.closePeriod(id, req.user.id, req.user?.tenantId);
  }

  // ============ JOURNAL ENTRIES ============
  @Post('journals')
  @AuthWithPermissions('finance.journals.create')
  @ApiOperation({ summary: 'Create journal entry' })
  async createJournalEntry(@Body() dto: CreateJournalEntryDto, @Request() req: any) {
    return this.financeService.createJournalEntry(dto, req.user.id, req.user?.tenantId);
  }

  @Get('journals')
  @AuthWithPermissions('finance.journals.read')
  @ApiOperation({ summary: 'Get journal entries' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'status', required: false, enum: JournalStatus })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getJournalEntries(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: JournalStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: any,
  ) {
    return this.financeService.getJournalEntries(facilityId, { status, startDate, endDate }, req?.user?.tenantId);
  }

  @Get('journals/:id')
  @AuthWithPermissions('finance.journals.read')
  @ApiOperation({ summary: 'Get journal entry by ID' })
  async getJournalEntry(@Param('id') id: string, @Request() req: any) {
    return this.financeService.getJournalEntry(id, req.user?.tenantId);
  }

  @Post('journals/:id/post')
  @AuthWithPermissions('finance.journals.post')
  @ApiOperation({ summary: 'Post journal entry' })
  async postJournalEntry(@Param('id') id: string, @Request() req: any) {
    return this.financeService.postJournalEntry(id, req.user.id, req.user?.tenantId);
  }

  // ============ REPORTS ============
  @Get('reports/trial-balance')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get trial balance' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'asOfDate', required: false })
  async getTrialBalance(
    @Query('facilityId') facilityId: string,
    @Query('asOfDate') asOfDate?: string,
    @Request() req?: any,
  ) {
    return this.financeService.getTrialBalance(facilityId, asOfDate, req?.user?.tenantId);
  }

  @Get('reports/income-statement')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get income statement' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getIncomeStatement(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req?: any,
  ) {
    return this.financeService.getIncomeStatement(facilityId, startDate, endDate, req?.user?.tenantId);
  }

  @Get('reports/balance-sheet')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get balance sheet' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'asOfDate', required: false })
  async getBalanceSheet(
    @Query('facilityId') facilityId: string,
    @Query('asOfDate') asOfDate?: string,
    @Request() req?: any,
  ) {
    return this.financeService.getBalanceSheet(facilityId, asOfDate, req?.user?.tenantId);
  }

  // ============ PAYMENT METHODS ============

  @Get('payment-methods')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'List configurable payment methods' })
  async getPaymentMethods(@Request() req: any) {
    try {
      const setting = await this.settingsService.getByKey(PAYMENT_METHODS_KEY);
      return (setting.value as any[]) ?? [];
    } catch {
      return [];
    }
  }

  @Post('payment-methods')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Add a payment method' })
  async createPaymentMethod(@Body() body: any, @Request() req: any) {
    let methods: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(PAYMENT_METHODS_KEY);
      methods = (setting.value as any[]) ?? [];
    } catch { /* not found — start with empty */ }
    const newMethod = { ...body, id: `pm_${Date.now()}`, isActive: body.isActive ?? true };
    methods.push(newMethod);
    await this.settingsService.upsert(PAYMENT_METHODS_KEY, methods, undefined, 'Configured payment methods');
    return newMethod;
  }

  @Patch('payment-methods/:id/toggle-active')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Toggle payment method active status' })
  async togglePaymentMethod(@Param('id') id: string, @Request() req: any) {
    let methods: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(PAYMENT_METHODS_KEY);
      methods = (setting.value as any[]) ?? [];
    } catch { /* not found — start with empty */ }

    const idx = methods.findIndex((m: any) => m.id === id);
    if (idx === -1) throw new NotFoundException(`Payment method ${id} not found`);
    methods[idx] = { ...methods[idx], isActive: !methods[idx].isActive };
    await this.settingsService.upsert(PAYMENT_METHODS_KEY, methods);
    return methods[idx];
  }
}
