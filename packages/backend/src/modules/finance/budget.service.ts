import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull, DataSource, In } from 'typeorm';
import { Budget, BudgetLine, BudgetStatus } from '../../database/entities/finance-extended.entity';
import { FacilityBudget } from '../../database/entities/facility-budget.entity';
import {
  BudgetReservation,
  ReservationStatus,
} from '../../database/entities/budget-reservation.entity';
import { JournalEntry, JournalStatus } from '../../database/entities/journal-entry.entity';
import { sumCents, fromCents, toCents } from '../../common/utils/money';
import { requireTenantId } from '../../common/utils/tenant.util';

export interface BudgetCheckResult {
  withinBudget: boolean;
  budgetedAmount: number;
  actualSpent: number;
  pendingAmount: number;
  remainingBudget: number;
  accountId: string;
  budgetName: string;
}

@Injectable()
export class BudgetService {
  private readonly logger = new Logger(BudgetService.name);

  constructor(
    @InjectRepository(Budget)
    private budgetRepo: Repository<Budget>,
    @InjectRepository(BudgetLine)
    private budgetLineRepo: Repository<BudgetLine>,
    @InjectRepository(FacilityBudget)
    private facilityBudgetRepo: Repository<FacilityBudget>,
    @InjectRepository(BudgetReservation)
    private reservationRepo: Repository<BudgetReservation>,
    @InjectRepository(JournalEntry)
    private journalEntryRepo: Repository<JournalEntry>,
    private dataSource: DataSource,
  ) {}

  async create(
    dto: Partial<Budget> & { name: string; facilityId: string; fiscalYear: number },
    tenantId?: string,
  ): Promise<Budget> {
    const budget = this.budgetRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) });
    return this.budgetRepo.save(budget);
  }

  async findAll(facilityId?: string, tenantId?: string): Promise<Budget[]> {
    const where: any = {};
    if (facilityId) where.facilityId = facilityId;
    if (tenantId) where.tenantId = tenantId;
    return this.budgetRepo.find({ where, relations: ['lines'], order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, tenantId?: string): Promise<Budget> {
    const budget = await this.budgetRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: ['lines', 'lines.account'],
    });
    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }

  async addLine(
    budgetId: string,
    dto: {
      accountId: string;
      costCenterId?: string;
      period: number;
      budgetedAmount: number;
      notes?: string;
    },
    tenantId?: string,
  ): Promise<BudgetLine> {
    await this.findOne(budgetId, tenantId);
    const line = this.budgetLineRepo.create({
      ...dto,
      budgetId,
      ...(tenantId ? { tenantId } : {}),
    });
    return this.budgetLineRepo.save(line);
  }

  async updateLine(
    lineId: string,
    dto: Partial<BudgetLine>,
    tenantId?: string,
  ): Promise<BudgetLine> {
    const line = await this.budgetLineRepo.findOne({
      where: { id: lineId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!line) throw new NotFoundException('Budget line not found');
    Object.assign(line, dto);
    return this.budgetLineRepo.save(line);
  }

  async approve(id: string, userId: string, tenantId?: string): Promise<Budget> {
    const budget = await this.findOne(id, tenantId);
    budget.status = BudgetStatus.APPROVED;
    budget.approvedBy = userId;
    budget.approvedAt = new Date();
    return this.budgetRepo.save(budget);
  }

  async getBudgetVsActual(budgetId: string, tenantId?: string): Promise<any> {
    const budget = await this.findOne(budgetId, tenantId);
    const result = [];
    for (const line of budget.lines || []) {
      // Look up actual amounts from posted journal entries for the budget line's account & period
      const actual = await this.budgetLineRepo.query(
        `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as actual
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE jel.account_id = $1
           AND je.status = 'posted'
           AND je.journal_date >= (SELECT start_date FROM fiscal_periods WHERE fiscal_year = $2 AND period = $3 AND tenant_id = $4 LIMIT 1)
           AND je.journal_date <= (SELECT end_date   FROM fiscal_periods WHERE fiscal_year = $2 AND period = $3 AND tenant_id = $4 LIMIT 1)
           AND je.tenant_id = $4
           AND jel.tenant_id = $4`,
        [line.accountId, budget.fiscalYear, line.period, tenantId],
      );
      const actualAmount = Number(actual[0]?.actual || 0);
      const budgetedAmt = Number(line.budgetedAmount);
      result.push({
        lineId: line.id,
        accountId: line.accountId,
        period: line.period,
        budgetAmount: budgetedAmt,
        actualAmount,
        variance: budgetedAmt - actualAmount,
        variancePercent:
          budgetedAmt > 0 ? (((budgetedAmt - actualAmount) / budgetedAmt) * 100).toFixed(1) : 0,
      });
    }
    return { budget: { id: budget.id, name: budget.name, status: budget.status }, lines: result };
  }

  /**
   * Check if a proposed expenditure fits within the approved budget for
   * the given account in the current fiscal period.
   */
  async checkBudgetAvailability(
    facilityId: string,
    accountId: string,
    amount: number,
    tenantId?: string,
  ): Promise<BudgetCheckResult | null> {
    const now = new Date();
    const fiscalYear = now.getFullYear();
    const currentPeriod = now.getMonth() + 1;

    // Find approved/active budget for this facility and fiscal year
    const budget = await this.budgetRepo.findOne({
      where: {
        facilityId,
        fiscalYear,
        status: BudgetStatus.APPROVED,
        ...(tenantId ? { tenantId } : {}),
      },
      relations: ['lines'],
    });

    if (!budget) {
      // Also check ACTIVE status
      const activeBudget = await this.budgetRepo.findOne({
        where: {
          facilityId,
          fiscalYear,
          status: BudgetStatus.ACTIVE,
          ...(tenantId ? { tenantId } : {}),
        },
        relations: ['lines'],
      });
      if (!activeBudget) return null; // No budget defined — cannot enforce
      return this.evaluateBudgetLine(activeBudget, accountId, amount, currentPeriod, tenantId);
    }

    return this.evaluateBudgetLine(budget, accountId, amount, currentPeriod, tenantId);
  }

  private async evaluateBudgetLine(
    budget: Budget,
    accountId: string,
    proposedAmount: number,
    period: number,
    tenantId?: string,
  ): Promise<BudgetCheckResult | null> {
    const line = (budget.lines || []).find((l) => l.accountId === accountId && l.period === period);
    if (!line) return null; // No budget line for this account/period

    const actual = await this.budgetLineRepo.query(
      `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as actual
       FROM journal_entry_lines jel
       JOIN journal_entries je ON jel.journal_entry_id = je.id
       WHERE jel.account_id = $1
         AND je.status = 'posted'
         AND je.journal_date >= (SELECT start_date FROM fiscal_periods WHERE fiscal_year = $2 AND period = $3 AND tenant_id = $4 LIMIT 1)
         AND je.journal_date <= (SELECT end_date   FROM fiscal_periods WHERE fiscal_year = $2 AND period = $3 AND tenant_id = $4 LIMIT 1)
         AND je.tenant_id = $4
         AND jel.tenant_id = $4`,
      [accountId, budget.fiscalYear, period, tenantId],
    );

    const actualSpent = fromCents(toCents(actual[0]?.actual || 0));
    const budgetedAmount = fromCents(toCents(line.budgetedAmount));
    const remainingBudget = fromCents(
      toCents(line.budgetedAmount) - toCents(actual[0]?.actual || 0),
    );

    return {
      withinBudget: toCents(proposedAmount) <= toCents(remainingBudget),
      budgetedAmount,
      actualSpent,
      pendingAmount: proposedAmount,
      remainingBudget,
      accountId,
      budgetName: budget.name,
    };
  }

  /**
   * Enforce budget limit — throws if the proposed amount exceeds remaining budget.
   * Returns silently if no budget is defined (advisory mode).
   */
  async enforceBudgetLimit(
    facilityId: string,
    accountId: string,
    amount: number,
    tenantId?: string,
  ): Promise<void> {
    const check = await this.checkBudgetAvailability(facilityId, accountId, amount, tenantId);
    if (!check) {
      this.logger.warn(
        `No budget line found for account ${accountId} in facility ${facilityId} — skipping enforcement`,
      );
      return;
    }
    if (!check.withinBudget) {
      throw new BadRequestException(
        `Budget exceeded for "${check.budgetName}": ` +
          `budgeted ${check.budgetedAmount.toLocaleString()}, ` +
          `spent ${check.actualSpent.toLocaleString()}, ` +
          `remaining ${check.remainingBudget.toLocaleString()}, ` +
          `requested ${check.pendingAmount.toLocaleString()}. ` +
          `Please request a budget amendment or reduce the amount.`,
      );
    }
  }

  // ============ FACILITY-WIDE BUDGET MANAGEMENT (for Procurement Phase 2) ============

  /**
   * Get or create fiscal year budget for a facility
   */
  async getFacilityBudgetForYear(
    facilityId: string,
    year: number,
    tenantId?: string,
  ): Promise<FacilityBudget> {
    const where: any = {
      facilityId,
      isActive: true,
      deletedAt: IsNull(),
    };
    if (tenantId) where.tenantId = tenantId;

    // Assume fiscal year starts Jan 1
    const fiscalYearStart = new Date(`${year}-01-01`);

    // Try to find existing budget
    let budget = await this.facilityBudgetRepo.findOne({
      where: {
        ...where,
        fiscalYearStart: LessThanOrEqual(fiscalYearStart),
      },
      relations: ['reservations'],
      order: { fiscalYearStart: 'DESC' },
    });

    if (!budget) {
      throw new NotFoundException(
        `No active budget found for facility ${facilityId} in fiscal year ${year}`,
      );
    }

    return budget;
  }

  /**
   * Calculate total spent from GL EXPENSE accounts
   * Uses Finance GL entries to determine actual expense spending
   */
  async calculateBudgetSpent(
    facilityId: string,
    fiscalYearStart: Date,
    tenantId?: string,
  ): Promise<number> {
    try {
      // Query GL entry lines for EXPENSE accounts with debit = actual spending
      const qb = this.journalEntryRepo
        .createQueryBuilder('je')
        .leftJoinAndSelect('je.lines', 'jel')
        .leftJoinAndSelect('jel.account', 'acc')
        .where('je.facilityId = :facilityId', { facilityId })
        .andWhere('je.journalDate >= :startDate', { startDate: fiscalYearStart })
        .andWhere('je.status = :status', { status: JournalStatus.POSTED })
        .andWhere('acc.accountType = :type', { type: 'EXPENSE' });

      if (tenantId) {
        qb.andWhere('je.tenantId = :tenantId', { tenantId });
      }

      const entries = await qb.getMany();

      // Sprint-6 money-cents sweep: aggregate JEL debits at cent
      // precision, then return a 2-dp number for downstream compares.
      let spentCents = 0;
      for (const entry of entries) {
        if (entry.lines) {
          for (const line of entry.lines) {
            spentCents += toCents(line.debit || 0);
          }
        }
      }
      const spent = fromCents(spentCents);

      this.logger.debug(`Calculated budget spent for facility ${facilityId}: ${spent}`);
      return spent;
    } catch (error) {
      this.logger.error(`Error calculating budget spent: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Calculate total budget reserved but not yet spent.
   * Includes both PENDING and APPROVED reservations — APPROVED money
   * is committed-but-not-disbursed and must still reduce availability
   * (Budget audit F3: previously only PENDING was excluded, so as
   * soon as a reservation flipped to APPROVED it disappeared from
   * the availability calculation, double-counting the budget).
   */
  async calculateBudgetReserved(budgetId: string, tenantId?: string): Promise<number> {
    const where: any = {
      budgetId,
      status: In([ReservationStatus.PENDING, ReservationStatus.APPROVED]),
    };
    if (tenantId) where.tenantId = tenantId;

    const reservations = await this.reservationRepo.find({ where });
    return fromCents(reservations.reduce((sum, r) => sum + toCents(r.reservedAmount), 0));
  }

  /**
   * Calculate available budget = total allocation - spent - reserved
   */
  async calculateBudgetAvailable(
    facilityId: string,
    tenantId?: string,
  ): Promise<{
    totalAllocation: number;
    spent: number;
    reserved: number;
    available: number;
  }> {
    try {
      const currentYear = new Date().getFullYear();
      const budget = await this.getFacilityBudgetForYear(facilityId, currentYear, tenantId);

      const spent = await this.calculateBudgetSpent(facilityId, budget.fiscalYearStart, tenantId);
      const reserved = await this.calculateBudgetReserved(budget.id, tenantId);

      const available = fromCents(
        toCents(budget.totalBudgetAllocation) - toCents(spent) - toCents(reserved),
      );

      return {
        totalAllocation: fromCents(toCents(budget.totalBudgetAllocation)),
        spent,
        reserved,
        available: Math.max(0, available), // Never negative
      };
    } catch (error) {
      this.logger.error(`Error calculating available budget: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Validate that sufficient budget exists for proposed amount
   * Throws BadRequestException if insufficient
   */
  async validateBudgetSufficient(
    facilityId: string,
    amount: number,
    tenantId?: string,
  ): Promise<boolean> {
    try {
      const { available } = await this.calculateBudgetAvailable(facilityId, tenantId);

      if (amount > available) {
        throw new BadRequestException(
          `Insufficient budget. Requested: $${amount.toFixed(2)}, Available: $${available.toFixed(2)}`,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error validating budget: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create a budget reservation for a PR or PO
   */
  async reserveBudget(
    facilityId: string,
    documentId: string,
    documentType: 'PR' | 'PO',
    amount: number,
    tenantId?: string,
  ): Promise<BudgetReservation> {
    if (!(amount > 0)) {
      throw new BadRequestException('Reservation amount must be positive');
    }

    return this.dataSource.transaction(async (manager) => {
      try {
        const budgetRepo = manager.getRepository(FacilityBudget);
        const reservationRepo = manager.getRepository(BudgetReservation);

        // Lock the active budget row to serialise concurrent reservations.
        // Without this, two parallel reserveBudget calls can both pass the
        // available-balance check and over-commit.
        const qb = budgetRepo
          .createQueryBuilder('b')
          .setLock('pessimistic_write')
          .where('b.facility_id = :facilityId', { facilityId })
          .andWhere('b.is_active = TRUE')
          .andWhere('b.deleted_at IS NULL');
        if (tenantId) {
          qb.andWhere('b.tenant_id = :tenantId', { tenantId });
        }
        const budget = await qb.orderBy('b.fiscal_year_start', 'DESC').getOne();

        if (!budget) {
          throw new NotFoundException(`No active budget for facility ${facilityId}`);
        }

        // Recompute remaining capacity inside the lock so the check is
        // race-free.
        const reservations = await reservationRepo.find({
          where: {
            budgetId: budget.id,
            ...(tenantId ? { tenantId } : {}),
            status: In([ReservationStatus.PENDING, ReservationStatus.APPROVED]),
          },
        });
        const reservedTotalCents = reservations.reduce(
          (sum, r) => sum + toCents(r.reservedAmount),
          0,
        );
        const remainingCents = toCents(budget.totalBudgetAllocation) - reservedTotalCents;
        const remaining = fromCents(remainingCents);

        if (toCents(amount) > remainingCents) {
          throw new BadRequestException(
            `Reservation of ${amount} exceeds remaining budget capacity ${remaining}`,
          );
        }

        const reservation = reservationRepo.create({
          budgetId: budget.id,
          documentId,
          documentType,
          reservedAmount: amount,
          status: ReservationStatus.PENDING,
          tenantId,
          remarks: `Budget reserved for ${documentType} ${documentId}`,
        });

        const saved = await reservationRepo.save(reservation);

        this.logger.log(`Reserved $${amount} budget for ${documentType} ${documentId}`);
        return saved;
      } catch (error) {
        this.logger.error(`Error reserving budget: ${error.message}`, error.stack);
        throw error;
      }
    });
  }

  /**
   * Update reservation status when PR/PO is approved
   */
  async approveReservation(reservationId: string, tenantId?: string): Promise<BudgetReservation> {
    const where: any = { id: reservationId };
    if (tenantId) where.tenantId = tenantId;

    const reservation = await this.reservationRepo.findOne({ where });
    if (!reservation) {
      throw new NotFoundException(`Reservation ${reservationId} not found`);
    }

    reservation.status = ReservationStatus.APPROVED;
    return this.reservationRepo.save(reservation);
  }

  /**
   * Release a budget reservation (e.g., when PR/PO is rejected or cancelled)
   */
  async releaseReservation(reservationId: string, tenantId?: string): Promise<BudgetReservation> {
    const where: any = { id: reservationId };
    if (tenantId) where.tenantId = tenantId;

    const reservation = await this.reservationRepo.findOne({ where });
    if (!reservation) {
      throw new NotFoundException(`Reservation ${reservationId} not found`);
    }

    reservation.status = ReservationStatus.RELEASED;
    this.logger.log(`Released budget reservation ${reservationId}`);
    return this.reservationRepo.save(reservation);
  }

  /**
   * Mark reservation as spent when GRN is posted
   */
  async markReservationSpent(documentId: string, tenantId?: string): Promise<void> {
    const where: any = { documentId, status: ReservationStatus.APPROVED };
    if (tenantId) where.tenantId = tenantId;

    const reservations = await this.reservationRepo.find({ where });
    for (const res of reservations) {
      res.status = ReservationStatus.SPENT;
      await this.reservationRepo.save(res);
    }
  }

  /**
   * Get all reservations for a document
   */
  async getReservationsForDocument(
    documentId: string,
    tenantId?: string,
  ): Promise<BudgetReservation[]> {
    const where: any = { documentId };
    if (tenantId) where.tenantId = tenantId;

    return this.reservationRepo.find({
      where,
      relations: ['budget'],
      order: { createdAt: 'DESC' },
    });
  }
}
