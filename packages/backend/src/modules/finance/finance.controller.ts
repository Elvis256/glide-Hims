import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { FinanceApprovalService } from './finance-approval.service';
import { TrialBalanceService } from './trial-balance.service';
import { GLReconciliationService } from './gl-reconciliation.service';
import { GLAnalyticsService } from './gl-analytics.service';
import { RevenueExpenseService } from './revenue-expense.service';
import { BudgetVarianceService } from './budget-variance.service';
import { ReportGeneratorService } from './report-generator.service';
import { DataCleanupService } from './data-cleanup.service';
import { DataIntegrityService } from './data-integrity.service';
import { AuditComplianceService } from './audit-compliance.service';
import { PerformanceOptimizationService } from './performance-optimization.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import {
  CreateAccountDto,
  UpdateAccountDto,
  CreateJournalEntryDto,
  CreateFiscalYearDto,
  CreatePaymentMethodDto,
  CreateCurrencyDto,
  UpdateCurrencyDto,
  CreateExchangeRateDto,
  UpdateExchangeRateDto,
  ReverseJournalEntryDto,
} from './dto/finance.dto';
import {
  SubmitJournalEntryForApprovalDto,
  ApproveJournalEntryDto,
  RejectJournalEntryDto,
  PostJournalEntryDto,
} from './dto/finance-approval.dto';
import {
  GetTrialBalanceQueryDto,
  GetReconciliationStatusQueryDto,
  ComparePeriodQueryDto,
  MarkAccountReconciledDto,
} from './dto/trial-balance.dto';
import { GenerateReportDto } from './dto/analytics.dto';
import { AccountType } from '../../database/entities/chart-of-account.entity';
import { JournalStatus } from '../../database/entities/journal-entry.entity';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

const PAYMENT_METHODS_KEY = 'finance_payment_methods';
const CURRENCIES_KEY = 'finance_currencies';
const EXCHANGE_RATES_KEY = 'finance_exchange_rates';

@ApiTags('Finance & Accounting')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('finance')
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly financeApprovalService: FinanceApprovalService,
    private readonly trialBalanceService: TrialBalanceService,
    private readonly glReconciliationService: GLReconciliationService,
    private readonly glAnalyticsService: GLAnalyticsService,
    private readonly revenueExpenseService: RevenueExpenseService,
    private readonly budgetVarianceService: BudgetVarianceService,
    private readonly reportGeneratorService: ReportGeneratorService,
    private readonly dataCleanupService: DataCleanupService,
    private readonly dataIntegrityService: DataIntegrityService,
    private readonly auditComplianceService: AuditComplianceService,
    private readonly performanceOptimizationService: PerformanceOptimizationService,
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

  @Post('fiscal-periods/:id/open')
  @AuthWithPermissions('finance.periods.close')
  @ApiOperation({ summary: 'Re-open a closed fiscal period (not allowed for locked periods)' })
  async openPeriod(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.financeService.openPeriod(id, req.user?.tenantId);
  }

  @Post('fiscal-periods/:id/lock')
  @AuthWithPermissions('finance.periods.lock')
  @ApiOperation({ summary: 'Permanently lock a closed fiscal period' })
  async lockPeriod(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.financeService.lockPeriod(id, req.user.id, req.user?.tenantId);
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
    return this.financeService.getJournalEntries(
      facilityId,
      { status, startDate, endDate },
      req?.user?.tenantId,
    );
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

  @Post('journals/:id/reverse')
  @AuthWithPermissions('finance.journals.reverse')
  @ApiOperation({
    summary: 'Reverse a posted journal entry (creates offsetting entry and auto-posts it)',
  })
  async reverseJournalEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseJournalEntryDto,
    @Request() req: any,
  ) {
    return this.financeService.reverseJournalEntry(id, req.user.id, dto.reason, req.user?.tenantId);
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
    return this.financeService.getIncomeStatement(
      facilityId,
      startDate,
      endDate,
      req?.user?.tenantId,
    );
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
      const setting = await this.settingsService.getByKey(PAYMENT_METHODS_KEY, req.user?.tenantId);
      return (setting.value as any[]) ?? [];
    } catch {
      return [];
    }
  }

  @Post('payment-methods')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Add a payment method' })
  async createPaymentMethod(@Body() body: CreatePaymentMethodDto, @Request() req: any) {
    let methods: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(PAYMENT_METHODS_KEY, req.user?.tenantId);
      methods = (setting.value as any[]) ?? [];
    } catch {
      /* not found — start with empty */
    }
    const newMethod = { ...body, id: `pm_${Date.now()}`, isActive: (body as any).isActive ?? true };
    methods.push(newMethod);
    await this.settingsService.upsert(
      PAYMENT_METHODS_KEY,
      methods,
      req.user?.tenantId,
      'Configured payment methods',
    );
    return newMethod;
  }

  @Patch('payment-methods/:id/toggle-active')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Toggle payment method active status' })
  async togglePaymentMethod(@Param('id') id: string, @Request() req: any) {
    let methods: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(PAYMENT_METHODS_KEY, req.user?.tenantId);
      methods = (setting.value as any[]) ?? [];
    } catch {
      /* not found — start with empty */
    }

    const idx = methods.findIndex((m: any) => m.id === id);
    if (idx === -1) throw new NotFoundException(`Payment method ${id} not found`);
    methods[idx] = { ...methods[idx], isActive: !methods[idx].isActive };
    await this.settingsService.upsert(PAYMENT_METHODS_KEY, methods, req.user?.tenantId);
    return methods[idx];
  }

  // ============ CURRENCIES ============
  @Get('currencies')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'List all currencies' })
  async getCurrencies(@Request() req: any) {
    try {
      const setting = await this.settingsService.getByKey(CURRENCIES_KEY, req.user?.tenantId);
      return (setting.value as any[]) ?? [];
    } catch {
      return [];
    }
  }

  @Get('currencies/:id')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get currency by ID' })
  async getCurrency(@Param('id') id: string, @Request() req: any) {
    let currencies: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(CURRENCIES_KEY, req.user?.tenantId);
      currencies = (setting.value as any[]) ?? [];
    } catch {
      /* empty */
    }
    const currency = currencies.find((c: any) => c.id === id);
    if (!currency) throw new NotFoundException(`Currency ${id} not found`);
    return currency;
  }

  @Post('currencies')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Create currency' })
  async createCurrency(@Body() dto: CreateCurrencyDto, @Request() req: any) {
    let currencies: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(CURRENCIES_KEY, req.user?.tenantId);
      currencies = (setting.value as any[]) ?? [];
    } catch {
      /* empty */
    }
    const newCurrency = {
      id: crypto.randomUUID(),
      ...dto,
      isActive: true,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    currencies.push(newCurrency);
    await this.settingsService.upsert(
      CURRENCIES_KEY,
      currencies,
      req.user?.tenantId,
      'Configured currencies',
    );
    return newCurrency;
  }

  @Patch('currencies/:id')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Update currency' })
  async updateCurrency(
    @Param('id') id: string,
    @Body() dto: UpdateCurrencyDto,
    @Request() req: any,
  ) {
    let currencies: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(CURRENCIES_KEY, req.user?.tenantId);
      currencies = (setting.value as any[]) ?? [];
    } catch {
      /* empty */
    }
    const idx = currencies.findIndex((c: any) => c.id === id);
    if (idx === -1) throw new NotFoundException(`Currency ${id} not found`);
    currencies[idx] = { ...currencies[idx], ...dto };
    await this.settingsService.upsert(CURRENCIES_KEY, currencies, req.user?.tenantId);
    return currencies[idx];
  }

  @Post('currencies/:id/set-default')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Set default currency' })
  async setDefaultCurrency(@Param('id') id: string, @Request() req: any) {
    let currencies: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(CURRENCIES_KEY, req.user?.tenantId);
      currencies = (setting.value as any[]) ?? [];
    } catch {
      /* empty */
    }
    currencies = currencies.map((c: any) => ({ ...c, isDefault: c.id === id }));
    await this.settingsService.upsert(CURRENCIES_KEY, currencies, req.user?.tenantId);
    return currencies.find((c: any) => c.id === id);
  }

  @Patch('currencies/:id/toggle-active')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Toggle currency active status' })
  async toggleCurrency(@Param('id') id: string, @Request() req: any) {
    let currencies: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(CURRENCIES_KEY, req.user?.tenantId);
      currencies = (setting.value as any[]) ?? [];
    } catch {
      /* empty */
    }
    const idx = currencies.findIndex((c: any) => c.id === id);
    if (idx === -1) throw new NotFoundException(`Currency ${id} not found`);
    currencies[idx] = { ...currencies[idx], isActive: !currencies[idx].isActive };
    await this.settingsService.upsert(CURRENCIES_KEY, currencies, req.user?.tenantId);
    return currencies[idx];
  }

  @Delete('currencies/:id')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Delete currency' })
  async deleteCurrency(@Param('id') id: string, @Request() req: any) {
    let currencies: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(CURRENCIES_KEY, req.user?.tenantId);
      currencies = (setting.value as any[]) ?? [];
    } catch {
      /* empty */
    }
    currencies = currencies.filter((c: any) => c.id !== id);
    await this.settingsService.upsert(CURRENCIES_KEY, currencies, req.user?.tenantId);
    return { deleted: true };
  }

  // ============ EXCHANGE RATES ============
  @Get('exchange-rates')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'List all exchange rates' })
  async getExchangeRates(@Request() req: any) {
    try {
      const setting = await this.settingsService.getByKey(EXCHANGE_RATES_KEY, req.user?.tenantId);
      return (setting.value as any[]) ?? [];
    } catch {
      return [];
    }
  }

  @Get('exchange-rates/current')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get current exchange rate between two currencies' })
  async getCurrentExchangeRate(
    @Query('from') from: string,
    @Query('to') to: string,
    @Request() req: any,
  ) {
    let rates: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(EXCHANGE_RATES_KEY, req.user?.tenantId);
      rates = (setting.value as any[]) ?? [];
    } catch {
      /* empty */
    }
    const rate = rates.find(
      (r: any) => r.fromCurrencyId === from && r.toCurrencyId === to && r.isActive !== false,
    );
    return rate || null;
  }

  @Post('exchange-rates')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Create exchange rate' })
  async createExchangeRate(@Body() dto: CreateExchangeRateDto, @Request() req: any) {
    let rates: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(EXCHANGE_RATES_KEY, req.user?.tenantId);
      rates = (setting.value as any[]) ?? [];
    } catch {
      /* empty */
    }
    const newRate = {
      id: crypto.randomUUID(),
      ...dto,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    rates.push(newRate);
    await this.settingsService.upsert(
      EXCHANGE_RATES_KEY,
      rates,
      req.user?.tenantId,
      'Configured exchange rates',
    );
    return newRate;
  }

  @Patch('exchange-rates/:id')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Update exchange rate' })
  async updateExchangeRate(
    @Param('id') id: string,
    @Body() dto: UpdateExchangeRateDto,
    @Request() req: any,
  ) {
    let rates: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(EXCHANGE_RATES_KEY, req.user?.tenantId);
      rates = (setting.value as any[]) ?? [];
    } catch {
      /* empty */
    }
    const idx = rates.findIndex((r: any) => r.id === id);
    if (idx === -1) throw new NotFoundException(`Exchange rate ${id} not found`);
    rates[idx] = { ...rates[idx], ...dto };
    await this.settingsService.upsert(EXCHANGE_RATES_KEY, rates, req.user?.tenantId);
    return rates[idx];
  }

  @Delete('exchange-rates/:id')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Delete exchange rate' })
  async deleteExchangeRate(@Param('id') id: string, @Request() req: any) {
    let rates: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(EXCHANGE_RATES_KEY, req.user?.tenantId);
      rates = (setting.value as any[]) ?? [];
    } catch {
      /* empty */
    }
    rates = rates.filter((r: any) => r.id !== id);
    await this.settingsService.upsert(EXCHANGE_RATES_KEY, rates, req.user?.tenantId);
    return { deleted: true };
  }

  // ============ GL DRILL-DOWN ============
  @Get('accounts/:id/transactions')
  @AuthWithPermissions('finance.accounts.read')
  @ApiOperation({ summary: 'Get account transactions (GL drill-down)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAccountTransactions(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    return this.financeService.getAccountTransactions(
      id,
      { startDate, endDate, page, limit },
      req?.user?.tenantId,
    );
  }

  // ============ AR AGING REPORT ============
  @Get('reports/ar-aging')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get accounts receivable aging report' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getARAgingReport(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.financeService.getARAgingReport(facilityId, req.user?.tenantId);
  }

  // ============ CASH FLOW STATEMENT ============
  @Get('reports/cash-flow')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get cash flow statement' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getCashFlowStatement(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req?: any,
  ) {
    return this.financeService.getCashFlowStatement(
      facilityId,
      startDate,
      endDate,
      req?.user?.tenantId,
    );
  }

  // ============ CLOSING ENTRIES ============
  @Post('fiscal-periods/:id/closing-entries')
  @AuthWithPermissions('finance.periods.close')
  @ApiOperation({ summary: 'Generate closing entries for a fiscal period' })
  @ApiQuery({ name: 'facilityId', required: true })
  async generateClosingEntries(
    @Param('id') periodId: string,
    @Query('facilityId') facilityId: string,
    @Request() req: any,
  ) {
    return this.financeService.generateClosingEntries(
      facilityId,
      periodId,
      req.user.id,
      req.user?.tenantId,
    );
  }

  // ============ STATUTORY REPORTS (Uganda) ============
  @Get('reports/statutory/vat')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'VAT return report (URA format)' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getVATReturn(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req?: any,
  ) {
    return this.financeService.getStatutoryReport(
      'vat',
      facilityId,
      startDate,
      endDate,
      req?.user?.tenantId,
    );
  }

  @Get('reports/statutory/paye')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'PAYE return report' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getPAYEReturn(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req?: any,
  ) {
    return this.financeService.getStatutoryReport(
      'paye',
      facilityId,
      startDate,
      endDate,
      req?.user?.tenantId,
    );
  }

  @Get('reports/statutory/nssf')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'NSSF contribution report' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getNSSFReturn(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req?: any,
  ) {
    return this.financeService.getStatutoryReport(
      'nssf',
      facilityId,
      startDate,
      endDate,
      req?.user?.tenantId,
    );
  }

  // ==================== Finance Approval Workflow (Phase 2A) ====================

  /**
   * Submit journal entry for approval workflow
   * Entry must be in DRAFT status
   * Creates approval chain based on entry amount
   */
  @Put('journal-entries/:id/submit')
  @AuthWithPermissions('finance.journals.submit')
  @ApiOperation({ summary: 'Submit journal entry for approval' })
  async submitForApproval(
    @Param('id', ParseUUIDPipe) journalEntryId: string,
    @Body() dto: SubmitJournalEntryForApprovalDto,
    @Request() req: any,
  ) {
    const approvalChain = await this.financeApprovalService.submitForApproval(
      journalEntryId,
      req.user.id,
      req.user.tenantId,
      req.user.facilityId,
      dto.comments,
    );

    return {
      success: true,
      data: approvalChain,
      message: 'Entry submitted for approval',
    };
  }

  /**
   * Get pending approvals for current user's role
   * Returns all SUBMITTED entries awaiting this user's role approval
   */
  @Get('approvals/pending')
  @AuthWithPermissions('finance.journals.read')
  @ApiOperation({ summary: 'Get pending approvals for user' })
  @ApiQuery({ name: 'role', required: false, description: 'Filter by role (uses user role if not provided)' })
  @ApiQuery({ name: 'facilityId', required: false, description: 'Filter by facility' })
  async getPendingApprovalsForRole(
    @Query('role') role?: string,
    @Query('facilityId') facilityId?: string,
    @Request() req?: any,
  ) {
    const userRole = role || req?.user?.roles?.[0]?.name;
    const userFacilityId = facilityId || req?.user?.facilityId;

    const pending = await this.financeApprovalService.getPendingApprovalsForRole(
      userRole,
      userFacilityId,
      req?.user?.tenantId,
    );

    return {
      success: true,
      data: pending,
      count: pending.length,
    };
  }

  /**
   * Approve journal entry at current approval level
   * If all levels approved, entry becomes APPROVED and ready to post
   */
  @Put('journal-entries/:id/approve')
  @AuthWithPermissions('finance.journals.approve')
  @ApiOperation({ summary: 'Approve journal entry at current level' })
  async approveJournalEntry(
    @Param('id', ParseUUIDPipe) journalEntryId: string,
    @Body() dto: ApproveJournalEntryDto,
    @Request() req: any,
  ) {
    const approval = await this.financeApprovalService.approveAtLevel(
      journalEntryId,
      req.user.id,
      req.user.roles?.[0]?.name,
      req.user.tenantId,
      dto.comments,
    );

    return {
      success: true,
      data: approval,
      message: 'Entry approved',
    };
  }

  /**
   * Reject journal entry
   * Marks all approval levels as rejected and entry returns to DRAFT
   */
  @Put('journal-entries/:id/reject')
  @AuthWithPermissions('finance.journals.approve')
  @ApiOperation({ summary: 'Reject journal entry' })
  async rejectJournalEntry(
    @Param('id', ParseUUIDPipe) journalEntryId: string,
    @Body() dto: RejectJournalEntryDto,
    @Request() req: any,
  ) {
    await this.financeApprovalService.rejectAtLevel(
      journalEntryId,
      req.user.id,
      req.user.roles?.[0]?.name,
      dto.rejectionReason,
      req.user.tenantId,
    );

    return {
      success: true,
      message: 'Entry rejected and returned to draft',
    };
  }

  /**
   * Get approval history for a journal entry
   * Shows full chain of approvals with timestamps and comments
   */
  @Get('journal-entries/:id/approval-history')
  @AuthWithPermissions('finance.journals.read')
  @ApiOperation({ summary: 'Get approval history for entry' })
  async getApprovalHistory(
    @Param('id', ParseUUIDPipe) journalEntryId: string,
  ) {
    const history = await this.financeApprovalService.getApprovalHistory(journalEntryId);

    return {
      success: true,
      data: history,
      count: history.length,
    };
  }

  /**
   * Get escalation candidates (entries pending >5 days)
   * Used for admin notifications and follow-ups
   */
  @Get('approvals/escalations')
  @AuthWithPermissions('finance.journals.read')
  @ApiOperation({ summary: 'Get escalation candidates (pending >5 days)' })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'days', required: false, example: 5 })
  async getEscalationCandidates(
    @Query('facilityId') facilityId?: string,
    @Query('days') days?: string,
    @Request() req?: any,
  ) {
    const userFacilityId = facilityId || req?.user?.facilityId;
    const daysPending = days ? parseInt(days, 10) : 5;

    const escalations = await this.financeApprovalService.getEscalationCandidates(
      userFacilityId,
      daysPending,
    );

    return {
      success: true,
      data: escalations,
      count: escalations.length,
    };
  }

  // ============================================
  // TRIAL BALANCE ENDPOINTS (Phase 2B)
  // ============================================

  @Get('reports/trial-balance-analysis')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get detailed trial balance analysis' })
  @ApiQuery({ name: 'fiscalPeriodId', required: true })
  async getTrialBalanceAnalysis(
    @Query('fiscalPeriodId', new ParseUUIDPipe()) fiscalPeriodId: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const trialBalance = await this.trialBalanceService.getTrialBalance(
      facilityId,
      fiscalPeriodId,
    );

    return {
      success: true,
      data: trialBalance,
    };
  }

  @Get('trial-balance/compare')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Compare trial balance between two periods' })
  @ApiQuery({ name: 'period1Id', required: true })
  @ApiQuery({ name: 'period2Id', required: true })
  async compareTrialBalance(
    @Query('period1Id', new ParseUUIDPipe()) period1Id: string,
    @Query('period2Id', new ParseUUIDPipe()) period2Id: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const comparison = await this.trialBalanceService.comparePeriodsTrialBalance(
      facilityId,
      period1Id,
      period2Id,
    );

    return {
      success: true,
      data: comparison,
    };
  }

  @Get('trial-balance/reconciliation')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get reconciliation status for accounts' })
  @ApiQuery({ name: 'fiscalPeriodId', required: true })
  async getReconciliationStatus(
    @Query('fiscalPeriodId', new ParseUUIDPipe()) fiscalPeriodId: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const reconciliation = await this.trialBalanceService.getReconciliationStatus(
      facilityId,
      fiscalPeriodId,
    );

    return {
      success: true,
      data: reconciliation,
    };
  }

  @Get('trial-balance/variances')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Detect variances in trial balance' })
  @ApiQuery({ name: 'fiscalPeriodId', required: true })
  async detectVariances(
    @Query('fiscalPeriodId', new ParseUUIDPipe()) fiscalPeriodId: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const variances = await this.trialBalanceService.detectVariances(
      facilityId,
      fiscalPeriodId,
    );

    return {
      success: true,
      data: variances,
      count: variances.length,
    };
  }

  @Get('trial-balance/account/:accountId')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get balance for specific account' })
  @ApiQuery({ name: 'fiscalPeriodId', required: true })
  async getAccountBalance(
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Query('fiscalPeriodId', new ParseUUIDPipe()) fiscalPeriodId: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const balance = await this.trialBalanceService.getAccountBalance(
      accountId,
      fiscalPeriodId,
    );

    return {
      success: true,
      data: balance,
    };
  }

  @Put('trial-balance/reconcile/:accountId')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Mark account as reconciled' })
  async markAccountReconciled(
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Body() dto: MarkAccountReconciledDto,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;
    const userId = req?.user?.id;

    await this.glReconciliationService.markAsReconciled(
      accountId,
      dto.fiscalPeriodId,
      userId,
      dto.notes,
    );

    return {
      success: true,
      message: 'Account marked as reconciled',
    };
  }

  @Get('trial-balance/reconciliation-report/:accountId')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get reconciliation report for an account' })
  @ApiQuery({ name: 'fiscalPeriodId', required: true })
  async getReconciliationReport(
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Query('fiscalPeriodId', new ParseUUIDPipe()) fiscalPeriodId: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const report = await this.glReconciliationService.generateReconciliationReport(
      accountId,
      fiscalPeriodId,
      facilityId,
    );

    return {
      success: true,
      data: report,
    };
  }

  // ============ GL ANALYTICS ============

  @Get('analytics/account-trends/:accountId')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get multi-period trend analysis for an account' })
  @ApiQuery({ name: 'startPeriod', required: true, example: '2024-01' })
  @ApiQuery({ name: 'endPeriod', required: true, example: '2024-12' })
  async getAccountTrends(
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Query('startPeriod') startPeriod: string,
    @Query('endPeriod') endPeriod: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const trends = await this.glAnalyticsService.getAccountTrends(
      facilityId,
      accountId,
      startPeriod,
      endPeriod,
    );

    return {
      success: true,
      data: trends,
    };
  }

  @Get('analytics/compare-periods')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Compare GL account balances between two periods' })
  @ApiQuery({ name: 'period1', required: true, example: '2024-01' })
  @ApiQuery({ name: 'period2', required: true, example: '2024-02' })
  async comparePeriodsGL(
    @Query('period1') period1: string,
    @Query('period2') period2: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const comparison = await this.glAnalyticsService.compareAccountsBetweenPeriods(
      facilityId,
      period1,
      period2,
    );

    return {
      success: true,
      data: comparison,
    };
  }

  @Get('analytics/gl-summary/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get aggregated GL data for a period' })
  async getGLSummary(
    @Param('period') period: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const summary = await this.glAnalyticsService.getAggregatedGLData(
      facilityId,
      period,
    );

    return {
      success: true,
      data: summary,
    };
  }

  @Get('analytics/top-accounts/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get top accounts by debit/credit volume' })
  @ApiQuery({ name: 'limit', required: false, example: '10' })
  async getTopAccountsByVolume(
    @Param('period') period: string,
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    const facilityId = req?.user?.facilityId;

    const topAccounts = await this.glAnalyticsService.getTopAccountsByVolume(
      facilityId,
      period,
      limit ? parseInt(limit) : 10,
    );

    return {
      success: true,
      data: topAccounts,
    };
  }

  // ============ REVENUE & EXPENSE ============

  @Get('revenue-expense/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get revenue and expense summary for a period' })
  async getRevenueExpenseSummary(
    @Param('period') period: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const summary = await this.revenueExpenseService.getRevenueExpenseSummary(
      facilityId,
      period,
    );

    return {
      success: true,
      data: summary,
    };
  }

  @Get('revenue-expense/by-cost-center/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get revenue breakdown by cost center' })
  async getRevenueByCC(
    @Param('period') period: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const breakdown = await this.revenueExpenseService.getRevenueByCostCenter(
      facilityId,
      period,
    );

    return {
      success: true,
      data: breakdown,
    };
  }

  @Get('expense/by-cost-center/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get expense breakdown by cost center' })
  async getExpenseByCC(
    @Param('period') period: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const breakdown = await this.revenueExpenseService.getExpenseByCostCenter(
      facilityId,
      period,
    );

    return {
      success: true,
      data: breakdown,
    };
  }

  @Get('revenue-expense/by-account-type/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get revenue/expense analysis by account type' })
  async getRevenueExpenseByAccountType(
    @Param('period') period: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const analysis = await this.revenueExpenseService.getRevenueByAccountType(
      facilityId,
      period,
    );

    return {
      success: true,
      data: analysis,
    };
  }

  @Get('revenue-expense/top-revenue/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get top revenue accounts' })
  @ApiQuery({ name: 'limit', required: false, example: '10' })
  async getTopRevenueAccounts(
    @Param('period') period: string,
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    const facilityId = req?.user?.facilityId;

    const accounts = await this.revenueExpenseService.getTopRevenueAccounts(
      facilityId,
      period,
      limit ? parseInt(limit) : 10,
    );

    return {
      success: true,
      data: accounts,
    };
  }

  @Get('revenue-expense/top-expense/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get top expense accounts' })
  @ApiQuery({ name: 'limit', required: false, example: '10' })
  async getTopExpenseAccounts(
    @Param('period') period: string,
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    const facilityId = req?.user?.facilityId;

    const accounts = await this.revenueExpenseService.getTopExpenseAccounts(
      facilityId,
      period,
      limit ? parseInt(limit) : 10,
    );

    return {
      success: true,
      data: accounts,
    };
  }

  // ============ BUDGET VARIANCE ============

  @Get('budget-variance/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get budget variance summary for a period' })
  async getBudgetVarianceSummary(
    @Param('period') period: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const summary = await this.budgetVarianceService.getBudgetVarianceSummary(
      facilityId,
      period,
    );

    return {
      success: true,
      data: summary,
    };
  }

  @Get('budget-variance/detailed/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get detailed budget variance for each account' })
  async getDetailedVariances(
    @Param('period') period: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const variances = await this.budgetVarianceService.getDetailedVariances(
      facilityId,
      period,
    );

    return {
      success: true,
      data: variances,
    };
  }

  @Get('budget-variance/by-cost-center/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get budget vs actual by cost center' })
  async getBudgetByCC(
    @Param('period') period: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const analysis = await this.budgetVarianceService.getBudgetByCostCenter(
      facilityId,
      period,
    );

    return {
      success: true,
      data: analysis,
    };
  }

  @Get('budget-variance/by-account-type/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get budget variance by account type' })
  async getBudgetVarianceByAccountType(
    @Param('period') period: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const analysis = await this.budgetVarianceService.getBudgetByAccountType(
      facilityId,
      period,
    );

    return {
      success: true,
      data: analysis,
    };
  }

  @Get('budget-variance/over-budget/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get accounts significantly over budget' })
  @ApiQuery({ name: 'threshold', required: false, example: '10' })
  async getOverBudgetAccounts(
    @Param('period') period: string,
    @Request() req: any,
    @Query('threshold') threshold?: string,
  ) {
    const facilityId = req?.user?.facilityId;

    const accounts = await this.budgetVarianceService.getOverBudgetAccounts(
      facilityId,
      period,
      threshold ? parseInt(threshold) : 10,
    );

    return {
      success: true,
      data: accounts,
    };
  }

  @Get('budget-variance/under-budget/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get accounts significantly under budget' })
  @ApiQuery({ name: 'threshold', required: false, example: '10' })
  async getUnderBudgetAccounts(
    @Param('period') period: string,
    @Request() req: any,
    @Query('threshold') threshold?: string,
  ) {
    const facilityId = req?.user?.facilityId;

    const accounts = await this.budgetVarianceService.getUnderBudgetAccounts(
      facilityId,
      period,
      threshold ? parseInt(threshold) : 10,
    );

    return {
      success: true,
      data: accounts,
    };
  }

  @Get('budget-variance/burn-rate/:period')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get budget burn rate for a period' })
  async getBudgetBurnRate(
    @Param('period') period: string,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    const burnRate = await this.budgetVarianceService.getBudgetBurnRate(
      facilityId,
      period,
    );

    return {
      success: true,
      data: burnRate,
    };
  }

  // ============ REPORT GENERATION ============

  @Get('reports/standard')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get list of standard reports' })
  async getStandardReports() {
    const reports = this.reportGeneratorService.getStandardReports();

    return {
      success: true,
      data: reports,
    };
  }

  @Post('reports/generate')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Generate a report (trial balance, income statement, etc.)' })
  async generateReport(
    @Body() dto: GenerateReportDto,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    let report;
    switch (dto.reportType) {
      case 'trial-balance':
        report = await this.reportGeneratorService.generateTrialBalanceReport(
          facilityId,
          dto.period,
        );
        break;
      case 'income-statement':
        report = await this.reportGeneratorService.generateIncomeStatement(
          facilityId,
          dto.period,
        );
        break;
      case 'balance-sheet':
        report = await this.reportGeneratorService.generateBalanceSheet(
          facilityId,
          dto.period,
        );
        break;
      case 'variance':
        report = await this.reportGeneratorService.generateVarianceReport(
          facilityId,
          dto.period,
          dto.budget,
        );
        break;
      default:
        throw new Error(`Unknown report type: ${dto.reportType}`);
    }

    return {
      success: true,
      data: report,
    };
  }

  @Post('reports/export-csv')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Export report to CSV format' })
  async exportReportCSV(
    @Body() dto: GenerateReportDto,
    @Request() req: any,
  ) {
    const facilityId = req?.user?.facilityId;

    let report;
    switch (dto.reportType) {
      case 'trial-balance':
        report = await this.reportGeneratorService.generateTrialBalanceReport(
          facilityId,
          dto.period,
        );
        break;
      case 'income-statement':
        report = await this.reportGeneratorService.generateIncomeStatement(
          facilityId,
          dto.period,
        );
        break;
      case 'balance-sheet':
        report = await this.reportGeneratorService.generateBalanceSheet(
          facilityId,
          dto.period,
        );
        break;
      case 'variance':
        report = await this.reportGeneratorService.generateVarianceReport(
          facilityId,
          dto.period,
          dto.budget,
        );
        break;
      default:
        throw new Error(`Unknown report type: ${dto.reportType}`);
    }

    const csv = await this.reportGeneratorService.exportToCSV(report);

    return {
      success: true,
      data: csv,
      fileName: `${report.reportName}-${new Date().getTime()}.csv`,
    };
  }

  // ============ CLEANUP OPERATIONS (Phase 2D) ============
  @Get('cleanup/report')
  @AuthWithPermissions('finance.admin')
  @ApiOperation({ summary: 'Get cleanup report' })
  async getCleanupReport(@Request() req: any) {
    return {
      success: true,
      data: await this.dataCleanupService.getCleanupReport(req.user?.tenantId),
    };
  }

  @Post('cleanup/execute')
  @AuthWithPermissions('finance.admin')
  @ApiOperation({ summary: 'Execute full cleanup cycle' })
  async executeCleanup(
    @Query('dryRun') dryRun: boolean = true,
    @Request() req: any,
  ) {
    return {
      success: true,
      data: await this.dataCleanupService.executeFullCleanup(req.user?.tenantId, dryRun),
    };
  }

  @Post('cleanup/orphaned')
  @AuthWithPermissions('finance.admin')
  @ApiOperation({ summary: 'Detect and remove orphaned entries' })
  async cleanupOrphaned(
    @Query('dryRun') dryRun: boolean = true,
    @Request() req: any,
  ) {
    return {
      success: true,
      data: await this.dataCleanupService.detectOrphanedEntries(req.user?.tenantId, dryRun),
    };
  }

  @Post('cleanup/duplicates')
  @AuthWithPermissions('finance.admin')
  @ApiOperation({ summary: 'Detect and remove duplicate entries' })
  async cleanupDuplicates(
    @Query('dryRun') dryRun: boolean = true,
    @Request() req: any,
  ) {
    return {
      success: true,
      data: await this.dataCleanupService.detectDuplicateEntries(req.user?.tenantId, dryRun),
    };
  }

  @Get('cleanup/audit-logs')
  @AuthWithPermissions('finance.admin')
  @ApiOperation({ summary: 'Report old audit logs (does NOT delete — audit logs are append-only)' })
  async reportAuditLogs(
    @Query('retentionDays') retentionDays: number = 365,
    @Request() req: any,
  ) {
    return {
      success: true,
      data: await this.dataCleanupService.reportOldAuditLogs(
        req.user?.tenantId,
        retentionDays,
      ),
    };
  }

  // ============ DATA INTEGRITY (Phase 2D) ============
  @Get('integrity/report')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get comprehensive integrity report' })
  async getIntegrityReport(@Request() req: any) {
    return {
      success: true,
      data: await this.dataIntegrityService.getIntegrityReport(req.user?.tenantId),
    };
  }

  @Get('integrity/gl-balance')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Validate GL balance' })
  @ApiQuery({ name: 'periodStart', required: false })
  @ApiQuery({ name: 'periodEnd', required: false })
  async validateGLBalance(
    @Request() req: any,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
  ) {
    const start = periodStart ? new Date(periodStart) : undefined;
    const end = periodEnd ? new Date(periodEnd) : undefined;
    return {
      success: true,
      data: await this.dataIntegrityService.validateGLBalance(req.user?.tenantId, start, end),
    };
  }

  @Get('integrity/unbalanced-accounts')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Detect unbalanced GL accounts' })
  async getUnbalancedAccounts(@Request() req: any) {
    return {
      success: true,
      data: await this.dataIntegrityService.detectUnbalancedAccounts(req.user?.tenantId),
    };
  }

  @Get('integrity/anomalies')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Detect GL anomalies (fraud patterns)' })
  async detectAnomalies(@Request() req: any) {
    return {
      success: true,
      data: await this.dataIntegrityService.detectAnomalies(req.user?.tenantId),
    };
  }

  @Get('integrity/master-data')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Validate account master data' })
  async validateMasterData(@Request() req: any) {
    return {
      success: true,
      data: await this.dataIntegrityService.validateAccountMasterData(req.user?.tenantId),
    };
  }

  @Get('integrity/referential')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Verify referential integrity' })
  async verifyReferentialIntegrity(@Request() req: any) {
    return {
      success: true,
      data: await this.dataIntegrityService.verifyReferentialIntegrity(req.user?.tenantId),
    };
  }

  // ============ COMPLIANCE (Phase 2D) ============
  @Get('compliance/policies')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get compliance policies' })
  async getCompliancePolicies(@Request() req: any): Promise<any> {
    return {
      success: true,
      data: this.auditComplianceService.getCompliancePolicies(),
    };
  }

  @Get('compliance/status/:policyName')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Check compliance status' })
  async checkComplianceStatus(
    @Param('policyName') policyName: string,
    @Request() req: any,
  ) {
    return {
      success: true,
      data: await this.auditComplianceService.checkComplianceStatus(
        policyName,
      ),
    };
  }

  @Get('compliance/audit-trail')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Generate compliance audit trail' })
  @ApiQuery({ name: 'periodDays', required: false })
  async generateComplianceAudit(
    @Query('periodDays') periodDays: number = 90,
    @Request() req: any,
  ) {
    return {
      success: true,
      data: await this.auditComplianceService.generateComplianceAudit(
        periodDays,
      ),
    };
  }

  @Get('compliance/report')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Generate compliance report for auditors' })
  @ApiQuery({ name: 'includePeriodDays', required: false })
  async generateComplianceReport(
    @Query('includePeriodDays') includePeriodDays: number = 90,
    @Request() req: any,
  ) {
    return {
      success: true,
      data: await this.auditComplianceService.generateComplianceReport(
        includePeriodDays,
      ),
    };
  }

  @Post('compliance/archive')
  @AuthWithPermissions('finance.admin')
  @ApiOperation({ summary: 'Archive audit records' })
  @ApiQuery({ name: 'dryRun', required: false })
  @ApiQuery({ name: 'archiveDate', required: false })
  async archiveAuditRecords(
    @Request() req: any,
    @Query('dryRun') dryRun: boolean = true,
    @Query('archiveDate') archiveDate?: string,
  ) {
    const date = archiveDate ? new Date(archiveDate) : new Date();
    return {
      success: true,
      data: await this.auditComplianceService.archiveInactiveRecords(
        date,
        dryRun,
      ),
    };
  }

  @Get('compliance/integrity')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Verify audit trail integrity' })
  async verifyAuditIntegrity() {
    return {
      success: true,
      data: await this.auditComplianceService.verifyAuditIntegrity(),
    };
  }

  // ============ PERFORMANCE (Phase 2D) ============
  @Get('performance/metrics')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get performance metrics' })
  async getPerformanceMetrics() {
    return {
      success: true,
      data: await this.performanceOptimizationService.getPerformanceMetrics(),
    };
  }

  @Get('performance/table-sizes')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Analyze table sizes' })
  async analyzeTableSizes() {
    return {
      success: true,
      data: await this.performanceOptimizationService.analyzeTableSizes(),
    };
  }

  @Get('performance/index-health')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Analyze index health' })
  async analyzeIndexHealth() {
    return {
      success: true,
      data: await this.performanceOptimizationService.analyzeIndexHealth(),
    };
  }

  @Get('performance/fragmentation')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Analyze table fragmentation' })
  async analyzeFragmentation() {
    return {
      success: true,
      data: await this.performanceOptimizationService.analyzeTableFragmentation(),
    };
  }

  @Get('performance/slow-queries')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Identify slow queries' })
  async identifySlowQueries() {
    return {
      success: true,
      data: await this.performanceOptimizationService.identifySlowQueries(),
    };
  }

  @Post('performance/optimize-tables')
  @AuthWithPermissions('finance.admin')
  @ApiOperation({ summary: 'Optimize table statistics' })
  async optimizeTableStatistics(@Request() req: any) {
    return {
      success: true,
      data: await this.performanceOptimizationService.optimizeTableStatistics(),
    };
  }

  @Post('performance/create-indexes')
  @AuthWithPermissions('finance.admin')
  @ApiOperation({ summary: 'Create recommended indexes' })
  @ApiQuery({ name: 'dryRun', required: false })
  async createRecommendedIndexes(
    @Query('dryRun') dryRun: boolean = true,
    @Request() req: any,
  ) {
    return {
      success: true,
      data: await this.performanceOptimizationService.createRecommendedIndexes(
        dryRun,
      ),
    };
  }

  @Get('performance/report')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Generate optimization report' })
  async generateOptimizationReport() {
    return {
      success: true,
      data: await this.performanceOptimizationService.generateOptimizationReport(),
    };
  }
}
