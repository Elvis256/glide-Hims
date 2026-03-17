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
const CURRENCIES_KEY = 'finance_currencies';
const EXCHANGE_RATES_KEY = 'finance_exchange_rates';

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
      const setting = await this.settingsService.getByKey(PAYMENT_METHODS_KEY, req.user?.tenantId);
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
      const setting = await this.settingsService.getByKey(PAYMENT_METHODS_KEY, req.user?.tenantId);
      methods = (setting.value as any[]) ?? [];
    } catch { /* not found — start with empty */ }
    const newMethod = { ...body, id: `pm_${Date.now()}`, isActive: body.isActive ?? true };
    methods.push(newMethod);
    await this.settingsService.upsert(PAYMENT_METHODS_KEY, methods, req.user?.tenantId, 'Configured payment methods');
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
    } catch { /* not found — start with empty */ }

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
    } catch { return []; }
  }

  @Get('currencies/:id')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get currency by ID' })
  async getCurrency(@Param('id') id: string, @Request() req: any) {
    let currencies: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(CURRENCIES_KEY, req.user?.tenantId);
      currencies = (setting.value as any[]) ?? [];
    } catch { /* empty */ }
    const currency = currencies.find((c: any) => c.id === id);
    if (!currency) throw new NotFoundException(`Currency ${id} not found`);
    return currency;
  }

  @Post('currencies')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Create currency' })
  async createCurrency(@Body() dto: any, @Request() req: any) {
    let currencies: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(CURRENCIES_KEY, req.user?.tenantId);
      currencies = (setting.value as any[]) ?? [];
    } catch { /* empty */ }
    const newCurrency = { id: crypto.randomUUID(), ...dto, isActive: true, isDefault: false, createdAt: new Date().toISOString() };
    currencies.push(newCurrency);
    await this.settingsService.upsert(CURRENCIES_KEY, currencies, req.user?.tenantId, 'Configured currencies');
    return newCurrency;
  }

  @Patch('currencies/:id')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Update currency' })
  async updateCurrency(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    let currencies: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(CURRENCIES_KEY, req.user?.tenantId);
      currencies = (setting.value as any[]) ?? [];
    } catch { /* empty */ }
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
    } catch { /* empty */ }
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
    } catch { /* empty */ }
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
    } catch { /* empty */ }
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
    } catch { return []; }
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
    } catch { /* empty */ }
    const rate = rates.find((r: any) =>
      r.fromCurrencyId === from && r.toCurrencyId === to && r.isActive !== false,
    );
    return rate || null;
  }

  @Post('exchange-rates')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Create exchange rate' })
  async createExchangeRate(@Body() dto: any, @Request() req: any) {
    let rates: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(EXCHANGE_RATES_KEY, req.user?.tenantId);
      rates = (setting.value as any[]) ?? [];
    } catch { /* empty */ }
    const newRate = { id: crypto.randomUUID(), ...dto, isActive: true, createdAt: new Date().toISOString() };
    rates.push(newRate);
    await this.settingsService.upsert(EXCHANGE_RATES_KEY, rates, req.user?.tenantId, 'Configured exchange rates');
    return newRate;
  }

  @Patch('exchange-rates/:id')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Update exchange rate' })
  async updateExchangeRate(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    let rates: any[] = [];
    try {
      const setting = await this.settingsService.getByKey(EXCHANGE_RATES_KEY, req.user?.tenantId);
      rates = (setting.value as any[]) ?? [];
    } catch { /* empty */ }
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
    } catch { /* empty */ }
    rates = rates.filter((r: any) => r.id !== id);
    await this.settingsService.upsert(EXCHANGE_RATES_KEY, rates, req.user?.tenantId);
    return { deleted: true };
  }
}
