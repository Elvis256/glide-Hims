import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { JournalEntry, JournalStatus } from '../../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { ChartOfAccount, AccountType } from '../../database/entities/chart-of-account.entity';
import { FiscalPeriod } from '../../database/entities/fiscal-period.entity';

/**
 * Trial Balance Line (for display)
 */
export interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
}

/**
 * Trial Balance Result
 */
export interface TrialBalance {
  lines: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  imbalanceAmount: number;
  generatedAt: Date;
}

/**
 * Reconciliation Status
 */
export interface ReconciliationStatus {
  accountId: string;
  accountCode: string;
  accountName: string;
  totalAmount: number;
  reconciledAmount: number;
  unmatchedAmount: number;
  percentageReconciled: number;
  lastReconciledAt?: Date;
}

/**
 * Variance Analysis
 */
export interface VarianceItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  expectedAmount: number;
  actualAmount: number;
  variance: number;
  variancePercent: number;
  isSignificant: boolean; // >5% or >$1000
}

/**
 * Period Comparison
 */
export interface PeriodComparison {
  period1Id: string;
  period1TrialBalance: TrialBalance;
  period2Id: string;
  period2TrialBalance: TrialBalance;
  accountChanges: Array<{
    accountId: string;
    accountName: string;
    period1Debit: number;
    period1Credit: number;
    period2Debit: number;
    period2Credit: number;
    debitChange: number;
    creditChange: number;
  }>;
}

@Injectable()
export class TrialBalanceService {
  constructor(
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepo: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine)
    private readonly journalEntryLineRepo: Repository<JournalEntryLine>,
    @InjectRepository(ChartOfAccount)
    private readonly chartOfAccountRepo: Repository<ChartOfAccount>,
    @InjectRepository(FiscalPeriod)
    private readonly fiscalPeriodRepo: Repository<FiscalPeriod>,
  ) {}

  /**
   * Get trial balance for a facility and period
   * Groups all GL entries by account and sums debits/credits
   */
  async getTrialBalance(
    facilityId: string,
    fiscalPeriodId: string,
  ): Promise<TrialBalance> {
    // Verify fiscal period exists
    const period = await this.fiscalPeriodRepo.findOne({
      where: { id: fiscalPeriodId },
    });

    if (!period) {
      throw new NotFoundException(`Fiscal period ${fiscalPeriodId} not found`);
    }

    // Get all POSTED journal entries for this period
    const entries = await this.journalEntryRepo.find({
      where: {
        facilityId,
        fiscalPeriodId,
        status: JournalStatus.POSTED,
      },
    });

    if (entries.length === 0) {
      // Return empty trial balance
      return {
        lines: [],
        totalDebit: 0,
        totalCredit: 0,
        balanced: true,
        imbalanceAmount: 0,
        generatedAt: new Date(),
      };
    }

    // Get all entry IDs
    const entryIds = entries.map((e) => e.id);

    // Get all lines for these entries
    const lines = await this.journalEntryLineRepo.find({
      where: {
        journalEntryId: In(entryIds),
      },
      relations: ['account'],
    });

    // Group by account and sum debits/credits
    const accountMap = new Map<string, { debit: number; credit: number; account: ChartOfAccount }>();

    for (const line of lines) {
      if (!accountMap.has(line.accountId)) {
        accountMap.set(line.accountId, {
          debit: 0,
          credit: 0,
          account: line.account,
        });
      }

      const entry = accountMap.get(line.accountId);
      if (entry) {
        entry.debit += line.debit;
        entry.credit += line.credit;
      }
    }

    // Build trial balance lines
    const trialBalanceLines: TrialBalanceLine[] = Array.from(accountMap.values()).map((item) => ({
      accountId: item.account.id,
      accountCode: item.account.accountCode,
      accountName: item.account.accountName,
      accountType: item.account.accountType,
      debit: item.debit,
      credit: item.credit,
    }));

    // Calculate totals
    const totalDebit = trialBalanceLines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = trialBalanceLines.reduce((sum, line) => sum + line.credit, 0);

    // Check if balanced (allow for rounding)
    const imbalanceAmount = Math.abs(totalDebit - totalCredit);
    const balanced = imbalanceAmount < 0.01; // Within 1 cent

    return {
      lines: trialBalanceLines.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      balanced,
      imbalanceAmount: Math.round(imbalanceAmount * 100) / 100,
      generatedAt: new Date(),
    };
  }

  /**
   * Get reconciliation status for all accounts
   * Shows how much of each account balance has been reconciled
   */
  async getReconciliationStatus(
    facilityId: string,
    fiscalPeriodId: string,
  ): Promise<ReconciliationStatus[]> {
    const trialBalance = await this.getTrialBalance(facilityId, fiscalPeriodId);

    // For now, assume all posted entries are reconciled
    // In a real system, this would check against reconciliation_items table
    const statuses: ReconciliationStatus[] = trialBalance.lines.map((line) => {
      const totalAmount = line.debit + line.credit;
      return {
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        totalAmount,
        reconciledAmount: totalAmount, // Simplified: all posted are reconciled
        unmatchedAmount: 0,
        percentageReconciled: totalAmount > 0 ? 100 : 0,
        lastReconciledAt: new Date(),
      };
    });

    return statuses;
  }

  /**
   * Detect variances in trial balance
   * Compared to expected balances (from previous period or budget)
   */
  async detectVariances(
    facilityId: string,
    fiscalPeriodId: string,
    expectedBalances?: Map<string, number>,
  ): Promise<VarianceItem[]> {
    const trialBalance = await this.getTrialBalance(facilityId, fiscalPeriodId);

    const variances: VarianceItem[] = [];
    const varianceThreshold = 0.05; // 5%
    const dollarThreshold = 1000; // $1000

    for (const line of trialBalance.lines) {
      const actualAmount = line.debit + line.credit;

      // If we have expected balances, compare
      if (expectedBalances && expectedBalances.has(line.accountId)) {
        const expectedAmount = expectedBalances.get(line.accountId) || 0;
        const variance = actualAmount - expectedAmount;
        const variancePercent = expectedAmount !== 0 ? (variance / expectedAmount) * 100 : 0;

        const isSignificant =
          Math.abs(variancePercent) > varianceThreshold || Math.abs(variance) > dollarThreshold;

        if (isSignificant) {
          variances.push({
            accountId: line.accountId,
            accountCode: line.accountCode,
            accountName: line.accountName,
            expectedAmount,
            actualAmount,
            variance,
            variancePercent,
            isSignificant: true,
          });
        }
      }
    }

    return variances.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  }

  /**
   * Compare trial balance between two fiscal periods
   */
  async comparePeriodsTrialBalance(
    facilityId: string,
    period1Id: string,
    period2Id: string,
  ): Promise<PeriodComparison> {
    const [period1TB, period2TB] = await Promise.all([
      this.getTrialBalance(facilityId, period1Id),
      this.getTrialBalance(facilityId, period2Id),
    ]);

    // Build map of period 1 accounts
    const period1Map = new Map<string, TrialBalanceLine>();
    for (const line of period1TB.lines) {
      period1Map.set(line.accountId, line);
    }

    // Build map of period 2 accounts
    const period2Map = new Map<string, TrialBalanceLine>();
    for (const line of period2TB.lines) {
      period2Map.set(line.accountId, line);
    }

    // Get all unique accounts
    const allAccountIds = new Set([...period1Map.keys(), ...period2Map.keys()]);

    // Build comparison
    const accountChanges = Array.from(allAccountIds).map((accountId) => {
      const p1Line = period1Map.get(accountId) || {
        accountId,
        accountCode: '',
        accountName: '',
        accountType: AccountType.ASSET,
        debit: 0,
        credit: 0,
      };
      const p2Line = period2Map.get(accountId) || {
        accountId,
        accountCode: '',
        accountName: '',
        accountType: AccountType.ASSET,
        debit: 0,
        credit: 0,
      };

      return {
        accountId,
        accountName: p1Line.accountName || p2Line.accountName,
        period1Debit: p1Line.debit,
        period1Credit: p1Line.credit,
        period2Debit: p2Line.debit,
        period2Credit: p2Line.credit,
        debitChange: p2Line.debit - p1Line.debit,
        creditChange: p2Line.credit - p1Line.credit,
      };
    });

    return {
      period1Id,
      period1TrialBalance: period1TB,
      period2Id,
      period2TrialBalance: period2TB,
      accountChanges: accountChanges.sort((a, b) =>
        Math.abs(b.debitChange + b.creditChange) - Math.abs(a.debitChange + a.creditChange),
      ),
    };
  }

  /**
   * Get trial balance for a specific account
   */
  async getAccountBalance(
    accountId: string,
    fiscalPeriodId: string,
  ): Promise<{ debit: number; credit: number; balance: number }> {
    const lines = await this.journalEntryLineRepo
      .createQueryBuilder('jel')
      .innerJoin('jel.journalEntry', 'je')
      .where('jel.account_id = :accountId', { accountId })
      .andWhere('je.fiscal_period_id = :fiscalPeriodId', { fiscalPeriodId })
      .andWhere('je.status = :status', { status: JournalStatus.POSTED })
      .select('SUM(jel.debit)', 'debit')
      .addSelect('SUM(jel.credit)', 'credit')
      .getRawOne();

    const debit = lines?.debit || 0;
    const credit = lines?.credit || 0;

    return {
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
      balance: Math.round((debit - credit) * 100) / 100,
    };
  }

  /**
   * Get accounts by type (for filtering)
   */
  async getAccountsByType(
    facilityId: string,
    accountType: AccountType,
  ): Promise<ChartOfAccount[]> {
    return await this.chartOfAccountRepo.find({
      where: {
        facilityId,
        accountType,
      },
      order: { accountCode: 'ASC' },
    });
  }
}
