import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget, BudgetLine, BudgetStatus } from '../../database/entities/finance-extended.entity';

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
    dto: { accountId: string; costCenterId?: string; period: number; budgetedAmount: number; notes?: string },
    tenantId?: string,
  ): Promise<BudgetLine> {
    await this.findOne(budgetId, tenantId);
    const line = this.budgetLineRepo.create({ ...dto, budgetId, ...(tenantId ? { tenantId } : {}) });
    return this.budgetLineRepo.save(line);
  }

  async updateLine(lineId: string, dto: Partial<BudgetLine>, tenantId?: string): Promise<BudgetLine> {
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
        `SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) as actual
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE jel.account_id = $1
           AND je.status = 'posted'
           AND je.entry_date >= (SELECT start_date FROM fiscal_periods WHERE fiscal_year = $2 AND period = $3 LIMIT 1)
           AND je.entry_date <= (SELECT end_date FROM fiscal_periods WHERE fiscal_year = $2 AND period = $3 LIMIT 1)
           AND je.tenant_id = $4`,
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
        variancePercent: budgetedAmt > 0 ? (((budgetedAmt - actualAmount) / budgetedAmt) * 100).toFixed(1) : 0,
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
    const line = (budget.lines || []).find(
      (l) => l.accountId === accountId && l.period === period,
    );
    if (!line) return null; // No budget line for this account/period

    const actual = await this.budgetLineRepo.query(
      `SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) as actual
       FROM journal_entry_lines jel
       JOIN journal_entries je ON jel.journal_entry_id = je.id
       WHERE jel.account_id = $1
         AND je.status = 'posted'
         AND je.entry_date >= (SELECT start_date FROM fiscal_periods WHERE fiscal_year = $2 AND period = $3 LIMIT 1)
         AND je.entry_date <= (SELECT end_date FROM fiscal_periods WHERE fiscal_year = $2 AND period = $3 LIMIT 1)
         AND je.tenant_id = $4`,
      [accountId, budget.fiscalYear, period, tenantId],
    );

    const actualSpent = Number(actual[0]?.actual || 0);
    const budgetedAmount = Number(line.budgetedAmount);
    const remainingBudget = budgetedAmount - actualSpent;

    return {
      withinBudget: proposedAmount <= remainingBudget,
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
      this.logger.warn(`No budget line found for account ${accountId} in facility ${facilityId} — skipping enforcement`);
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
}
