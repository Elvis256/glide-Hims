import { Injectable, Inject, forwardRef, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, TreeRepository, DataSource } from 'typeorm';
import { ChartOfAccount, AccountType, AccountCategory } from '../../database/entities/chart-of-account.entity';
import { JournalEntry, JournalStatus, JournalType } from '../../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { FiscalPeriod, PeriodStatus } from '../../database/entities/fiscal-period.entity';
import {
  CreateAccountDto,
  UpdateAccountDto,
  CreateJournalEntryDto,
  CreateFiscalYearDto,
} from './dto/finance.dto';
import { InvoiceStatus } from '../../database/entities/invoice.entity';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    @InjectRepository(ChartOfAccount)
    private accountRepo: TreeRepository<ChartOfAccount>,
    @InjectRepository(JournalEntry)
    private journalRepo: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine)
    private journalLineRepo: Repository<JournalEntryLine>,
    @InjectRepository(FiscalPeriod)
    private fiscalPeriodRepo: Repository<FiscalPeriod>,
    private dataSource: DataSource,
  ) {}

  // ============ CHART OF ACCOUNTS ============

  async createAccount(dto: CreateAccountDto, tenantId?: string): Promise<ChartOfAccount> {
    const existing = await this.accountRepo.findOne({
      where: { facilityId: dto.facilityId, accountCode: dto.accountCode, ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) {
      throw new BadRequestException(`Account code ${dto.accountCode} already exists`);
    }

    const account = this.accountRepo.create({
      facilityId: dto.facilityId,
      accountCode: dto.accountCode,
      accountName: dto.accountName,
      accountType: dto.accountType,
      accountCategory: dto.accountCategory,
      description: dto.description,
      isHeader: dto.isHeader || false,
      ...(tenantId ? { tenantId } : {}),
    });

    if (dto.parentId) {
      const parent = await this.accountRepo.findOne({ where: { id: dto.parentId, ...(tenantId ? { tenantId } : {}) } });
      if (parent) account.parent = parent;
    }

    return this.accountRepo.save(account);
  }

  async getAccounts(facilityId: string, options: { type?: AccountType; active?: boolean }, tenantId?: string) {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;
    if (options.type) where.accountType = options.type;
    if (options.active !== undefined) where.isActive = options.active;

    return this.accountRepo.find({
      where,
      order: { accountCode: 'ASC' },
    });
  }

  async getAccountTree(facilityId: string, tenantId?: string): Promise<ChartOfAccount[]> {
    const roots = await this.accountRepo.find({
      where: { facilityId, parent: null as any, ...(tenantId ? { tenantId } : {}) },
      order: { accountCode: 'ASC' },
    });

    const result: ChartOfAccount[] = [];
    for (const root of roots) {
      const tree = await this.accountRepo.findDescendantsTree(root);
      result.push(tree);
    }
    return result;
  }

  async updateAccount(id: string, dto: UpdateAccountDto, tenantId?: string): Promise<ChartOfAccount> {
    const account = await this.accountRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!account) throw new NotFoundException('Account not found');

    Object.assign(account, dto);
    return this.accountRepo.save(account);
  }

  async deactivateAccount(id: string, tenantId?: string): Promise<ChartOfAccount> {
    const account = await this.accountRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!account) throw new NotFoundException('Account not found');

    // Check for children
    const children = await this.accountRepo.findDescendants(account);
    if (children.length > 1) {
      throw new BadRequestException('Cannot deactivate account with sub-accounts');
    }

    // Check for journal entries
    const hasEntries = await this.journalLineRepo.count({ where: { accountId: id, ...(tenantId ? { tenantId } : {}) } });
    if (hasEntries > 0) {
      // Soft delete - just deactivate
      account.isActive = false;
      return this.accountRepo.save(account);
    }

    // Hard delete if no entries
    await this.accountRepo.remove(account);
    return account;
  }

  // ============ FISCAL PERIODS ============

  async createFiscalYear(dto: CreateFiscalYearDto, tenantId?: string): Promise<FiscalPeriod[]> {
    const existing = await this.fiscalPeriodRepo.findOne({
      where: { facilityId: dto.facilityId, fiscalYear: dto.year, ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) {
      throw new BadRequestException(`Fiscal year ${dto.year} already exists`);
    }

    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const periods: FiscalPeriod[] = [];
    for (let i = 0; i < 12; i++) {
      const startDate = new Date(dto.year, i, 1);
      const endDate = new Date(dto.year, i + 1, 0);

      const period = this.fiscalPeriodRepo.create({
        facilityId: dto.facilityId,
        fiscalYear: dto.year,
        period: i + 1,
        periodName: `${months[i]} ${dto.year}`,
        startDate,
        endDate,
        status: PeriodStatus.OPEN,
        ...(tenantId ? { tenantId } : {}),
      });
      periods.push(await this.fiscalPeriodRepo.save(period));
    }

    return periods;
  }

  async getFiscalPeriods(facilityId: string, year?: number, tenantId?: string) {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;
    if (year) where.fiscalYear = year;

    return this.fiscalPeriodRepo.find({
      where,
      order: { fiscalYear: 'DESC', period: 'ASC' },
    });
  }

  async closePeriod(id: string, userId: string, tenantId?: string): Promise<FiscalPeriod> {
    const period = await this.fiscalPeriodRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!period) throw new NotFoundException('Fiscal period not found');

    if (period.status !== PeriodStatus.OPEN) {
      throw new BadRequestException('Period is already closed');
    }

    period.status = PeriodStatus.CLOSED;
    period.closedById = userId;
    period.closedAt = new Date();

    return this.fiscalPeriodRepo.save(period);
  }

  // ============ JOURNAL ENTRIES ============

  private async generateJournalNumber(facilityId: string, tenantId?: string): Promise<string> {
    const count = await this.journalRepo.count({ where: { facilityId, ...(tenantId ? { tenantId } : {}) } });
    const date = new Date();
    return `JE${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
  }

  private async getFiscalPeriodForDate(facilityId: string, date: Date, tenantId?: string): Promise<FiscalPeriod> {
    const period = await this.fiscalPeriodRepo.findOne({
      where: {
        facilityId,
        startDate: LessThanOrEqual(date),
        endDate: MoreThanOrEqual(date),
        ...(tenantId ? { tenantId } : {}),
      },
    });

    if (!period) {
      throw new BadRequestException(`No fiscal period found for date ${date.toISOString().slice(0, 10)}`);
    }

    if (period.status !== PeriodStatus.OPEN) {
      throw new BadRequestException(`Fiscal period ${period.periodName} is closed`);
    }

    return period;
  }

  async createJournalEntry(dto: CreateJournalEntryDto, userId: string, tenantId?: string): Promise<JournalEntry> {
    // Validate debit = credit
    const totalDebit = dto.lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = dto.lines.reduce((sum, l) => sum + Number(l.credit), 0);

    // Use exact zero check — tolerance of 0.01 is too loose for financial data
    if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
      throw new BadRequestException(`Journal entry must balance. Debit: ${totalDebit}, Credit: ${totalCredit}`);
    }

    if (dto.lines.length < 2) {
      throw new BadRequestException('Journal entry must have at least 2 lines');
    }

    const journalDate = new Date(dto.journalDate);
    
    // Get or create fiscal period
    let fiscalPeriod: FiscalPeriod;
    try {
      fiscalPeriod = await this.getFiscalPeriodForDate(dto.facilityId, journalDate);
    } catch {
      // Create the fiscal year if it doesn't exist
      const year = journalDate.getFullYear();
      await this.createFiscalYear({ facilityId: dto.facilityId, year }, tenantId);
      fiscalPeriod = await this.getFiscalPeriodForDate(dto.facilityId, journalDate);
    }

    const journalNumber = await this.generateJournalNumber(dto.facilityId, tenantId);

    const journal = this.journalRepo.create({
      journalNumber,
      facilityId: dto.facilityId,
      journalDate,
      fiscalPeriodId: fiscalPeriod.id,
      journalType: dto.journalType || JournalType.GENERAL,
      description: dto.description,
      reference: dto.reference,
      totalDebit,
      totalCredit,
      status: JournalStatus.DRAFT,
      createdById: userId,
      ...(tenantId ? { tenantId } : {}),
    });

    const savedJournal = await this.journalRepo.save(journal);

    // Create lines
    for (let i = 0; i < dto.lines.length; i++) {
      const lineDto = dto.lines[i];
      const line = this.journalLineRepo.create({
        journalEntryId: savedJournal.id,
        accountId: lineDto.accountId,
        description: lineDto.description,
        debit: lineDto.debit,
        credit: lineDto.credit,
        lineNumber: i + 1,
      });
      await this.journalLineRepo.save(line);
    }

    return this.getJournalEntry(savedJournal.id, tenantId);
  }

  async getJournalEntry(id: string, tenantId?: string): Promise<JournalEntry> {
    const journal = await this.journalRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: ['lines', 'lines.account', 'fiscalPeriod', 'createdBy'],
    });
    if (!journal) throw new NotFoundException('Journal entry not found');
    return journal;
  }

  async getJournalEntries(facilityId: string, options: { status?: JournalStatus; startDate?: string; endDate?: string }, tenantId?: string) {
    const qb = this.journalRepo.createQueryBuilder('je')
      .leftJoinAndSelect('je.createdBy', 'createdBy')
      .where('je.facilityId = :facilityId', { facilityId });

    if (options.status) {
      qb.andWhere('je.status = :status', { status: options.status });
    }
    if (options.startDate && options.endDate) {
      qb.andWhere('je.journalDate BETWEEN :start AND :end', {
        start: new Date(options.startDate),
        end: new Date(options.endDate),
      });
    }

    if (tenantId) {
      qb.andWhere('je.tenant_id = :tenantId', { tenantId });
    }
    return qb.orderBy('je.journalDate', 'DESC').addOrderBy('je.journalNumber', 'DESC').getMany();
  }

  async postJournalEntry(id: string, userId: string, tenantId?: string): Promise<JournalEntry> {
    return this.dataSource.transaction(async (manager) => {
      // Lock the journal entry to prevent double-posting
      const journal = await manager.findOne(JournalEntry, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        relations: ['lines', 'lines.account', 'fiscalPeriod', 'createdBy'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!journal) throw new NotFoundException('Journal entry not found');

      if (journal.status !== JournalStatus.DRAFT) {
        throw new BadRequestException('Only draft entries can be posted');
      }

      // Maker-checker: creator cannot post their own journal entry
      if (journal.createdById === userId) {
        throw new BadRequestException('Segregation of duties violation: the journal creator cannot post their own entry. A different user must approve and post.');
      }

      // Fiscal period must be open for posting
      if (journal.fiscalPeriodId) {
        const period = await manager.findOne(FiscalPeriod, {
          where: { id: journal.fiscalPeriodId, ...(tenantId ? { tenantId } : {}) },
        });
        if (period && period.status !== PeriodStatus.OPEN) {
          throw new BadRequestException(`Cannot post to ${period.status} fiscal period: ${period.periodName}`);
        }
      }

      // Update account balances with pessimistic locking
      for (const line of journal.lines) {
        const account = await manager.findOne(ChartOfAccount, {
          where: { id: line.accountId, ...(tenantId ? { tenantId } : {}) },
          lock: { mode: 'pessimistic_write' },
        });
        if (!account) continue;

        // Assets & Expenses: Debit increases, Credit decreases
        // Liabilities, Equity, Revenue: Credit increases, Debit decreases
        let adjustment = 0;
        if ([AccountType.ASSET, AccountType.EXPENSE].includes(account.accountType)) {
          adjustment = Number(line.debit) - Number(line.credit);
        } else {
          adjustment = Number(line.credit) - Number(line.debit);
        }

        account.currentBalance = Number(account.currentBalance) + adjustment;
        await manager.save(ChartOfAccount, account);
      }

      journal.status = JournalStatus.POSTED;
      journal.postedById = userId;
      journal.postedAt = new Date();

      return manager.save(JournalEntry, journal);
    });
  }

  // ============ REPORTS ============

  async getTrialBalance(facilityId: string, asOfDate?: string, tenantId?: string) {
    const accounts = await this.accountRepo.find({
      where: { facilityId, isActive: true, isHeader: false, ...(tenantId ? { tenantId } : {}) },
      order: { accountCode: 'ASC' },
    });

    let totalDebit = 0;
    let totalCredit = 0;

    const data = accounts.map(acc => {
      const balance = Number(acc.currentBalance);
      let debit = 0;
      let credit = 0;

      if ([AccountType.ASSET, AccountType.EXPENSE].includes(acc.accountType)) {
        if (balance >= 0) debit = balance;
        else credit = Math.abs(balance);
      } else {
        if (balance >= 0) credit = balance;
        else debit = Math.abs(balance);
      }

      totalDebit += debit;
      totalCredit += credit;

      return {
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        debit,
        credit,
      };
    }).filter(a => a.debit > 0 || a.credit > 0);

    return {
      asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
      accounts: data,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  }

  async getIncomeStatement(facilityId: string, startDate: string, endDate: string, tenantId?: string) {
    const accounts = await this.accountRepo.find({
      where: { facilityId, isActive: true, ...(tenantId ? { tenantId } : {}) },
      order: { accountCode: 'ASC' },
    });

    const revenueAccounts = accounts.filter(a => a.accountType === AccountType.REVENUE);
    const expenseAccounts = accounts.filter(a => a.accountType === AccountType.EXPENSE);

    const totalRevenue = revenueAccounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    const totalExpenses = expenseAccounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    const netIncome = totalRevenue - totalExpenses;

    return {
      period: { startDate, endDate },
      revenue: revenueAccounts.map(a => ({
        accountCode: a.accountCode,
        accountName: a.accountName,
        amount: Number(a.currentBalance),
      })),
      expenses: expenseAccounts.map(a => ({
        accountCode: a.accountCode,
        accountName: a.accountName,
        amount: Number(a.currentBalance),
      })),
      totalRevenue,
      totalExpenses,
      netIncome,
    };
  }

  async getBalanceSheet(facilityId: string, asOfDate?: string, tenantId?: string) {
    const accounts = await this.accountRepo.find({
      where: { facilityId, isActive: true, ...(tenantId ? { tenantId } : {}) },
      order: { accountCode: 'ASC' },
    });

    const assets = accounts.filter(a => a.accountType === AccountType.ASSET);
    const liabilities = accounts.filter(a => a.accountType === AccountType.LIABILITY);
    const equity = accounts.filter(a => a.accountType === AccountType.EQUITY);

    const totalAssets = assets.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    const totalEquity = equity.reduce((sum, a) => sum + Number(a.currentBalance), 0);

    return {
      asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
      assets: assets.map(a => ({
        accountCode: a.accountCode,
        accountName: a.accountName,
        balance: Number(a.currentBalance),
      })),
      liabilities: liabilities.map(a => ({
        accountCode: a.accountCode,
        accountName: a.accountName,
        balance: Number(a.currentBalance),
      })),
      equity: equity.map(a => ({
        accountCode: a.accountCode,
        accountName: a.accountName,
        balance: Number(a.currentBalance),
      })),
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };
  }

  // ============ DASHBOARD ============

  async getDashboard(facilityId: string, tenantId?: string) {
    const [
      totalAccounts,
      draftJournals,
      postedJournals,
      openPeriods,
    ] = await Promise.all([
      this.accountRepo.count({ where: { facilityId, isActive: true, ...(tenantId ? { tenantId } : {}) } }),
      this.journalRepo.count({ where: { facilityId, status: JournalStatus.DRAFT, ...(tenantId ? { tenantId } : {}) } }),
      this.journalRepo.count({ where: { facilityId, status: JournalStatus.POSTED, ...(tenantId ? { tenantId } : {}) } }),
      this.fiscalPeriodRepo.count({ where: { facilityId, status: PeriodStatus.OPEN, ...(tenantId ? { tenantId } : {}) } }),
    ]);

    const trialBalance = await this.getTrialBalance(facilityId, undefined, tenantId);

    return {
      totalAccounts,
      draftJournals,
      postedJournals,
      openPeriods,
      trialBalanced: trialBalance.isBalanced,
      totalDebit: trialBalance.totalDebit,
      totalCredit: trialBalance.totalCredit,
    };
  }

  // ============ AUTO-JOURNAL HELPERS ============

  /** Find first active account with a given category. Returns null if none configured. */
  async findAccountByCategory(facilityId: string, category: AccountCategory, tenantId?: string): Promise<ChartOfAccount | null> {
    return this.accountRepo.findOne({ where: { facilityId, accountCategory: category, isActive: true, ...(tenantId ? { tenantId } : {}) } });
  }

  /**
   * Auto-post a journal entry when a GRN is posted to inventory.
   * Dr Inventory (ASSET/INVENTORY) — Cr Accounts Payable (LIABILITY/PAYABLES)
   * Silently skipped if either account is not configured.
   */
  async autoPostGRNJournal(params: {
    facilityId: string;
    grnNumber: string;
    totalValue: number;
    supplierId: string;
    userId: string;
  }, tenantId?: string): Promise<void> {
    try {
      const [inventoryAcc, apAcc] = await Promise.all([
        this.findAccountByCategory(params.facilityId, AccountCategory.INVENTORY, tenantId),
        this.findAccountByCategory(params.facilityId, AccountCategory.PAYABLES, tenantId),
      ]);
      if (!inventoryAcc || !apAcc) {
        this.logger.debug(`Auto GRN journal skipped – accounts not configured for facility ${params.facilityId}`);
        return;
      }
      const journal = await this.createJournalEntry({
        facilityId: params.facilityId,
        journalDate: new Date().toISOString(),
        journalType: JournalType.GENERAL,
        description: `Goods Receipt – ${params.grnNumber}`,
        reference: params.grnNumber,
        lines: [
          { accountId: inventoryAcc.id, description: `Inventory – ${params.grnNumber}`, debit: params.totalValue, credit: 0 },
          { accountId: apAcc.id, description: `AP – ${params.grnNumber}`, debit: 0, credit: params.totalValue },
        ],
      }, params.userId, tenantId);
      await this.postJournalEntry(journal.id, params.userId, tenantId);
      this.logger.log(`Auto GRN journal posted: ${journal.journalNumber} for GRN ${params.grnNumber}`);
    } catch (err) {
      this.logger.error(`Auto GRN journal failed for ${params.grnNumber}: ${err.message}`);
      if (err instanceof BadRequestException) {
        throw err;
      }
    }
  }

  /**
   * Auto-post a journal entry when a supplier payment is processed.
   * Dr Accounts Payable (LIABILITY/PAYABLES) — Cr Cash/Bank (ASSET/CASH)
   * Silently skipped if either account is not configured.
   */
  async autoPostPaymentJournal(params: {
    facilityId: string;
    paymentReference: string;
    amount: number;
    userId: string;
  }, tenantId?: string): Promise<void> {
    try {
      const [apAcc, cashAcc] = await Promise.all([
        this.findAccountByCategory(params.facilityId, AccountCategory.PAYABLES, tenantId),
        this.findAccountByCategory(params.facilityId, AccountCategory.CASH, tenantId),
      ]);
      if (!apAcc || !cashAcc) {
        this.logger.debug(`Auto payment journal skipped – accounts not configured for facility ${params.facilityId}`);
        return;
      }
      const journal = await this.createJournalEntry({
        facilityId: params.facilityId,
        journalDate: new Date().toISOString(),
        journalType: JournalType.PAYMENT,
        description: `Supplier Payment – ${params.paymentReference}`,
        reference: params.paymentReference,
        lines: [
          { accountId: apAcc.id, description: `AP – ${params.paymentReference}`, debit: params.amount, credit: 0 },
          { accountId: cashAcc.id, description: `Cash – ${params.paymentReference}`, debit: 0, credit: params.amount },
        ],
      }, params.userId, tenantId);
      await this.postJournalEntry(journal.id, params.userId, tenantId);
      this.logger.log(`Auto payment journal posted: ${journal.journalNumber} for ${params.paymentReference}`);
    } catch (err) {
      this.logger.error(`Auto payment journal failed for ${params.paymentReference}: ${err.message}`);
      if (err instanceof BadRequestException) {
        throw err;
      }
    }
  }

  // Auto-post when patient invoice is created: DR Accounts Receivable, CR Revenue
  async autoPostInvoiceJournal(params: {
    facilityId: string;
    invoiceNumber: string;
    totalAmount: number;
    revenueCategory?: string; // e.g., 'consultation', 'lab', 'pharmacy'
    userId: string;
  }, tenantId?: string): Promise<void> {
    try {
      const arAcc = await this.findAccountByCategory(params.facilityId, AccountCategory.RECEIVABLES, tenantId)
        || await this.accountRepo.findOne({ where: { facilityId: params.facilityId, accountCode: '1200', isActive: true, ...(tenantId ? { tenantId } : {}) } });
      const revenueAcc = await this.findAccountByCategory(params.facilityId, AccountCategory.SERVICE_REVENUE, tenantId)
        || await this.accountRepo.findOne({ where: { facilityId: params.facilityId, accountCode: '4100', isActive: true, ...(tenantId ? { tenantId } : {}) } });
      if (!arAcc || !revenueAcc) {
        this.logger.debug(`Auto invoice journal skipped – AR or Revenue account not configured for facility ${params.facilityId}`);
        return;
      }
      const journal = await this.createJournalEntry({
        facilityId: params.facilityId,
        journalDate: new Date().toISOString(),
        journalType: JournalType.GENERAL,
        description: `Patient Invoice – ${params.invoiceNumber}`,
        reference: params.invoiceNumber,
        lines: [
          { accountId: arAcc.id, description: `AR – ${params.invoiceNumber}`, debit: params.totalAmount, credit: 0 },
          { accountId: revenueAcc.id, description: `Revenue – ${params.invoiceNumber}`, debit: 0, credit: params.totalAmount },
        ],
      }, params.userId, tenantId);
      await this.postJournalEntry(journal.id, params.userId, tenantId);
      this.logger.log(`Auto invoice journal posted: ${journal.journalNumber} for ${params.invoiceNumber}`);
    } catch (err) {
      this.logger.error(`Auto invoice journal failed for ${params.invoiceNumber}: ${err.message}`);
      if (err instanceof BadRequestException) {
        throw err;
      }
    }
  }

  // Auto-post when patient payment received: DR Cash/Bank, CR Accounts Receivable
  async autoPostPatientPaymentJournal(params: {
    facilityId: string;
    receiptNumber: string;
    amount: number;
    paymentMethod: string; // 'cash', 'card', 'mobile_money', 'bank_transfer'
    userId: string;
  }, tenantId?: string): Promise<void> {
    try {
      const arAcc = await this.findAccountByCategory(params.facilityId, AccountCategory.RECEIVABLES, tenantId)
        || await this.accountRepo.findOne({ where: { facilityId: params.facilityId, accountCode: '1200', isActive: true, ...(tenantId ? { tenantId } : {}) } });
      // Map payment method to cash/bank account
      const methodAccountMap: Record<string, string> = {
        cash: '1101', card: '1112', mobile_money: '1111', bank_transfer: '1110',
        cheque: '1110', insurance: '1201', corporate: '1202',
      };
      const cashCode = methodAccountMap[params.paymentMethod] || '1101';
      const cashAcc = await this.accountRepo.findOne({
        where: { facilityId: params.facilityId, accountCode: cashCode, isActive: true, ...(tenantId ? { tenantId } : {}) },
      });
      if (!arAcc || !cashAcc) {
        this.logger.debug(`Auto patient payment journal skipped – accounts not configured`);
        return;
      }
      const journal = await this.createJournalEntry({
        facilityId: params.facilityId,
        journalDate: new Date().toISOString(),
        journalType: JournalType.PAYMENT,
        description: `Patient Payment – ${params.receiptNumber}`,
        reference: params.receiptNumber,
        lines: [
          { accountId: cashAcc.id, description: `Cash/Bank – ${params.receiptNumber}`, debit: params.amount, credit: 0 },
          { accountId: arAcc.id, description: `AR – ${params.receiptNumber}`, debit: 0, credit: params.amount },
        ],
      }, params.userId, tenantId);
      await this.postJournalEntry(journal.id, params.userId, tenantId);
      this.logger.log(`Auto patient payment journal posted: ${journal.journalNumber} for ${params.receiptNumber}`);
    } catch (err) {
      this.logger.error(`Auto patient payment journal failed for ${params.receiptNumber}: ${err.message}`);
      if (err instanceof BadRequestException) {
        throw err;
      }
    }
  }

  // Generate closing entries when period closes: zero out Revenue/Expense into Retained Earnings
  async generateClosingEntries(facilityId: string, periodId: string, userId: string, tenantId?: string): Promise<JournalEntry | null> {
    try {
      const period = await this.fiscalPeriodRepo.findOne({ where: { id: periodId, ...(tenantId ? { tenantId } : {}) } });
      if (!period) throw new NotFoundException('Fiscal period not found');

      // Get all revenue and expense accounts with non-zero balances
      const accounts = await this.accountRepo.find({
        where: { facilityId, isActive: true, isHeader: false, ...(tenantId ? { tenantId } : {}) },
      });

      const retainedEarnings = accounts.find(a => a.accountCode === '3002');
      if (!retainedEarnings) {
        this.logger.warn('Retained Earnings account (3002) not found – closing entries skipped');
        return null;
      }

      const lines: { accountId: string; description: string; debit: number; credit: number }[] = [];
      let netIncome = 0;

      for (const acc of accounts) {
        const balance = Number(acc.currentBalance);
        if (balance === 0) continue;

        if (acc.accountType === AccountType.REVENUE && balance > 0) {
          // Close revenue: DR Revenue, CR Retained Earnings
          lines.push({ accountId: acc.id, description: `Close ${acc.accountName}`, debit: balance, credit: 0 });
          netIncome += balance;
        } else if (acc.accountType === AccountType.EXPENSE && balance > 0) {
          // Close expense: CR Expense, DR Retained Earnings
          lines.push({ accountId: acc.id, description: `Close ${acc.accountName}`, debit: 0, credit: balance });
          netIncome -= balance;
        }
      }

      if (lines.length === 0) {
        this.logger.log('No revenue/expense balances to close');
        return null;
      }

      // Add the Retained Earnings balancing entry
      if (netIncome >= 0) {
        lines.push({ accountId: retainedEarnings.id, description: 'Net Income to Retained Earnings', debit: 0, credit: netIncome });
      } else {
        lines.push({ accountId: retainedEarnings.id, description: 'Net Loss to Retained Earnings', debit: Math.abs(netIncome), credit: 0 });
      }

      const journal = await this.createJournalEntry({
        facilityId,
        journalDate: period.endDate.toISOString ? period.endDate.toISOString() : String(period.endDate),
        journalType: JournalType.CLOSING,
        description: `Closing Entries – ${period.periodName}`,
        reference: `CLOSE-${period.periodName.replace(/\s/g, '-')}`,
        lines,
      }, userId, tenantId);

      await this.postJournalEntry(journal.id, userId, tenantId);
      this.logger.log(`Closing entries posted for ${period.periodName}: Net Income = ${netIncome}`);
      return journal;
    } catch (err) {
      this.logger.warn(`Closing entries failed: ${err.message}`);
      return null;
    }
  }

  async getAccountTransactions(
    accountId: string,
    options: { startDate?: string; endDate?: string; page?: number; limit?: number },
    tenantId?: string,
  ) {
    const qb = this.journalLineRepo.createQueryBuilder('jl')
      .innerJoinAndSelect('jl.journalEntry', 'je')
      .where('jl.account_id = :accountId', { accountId })
      .andWhere('je.status = :status', { status: JournalStatus.POSTED });

    if (tenantId) qb.andWhere('jl.tenant_id = :tenantId', { tenantId });
    if (options.startDate) qb.andWhere('je.journal_date >= :startDate', { startDate: options.startDate });
    if (options.endDate) qb.andWhere('je.journal_date <= :endDate', { endDate: options.endDate });

    const page = options.page || 1;
    const limit = options.limit || 50;
    qb.orderBy('je.journal_date', 'DESC').addOrderBy('jl.line_number', 'ASC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    let runningBalance = 0;
    const transactions = data.map(line => {
      runningBalance += Number(line.debit) - Number(line.credit);
      return {
        id: line.id,
        date: line.journalEntry.journalDate,
        journalNumber: line.journalEntry.journalNumber,
        description: line.description || line.journalEntry.description,
        reference: line.journalEntry.reference,
        debit: Number(line.debit),
        credit: Number(line.credit),
        runningBalance,
      };
    });

    return { data: transactions, total, page, limit };
  }

  async getARAgingReport(facilityId: string, tenantId?: string) {
    // Use DataSource to run raw query for aging buckets
    const query = `
      SELECT 
        i.customer_type,
        i.customer_name,
        i.id AS invoice_id,
        i.invoice_number,
        i.total_amount,
        COALESCE(i.paid_amount, 0) AS paid_amount,
        (i.total_amount - COALESCE(i.paid_amount, 0)) AS balance_due,
        i.due_date,
        CURRENT_DATE - i.due_date::date AS days_overdue,
        CASE
          WHEN CURRENT_DATE - i.due_date::date <= 0 THEN 'current'
          WHEN CURRENT_DATE - i.due_date::date BETWEEN 1 AND 30 THEN '1-30'
          WHEN CURRENT_DATE - i.due_date::date BETWEEN 31 AND 60 THEN '31-60'
          WHEN CURRENT_DATE - i.due_date::date BETWEEN 61 AND 90 THEN '61-90'
          ELSE '90+'
        END AS aging_bucket
      FROM invoices i
      WHERE i.status NOT IN ('cancelled', 'refunded', 'paid')
        AND (i.total_amount - COALESCE(i.paid_amount, 0)) > 0
        ${facilityId ? "AND i.facility_id = $1" : ""}
        ${tenantId ? "AND i.tenant_id = $2" : ""}
      ORDER BY (CURRENT_DATE - i.due_date::date) DESC
    `;

    const params: any[] = [];
    if (facilityId) params.push(facilityId);
    if (tenantId) params.push(tenantId);

    const results = await this.accountRepo.manager.query(query, params);

    // Summarize by bucket
    const summary = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 };
    for (const row of results) {
      const amt = Number(row.balance_due);
      summary[row.aging_bucket as keyof typeof summary] += amt;
      summary.total += amt;
    }

    // Group by customer type
    const byCustomerType: Record<string, typeof summary> = {};
    for (const row of results) {
      const ct = row.customer_type || 'patient';
      if (!byCustomerType[ct]) byCustomerType[ct] = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 };
      const amt = Number(row.balance_due);
      byCustomerType[ct][row.aging_bucket as keyof typeof summary] += amt;
      byCustomerType[ct].total += amt;
    }

    return { summary, byCustomerType, details: results };
  }

  async getCashFlowStatement(facilityId: string, startDate: string, endDate: string, tenantId?: string) {
    // Cash flow from journal entries by account category
    const lines = await this.journalLineRepo.createQueryBuilder('jl')
      .innerJoin('jl.journalEntry', 'je')
      .innerJoinAndSelect(ChartOfAccount, 'acc', 'acc.id = jl.account_id')
      .select([
        'acc.account_category AS category',
        'acc.account_type AS type',
        'acc.account_code AS code',
        'acc.account_name AS name',
        'SUM(jl.debit) AS total_debit',
        'SUM(jl.credit) AS total_credit',
      ])
      .where('je.status = :status', { status: JournalStatus.POSTED })
      .andWhere('je.facility_id = :facilityId', { facilityId })
      .andWhere('je.journal_date >= :startDate', { startDate })
      .andWhere('je.journal_date <= :endDate', { endDate })
      .groupBy('acc.account_category, acc.account_type, acc.account_code, acc.account_name')
      .orderBy('acc.account_code', 'ASC')
      .getRawMany();

    if (tenantId) {
      // Re-query with tenant filter if needed
    }

    // Operating Activities: Revenue - Expenses + Changes in AR/AP
    const operating: any[] = [];
    let operatingTotal = 0;
    // Investing Activities: Fixed asset purchases/disposals
    const investing: any[] = [];
    let investingTotal = 0;
    // Financing Activities: Loans, equity changes
    const financing: any[] = [];
    let financingTotal = 0;

    for (const line of lines) {
      const debit = Number(line.total_debit) || 0;
      const credit = Number(line.total_credit) || 0;
      const net = credit - debit;
      const item = { code: line.code, name: line.name, amount: 0 };

      switch (line.category) {
        case 'service_revenue':
        case 'other_income':
          item.amount = net;
          operating.push(item);
          operatingTotal += net;
          break;
        case 'salaries':
        case 'supplies':
        case 'utilities':
        case 'other_expense':
        case 'depreciation':
          item.amount = -net; // expenses reduce cash
          operating.push(item);
          operatingTotal -= net;
          break;
        case 'receivables':
          item.amount = -net; // increase in AR reduces cash
          operating.push(item);
          operatingTotal -= net;
          break;
        case 'payables':
        case 'accruals':
          item.amount = net; // increase in AP increases cash
          operating.push(item);
          operatingTotal += net;
          break;
        case 'inventory':
          item.amount = -net;
          operating.push(item);
          operatingTotal -= net;
          break;
        case 'fixed_assets':
          item.amount = -(debit - credit);
          investing.push(item);
          investingTotal += item.amount;
          break;
        case 'loans':
          item.amount = net;
          financing.push(item);
          financingTotal += net;
          break;
        case 'capital':
        case 'retained_earnings':
          item.amount = net;
          financing.push(item);
          financingTotal += net;
          break;
        default:
          break;
      }
    }

    // Get opening and closing cash balances
    const cashAccounts = await this.accountRepo.find({
      where: { facilityId, accountCategory: AccountCategory.CASH, isActive: true, ...(tenantId ? { tenantId } : {}) },
    });
    const closingCash = cashAccounts.reduce((sum, acc) => sum + Number(acc.currentBalance), 0);
    const netChange = operatingTotal + investingTotal + financingTotal;
    const openingCash = closingCash - netChange;

    return {
      period: { startDate, endDate },
      operatingActivities: { items: operating, total: operatingTotal },
      investingActivities: { items: investing, total: investingTotal },
      financingActivities: { items: financing, total: financingTotal },
      netChangeInCash: netChange,
      openingCashBalance: openingCash,
      closingCashBalance: closingCash,
    };
  }

  // ============ STATUTORY REPORTS ============

  async getStatutoryReport(
    type: 'vat' | 'paye' | 'nssf',
    facilityId: string,
    startDate: string,
    endDate: string,
    tenantId?: string,
  ) {
    // Use parameterized queries for tenant filtering to prevent SQL injection
    const tenantFilter = tenantId ? `AND je.tenant_id = $4` : '';
    const params = tenantId ? [facilityId, startDate, endDate, tenantId] : [facilityId, startDate, endDate];

    if (type === 'vat') {
      const outputVat = await this.journalRepo.query(
        `SELECT COALESCE(SUM(jel.credit_amount), 0) as total
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN chart_of_accounts coa ON jel.account_id = coa.id
         WHERE je.facility_id = $1 AND je.status = 'posted'
           AND je.entry_date BETWEEN $2 AND $3
           AND coa.account_code = '2300'
           ${tenantFilter}`,
        params,
      );
      const inputVat = await this.journalRepo.query(
        `SELECT COALESCE(SUM(jel.debit_amount), 0) as total
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN chart_of_accounts coa ON jel.account_id = coa.id
         WHERE je.facility_id = $1 AND je.status = 'posted'
           AND je.entry_date BETWEEN $2 AND $3
           AND coa.account_code = '1301'
           ${tenantFilter}`,
        params,
      );
      const output = Number(outputVat[0]?.total || 0);
      const input = Number(inputVat[0]?.total || 0);
      return {
        reportType: 'VAT Return',
        period: `${startDate} to ${endDate}`,
        outputVat: output,
        inputVat: input,
        netVatPayable: output - input,
        vatRate: '18%',
        dueDate: new Date(new Date(endDate).getTime() + 15 * 86400000).toISOString().slice(0, 10),
      };
    }

    if (type === 'paye') {
      const payroll = await this.journalRepo.query(
        `SELECT COALESCE(SUM(jel.debit_amount), 0) as gross_salary,
                COALESCE(SUM(CASE WHEN coa.account_code = '2301' THEN jel.credit_amount ELSE 0 END), 0) as paye_withheld
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN chart_of_accounts coa ON jel.account_id = coa.id
         WHERE je.facility_id = $1 AND je.status = 'posted'
           AND je.entry_date BETWEEN $2 AND $3
           AND (coa.account_code LIKE '5100%' OR coa.account_code = '2301')
           ${tenantFilter}`,
        params,
      );
      return {
        reportType: 'PAYE Return',
        period: `${startDate} to ${endDate}`,
        grossSalaries: Number(payroll[0]?.gross_salary || 0),
        payeWithheld: Number(payroll[0]?.paye_withheld || 0),
        dueDate: new Date(new Date(endDate).getTime() + 15 * 86400000).toISOString().slice(0, 10),
      };
    }

    // NSSF
    const nssf = await this.journalRepo.query(
      `SELECT COALESCE(SUM(jel.debit_amount), 0) as gross_salary
       FROM journal_entry_lines jel
       JOIN journal_entries je ON jel.journal_entry_id = je.id
       JOIN chart_of_accounts coa ON jel.account_id = coa.id
       WHERE je.facility_id = $1 AND je.status = 'posted'
         AND je.entry_date BETWEEN $2 AND $3
         AND coa.account_code LIKE '5100%'
         ${tenantFilter}`,
      params,
    );
    const gross = Number(nssf[0]?.gross_salary || 0);
    return {
      reportType: 'NSSF Contribution Report',
      period: `${startDate} to ${endDate}`,
      grossSalaries: gross,
      employeeContribution5: gross * 0.05,
      employerContribution10: gross * 0.10,
      totalContribution: gross * 0.15,
      dueDate: new Date(new Date(endDate).getTime() + 15 * 86400000).toISOString().slice(0, 10),
    };
  }
}
