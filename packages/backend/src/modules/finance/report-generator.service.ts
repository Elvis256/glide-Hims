import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChartOfAccount } from '../../database/entities/chart-of-account.entity';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

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
  async createReportDefinition(definition: Partial<ReportDefinition>): Promise<ReportDefinition> {
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

    return report;
  }

  /**
   * Generate trial balance report
   */
  async generateTrialBalanceReport(facilityId: string, period: string): Promise<ReportData> {
    const accounts = await this.accountRepository.find({
      where: { facilityId },
    });

    const rows = accounts.map((account) => ({
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      debitBalance: 0,
      creditBalance: 0,
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
  async generateIncomeStatement(facilityId: string, period: string): Promise<ReportData> {
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
  async generateBalanceSheet(facilityId: string, period: string): Promise<ReportData> {
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
      budgetedAmount: 0,
      actualAmount: 0,
      varianceAmount: 0,
      variancePercent: 0,
      status: 'on-target',
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
   * Export report to CSV format
   */
  async exportToCSV(report: ReportData): Promise<string> {
    if (!report.rows.length) return '';

    const headers = Object.keys(report.rows[0]).join(',');
    const dataRows = report.rows.map((row) =>
      Object.values(row)
        .map((v) => (typeof v === 'string' ? `"${v}"` : v))
        .join(','),
    );

    return [headers, ...dataRows].join('\n');
  }

  /**
   * Export report to Excel format using xlsx library
   */
  async exportToExcel(report: ReportData): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();

    // Sanitize cell values to prevent formula injection (CWE-1236)
    const FORMULA_LEADERS = /^[=+\-@\t\r\n]/;
    const sanitizedRows = report.rows.map((row) => {
      const clean: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(row)) {
        if (typeof val === 'string' && FORMULA_LEADERS.test(val)) {
          clean[key] = `'${val}`;
        } else {
          clean[key] = val;
        }
      }
      return clean;
    });

    const ws = wb.addWorksheet(report.reportName.substring(0, 31));
    if (report.rows.length > 0) {
      const colKeys = Object.keys(report.rows[0]);
      // Auto-size columns based on content
      ws.columns = colKeys.map((key) => {
        const maxLen = Math.max(
          key.length,
          ...report.rows.map((r) => String(r[key] ?? '').length),
        );
        return { header: key, key, width: Math.min(maxLen + 2, 50) };
      });
      for (const row of sanitizedRows) ws.addRow(row);
    }

    // Add summary sheet if summary data exists
    if (report.summary?.totalValues) {
      const summaryWs = wb.addWorksheet('Summary');
      summaryWs.columns = [
        { header: 'Metric', key: 'Metric' },
        { header: 'Value', key: 'Value' },
      ];
      for (const [key, val] of Object.entries(report.summary.totalValues)) {
        summaryWs.addRow({ Metric: key, Value: val });
      }
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /**
   * Export report to PDF format using pdfkit
   */
  async exportToPDF(report: ReportData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(16).font('Helvetica-Bold').text(report.reportName, { align: 'center' });
      doc.moveDown(0.3);

      // Metadata
      doc.fontSize(9).font('Helvetica');
      doc.text(`Period: ${report.periodCovered}`, { align: 'center' });
      doc.text(`Generated: ${report.generatedAt.toISOString().split('T')[0]}`, {
        align: 'center',
      });
      doc.moveDown(1);

      if (report.rows.length === 0) {
        doc.fontSize(11).text('No data available for this report.');
        doc.end();
        return;
      }

      // Table layout
      const columns = Object.keys(report.rows[0]);
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const colWidth = Math.floor(pageWidth / columns.length);
      const startX = doc.page.margins.left;
      let y = doc.y;

      // Header row
      doc.fontSize(8).font('Helvetica-Bold');
      columns.forEach((col, i) => {
        doc.text(col, startX + i * colWidth, y, {
          width: colWidth - 4,
          align: 'left',
          lineBreak: false,
        });
      });
      y += 14;

      // Divider line
      doc
        .moveTo(startX, y)
        .lineTo(startX + pageWidth, y)
        .stroke();
      y += 4;

      // Data rows
      doc.font('Helvetica').fontSize(7);
      const maxRows = Math.min(report.rows.length, 500); // Cap at 500 for PDF
      for (let r = 0; r < maxRows; r++) {
        // Check if we need a new page
        if (y > doc.page.height - doc.page.margins.bottom - 20) {
          doc.addPage();
          y = doc.page.margins.top;

          // Re-print header on new page
          doc.fontSize(8).font('Helvetica-Bold');
          columns.forEach((col, i) => {
            doc.text(col, startX + i * colWidth, y, {
              width: colWidth - 4,
              align: 'left',
              lineBreak: false,
            });
          });
          y += 14;
          doc
            .moveTo(startX, y)
            .lineTo(startX + pageWidth, y)
            .stroke();
          y += 4;
          doc.font('Helvetica').fontSize(7);
        }

        const row = report.rows[r];
        columns.forEach((col, i) => {
          const val = row[col];
          const text = val instanceof Date ? val.toISOString().split('T')[0] : String(val ?? '');
          doc.text(text, startX + i * colWidth, y, {
            width: colWidth - 4,
            align: typeof val === 'number' ? 'right' : 'left',
            lineBreak: false,
          });
        });
        y += 12;
      }

      if (report.rows.length > maxRows) {
        doc.moveDown(1);
        doc
          .fontSize(8)
          .font('Helvetica-Oblique')
          .text(`... and ${report.rows.length - maxRows} more rows (truncated for PDF)`);
      }

      // Summary footer
      if (report.summary) {
        doc.moveDown(1);
        doc
          .moveTo(startX, doc.y)
          .lineTo(startX + pageWidth, doc.y)
          .stroke();
        doc.moveDown(0.5);
        doc.fontSize(9).font('Helvetica-Bold').text(`Total rows: ${report.summary.totalRows}`);

        if (report.summary.totalValues) {
          for (const [key, val] of Object.entries(report.summary.totalValues)) {
            doc.fontSize(8).font('Helvetica').text(`${key}: ${val}`);
          }
        }
      }

      doc.end();
    });
  }

  /**
   * Build a custom query from report definition
   */
  buildCustomReportQuery(definition: ReportDefinition): {
    sql: string;
    parameters: Record<string, unknown>;
  } {
    const allowedColumns = new Set([
      'id',
      'tenant_id',
      'facility_id',
      'journal_entry_id',
      'account_id',
      'account_code',
      'account_name',
      'debit',
      'credit',
      'description',
      'reference',
      'cost_center',
      'department',
      'created_at',
      'updated_at',
      'journal_date',
      'period_id',
      'status',
      'type',
    ]);
    const allowedDirections = new Set(['ASC', 'DESC']);

    const validateField = (field: string): string => {
      if (!allowedColumns.has(field)) {
        throw new BadRequestException(`Invalid report field: ${field}`);
      }
      return field;
    };

    let sql = 'SELECT ';

    sql += definition.columns.map((col) => validateField(col.field)).join(', ');
    sql += ' FROM journal_entry_lines';

    const parameters: Record<string, unknown> = {};
    let paramIdx = 0;
    const nextParam = (value: unknown): string => {
      const key = `p${paramIdx++}`;
      parameters[key] = value;
      return `:${key}`;
    };

    if (definition.filters.length > 0) {
      const clauses = definition.filters.map((filter) => {
        const field = validateField(filter.field);
        switch (filter.operator) {
          case 'eq':
            return `${field} = ${nextParam(filter.value)}`;
          case 'neq':
            return `${field} != ${nextParam(filter.value)}`;
          case 'gt':
            return `${field} > ${nextParam(filter.value)}`;
          case 'lt':
            return `${field} < ${nextParam(filter.value)}`;
          case 'gte':
            return `${field} >= ${nextParam(filter.value)}`;
          case 'lte':
            return `${field} <= ${nextParam(filter.value)}`;
          case 'in': {
            if (!Array.isArray(filter.value) || filter.value.length === 0) {
              throw new BadRequestException(`Operator 'in' requires a non-empty array value`);
            }
            const placeholders = filter.value.map((v: unknown) => nextParam(v)).join(', ');
            return `${field} IN (${placeholders})`;
          }
          case 'between': {
            if (!Array.isArray(filter.value) || filter.value.length !== 2) {
              throw new BadRequestException(
                `Operator 'between' requires an array of exactly two values`,
              );
            }
            return `${field} BETWEEN ${nextParam(filter.value[0])} AND ${nextParam(filter.value[1])}`;
          }
          default:
            throw new BadRequestException(`Unsupported operator: ${filter.operator}`);
        }
      });
      sql += ' WHERE ' + clauses.join(' AND ');
    }

    if (definition.groupBy && definition.groupBy.length > 0) {
      sql += ' GROUP BY ' + definition.groupBy.map(validateField).join(', ');
    }

    if (definition.sorts && definition.sorts.length > 0) {
      sql +=
        ' ORDER BY ' +
        definition.sorts
          .map((sort) => {
            const field = validateField(sort.field);
            const dir = sort.direction.toUpperCase();
            if (!allowedDirections.has(dir)) {
              throw new BadRequestException(`Invalid sort direction: ${sort.direction}`);
            }
            return `${field} ${dir}`;
          })
          .join(', ');
    }

    return { sql, parameters };
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
