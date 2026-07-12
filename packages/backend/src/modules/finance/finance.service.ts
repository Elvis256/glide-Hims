import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
  TreeRepository,
  DataSource,
  EntityManager,
} from 'typeorm';
import {
  ChartOfAccount,
  AccountType,
  AccountCategory,
} from '../../database/entities/chart-of-account.entity';
import {
  JournalEntry,
  JournalStatus,
  JournalType,
} from '../../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { FiscalPeriod, PeriodStatus } from '../../database/entities/fiscal-period.entity';
import {
  CreateAccountDto,
  UpdateAccountDto,
  CreateJournalEntryDto,
  CreateFiscalYearDto,
} from './dto/finance.dto';
import { InvoiceStatus } from '../../database/entities/invoice.entity';
import { sumCents, eqCents, fromCents, toCents } from '../../common/utils/money';
import { requireTenantId } from '../../common/utils/tenant.util';

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
      where: {
        facilityId: dto.facilityId,
        accountCode: dto.accountCode,
        tenantId: requireTenantId(tenantId),
      },
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
      tenantId: requireTenantId(tenantId),
    });

    if (dto.parentId) {
      const parent = await this.accountRepo.findOne({
        where: { id: dto.parentId, tenantId: requireTenantId(tenantId) },
      });
      if (parent) account.parent = parent;
    }

    return this.accountRepo.save(account);
  }

  async getAccounts(
    facilityId: string,
    options: { type?: AccountType; active?: boolean },
    tenantId?: string,
  ) {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;
    if (options.type) where.accountType = options.type;
    if (options.active !== undefined) where.isActive = options.active;

    return this.accountRepo.find({
      where,
      order: { accountCode: 'ASC' },
    });
  }

  async getAccountTree(facilityId: string, tenantId?: string): Promise<any[]> {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;

    const accounts = await this.accountRepo.find({
      where,
      relations: ['parent'],
      order: { accountCode: 'ASC' },
    });

    // Build flat result with parentId
    const flat = accounts.map((a) => ({
      id: a.id,
      facilityId: a.facilityId,
      tenantId: a.tenantId,
      accountCode: a.accountCode,
      accountName: a.accountName,
      accountType: a.accountType,
      accountCategory: a.accountCategory,
      description: a.description,
      isActive: a.isActive,
      isHeader: a.isHeader,
      currentBalance: Number(a.currentBalance) || 0,
      currency: a.currency,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      parentId: a.parent?.id || null,
    }));

    // Aggregate child balances up to parent/header accounts
    const map = new Map<string, (typeof flat)[number]>();
    flat.forEach((a) => map.set(a.id, a));

    const aggregated = new Set<string>();
    const aggregate = (node: (typeof flat)[number]): number => {
      if (aggregated.has(node.id)) return node.currentBalance;
      aggregated.add(node.id);

      const children = flat.filter((a) => a.parentId === node.id);
      if (children.length === 0) return node.currentBalance;

      const childSum = children.reduce((sum, child) => sum + aggregate(child), 0);
      if (node.isHeader) {
        node.currentBalance = childSum;
      }
      return node.currentBalance;
    };

    flat.filter((a) => !a.parentId).forEach(aggregate);

    return flat;
  }

  async updateAccount(
    id: string,
    dto: UpdateAccountDto,
    tenantId?: string,
  ): Promise<ChartOfAccount> {
    const account = await this.accountRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!account) throw new NotFoundException('Account not found');

    Object.assign(account, dto);
    return this.accountRepo.save(account);
  }

  async deactivateAccount(id: string, tenantId?: string): Promise<ChartOfAccount> {
    const account = await this.accountRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!account) throw new NotFoundException('Account not found');

    // Check for children
    const children = await this.accountRepo.findDescendants(account);
    if (children.length > 1) {
      throw new BadRequestException('Cannot deactivate account with sub-accounts');
    }

    // Check for journal entries
    const hasEntries = await this.journalLineRepo.count({
      where: { accountId: id, tenantId: requireTenantId(tenantId) },
    });
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
      where: {
        facilityId: dto.facilityId,
        fiscalYear: dto.year,
        tenantId: requireTenantId(tenantId),
      },
    });
    if (existing) {
      throw new BadRequestException(`Fiscal year ${dto.year} already exists`);
    }

    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
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
        tenantId: requireTenantId(tenantId),
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
    const period = await this.fiscalPeriodRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');

    if (period.status !== PeriodStatus.OPEN) {
      throw new BadRequestException('Period is already closed');
    }

    period.status = PeriodStatus.CLOSED;
    period.closedById = userId;
    period.closedAt = new Date();

    return this.fiscalPeriodRepo.save(period);
  }

  async openPeriod(id: string, tenantId?: string): Promise<FiscalPeriod> {
    const period = await this.fiscalPeriodRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');

    if (period.status === PeriodStatus.LOCKED) {
      throw new BadRequestException(
        'Locked periods cannot be re-opened. Only closed periods can be reopened.',
      );
    }
    if (period.status === PeriodStatus.OPEN) {
      throw new BadRequestException('Period is already open');
    }

    period.status = PeriodStatus.OPEN;
    // Clear closure metadata — column is nullable in DB
    (period as any).closedById = null;
    (period as any).closedAt = null;

    return this.fiscalPeriodRepo.save(period);
  }

  async lockPeriod(id: string, userId: string, tenantId?: string): Promise<FiscalPeriod> {
    const period = await this.fiscalPeriodRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');

    if (period.status === PeriodStatus.LOCKED) {
      throw new BadRequestException('Period is already locked');
    }
    if (period.status === PeriodStatus.OPEN) {
      throw new BadRequestException('Period must be closed before it can be locked');
    }

    period.status = PeriodStatus.LOCKED;
    if (!period.closedById) {
      period.closedById = userId;
      period.closedAt = new Date();
    }

    return this.fiscalPeriodRepo.save(period);
  }

  async reverseJournalEntry(
    id: string,
    userId: string,
    reason: string,
    tenantId?: string,
  ): Promise<JournalEntry> {
    const original = await this.journalRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
      relations: ['lines', 'lines.account', 'fiscalPeriod'],
    });
    if (!original) throw new NotFoundException('Journal entry not found');

    if (original.status !== JournalStatus.POSTED) {
      throw new BadRequestException('Only posted journal entries can be reversed');
    }
    if (original.isReversed) {
      throw new BadRequestException('This journal entry has already been reversed');
    }
    if (original.isReversal) {
      throw new BadRequestException(
        'A reversal entry cannot itself be reversed. Create a correcting journal entry instead.',
      );
    }

    const reversalDate = new Date();
    const fiscalPeriod = await this.getFiscalPeriodForDate(
      original.facilityId,
      reversalDate,
      tenantId,
    );
    const journalNumber = await this.generateJournalNumber(original.facilityId, tenantId);

    let reversalId = '';

    await this.dataSource.transaction(async (manager) => {
      // Create the reversing journal entry (swap debits and credits)
      const reversal = manager.create(JournalEntry, {
        journalNumber,
        facilityId: original.facilityId,
        journalDate: reversalDate,
        fiscalPeriodId: fiscalPeriod.id,
        journalType: JournalType.GENERAL,
        description: `REVERSAL of ${original.journalNumber}: ${reason}`,
        reference: original.journalNumber,
        totalDebit: original.totalCredit,
        totalCredit: original.totalDebit,
        status: JournalStatus.DRAFT,
        createdById: userId,
        isReversal: true,
        reversalOfId: original.id,
        tenantId: requireTenantId(tenantId),
      });
      const savedReversal = await manager.save(JournalEntry, reversal);
      reversalId = savedReversal.id;

      // Swap debit/credit on every line
      for (let i = 0; i < original.lines.length; i++) {
        const origLine = original.lines[i];
        const line = manager.create(JournalEntryLine, {
          journalEntryId: reversalId,
          tenantId: original.tenantId,
          accountId: origLine.accountId,
          description: `Reversal: ${origLine.description || ''}`.trim(),
          debit: origLine.credit,
          credit: origLine.debit,
          lineNumber: i + 1,
        });
        await manager.save(JournalEntryLine, line);
      }

      // Mark the original as reversed
      await manager.update(
        JournalEntry,
        { id: original.id },
        { isReversed: true, reversedById: userId, reversedAt: reversalDate },
      );
    });

    // Auto-post the reversal entry. If posting fails, roll back the original's
    // reversed flag and delete the orphaned DRAFT reversal so the books stay consistent.
    try {
      return await this.postJournalEntry(reversalId, userId, tenantId, true);
    } catch (err) {
      await this.dataSource.transaction(async (manager) => {
        await manager.update(
          JournalEntry,
          { id: original.id },
          { isReversed: false, reversedById: null as any, reversedAt: null as any },
        );
        await manager.delete(JournalEntryLine, { journalEntryId: reversalId });
        await manager.delete(JournalEntry, { id: reversalId });
      });
      throw err;
    }
  }

  // ============ JOURNAL ENTRIES ============

  private async generateJournalNumber(
    facilityId: string,
    tenantId?: string,
    manager?: EntityManager,
  ): Promise<string> {
    const date = new Date();
    const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

    // Acquire a per-(tenant, facility, month) advisory lock so that two
    // concurrent createJournalEntry transactions cannot derive the same
    // journalNumber. Lock is released at transaction end. Falls back to a
    // plain count when no manager is provided (old call sites).
    if (manager) {
      const key = `je:${tenantId ?? 'global'}:${facilityId}:${yyyymm}`;
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
      const repo = manager.getRepository(JournalEntry);
      const count = await repo.count({
        where: { facilityId, tenantId: requireTenantId(tenantId) },
      });
      return `JE${yyyymm}${String(count + 1).padStart(5, '0')}`;
    }

    const count = await this.journalRepo.count({
      where: { facilityId, tenantId: requireTenantId(tenantId) },
    });
    return `JE${yyyymm}${String(count + 1).padStart(5, '0')}`;
  }

  private async getFiscalPeriodForDate(
    facilityId: string,
    date: Date,
    tenantId?: string,
  ): Promise<FiscalPeriod> {
    const period = await this.fiscalPeriodRepo.findOne({
      where: {
        facilityId,
        startDate: LessThanOrEqual(date),
        endDate: MoreThanOrEqual(date),
        tenantId: requireTenantId(tenantId),
      },
    });

    if (!period) {
      throw new BadRequestException(
        `No fiscal period found for date ${date.toISOString().slice(0, 10)}`,
      );
    }

    if (period.status !== PeriodStatus.OPEN) {
      throw new BadRequestException(`Fiscal period ${period.periodName} is closed`);
    }

    return period;
  }

  async createJournalEntry(
    dto: CreateJournalEntryDto,
    userId: string,
    tenantId?: string,
  ): Promise<JournalEntry> {
    // Validate debit = credit using exact cents-based math (no float drift).
    const totalDebitCents = sumCents(...dto.lines.map((l) => l.debit ?? 0));
    const totalCreditCents = sumCents(...dto.lines.map((l) => l.credit ?? 0));
    const totalDebit = fromCents(totalDebitCents);
    const totalCredit = fromCents(totalCreditCents);

    if (!eqCents(totalDebitCents, totalCreditCents)) {
      throw new BadRequestException(
        `Journal entry must balance. Debit: ${totalDebit}, Credit: ${totalCredit}`,
      );
    }

    if (dto.lines.length < 2) {
      throw new BadRequestException('Journal entry must have at least 2 lines');
    }

    // CRITICAL FIX: Validate all GL accounts before creating journal
    for (const line of dto.lines) {
      await this.validateGLAccount(line.accountId, tenantId);
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

    return this.dataSource.transaction(async (manager) => {
      // Re-derive inside the tx so the advisory lock and final number are
      // committed atomically (prevents duplicate journalNumbers under load).
      const finalJournalNumber = await this.generateJournalNumber(
        dto.facilityId,
        tenantId,
        manager,
      );
      void journalNumber;
      const journal = manager.create(JournalEntry, {
        journalNumber: finalJournalNumber,
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
        tenantId: requireTenantId(tenantId),
      });

      const savedJournal = await manager.save(JournalEntry, journal);

      // Create lines within the same transaction
      for (let i = 0; i < dto.lines.length; i++) {
        const lineDto = dto.lines[i];
        const line = manager.create(JournalEntryLine, {
          journalEntryId: savedJournal.id,
          tenantId,
          accountId: lineDto.accountId,
          description: lineDto.description,
          debit: lineDto.debit,
          credit: lineDto.credit,
          lineNumber: i + 1,
        });
        await manager.save(JournalEntryLine, line);
      }

      // Read back through the same transaction manager so the freshly-inserted
      // rows are visible (default repo uses a different connection from the
      // pool which would not yet see the uncommitted writes).
      const created = await manager.findOne(JournalEntry, {
        where: { id: savedJournal.id, tenantId: requireTenantId(tenantId) },
        relations: ['lines', 'lines.account', 'fiscalPeriod', 'createdBy'],
      });
      if (!created) throw new NotFoundException('Journal entry not found');
      return created;
    });
  }

  private async validateGLAccount(accountId: string, tenantId?: string): Promise<void> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId, tenantId: requireTenantId(tenantId) },
    });

    if (!account) {
      throw new NotFoundException(`GL Account ${accountId} not found`);
    }

    if (!account.isActive) {
      throw new BadRequestException(
        `GL Account ${account.accountCode} (${account.accountName}) is inactive`,
      );
    }

    if (account.isHeader) {
      throw new BadRequestException(
        `Cannot post to header account ${account.accountCode}. Please use a leaf account instead.`,
      );
    }
  }

  async getJournalEntry(id: string, tenantId?: string): Promise<JournalEntry> {
    const journal = await this.journalRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
      relations: ['lines', 'lines.account', 'fiscalPeriod', 'createdBy'],
    });
    if (!journal) throw new NotFoundException('Journal entry not found');
    return journal;
  }

  async getJournalEntries(
    facilityId: string,
    options: { status?: JournalStatus; startDate?: string; endDate?: string },
    tenantId?: string,
  ) {
    const qb = this.journalRepo
      .createQueryBuilder('je')
      .leftJoinAndSelect('je.lines', 'lines')
      .leftJoinAndSelect('lines.account', 'account')
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
      qb.andWhere('je.tenantId = :tenantId', { tenantId });
    }
    return qb.orderBy('je.journalDate', 'DESC').addOrderBy('je.journalNumber', 'DESC').getMany();
  }

  async postJournalEntry(
    id: string,
    userId: string,
    tenantId?: string,
    autoGenerated = false,
  ): Promise<JournalEntry> {
    return this.dataSource.transaction(async (manager) => {
      // Lock the journal entry row first (no relations — PostgreSQL FOR UPDATE can't handle LEFT JOINs)
      const locked = await manager.findOne(JournalEntry, {
        where: { id, tenantId: requireTenantId(tenantId) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Journal entry not found');

      // Now load full journal with relations (outside the lock)
      const journal = await manager.findOne(JournalEntry, {
        where: { id, tenantId: requireTenantId(tenantId) },
        relations: ['lines', 'lines.account', 'fiscalPeriod', 'createdBy'],
      });
      if (!journal) throw new NotFoundException('Journal entry not found');

      if (journal.status !== JournalStatus.DRAFT && journal.status !== JournalStatus.APPROVED) {
        throw new BadRequestException('Only draft or fully approved entries can be posted');
      }

      // F12: re-validate debit==credit at post-time using cents-rounded math.
      // Lines may have been mutated after creation; never trust journal.totalDebit/Credit.
      const recomputedDebit = sumCents(...(journal.lines ?? []).map((l) => l.debit ?? 0));
      const recomputedCredit = sumCents(...(journal.lines ?? []).map((l) => l.credit ?? 0));
      if (!eqCents(recomputedDebit, recomputedCredit)) {
        throw new BadRequestException(
          `Journal entry is unbalanced: debit=${fromCents(recomputedDebit)} credit=${fromCents(recomputedCredit)}`,
        );
      }
      // Also reject any line that has both debit and credit > 0 (F14 belt-and-braces)
      for (const l of journal.lines ?? []) {
        if (Number(l.debit) > 0 && Number(l.credit) > 0) {
          throw new BadRequestException(
            `Line ${l.lineNumber}: a journal line cannot carry both debit and credit amounts`,
          );
        }
        if (Number(l.debit) <= 0 && Number(l.credit) <= 0) {
          throw new BadRequestException(
            `Line ${l.lineNumber}: a journal line must have either debit or credit > 0`,
          );
        }
      }

      // Maker-checker: creator cannot post their own journal entry
      // Bypassed for system-generated auto-post journals (GRN posting, payment processing)
      if (!autoGenerated && journal.createdById === userId) {
        throw new BadRequestException(
          'Segregation of duties violation: the journal creator cannot post their own entry. A different user must approve and post.',
        );
      }

      // Fiscal period must be open for posting
      if (journal.fiscalPeriodId) {
        const period = await manager.findOne(FiscalPeriod, {
          where: { id: journal.fiscalPeriodId, tenantId: requireTenantId(tenantId) },
        });
        if (period && period.status !== PeriodStatus.OPEN) {
          throw new BadRequestException(
            `Cannot post to ${period.status} fiscal period: ${period.periodName}`,
          );
        }
      }

      // Update account balances with pessimistic locking
      for (const line of journal.lines) {
        const account = await manager.findOne(ChartOfAccount, {
          where: { id: line.accountId, tenantId: requireTenantId(tenantId) },
          lock: { mode: 'pessimistic_write' },
        });
        if (!account) continue;

        // Sprint-6 money-cents sweep: cents arithmetic for COA
        // balance updates so posting hundreds of JEL rows can't
        // accumulate IEEE 754 drift in `currentBalance`.
        const debitCents = toCents(line.debit);
        const creditCents = toCents(line.credit);
        let adjustmentCents = 0;
        if ([AccountType.ASSET, AccountType.EXPENSE].includes(account.accountType)) {
          adjustmentCents = debitCents - creditCents;
        } else {
          adjustmentCents = creditCents - debitCents;
        }

        account.currentBalance = fromCents(toCents(account.currentBalance) + adjustmentCents);
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
      where: { facilityId, isActive: true, isHeader: false, tenantId: requireTenantId(tenantId) },
      order: { accountCode: 'ASC' },
    });

    // Accumulate trial balance totals in cents to prevent IEEE 754 drift
    // across hundreds of accounts (which would otherwise cause spurious
    // "out of balance" reports).
    let totalDebitCents = 0;
    let totalCreditCents = 0;

    const data = accounts
      .map((acc) => {
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

        totalDebitCents += toCents(debit);
        totalCreditCents += toCents(credit);

        return {
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          accountType: acc.accountType,
          debit,
          credit,
        };
      })
      .filter((a) => a.debit > 0 || a.credit > 0);

    const totalDebit = fromCents(totalDebitCents);
    const totalCredit = fromCents(totalCreditCents);

    return {
      asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
      accounts: data,
      totalDebit,
      totalCredit,
      isBalanced: eqCents(totalDebitCents, totalCreditCents),
    };
  }

  async getIncomeStatement(
    facilityId: string,
    startDate: string,
    endDate: string,
    tenantId?: string,
  ) {
    const accounts = await this.accountRepo.find({
      where: { facilityId, isActive: true, tenantId: requireTenantId(tenantId) },
      order: { accountCode: 'ASC' },
    });

    const revenueAccounts = accounts.filter((a) => a.accountType === AccountType.REVENUE);
    const expenseAccounts = accounts.filter((a) => a.accountType === AccountType.EXPENSE);

    const totalRevenue = revenueAccounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    const totalExpenses = expenseAccounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    const netIncome = totalRevenue - totalExpenses;

    return {
      period: { startDate, endDate },
      revenue: revenueAccounts.map((a) => ({
        accountCode: a.accountCode,
        accountName: a.accountName,
        amount: Number(a.currentBalance),
      })),
      expenses: expenseAccounts.map((a) => ({
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
      where: { facilityId, isActive: true, tenantId: requireTenantId(tenantId) },
      order: { accountCode: 'ASC' },
    });

    const assets = accounts.filter((a) => a.accountType === AccountType.ASSET);
    const liabilities = accounts.filter((a) => a.accountType === AccountType.LIABILITY);
    const equity = accounts.filter((a) => a.accountType === AccountType.EQUITY);

    const totalAssets = assets.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    const totalEquity = equity.reduce((sum, a) => sum + Number(a.currentBalance), 0);

    return {
      asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
      assets: assets.map((a) => ({
        accountCode: a.accountCode,
        accountName: a.accountName,
        balance: Number(a.currentBalance),
      })),
      liabilities: liabilities.map((a) => ({
        accountCode: a.accountCode,
        accountName: a.accountName,
        balance: Number(a.currentBalance),
      })),
      equity: equity.map((a) => ({
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
    const [totalAccounts, draftJournals, postedJournals, openPeriods] = await Promise.all([
      this.accountRepo.count({
        where: { facilityId, isActive: true, tenantId: requireTenantId(tenantId) },
      }),
      this.journalRepo.count({
        where: { facilityId, status: JournalStatus.DRAFT, tenantId: requireTenantId(tenantId) },
      }),
      this.journalRepo.count({
        where: { facilityId, status: JournalStatus.POSTED, tenantId: requireTenantId(tenantId) },
      }),
      this.fiscalPeriodRepo.count({
        where: { facilityId, status: PeriodStatus.OPEN, tenantId: requireTenantId(tenantId) },
      }),
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
  async findAccountByCategory(
    facilityId: string,
    category: AccountCategory,
    tenantId?: string,
  ): Promise<ChartOfAccount | null> {
    return this.accountRepo.findOne({
      where: {
        facilityId,
        accountCategory: category,
        isActive: true,
        isHeader: false,
        tenantId: requireTenantId(tenantId),
      },
    });
  }

  /**
   * Auto-post a journal entry when a GRN is posted to inventory.
   * Dr Inventory (ASSET/INVENTORY) — Cr Accounts Payable (LIABILITY/PAYABLES)
   * Silently skipped if either account is not configured.
   */
  async autoPostGRNJournal(
    params: {
      facilityId: string;
      grnNumber: string;
      totalValue: number;
      supplierId: string;
      userId: string;
    },
    tenantId?: string,
  ): Promise<void> {
    try {
      const [inventoryAcc, apAcc] = await Promise.all([
        this.findAccountByCategory(params.facilityId, AccountCategory.INVENTORY, tenantId),
        this.findAccountByCategory(params.facilityId, AccountCategory.PAYABLES, tenantId),
      ]);
      if (!inventoryAcc || !apAcc) {
        this.logger.debug(
          `Auto GRN journal skipped – accounts not configured for facility ${params.facilityId}`,
        );
        return;
      }
      const journal = await this.createJournalEntry(
        {
          facilityId: params.facilityId,
          journalDate: new Date().toISOString(),
          journalType: JournalType.GENERAL,
          description: `Goods Receipt – ${params.grnNumber}`,
          reference: params.grnNumber,
          lines: [
            {
              accountId: inventoryAcc.id,
              description: `Inventory – ${params.grnNumber}`,
              debit: params.totalValue,
              credit: 0,
            },
            {
              accountId: apAcc.id,
              description: `AP – ${params.grnNumber}`,
              debit: 0,
              credit: params.totalValue,
            },
          ],
        },
        params.userId,
        tenantId,
      );
      await this.postJournalEntry(journal.id, params.userId, tenantId, true);
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
  async autoPostPaymentJournal(
    params: {
      facilityId: string;
      paymentReference: string;
      amount: number;
      userId: string;
    },
    tenantId?: string,
  ): Promise<void> {
    try {
      const [apAcc, cashAcc] = await Promise.all([
        this.findAccountByCategory(params.facilityId, AccountCategory.PAYABLES, tenantId),
        this.findAccountByCategory(params.facilityId, AccountCategory.CASH, tenantId),
      ]);
      if (!apAcc || !cashAcc) {
        this.logger.debug(
          `Auto payment journal skipped – accounts not configured for facility ${params.facilityId}`,
        );
        return;
      }
      const journal = await this.createJournalEntry(
        {
          facilityId: params.facilityId,
          journalDate: new Date().toISOString(),
          journalType: JournalType.PAYMENT,
          description: `Supplier Payment – ${params.paymentReference}`,
          reference: params.paymentReference,
          lines: [
            {
              accountId: apAcc.id,
              description: `AP – ${params.paymentReference}`,
              debit: params.amount,
              credit: 0,
            },
            {
              accountId: cashAcc.id,
              description: `Cash – ${params.paymentReference}`,
              debit: 0,
              credit: params.amount,
            },
          ],
        },
        params.userId,
        tenantId,
      );
      await this.postJournalEntry(journal.id, params.userId, tenantId, true);
    } catch (err) {
      this.logger.error(
        `Auto payment journal failed for ${params.paymentReference}: ${err.message}`,
      );
      if (err instanceof BadRequestException) {
        throw err;
      }
    }
  }

  // Auto-post when patient invoice is created: DR Accounts Receivable, CR Revenue
  async autoPostInvoiceJournal(
    params: {
      facilityId: string;
      invoiceNumber: string;
      totalAmount: number;
      revenueCategory?: string; // e.g., 'consultation', 'lab', 'pharmacy'
      userId: string;
    },
    tenantId?: string,
  ): Promise<void> {
    try {
      const arAcc =
        (await this.findAccountByCategory(
          params.facilityId,
          AccountCategory.RECEIVABLES,
          tenantId,
        )) ||
        (await this.accountRepo.findOne({
          where: {
            facilityId: params.facilityId,
            accountCode: '1200',
            isActive: true,
            tenantId: requireTenantId(tenantId),
          },
        }));
      const revenueAcc =
        (await this.findAccountByCategory(
          params.facilityId,
          AccountCategory.SERVICE_REVENUE,
          tenantId,
        )) ||
        (await this.accountRepo.findOne({
          where: {
            facilityId: params.facilityId,
            accountCode: '4100',
            isActive: true,
            tenantId: requireTenantId(tenantId),
          },
        }));
      if (!arAcc || !revenueAcc) {
        this.logger.debug(
          `Auto invoice journal skipped – AR or Revenue account not configured for facility ${params.facilityId}`,
        );
        return;
      }
      const journal = await this.createJournalEntry(
        {
          facilityId: params.facilityId,
          journalDate: new Date().toISOString(),
          journalType: JournalType.GENERAL,
          description: `Patient Invoice – ${params.invoiceNumber}`,
          reference: params.invoiceNumber,
          lines: [
            {
              accountId: arAcc.id,
              description: `AR – ${params.invoiceNumber}`,
              debit: params.totalAmount,
              credit: 0,
            },
            {
              accountId: revenueAcc.id,
              description: `Revenue – ${params.invoiceNumber}`,
              debit: 0,
              credit: params.totalAmount,
            },
          ],
        },
        params.userId,
        tenantId,
      );
      await this.postJournalEntry(journal.id, params.userId, tenantId, true);
    } catch (err) {
      this.logger.error(`Auto invoice journal failed for ${params.invoiceNumber}: ${err.message}`);
      if (err instanceof BadRequestException) {
        throw err;
      }
    }
  }

  // Auto-post when patient payment received: DR Cash/Bank, CR Accounts Receivable
  async autoPostPatientPaymentJournal(
    params: {
      facilityId: string;
      receiptNumber: string;
      amount: number;
      paymentMethod: string; // 'cash', 'card', 'mobile_money', 'bank_transfer'
      userId: string;
    },
    tenantId?: string,
  ): Promise<void> {
    try {
      const arAcc =
        (await this.findAccountByCategory(
          params.facilityId,
          AccountCategory.RECEIVABLES,
          tenantId,
        )) ||
        (await this.accountRepo.findOne({
          where: {
            facilityId: params.facilityId,
            accountCode: '1200',
            isActive: true,
            tenantId: requireTenantId(tenantId),
          },
        }));
      // Map payment method to cash/bank account
      const methodAccountMap: Record<string, string> = {
        cash: '1101',
        card: '1112',
        mobile_money: '1111',
        bank_transfer: '1110',
        cheque: '1110',
        insurance: '1201',
        corporate: '1202',
      };
      const cashCode = methodAccountMap[params.paymentMethod] || '1101';
      const cashAcc = await this.accountRepo.findOne({
        where: {
          facilityId: params.facilityId,
          accountCode: cashCode,
          isActive: true,
          tenantId: requireTenantId(tenantId),
        },
      });
      if (!arAcc || !cashAcc) {
        this.logger.debug(`Auto patient payment journal skipped – accounts not configured`);
        return;
      }
      const journal = await this.createJournalEntry(
        {
          facilityId: params.facilityId,
          journalDate: new Date().toISOString(),
          journalType: JournalType.PAYMENT,
          description: `Patient Payment – ${params.receiptNumber}`,
          reference: params.receiptNumber,
          lines: [
            {
              accountId: cashAcc.id,
              description: `Cash/Bank – ${params.receiptNumber}`,
              debit: params.amount,
              credit: 0,
            },
            {
              accountId: arAcc.id,
              description: `AR – ${params.receiptNumber}`,
              debit: 0,
              credit: params.amount,
            },
          ],
        },
        params.userId,
        tenantId,
      );
      await this.postJournalEntry(journal.id, params.userId, tenantId, true);
    } catch (err) {
      this.logger.error(
        `Auto patient payment journal failed for ${params.receiptNumber}: ${err.message}`,
      );
      if (err instanceof BadRequestException) {
        throw err;
      }
    }
  }

  // Auto-post when pharmacy sale is completed: DR Cash/Bank, CR Service Revenue
  async autoPostPharmacySaleJournal(
    params: {
      facilityId: string;
      saleNumber: string;
      totalAmount: number;
      paymentMethod: string;
      userId: string;
    },
    tenantId?: string,
  ): Promise<void> {
    try {
      const methodAccountMap: Record<string, string> = {
        cash: '1101',
        card: '1112',
        mobile_money: '1111',
        bank_transfer: '1110',
      };
      const cashCode = methodAccountMap[params.paymentMethod] || '1101';
      const cashAcc =
        (await this.accountRepo.findOne({
          where: {
            facilityId: params.facilityId,
            accountCode: cashCode,
            isActive: true,
            tenantId: requireTenantId(tenantId),
          },
        })) ||
        (await this.findAccountByCategory(params.facilityId, AccountCategory.CASH, tenantId));
      const revenueAcc =
        (await this.findAccountByCategory(
          params.facilityId,
          AccountCategory.SERVICE_REVENUE,
          tenantId,
        )) ||
        (await this.accountRepo.findOne({
          where: {
            facilityId: params.facilityId,
            accountCode: '4100',
            isActive: true,
            tenantId: requireTenantId(tenantId),
          },
        }));
      if (!cashAcc || !revenueAcc) {
        this.logger.debug(
          `Auto pharmacy sale journal skipped – accounts not configured for facility ${params.facilityId}`,
        );
        return;
      }
      const journal = await this.createJournalEntry(
        {
          facilityId: params.facilityId,
          journalDate: new Date().toISOString(),
          journalType: JournalType.REVENUE,
          description: `Pharmacy Sale – ${params.saleNumber}`,
          reference: params.saleNumber,
          lines: [
            {
              accountId: cashAcc.id,
              description: `Cash – ${params.saleNumber}`,
              debit: params.totalAmount,
              credit: 0,
            },
            {
              accountId: revenueAcc.id,
              description: `Revenue – ${params.saleNumber}`,
              debit: 0,
              credit: params.totalAmount,
            },
          ],
        },
        params.userId,
        tenantId,
      );
      await this.postJournalEntry(journal.id, params.userId, tenantId, true);
    } catch (err) {
      this.logger.error(
        `Auto pharmacy sale journal failed for ${params.saleNumber}: ${err.message}`,
      );
      if (err instanceof BadRequestException) {
        throw err;
      }
    }
  }

  // Auto-post when insurance claim payment is recorded: DR Cash/Bank, CR Insurance Receivable/AR
  async autoPostInsurancePaymentJournal(
    params: {
      facilityId: string;
      claimNumber: string;
      amount: number;
      paymentReference?: string;
      userId: string;
    },
    tenantId?: string,
  ): Promise<void> {
    try {
      const bankAcc =
        (await this.findAccountByCategory(params.facilityId, AccountCategory.BANK, tenantId)) ||
        (await this.findAccountByCategory(params.facilityId, AccountCategory.CASH, tenantId));
      const arAcc =
        (await this.findAccountByCategory(
          params.facilityId,
          AccountCategory.RECEIVABLES,
          tenantId,
        )) ||
        (await this.accountRepo.findOne({
          where: {
            facilityId: params.facilityId,
            accountCode: '1200',
            isActive: true,
            tenantId: requireTenantId(tenantId),
          },
        }));
      if (!bankAcc || !arAcc) {
        this.logger.debug(
          `Auto insurance payment journal skipped – accounts not configured for facility ${params.facilityId}`,
        );
        return;
      }
      const ref = params.paymentReference || params.claimNumber;
      const journal = await this.createJournalEntry(
        {
          facilityId: params.facilityId,
          journalDate: new Date().toISOString(),
          journalType: JournalType.PAYMENT,
          description: `Insurance Payment – ${params.claimNumber}`,
          reference: ref,
          lines: [
            {
              accountId: bankAcc.id,
              description: `Bank – Insurance ${params.claimNumber}`,
              debit: params.amount,
              credit: 0,
            },
            {
              accountId: arAcc.id,
              description: `AR – Insurance ${params.claimNumber}`,
              debit: 0,
              credit: params.amount,
            },
          ],
        },
        params.userId,
        tenantId,
      );
      await this.postJournalEntry(journal.id, params.userId, tenantId, true);
    } catch (err) {
      this.logger.error(
        `Auto insurance payment journal failed for ${params.claimNumber}: ${err.message}`,
      );
      if (err instanceof BadRequestException) {
        throw err;
      }
    }
  }

  // Auto-post when radiology imaging is completed: DR AR, CR Service Revenue
  async autoPostRadiologyJournal(
    params: {
      facilityId: string;
      orderNumber: string;
      amount: number;
      userId: string;
    },
    tenantId?: string,
  ): Promise<void> {
    try {
      const arAcc =
        (await this.findAccountByCategory(
          params.facilityId,
          AccountCategory.RECEIVABLES,
          tenantId,
        )) ||
        (await this.accountRepo.findOne({
          where: {
            facilityId: params.facilityId,
            accountCode: '1200',
            isActive: true,
            tenantId: requireTenantId(tenantId),
          },
        }));
      const revenueAcc =
        (await this.findAccountByCategory(
          params.facilityId,
          AccountCategory.SERVICE_REVENUE,
          tenantId,
        )) ||
        (await this.accountRepo.findOne({
          where: {
            facilityId: params.facilityId,
            accountCode: '4100',
            isActive: true,
            tenantId: requireTenantId(tenantId),
          },
        }));
      if (!arAcc || !revenueAcc) {
        this.logger.debug(
          `Auto radiology journal skipped – accounts not configured for facility ${params.facilityId}`,
        );
        return;
      }
      const journal = await this.createJournalEntry(
        {
          facilityId: params.facilityId,
          journalDate: new Date().toISOString(),
          journalType: JournalType.REVENUE,
          description: `Radiology Service – ${params.orderNumber}`,
          reference: params.orderNumber,
          lines: [
            {
              accountId: arAcc.id,
              description: `AR – Radiology ${params.orderNumber}`,
              debit: params.amount,
              credit: 0,
            },
            {
              accountId: revenueAcc.id,
              description: `Revenue – Radiology ${params.orderNumber}`,
              debit: 0,
              credit: params.amount,
            },
          ],
        },
        params.userId,
        tenantId,
      );
      await this.postJournalEntry(journal.id, params.userId, tenantId, true);
    } catch (err) {
      this.logger.error(`Auto radiology journal failed for ${params.orderNumber}: ${err.message}`);
      if (err instanceof BadRequestException) {
        throw err;
      }
    }
  }

  // Auto-post when payroll is processed: DR Salaries Expense, CR Salaries Payable + PAYE Payable + NSSF Payable
  async autoPostPayrollJournal(
    params: {
      facilityId: string;
      payrollNumber: string;
      totalGross: number;
      totalNet: number;
      totalPaye: number;
      totalNssf: number;
      userId: string;
    },
    tenantId?: string,
  ): Promise<void> {
    try {
      const salaryExpAcc =
        (await this.findAccountByCategory(params.facilityId, AccountCategory.SALARIES, tenantId)) ||
        (await this.accountRepo.findOne({
          where: {
            facilityId: params.facilityId,
            accountCode: '5100',
            isActive: true,
            tenantId: requireTenantId(tenantId),
          },
        }));
      const salaryPayableAcc =
        (await this.findAccountByCategory(params.facilityId, AccountCategory.ACCRUALS, tenantId)) ||
        (await this.accountRepo.findOne({
          where: {
            facilityId: params.facilityId,
            accountCode: '2201',
            isActive: true,
            tenantId: requireTenantId(tenantId),
          },
        }));
      if (!salaryExpAcc || !salaryPayableAcc) {
        this.logger.debug(
          `Auto payroll journal skipped – accounts not configured for facility ${params.facilityId}`,
        );
        return;
      }
      // PAYE payable account (2202) and NSSF payable (use accruals fallback)
      const payeAcc = await this.accountRepo.findOne({
        where: {
          facilityId: params.facilityId,
          accountCode: '2202',
          isActive: true,
          tenantId: requireTenantId(tenantId),
        },
      });
      const nssfAcc = await this.accountRepo.findOne({
        where: {
          facilityId: params.facilityId,
          accountCode: '2203',
          isActive: true,
          tenantId: requireTenantId(tenantId),
        },
      });

      const lines: { accountId: string; description: string; debit: number; credit: number }[] = [
        {
          accountId: salaryExpAcc.id,
          description: `Salary Expense – ${params.payrollNumber}`,
          debit: params.totalGross,
          credit: 0,
        },
        {
          accountId: salaryPayableAcc.id,
          description: `Net Salaries Payable – ${params.payrollNumber}`,
          debit: 0,
          credit: params.totalNet,
        },
      ];
      if (payeAcc && params.totalPaye > 0) {
        lines.push({
          accountId: payeAcc.id,
          description: `PAYE Payable – ${params.payrollNumber}`,
          debit: 0,
          credit: params.totalPaye,
        });
      }
      if (nssfAcc && params.totalNssf > 0) {
        lines.push({
          accountId: nssfAcc.id,
          description: `NSSF Payable – ${params.payrollNumber}`,
          debit: 0,
          credit: params.totalNssf,
        });
      }
      // If PAYE/NSSF accounts missing, lump into salary payable to keep balanced
      const totalCredits =
        params.totalNet + (payeAcc ? params.totalPaye : 0) + (nssfAcc ? params.totalNssf : 0);
      const remainder = params.totalGross - totalCredits;
      if (remainder > 0.01) {
        lines[1].credit += remainder; // Add to salary payable
      }

      const journal = await this.createJournalEntry(
        {
          facilityId: params.facilityId,
          journalDate: new Date().toISOString(),
          journalType: JournalType.GENERAL,
          description: `Payroll – ${params.payrollNumber}`,
          reference: params.payrollNumber,
          lines,
        },
        params.userId,
        tenantId,
      );
      await this.postJournalEntry(journal.id, params.userId, tenantId, true);
    } catch (err) {
      this.logger.error(`Auto payroll journal failed for ${params.payrollNumber}: ${err.message}`);
      if (err instanceof BadRequestException) {
        throw err;
      }
    }
  }

  // Generate closing entries when period closes: zero out Revenue/Expense into Retained Earnings
  async generateClosingEntries(
    facilityId: string,
    periodId: string,
    userId: string,
    tenantId?: string,
  ): Promise<JournalEntry | null> {
    try {
      const period = await this.fiscalPeriodRepo.findOne({
        where: { id: periodId, tenantId: requireTenantId(tenantId) },
      });
      if (!period) throw new NotFoundException('Fiscal period not found');

      // Get all revenue and expense accounts with non-zero balances
      const accounts = await this.accountRepo.find({
        where: { facilityId, isActive: true, isHeader: false, tenantId: requireTenantId(tenantId) },
      });

      const retainedEarnings = accounts.find((a) => a.accountCode === '3002');
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
          lines.push({
            accountId: acc.id,
            description: `Close ${acc.accountName}`,
            debit: balance,
            credit: 0,
          });
          netIncome += balance;
        } else if (acc.accountType === AccountType.EXPENSE && balance > 0) {
          // Close expense: CR Expense, DR Retained Earnings
          lines.push({
            accountId: acc.id,
            description: `Close ${acc.accountName}`,
            debit: 0,
            credit: balance,
          });
          netIncome -= balance;
        }
      }

      if (lines.length === 0) {
        this.logger.log('No revenue/expense balances to close');
        return null;
      }

      // Add the Retained Earnings balancing entry
      if (netIncome >= 0) {
        lines.push({
          accountId: retainedEarnings.id,
          description: 'Net Income to Retained Earnings',
          debit: 0,
          credit: netIncome,
        });
      } else {
        lines.push({
          accountId: retainedEarnings.id,
          description: 'Net Loss to Retained Earnings',
          debit: Math.abs(netIncome),
          credit: 0,
        });
      }

      const journal = await this.createJournalEntry(
        {
          facilityId,
          journalDate: period.endDate.toISOString
            ? period.endDate.toISOString()
            : String(period.endDate),
          journalType: JournalType.CLOSING,
          description: `Closing Entries – ${period.periodName}`,
          reference: `CLOSE-${period.periodName.replace(/\s/g, '-')}`,
          lines,
        },
        userId,
        tenantId,
      );

      await this.postJournalEntry(journal.id, userId, tenantId, true);
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
    const qb = this.journalLineRepo
      .createQueryBuilder('jl')
      .innerJoinAndSelect('jl.journalEntry', 'je')
      .where('jl.account_id = :accountId', { accountId })
      .andWhere('je.status = :status', { status: JournalStatus.POSTED });

    if (tenantId) qb.andWhere('jl.tenant_id = :tenantId', { tenantId });
    if (options.startDate)
      qb.andWhere('je.journal_date >= :startDate', { startDate: options.startDate });
    if (options.endDate) qb.andWhere('je.journal_date <= :endDate', { endDate: options.endDate });

    const page = options.page || 1;
    const limit = options.limit || 50;
    qb.orderBy('je.journal_date', 'DESC').addOrderBy('jl.line_number', 'ASC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    let runningBalance = 0;
    const transactions = data.map((line) => {
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
    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required for AR aging report');
    }
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
        ${facilityId ? 'AND i.facility_id = $1' : ''}
        AND i.tenant_id = $2
      ORDER BY (CURRENT_DATE - i.due_date::date) DESC
    `;

    const params: any[] = [];
    if (facilityId) params.push(facilityId);
    params.push(tenantId);

    const results = await this.accountRepo.manager.query(query, params);

    // Summarize by bucket
    const summary: any = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 };
    for (const row of results) {
      const amt = Number(row.balance_due);
      summary[row.aging_bucket as keyof typeof summary] += amt;
      summary.total += amt;
    }

    // Group by customer type
    const byCustomerType: Record<string, typeof summary> = {};
    for (const row of results) {
      const ct = row.customer_type || 'patient';
      if (!byCustomerType[ct])
        byCustomerType[ct] = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 };
      const amt = Number(row.balance_due);
      byCustomerType[ct][row.aging_bucket as keyof typeof summary] += amt;
      byCustomerType[ct].total += amt;
    }

    return { summary, byCustomerType, details: results };
  }

  async getCashFlowStatement(
    facilityId: string,
    startDate: string,
    endDate: string,
    tenantId?: string,
  ) {
    // Cash flow from journal entries by account category
    const lines = await this.journalLineRepo
      .createQueryBuilder('jl')
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
      const item: any = { code: line.code, name: line.name, amount: 0 };

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
      where: {
        facilityId,
        accountCategory: AccountCategory.CASH,
        isActive: true,
        tenantId: requireTenantId(tenantId),
      },
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
    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required for statutory reports');
    }
    // Always include tenant filter to enforce tenant isolation
    const tenantFilter = 'AND je.tenant_id = $4';
    const params = [facilityId, startDate, endDate, tenantId];

    if (type === 'vat') {
      const outputVat = await this.journalRepo.query(
        `SELECT COALESCE(SUM(jel.credit_amount), 0) as total
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN chart_of_accounts coa ON jel.account_id = coa.id
         WHERE je.facility_id = $1 AND je.status = 'posted'
           AND je.journal_date BETWEEN $2 AND $3
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
           AND je.journal_date BETWEEN $2 AND $3
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
           AND je.journal_date BETWEEN $2 AND $3
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
         AND je.journal_date BETWEEN $2 AND $3
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
      employerContribution10: gross * 0.1,
      totalContribution: gross * 0.15,
      dueDate: new Date(new Date(endDate).getTime() + 15 * 86400000).toISOString().slice(0, 10),
    };
  }
}
