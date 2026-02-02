import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import {
  CreateAccountDto,
  UpdateAccountDto,
  CreateJournalEntryDto,
  CreateFiscalYearDto,
} from './dto/finance.dto';
import { AccountType } from '../../database/entities/chart-of-account.entity';
import { JournalStatus } from '../../database/entities/journal-entry.entity';

@ApiTags('Finance & Accounting')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ============ DASHBOARD ============
  @Get('dashboard')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get finance dashboard' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getDashboard(@Query('facilityId') facilityId: string) {
    return this.financeService.getDashboard(facilityId);
  }

  // ============ CHART OF ACCOUNTS ============
  @Post('accounts')
  @AuthWithPermissions('finance.accounts.create')
  @ApiOperation({ summary: 'Create account' })
  async createAccount(@Body() dto: CreateAccountDto) {
    return this.financeService.createAccount(dto);
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
  ) {
    return this.financeService.getAccounts(facilityId, { type, active });
  }

  @Get('accounts/tree')
  @AuthWithPermissions('finance.accounts.read')
  @ApiOperation({ summary: 'Get accounts as tree' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getAccountTree(@Query('facilityId') facilityId: string) {
    return this.financeService.getAccountTree(facilityId);
  }

  @Patch('accounts/:id')
  @AuthWithPermissions('finance.accounts.update')
  @ApiOperation({ summary: 'Update account' })
  async updateAccount(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.financeService.updateAccount(id, dto);
  }

  @Post('accounts/:id/deactivate')
  @AuthWithPermissions('finance.accounts.delete')
  @ApiOperation({ summary: 'Deactivate account (soft delete)' })
  async deactivateAccount(@Param('id') id: string) {
    return this.financeService.deactivateAccount(id);
  }

  // ============ FISCAL PERIODS ============
  @Post('fiscal-years')
  @AuthWithPermissions('finance.periods.create')
  @ApiOperation({ summary: 'Create fiscal year with 12 periods' })
  async createFiscalYear(@Body() dto: CreateFiscalYearDto) {
    return this.financeService.createFiscalYear(dto);
  }

  @Get('fiscal-periods')
  @AuthWithPermissions('finance.periods.read')
  @ApiOperation({ summary: 'Get fiscal periods' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'year', required: false })
  async getFiscalPeriods(
    @Query('facilityId') facilityId: string,
    @Query('year') year?: number,
  ) {
    return this.financeService.getFiscalPeriods(facilityId, year);
  }

  @Post('fiscal-periods/:id/close')
  @AuthWithPermissions('finance.periods.close')
  @ApiOperation({ summary: 'Close fiscal period' })
  async closePeriod(@Param('id') id: string, @Request() req: any) {
    return this.financeService.closePeriod(id, req.user.id);
  }

  // ============ JOURNAL ENTRIES ============
  @Post('journals')
  @AuthWithPermissions('finance.journals.create')
  @ApiOperation({ summary: 'Create journal entry' })
  async createJournalEntry(@Body() dto: CreateJournalEntryDto, @Request() req: any) {
    return this.financeService.createJournalEntry(dto, req.user.id);
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
  ) {
    return this.financeService.getJournalEntries(facilityId, { status, startDate, endDate });
  }

  @Get('journals/:id')
  @AuthWithPermissions('finance.journals.read')
  @ApiOperation({ summary: 'Get journal entry by ID' })
  async getJournalEntry(@Param('id') id: string) {
    return this.financeService.getJournalEntry(id);
  }

  @Post('journals/:id/post')
  @AuthWithPermissions('finance.journals.post')
  @ApiOperation({ summary: 'Post journal entry' })
  async postJournalEntry(@Param('id') id: string, @Request() req: any) {
    return this.financeService.postJournalEntry(id, req.user.id);
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
  ) {
    return this.financeService.getTrialBalance(facilityId, asOfDate);
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
  ) {
    return this.financeService.getIncomeStatement(facilityId, startDate, endDate);
  }

  @Get('reports/balance-sheet')
  @AuthWithPermissions('finance.reports.read')
  @ApiOperation({ summary: 'Get balance sheet' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'asOfDate', required: false })
  async getBalanceSheet(
    @Query('facilityId') facilityId: string,
    @Query('asOfDate') asOfDate?: string,
  ) {
    return this.financeService.getBalanceSheet(facilityId, asOfDate);
  }
}
