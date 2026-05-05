import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChartOfAccount } from '../../database/entities/chart-of-account.entity';

/**
 * Report Generator Service
 * Builds custom GL reports with flexible filtering and aggregation
 */

export interface ReportColumn {
  field: string;
  label: string;
  dataType: 'number' | 'string' | 'date';
  format?: string;
}

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'between';
  value: any;
}

export interface ReportSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  reportType: 'trial-balance' | 'income-statement' | 'balance-sheet' | 'variance' | 'custom';
  columns: ReportColumn[];
  filters: ReportFilter[];
  sorts: ReportSort[];
  groupBy?: string[];
  aggregations?: Array<{
    field: string;
    function: 'sum' | 'avg' | 'min' | 'max' | 'count';
  }>;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface ReportData {
  reportName: string;
  generatedAt: Date;
  periodCovered: string;
  rows: any[];
  summary?: {
    totalRows: number;
    totalValues?: Record<string, number>;
  };
}

@Injectable()
export class ReportGeneratorService {
  constructor(
    @InjectRepository(ChartOfAccount)
    private readonly accountRepository: Repository<ChartOfAccount>,
  ) {}

  /**
   * Create a custom report definition
   */
  async createReportDefinition(
    definition: Partial<ReportDefinition>,
  ): Promise<ReportDefinition> {
    const report: ReportDefinition = {
      id: `report-${Date.now()}`,
      name: definition.name || 'Custom Report',
      description: definition.description || '',
      reportType: definition.reportType || 'custom',
      columns: definition.columns || [],
      filters: definition.filters || [],
      sorts: definition.sorts || [],
      groupBy: definition.groupBy,
      aggregations: definition.aggregations,
      dateRange: definition.dateRange || {
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
      },
    };

    // TODO: Store in database (for now, just return definition)
    return report;
  }

  /**
   * Generate trial balance report
   */
  async generateTrialBalanceReport(
    facilityId: string,
    period: string,
  ): Promise<ReportData> {
    const accounts = await this.accountRepository.find({
      where: { facilityId },
    });

    const rows = accounts.map((account) => ({
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      debitBalance: 0, // Would populate from GL
      creditBalance: 0, // Would populate from GL
      period,
    }));

    return {
      reportName: 'Trial Balance Report',
      generatedAt: new Date(),
      periodCovered: period,
      rows,
      summary: {
        totalRows: rows.length,
      },
    };
  }

  /**
   * Generate income statement
   */
  async generateIncomeStatement(
    facilityId: string,
    period: string,
  ): Promise<ReportData> {
    const rows = [
      { lineItem: 'REVENUE', amount: 0, type: 'header' },
      { lineItem: 'Operating Revenue', amount: 0, type: 'subtotal' },
      { lineItem: 'Non-Operating Revenue', amount: 0, type: 'subtotal' },
      { lineItem: 'Total Revenue', amount: 0, type: 'total' },
      { lineItem: '', amount: 0, type: 'spacer' },
      { lineItem: 'EXPENSES', amount: 0, type: 'header' },
      { lineItem: 'Salaries & Benefits', amount: 0, type: 'subtotal' },
      { lineItem: 'Medical Supplies', amount: 0, type: 'subtotal' },
      { lineItem: 'Administrative Expenses', amount: 0, type: 'subtotal' },
      { lineItem: 'Depreciation', amount: 0, type: 'subtotal' },
      { lineItem: 'Total Expenses', amount: 0, type: 'total' },
      { lineItem: '', amount: 0, type: 'spacer' },
      { lineItem: 'NET INCOME', amount: 0, type: 'total' },
    ];

    return {
      reportName: 'Income Statement',
      generatedAt: new Date(),
      periodCovered: period,
      rows,
      summary: {
        totalRows: rows.length,
      },
    };
  }

  /**
   * Generate balance sheet
   */
  async generateBalanceSheet(
    facilityId: string,
    period: string,
  ): Promise<ReportData> {
    const rows = [
      { section: 'ASSETS', type: 'header' },
      { section: 'Current Assets', type: 'subtotal', amount: 0 },
      { section: 'Fixed Assets', type: 'subtotal', amount: 0 },
      { section: 'Total Assets', type: 'total', amount: 0 },
      { section: '', type: 'spacer' },
      { section: 'LIABILITIES', type: 'header' },
      { section: 'Current Liabilities', type: 'subtotal', amount: 0 },
      { section: 'Long-term Liabilities', type: 'subtotal', amount: 0 },
      { section: 'Total Liabilities', type: 'total', amount: 0 },
      { section: '', type: 'spacer' },
      { section: 'EQUITY', type: 'header' },
      { section: 'Retained Earnings', type: 'subtotal', amount: 0 },
      { section: 'Total Equity', type: 'total', amount: 0 },
      { section: '', type: 'spacer' },
      {
        section: 'TOTAL LIABILITIES & EQUITY',
        type: 'total',
        amount: 0,
      },
    ];

    return {
      reportName: 'Balance Sheet',
      generatedAt: new Date(),
      periodCovered: period,
      rows,
      summary: {
        totalRows: rows.length,
      },
    };
  }

  /**
   * Generate variance analysis report
   */
  async generateVarianceReport(
    facilityId: string,
    period: string,
    budget?: string,
  ): Promise<ReportData> {
    const accounts = await this.accountRepository.find({
      where: { facilityId },
    });

    const rows = accounts.map((account) => ({
      accountCode: account.accountCode,
      accountName: account.accountName,
      budgetedAmount: 0, // Would populate from budget
      actualAmount: 0, // Would populate from GL
      varianceAmount: 0, // budgeted - actual
      variancePercent: 0, // (variance / budgeted) * 100
      status: 'on-target', // under, on-target, over
    }));

    return {
      reportName: 'Variance Analysis Report',
      generatedAt: new Date(),
      periodCovered: `${period} vs Budget ${budget || period}`,
      rows,
      summary: {
        totalRows: rows.length,
      },
    };
  }

  /**
   * Export report to CSV format (stub)
   */
  async exportToCSV(report: ReportData): Promise<string> {
    // CSV header
    const headers = Object.keys(report.rows[0] || {}).join(',');
    
    // CSV data rows
    const dataRows = report.rows.map((row) =>
      Object.values(row)
        .map((v) => (typeof v === 'string' ? `"${v}"` : v))
        .join(','),
    );

    return [headers, ...dataRows].join('\n');
  }

  /**
   * Export report to Excel format (stub)
   * In production, would use a library like xlsx or exceljs
   */
  async exportToExcel(report: ReportData): Promise<Buffer> {
    // Stub: would use xlsx library in production
    const csv = await this.exportToCSV(report);
    return Buffer.from(csv, 'utf-8');
  }

  /**
   * Export report to PDF format (stub)
   * In production, would use a library like pdfkit or puppeteer
   */
  async exportToPDF(report: ReportData): Promise<Buffer> {
    // Stub: would use pdfkit or puppeteer in production
    const csv = await this.exportToCSV(report);
    return Buffer.from(csv, 'utf-8');
  }

  /**
   * Build a custom query from report definition
   * (This would be used to generate the SQL query for custom reports)
   */
  buildCustomReportQuery(definition: ReportDefinition): string {
    // Stub: builds SQL from report definition
    let query = 'SELECT ';

    // Add columns
    query += definition.columns.map((col) => col.field).join(', ');
    query += ' FROM journal_entry_lines';

    // Add filters
    if (definition.filters.length > 0) {
      query += ' WHERE ' + this.buildWhereClause(definition.filters);
    }

    // Add group by
    if (definition.groupBy && definition.groupBy.length > 0) {
      query += ' GROUP BY ' + definition.groupBy.join(', ');
    }

    // Add sorting
    if (definition.sorts && definition.sorts.length > 0) {
      query +=
        ' ORDER BY ' +
        definition.sorts
          .map((sort) => `${sort.field} ${sort.direction.toUpperCase()}`)
          .join(', ');
    }

    return query;
  }

  /**
   * Helper: Build WHERE clause from filters
   */
  private buildWhereClause(filters: ReportFilter[]): string {
    return filters
      .map((filter) => {
        switch (filter.operator) {
          case 'eq':
            return `${filter.field} = ${filter.value}`;
          case 'neq':
            return `${filter.field} != ${filter.value}`;
          case 'gt':
            return `${filter.field} > ${filter.value}`;
          case 'lt':
            return `${filter.field} < ${filter.value}`;
          case 'gte':
            return `${filter.field} >= ${filter.value}`;
          case 'lte':
            return `${filter.field} <= ${filter.value}`;
          case 'in':
            return `${filter.field} IN (${filter.value.join(',')})`;
          case 'between':
            return `${filter.field} BETWEEN ${filter.value[0]} AND ${filter.value[1]}`;
          default:
            return '';
        }
      })
      .join(' AND ');
  }

  /**
   * Get pre-built standard reports
   */
  getStandardReports(): ReportDefinition[] {
    return [
      {
        id: 'std-trial-balance',
        name: 'Trial Balance',
        description: 'Standard trial balance report',
        reportType: 'trial-balance',
        columns: [
          { field: 'accountCode', label: 'Account Code', dataType: 'string' },
          { field: 'accountName', label: 'Account Name', dataType: 'string' },
          { field: 'debitBalance', label: 'Debit', dataType: 'number' },
          { field: 'creditBalance', label: 'Credit', dataType: 'number' },
        ],
        filters: [],
        sorts: [{ field: 'accountCode', direction: 'asc' }],
        dateRange: {
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        },
      },
      {
        id: 'std-income-statement',
        name: 'Income Statement',
        description: 'Revenue and expense summary',
        reportType: 'income-statement',
        columns: [
          { field: 'lineItem', label: 'Line Item', dataType: 'string' },
          { field: 'amount', label: 'Amount', dataType: 'number' },
        ],
        filters: [],
        sorts: [],
        dateRange: {
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        },
      },
      {
        id: 'std-balance-sheet',
        name: 'Balance Sheet',
        description: 'Assets, liabilities, and equity',
        reportType: 'balance-sheet',
        columns: [
          { field: 'section', label: 'Section', dataType: 'string' },
          { field: 'amount', label: 'Amount', dataType: 'number' },
        ],
        filters: [],
        sorts: [],
        dateRange: {
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        },
      },
      {
        id: 'std-variance',
        name: 'Budget vs Actual Variance',
        description: 'Variance analysis report',
        reportType: 'variance',
        columns: [
          { field: 'accountCode', label: 'Account Code', dataType: 'string' },
          { field: 'budgetedAmount', label: 'Budget', dataType: 'number' },
          { field: 'actualAmount', label: 'Actual', dataType: 'number' },
          { field: 'varianceAmount', label: 'Variance', dataType: 'number' },
          { field: 'variancePercent', label: 'Variance %', dataType: 'number' },
        ],
        filters: [],
        sorts: [{ field: 'variancePercent', direction: 'desc' }],
        dateRange: {
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        },
      },
    ];
  }
}
