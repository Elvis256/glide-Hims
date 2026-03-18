import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget, BudgetLine, BudgetStatus } from '../../database/entities/finance-extended.entity';

@Injectable()
export class BudgetService {
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
           AND je.entry_date <= (SELECT end_date FROM fiscal_periods WHERE fiscal_year = $2 AND period = $3 LIMIT 1)`,
        [line.accountId, budget.fiscalYear, line.period],
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
}
