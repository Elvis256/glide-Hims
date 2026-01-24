import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, TreeRepository } from 'typeorm';
import { ChartOfAccount, AccountType } from '../../database/entities/chart-of-account.entity';
import { JournalEntry, JournalStatus, JournalType } from '../../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { FiscalPeriod, PeriodStatus } from '../../database/entities/fiscal-period.entity';
import {
  CreateAccountDto,
  UpdateAccountDto,
  CreateJournalEntryDto,
  CreateFiscalYearDto,
} from './dto/finance.dto';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(ChartOfAccount)
    private accountRepo: TreeRepository<ChartOfAccount>,
    @InjectRepository(JournalEntry)
    private journalRepo: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine)
    private journalLineRepo: Repository<JournalEntryLine>,
    @InjectRepository(FiscalPeriod)
    private fiscalPeriodRepo: Repository<FiscalPeriod>,
  ) {}

  // ============ CHART OF ACCOUNTS ============

  async createAccount(dto: CreateAccountDto): Promise<ChartOfAccount> {
    const existing = await this.accountRepo.findOne({
      where: { facilityId: dto.facilityId, accountCode: dto.accountCode },
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
    });

    if (dto.parentId) {
      const parent = await this.accountRepo.findOne({ where: { id: dto.parentId } });
      if (parent) account.parent = parent;
    }

    return this.accountRepo.save(account);
  }

  async getAccounts(facilityId: string, options: { type?: AccountType; active?: boolean }) {
    const where: any = { facilityId };
    if (options.type) where.accountType = options.type;
    if (options.active !== undefined) where.isActive = options.active;

    return this.accountRepo.find({
      where,
      order: { accountCode: 'ASC' },
    });
  }

  async getAccountTree(facilityId: string): Promise<ChartOfAccount[]> {
    const roots = await this.accountRepo.find({
      where: { facilityId, parent: null as any },
      order: { accountCode: 'ASC' },
    });

    const result: ChartOfAccount[] = [];
    for (const root of roots) {
      const tree = await this.accountRepo.findDescendantsTree(root);
      result.push(tree);
    }
    return result;
  }

  async updateAccount(id: string, dto: UpdateAccountDto): Promise<ChartOfAccount> {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');

    Object.assign(account, dto);
    return this.accountRepo.save(account);
  }

  // ============ FISCAL PERIODS ============

  async createFiscalYear(dto: CreateFiscalYearDto): Promise<FiscalPeriod[]> {
    const existing = await this.fiscalPeriodRepo.findOne({
      where: { facilityId: dto.facilityId, fiscalYear: dto.year },
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
      });
      periods.push(await this.fiscalPeriodRepo.save(period));
    }

    return periods;
  }

  async getFiscalPeriods(facilityId: string, year?: number) {
    const where: any = { facilityId };
    if (year) where.fiscalYear = year;

    return this.fiscalPeriodRepo.find({
      where,
      order: { fiscalYear: 'DESC', period: 'ASC' },
    });
  }

  async closePeriod(id: string, userId: string): Promise<FiscalPeriod> {
    const period = await this.fiscalPeriodRepo.findOne({ where: { id } });
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

  private async generateJournalNumber(facilityId: string): Promise<string> {
    const count = await this.journalRepo.count({ where: { facilityId } });
    const date = new Date();
    return `JE${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
  }

  private async getFiscalPeriodForDate(facilityId: string, date: Date): Promise<FiscalPeriod> {
    const period = await this.fiscalPeriodRepo.findOne({
      where: {
        facilityId,
        startDate: LessThanOrEqual(date),
        endDate: LessThanOrEqual(date),
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

  async createJournalEntry(dto: CreateJournalEntryDto, userId: string): Promise<JournalEntry> {
    // Validate debit = credit
    const totalDebit = dto.lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = dto.lines.reduce((sum, l) => sum + Number(l.credit), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
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
      await this.createFiscalYear({ facilityId: dto.facilityId, year });
      fiscalPeriod = await this.getFiscalPeriodForDate(dto.facilityId, journalDate);
    }

    const journalNumber = await this.generateJournalNumber(dto.facilityId);

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

    return this.getJournalEntry(savedJournal.id);
  }

  async getJournalEntry(id: string): Promise<JournalEntry> {
    const journal = await this.journalRepo.findOne({
      where: { id },
      relations: ['lines', 'lines.account', 'fiscalPeriod', 'createdBy'],
    });
    if (!journal) throw new NotFoundException('Journal entry not found');
    return journal;
  }

  async getJournalEntries(facilityId: string, options: { status?: JournalStatus; startDate?: string; endDate?: string }) {
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

    return qb.orderBy('je.journalDate', 'DESC').addOrderBy('je.journalNumber', 'DESC').getMany();
  }

  async postJournalEntry(id: string, userId: string): Promise<JournalEntry> {
    const journal = await this.getJournalEntry(id);

    if (journal.status !== JournalStatus.DRAFT) {
      throw new BadRequestException('Only draft entries can be posted');
    }

    // Update account balances
    for (const line of journal.lines) {
      const account = await this.accountRepo.findOne({ where: { id: line.accountId } });
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
      await this.accountRepo.save(account);
    }

    journal.status = JournalStatus.POSTED;
    journal.postedById = userId;
    journal.postedAt = new Date();

    return this.journalRepo.save(journal);
  }

  // ============ REPORTS ============

  async getTrialBalance(facilityId: string, asOfDate?: string) {
    const accounts = await this.accountRepo.find({
      where: { facilityId, isActive: true, isHeader: false },
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

  async getIncomeStatement(facilityId: string, startDate: string, endDate: string) {
    const accounts = await this.accountRepo.find({
      where: { facilityId, isActive: true },
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

  async getBalanceSheet(facilityId: string, asOfDate?: string) {
    const accounts = await this.accountRepo.find({
      where: { facilityId, isActive: true },
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

  async getDashboard(facilityId: string) {
    const [
      totalAccounts,
      draftJournals,
      postedJournals,
      openPeriods,
    ] = await Promise.all([
      this.accountRepo.count({ where: { facilityId, isActive: true } }),
      this.journalRepo.count({ where: { facilityId, status: JournalStatus.DRAFT } }),
      this.journalRepo.count({ where: { facilityId, status: JournalStatus.POSTED } }),
      this.fiscalPeriodRepo.count({ where: { facilityId, status: PeriodStatus.OPEN } }),
    ]);

    const trialBalance = await this.getTrialBalance(facilityId);

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
}
