import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ChartOfAccount, AccountType } from '../../database/entities/chart-of-account.entity';
import { JournalEntry, JournalStatus } from '../../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';

/**
 * GL Analytics Service
 * Provides trend analysis, multi-period aggregations, and variance calculations
 */

export interface TrendLine {
  period: string;
  periodId: string;
  debitAmount: number;
  creditAmount: number;
  netAmount: number;
  balance: number;
}

export interface AccountTrend {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  trends: TrendLine[];
  minBalance: number;
  maxBalance: number;
  averageBalance: number;
  changePercent: number;
}

export interface PeriodComparison {
  period1Id: string;
  period1Name: string;
  period2Id: string;
  period2Name: string;
  accounts: {
    accountCode: string;
    accountName: string;
    period1Balance: number;
    period2Balance: number;
    absoluteChange: number;
    percentChange: number;
    variance: 'increase' | 'decrease' | 'no-change';
  }[];
}

export interface AggregatedGLData {
  facilityId: string;
  period: string;
  totalDebits: number;
  totalCredits: number;
  difference: number;
  accountCount: number;
  lineItemCount: number;
  lastUpdated: Date;
}

@Injectable()
export class GLAnalyticsService {
  constructor(
    @InjectRepository(ChartOfAccount)
    private readonly accountRepository: Repository<ChartOfAccount>,
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepository: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine)
    private readonly journalEntryLineRepository: Repository<JournalEntryLine>,
  ) {}

  /**
   * Get multi-period trend analysis for an account
   * Shows debit, credit, and balance progression over time
   */
  async getAccountTrends(
    facilityId: string,
    accountId: string,
    startPeriod: string,
    endPeriod: string,
  ): Promise<AccountTrend> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, facilityId },
    });

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    // Parse period strings (YYYY-MM) and compute proper month boundaries.
    const [sY, sM] = startPeriod.split('-').map((n) => parseInt(n, 10));
    const [eY, eM] = endPeriod.split('-').map((n) => parseInt(n, 10));
    const startDate = new Date(sY, sM - 1, 1);
    const endDate = new Date(eY, eM, 0); // day 0 of next month = last day of endPeriod

    const lines = await this.journalEntryLineRepository.find({
      where: {
        accountId,
        journalEntry: {
          facilityId,
          status: JournalStatus.POSTED,
          journalDate: Between(startDate, endDate),
        },
      },
      relations: ['journalEntry'],
    });

    // Group by period
    const periodMap = new Map<
      string,
      { debits: number; credits: number; entries: number }
    >();

    lines.forEach((line) => {
      const period = line.journalEntry.journalDate
        .toISOString()
        .substring(0, 7);
      if (!periodMap.has(period)) {
        periodMap.set(period, { debits: 0, credits: 0, entries: 0 });
      }
      const data = periodMap.get(period)!;
      data.debits += line.debit;
      data.credits += line.credit;
      data.entries += 1;
    });

    // Build trend array
    const trends: TrendLine[] = [];
    let runningBalance = 0;

    const sortedPeriods = Array.from(periodMap.keys()).sort();
    sortedPeriods.forEach((period) => {
      const data = periodMap.get(period)!;
      const netAmount = data.debits - data.credits;
      runningBalance += netAmount;

      trends.push({
        period,
        periodId: period,
        debitAmount: data.debits,
        creditAmount: data.credits,
        netAmount,
        balance: runningBalance,
      });
    });

    // Calculate statistics
    const balances = trends.map((t) => t.balance);
    const minBalance = Math.min(...balances);
    const maxBalance = Math.max(...balances);
    const averageBalance = balances.reduce((a, b) => a + b, 0) / balances.length;
    const changePercent =
      trends.length > 1 && trends[0].balance !== 0
        ? ((trends[trends.length - 1].balance - trends[0].balance) /
            Math.abs(trends[0].balance)) *
          100
        : 0;

    return {
      accountId,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      trends,
      minBalance,
      maxBalance,
      averageBalance,
      changePercent,
    };
  }

  /**
   * Compare account balances between two periods
   */
  async compareAccountsBetweenPeriods(
    facilityId: string,
    period1: string,
    period2: string,
  ): Promise<PeriodComparison> {
    const startDate1 = new Date(`${period1}-01`);
    const endDate1 = new Date(
      `${period1}-${new Date(period1 + '-01').getDate()}`,
    );
    const startDate2 = new Date(`${period2}-01`);
    const endDate2 = new Date(
      `${period2}-${new Date(period2 + '-01').getDate()}`,
    );

    // Get all lines for period1
    const lines1 = await this.journalEntryLineRepository.find({
      where: {
        journalEntry: {
          facilityId,
          status: JournalStatus.POSTED,
          journalDate: Between(startDate1, endDate1),
        },
      },
      relations: ['account', 'journalEntry'],
    });

    // Get all lines for period2
    const lines2 = await this.journalEntryLineRepository.find({
      where: {
        journalEntry: {
          facilityId,
          status: JournalStatus.POSTED,
          journalDate: Between(startDate2, endDate2),
        },
      },
      relations: ['account', 'journalEntry'],
    });

    // Calculate balances by account for each period
    const period1Balances = this.aggregateLinesByAccount(lines1);
    const period2Balances = this.aggregateLinesByAccount(lines2);

    // Compare
    const allAccountCodes = new Set([
      ...period1Balances.keys(),
      ...period2Balances.keys(),
    ]);

    const comparisons = Array.from(allAccountCodes).map((code) => {
      const p1Balance = period1Balances.get(code) || 0;
      const p2Balance = period2Balances.get(code) || 0;
      const absoluteChange = p2Balance - p1Balance;
      const percentChange =
        p1Balance !== 0 ? (absoluteChange / Math.abs(p1Balance)) * 100 : 0;

      return {
        accountCode: code,
        accountName: 'Account', // Would need to lookup actual name
        period1Balance: p1Balance,
        period2Balance: p2Balance,
        absoluteChange,
        percentChange,
        variance: (
          absoluteChange > 0.01
            ? 'increase'
            : absoluteChange < -0.01
              ? 'decrease'
              : 'no-change'
        ) as 'increase' | 'decrease' | 'no-change',
      };
    });

    return {
      period1Id: period1,
      period1Name: period1,
      period2Id: period2,
      period2Name: period2,
      accounts: comparisons,
    };
  }

  /**
   * Get aggregated GL data for a period
   * Total debits, credits, item counts, etc.
   */
  async getAggregatedGLData(
    facilityId: string,
    period: string,
  ): Promise<AggregatedGLData> {
    const startDate = new Date(`${period}-01`);
    const endDate = new Date(
      `${period}-${new Date(period + '-01').getDate()}`,
    );

    const lines = await this.journalEntryLineRepository.find({
      where: {
        journalEntry: {
          facilityId,
          status: JournalStatus.POSTED,
          journalDate: Between(startDate, endDate),
        },
      },
      relations: ['journalEntry'],
    });

    const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredits = lines.reduce(
      (sum, line) => sum + line.credit,
      0,
    );

    const uniqueAccounts = new Set(lines.map((l) => l.accountId)).size;
    const entries = new Set(lines.map((l) => l.journalEntryId)).size;

    return {
      facilityId,
      period,
      totalDebits,
      totalCredits,
      difference: totalDebits - totalCredits,
      accountCount: uniqueAccounts,
      lineItemCount: lines.length,
      lastUpdated: new Date(),
    };
  }

  /**
   * Calculate variance analysis for an account
   * Compares actual GL balance to expected/budget
   */
  async calculateVarianceAnalysis(
    facilityId: string,
    accountId: string,
    period: string,
    expectedBalance?: number,
  ): Promise<{
    accountCode: string;
    period: string;
    actualBalance: number;
    expectedBalance: number;
    absoluteVariance: number;
    percentVariance: number;
    isSignificant: boolean;
  }> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, facilityId },
    });

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    const startDate = new Date(`${period}-01`);
    const endDate = new Date(
      `${period}-${new Date(period + '-01').getDate()}`,
    );

    const lines = await this.journalEntryLineRepository.find({
      where: {
        accountId,
        journalEntry: {
          facilityId,
          status: JournalStatus.POSTED,
          journalDate: Between(startDate, endDate),
        },
      },
      relations: ['journalEntry'],
    });

    const actualBalance = lines.reduce(
      (sum, line) => sum + (line.debit - line.credit),
      0,
    );

    const expected = expectedBalance || 0;
    const absoluteVariance = actualBalance - expected;
    const percentVariance =
      expected !== 0 ? Math.abs(absoluteVariance / expected) * 100 : 0;

    return {
      accountCode: account.accountCode,
      period,
      actualBalance,
      expectedBalance: expected,
      absoluteVariance,
      percentVariance,
      isSignificant: percentVariance > 5 || Math.abs(absoluteVariance) > 1000,
    };
  }

  /**
   * Helper: Aggregate journal lines by account
   */
  private aggregateLinesByAccount(
    lines: JournalEntryLine[],
  ): Map<string, number> {
    const balances = new Map<string, number>();

    lines.forEach((line) => {
      const code = line.account?.accountCode || 'UNKNOWN';
      const balance = balances.get(code) || 0;
      balances.set(code, balance + (line.debit - line.credit));
    });

    return balances;
  }

  /**
   * Get top accounts by debit/credit volume
   */
  async getTopAccountsByVolume(
    facilityId: string,
    period: string,
    limit: number = 10,
  ): Promise<
    Array<{
      accountCode: string;
      accountName: string;
      debitVolume: number;
      creditVolume: number;
      netVolume: number;
      entryCount: number;
    }>
  > {
    const startDate = new Date(`${period}-01`);
    const endDate = new Date(
      `${period}-${new Date(period + '-01').getDate()}`,
    );

    const lines = await this.journalEntryLineRepository.find({
      where: {
        journalEntry: {
          facilityId,
          status: JournalStatus.POSTED,
          journalDate: Between(startDate, endDate),
        },
      },
      relations: ['account', 'journalEntry'],
    });

    const accountVolumes = new Map<
      string,
      {
        code: string;
        name: string;
        debits: number;
        credits: number;
        entries: number;
      }
    >();

    lines.forEach((line) => {
      const code = line.account!.accountCode;
      if (!accountVolumes.has(code)) {
        accountVolumes.set(code, {
          code,
          name: line.account!.accountName,
          debits: 0,
          credits: 0,
          entries: 0,
        });
      }
      const vol = accountVolumes.get(code)!;
      vol.debits += line.debit;
      vol.credits += line.credit;
      vol.entries += 1;
    });

    return Array.from(accountVolumes.values())
      .sort(
        (a, b) =>
          Math.abs(b.debits + b.credits) - Math.abs(a.debits + a.credits),
      )
      .slice(0, limit)
      .map((v) => ({
        accountCode: v.code,
        accountName: v.name,
        debitVolume: v.debits,
        creditVolume: v.credits,
        netVolume: v.debits - v.credits,
        entryCount: v.entries,
      }));
  }
}
