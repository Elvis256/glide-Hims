import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import hrService from '../../../services/hr';
import { useFacilityId } from '../../../lib/facility';
import { useInstitutionInfo } from '../../../lib/useInstitutionInfo';
import { formatCurrency } from '../../../lib/currency';
import { toast } from 'sonner';
import {
  FileText,
  Download,
  DollarSign,
  Building2,
  Users,
  TrendingUp,
  Printer,
  Calendar,
  Loader2,
  ChevronDown,
  BarChart3,
  Shield,
  FileSpreadsheet,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: string;
  facilityId: string;
  totalGross: number;
  totalNet: number;
  employeeCount: number;
}

interface Payslip {
  employeeName: string;
  employeeNumber: string;
  basicSalary: number;
  grossSalary: number;
  paye: number;
  nssfEmployee: number;
  nssfEmployer: number;
  totalDeductions: number;
  netSalary: number;
}

interface PayrollReport {
  id: string;
  month: number;
  year: number;
  status: string;
  payslipCount: number;
  totalPaye: number;
  totalNssfEmployee: number;
  totalNssfEmployer: number;
  totalNssf: number;
  payslips: Payslip[];
}

interface TaxMonthEntry {
  month: number;
  year: number;
  totalGross: number;
  totalPaye: number;
  totalNssfEmployee: number;
  totalNssfEmployer: number;
  employeeCount: number;
}

interface TaxReport {
  year: number;
  months: TaxMonthEntry[];
  total: {
    gross: number;
    paye: number;
    nssfEmployee: number;
    nssfEmployer: number;
  };
}

type ReportTab = 'payroll-summary' | 'paye-report' | 'nssf-report' | 'year-end';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_ABBREV = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmtMoney(amount: number | undefined | null): string {
  return formatCurrency(amount ?? 0);
}

function fmtMoneyRaw(amount: number | undefined | null): string {
  const val = Number(amount ?? 0);
  return `UGX ${val.toLocaleString('en-UG')}`;
}

function n(val: any): number {
  return Number(val ?? 0);
}

function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  inst?: InstitutionProfile,
) {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // Company profile header rows
  const profileRows: string[] = [];
  if (inst?.name) profileRows.push(escape(inst.name));
  const contactParts: string[] = [];
  if (inst?.address) contactParts.push(inst.address);
  if (inst?.phone) contactParts.push(`Tel: ${inst.phone}`);
  if (inst?.email) contactParts.push(inst.email);
  if (inst?.taxId) contactParts.push(`TIN: ${inst.taxId}`);
  if (contactParts.length > 0) profileRows.push(escape(contactParts.join(' | ')));
  if (profileRows.length > 0) profileRows.push(''); // blank separator line

  const dataLines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))];
  const csv = [...profileRows, ...dataLines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function currentYear(): number {
  return new Date().getFullYear();
}

function yearOptions(): number[] {
  const now = currentYear();
  return Array.from({ length: 6 }, (_, i) => now - i);
}

interface InstitutionProfile {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  taxId?: string;
}

function addPdfHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  inst: InstitutionProfile,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const companyName = inst.name || 'Organization';
  let y = 10;

  // Logo (left-aligned)
  if (inst.logo && inst.logo.startsWith('data:image')) {
    try {
      doc.addImage(inst.logo, 'PNG', 14, y, 20, 20);
      // Company name next to logo
      doc.setTextColor(30, 58, 138);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(companyName, 38, y + 8);

      // Contact line below name, next to logo
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const contactParts: string[] = [];
      if (inst.address) contactParts.push(inst.address);
      if (inst.phone) contactParts.push(`Tel: ${inst.phone}`);
      if (inst.email) contactParts.push(inst.email);
      if (inst.taxId) contactParts.push(`TIN: ${inst.taxId}`);
      if (contactParts.length > 0) {
        const contactLine = contactParts.join('  |  ');
        const maxWidth = pageWidth - 52;
        const lines = doc.splitTextToSize(contactLine, maxWidth);
        doc.text(lines, 38, y + 14);
        y += 20 + (lines.length > 1 ? lines.length * 3 : 0);
      } else {
        y += 22;
      }
    } catch {
      // Logo failed — fall back to text-only
      y = addTextOnlyHeader(doc, companyName, inst, y);
    }
  } else {
    y = addTextOnlyHeader(doc, companyName, inst, y);
  }

  // Separator line
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.4);
  doc.line(14, y, pageWidth - 14, y);
  y += 4;

  // Blue title bar
  doc.setFillColor(59, 130, 246);
  doc.rect(14, y, pageWidth - 28, 16, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, 20, y + 7);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 20, y + 13);

  y += 20;
  doc.setTextColor(0, 0, 0);
  return y;
}

function addTextOnlyHeader(doc: jsPDF, companyName: string, inst: InstitutionProfile, y: number): number {
  doc.setTextColor(30, 58, 138);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(companyName, 14, y + 6);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const parts: string[] = [];
  if (inst.address) parts.push(inst.address);
  if (inst.phone) parts.push(`Tel: ${inst.phone}`);
  if (inst.email) parts.push(inst.email);
  if (inst.taxId) parts.push(`TIN: ${inst.taxId}`);
  if (parts.length > 0) {
    doc.text(parts.join('  |  '), 14, y + 4);
    y += 8;
  }
  return y;
}

function addPdfFooter(doc: jsPDF) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);

    doc.line(14, pageHeight - 18, pageWidth - 14, pageHeight - 18);

    const dateStr = `Generated on ${new Date().toLocaleDateString('en-UG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })} at ${new Date().toLocaleTimeString('en-UG')}`;

    doc.text(dateStr, 14, pageHeight - 12);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 12, {
      align: 'right',
    });
  }
}

// ─── Tabs Config ─────────────────────────────────────────────────────────────

const TABS: { key: ReportTab; label: string; icon: React.ReactNode }[] = [
  { key: 'payroll-summary', label: 'Payroll Summary', icon: <FileText className="w-4 h-4" /> },
  { key: 'paye-report', label: 'PAYE Tax Report', icon: <DollarSign className="w-4 h-4" /> },
  { key: 'nssf-report', label: 'NSSF Remittance', icon: <Shield className="w-4 h-4" /> },
  { key: 'year-end', label: 'Year-End Summary', icon: <BarChart3 className="w-4 h-4" /> },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function PayrollReportsPage() {
  const facilityId = useFacilityId();
  const inst = useInstitutionInfo();
  const companyName = inst?.name || 'Organization';

  const [selectedYear, setSelectedYear] = useState<number>(currentYear());
  const [activeTab, setActiveTab] = useState<ReportTab>('payroll-summary');
  const [selectedRunId, setSelectedRunId] = useState<string>('');

  // ── Queries ──────────────────────────────────────────────────────────────

  const {
    data: payrollRuns = [],
    isLoading: runsLoading,
  } = useQuery<PayrollRun[]>({
    queryKey: ['payroll-runs', facilityId, selectedYear],
    queryFn: async () => {
      try {
        return await hrService.payroll.list({
          facilityId,
          year: selectedYear,
        });
      } catch {
        return [];
      }
    },
    enabled: !!facilityId,
  });

  const processedRuns = useMemo(
    () => payrollRuns.filter((r) => r.status === 'completed' || r.status === 'paid'),
    [payrollRuns],
  );

  const {
    data: payrollReport,
    isLoading: reportLoading,
  } = useQuery<PayrollReport>({
    queryKey: ['payroll-report', selectedRunId],
    queryFn: async () => {
      try {
        return await hrService.payrollReport(selectedRunId);
      } catch (err) {
        toast.error('Failed to load payroll report');
        throw err;
      }
    },
    enabled: !!selectedRunId,
  });

  const {
    data: taxReport,
    isLoading: taxLoading,
  } = useQuery<TaxReport>({
    queryKey: ['tax-report', selectedYear, facilityId],
    queryFn: async () => {
      try {
        return await hrService.taxReport(selectedYear, facilityId);
      } catch {
        return { year: selectedYear, months: [], total: { gross: 0, paye: 0, nssfEmployee: 0, nssfEmployer: 0 } };
      }
    },
    enabled: !!facilityId,
  });

  // ── Computed Stats ───────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!taxReport) {
      return { totalExpense: 0, totalPaye: 0, totalNssf: 0, avgNet: 0, totalNet: 0 };
    }
    const totalNssf = (taxReport.total.nssfEmployee ?? 0) + (taxReport.total.nssfEmployer ?? 0);
    // Net pay = Gross - PAYE - NSSF Employee only (employer NSSF is not deducted from employee pay)
    const totalNet = (taxReport.total.gross ?? 0) - (taxReport.total.paye ?? 0) - (taxReport.total.nssfEmployee ?? 0);
    // Average net pay per employee per month
    const monthCount = taxReport.months.length || 1;
    const avgEmployees = taxReport.months.reduce((s, m) => s + (m.employeeCount ?? 0), 0) / monthCount;
    const avgNet = avgEmployees > 0 ? totalNet / taxReport.months.reduce((s, m) => s + (m.employeeCount ?? 0), 0) : 0;
    return {
      totalExpense: taxReport.total.gross ?? 0,
      totalPaye: taxReport.total.paye ?? 0,
      totalNssf,
      avgNet,
      totalNet,
    };
  }, [taxReport]);

  // ── PDF Generators ───────────────────────────────────────────────────────

  function generatePayrollSummaryPdf() {
    if (!payrollReport || !payrollReport.payslips?.length) {
      toast.error('No payroll data to export');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    const monthLabel = MONTH_NAMES[(payrollReport.month ?? 1) - 1] || '';

    const headerY = addPdfHeader(
      doc,
      'Payroll Summary Report',
      `${monthLabel} ${payrollReport.year} — ${payrollReport.payslipCount} employees`,
      inst || {},
    );

    const body = payrollReport.payslips.map((p, i) => [
      i + 1,
      p.employeeName,
      p.employeeNumber || '—',
      fmtMoneyRaw(n(p.basicSalary)),
      fmtMoneyRaw(n(p.grossSalary) - n(p.basicSalary)),
      fmtMoneyRaw(n(p.grossSalary)),
      fmtMoneyRaw(n(p.paye)),
      fmtMoneyRaw(n(p.nssfEmployee)),
      fmtMoneyRaw(n(p.nssfEmployer)),
      fmtMoneyRaw(n(p.totalDeductions)),
      fmtMoneyRaw(n(p.netSalary)),
    ]);

    const totals = payrollReport.payslips.reduce(
      (acc, p) => ({
        basic: acc.basic + n(p.basicSalary),
        allowances: acc.allowances + (n(p.grossSalary) - n(p.basicSalary)),
        gross: acc.gross + n(p.grossSalary),
        paye: acc.paye + n(p.paye),
        nssfEmp: acc.nssfEmp + n(p.nssfEmployee),
        nssfEr: acc.nssfEr + n(p.nssfEmployer),
        deductions: acc.deductions + n(p.totalDeductions),
        net: acc.net + n(p.netSalary),
      }),
      { basic: 0, allowances: 0, gross: 0, paye: 0, nssfEmp: 0, nssfEr: 0, deductions: 0, net: 0 },
    );

    body.push([
      '',
      'TOTALS',
      '',
      fmtMoneyRaw(totals.basic),
      fmtMoneyRaw(totals.allowances),
      fmtMoneyRaw(totals.gross),
      fmtMoneyRaw(totals.paye),
      fmtMoneyRaw(totals.nssfEmp),
      fmtMoneyRaw(totals.nssfEr),
      fmtMoneyRaw(totals.deductions),
      fmtMoneyRaw(totals.net),
    ]);

    autoTable(doc, {
      head: [[
        '#', 'Employee', 'Emp No.', 'Basic Salary', 'Allowances',
        'Gross', 'PAYE', 'NSSF (Ee)', 'NSSF (Er)', 'Deductions', 'Net Pay',
      ]],
      body,
      startY: headerY,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 38 },
        2: { cellWidth: 22 },
      },
      didParseCell: (data: any) => {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [219, 234, 254];
        }
      },
    });

    addPdfFooter(doc);
    doc.save(`Payroll_Summary_${monthLabel}_${payrollReport.year}.pdf`);
    toast.success('Payroll summary PDF downloaded');
  }

  function generatePayeTaxPdf() {
    if (!taxReport || !taxReport.months?.length) {
      toast.error('No PAYE data to export');
      return;
    }

    const doc = new jsPDF();

    const headerY = addPdfHeader(
      doc,
      'PAYE Tax Report — Uganda Revenue Authority',
      `Financial Year ${selectedYear} — Employer: ${companyName}`,
      inst || {},
    );

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`TIN: ${inst?.taxId || 'N/A'}`, 14, headerY + 4);
    doc.text(`Reporting Period: January – December ${selectedYear}`, 14, headerY + 10);

    const body = taxReport.months.map((m) => [
      MONTH_NAMES[(m.month ?? 1) - 1] || '',
      m.employeeCount ?? 0,
      fmtMoneyRaw(m.totalGross),
      fmtMoneyRaw(m.totalPaye),
    ]);

    body.push([
      'ANNUAL TOTAL',
      '',
      fmtMoneyRaw(taxReport.total.gross),
      fmtMoneyRaw(taxReport.total.paye),
    ]);

    const tableResult = autoTable(doc, {
      head: [['Month', 'Employees', 'Gross Salary', 'PAYE Amount']],
      body,
      startY: headerY + 16,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
      didParseCell: (data: any) => {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [219, 234, 254];
        }
      },
    });

    const finalY = tableResult?.finalY ?? 200;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      'This report is generated for URA PAYE filing purposes under the Income Tax Act, Cap. 340.',
      14,
      finalY + 12,
    );

    addPdfFooter(doc);
    doc.save(`PAYE_Tax_Report_${selectedYear}.pdf`);
    toast.success('PAYE tax report PDF downloaded');
  }

  function generateNssfPdf() {
    if (!taxReport || !taxReport.months?.length) {
      toast.error('No NSSF data to export');
      return;
    }

    const doc = new jsPDF();

    const headerY = addPdfHeader(
      doc,
      'NSSF Remittance Report',
      `Financial Year ${selectedYear} — Employee 5% + Employer 10%`,
      inst || {},
    );

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Employer Registration No: ${inst?.taxId || 'N/A'}`, 14, headerY + 4);

    const body = taxReport.months.map((m) => {
      const total = (m.totalNssfEmployee ?? 0) + (m.totalNssfEmployer ?? 0);
      return [
        MONTH_NAMES[(m.month ?? 1) - 1] || '',
        m.employeeCount ?? 0,
        fmtMoneyRaw(m.totalGross),
        fmtMoneyRaw(m.totalNssfEmployee),
        fmtMoneyRaw(m.totalNssfEmployer),
        fmtMoneyRaw(total),
      ];
    });

    const totalNssfAll =
      (taxReport.total.nssfEmployee ?? 0) + (taxReport.total.nssfEmployer ?? 0);

    body.push([
      'ANNUAL TOTAL',
      '',
      fmtMoneyRaw(taxReport.total.gross),
      fmtMoneyRaw(taxReport.total.nssfEmployee),
      fmtMoneyRaw(taxReport.total.nssfEmployer),
      fmtMoneyRaw(totalNssfAll),
    ]);

    const nssfTableResult = autoTable(doc, {
      head: [['Month', 'Employees', 'Gross Salary', 'NSSF Employee (5%)', 'NSSF Employer (10%)', 'Total NSSF (15%)']],
      body,
      startY: headerY + 10,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
      didParseCell: (data: any) => {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [209, 250, 229];
        }
      },
    });

    const finalY = nssfTableResult?.finalY ?? 200;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      'Contributions computed per NSSF Act, 1985 — Employee 5%, Employer 10% of gross salary.',
      14,
      finalY + 12,
    );

    addPdfFooter(doc);
    doc.save(`NSSF_Remittance_Report_${selectedYear}.pdf`);
    toast.success('NSSF remittance report PDF downloaded');
  }

  function generateYearEndPdf() {
    if (!taxReport || !taxReport.months?.length) {
      toast.error('No year-end data to export');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });

    const headerY = addPdfHeader(
      doc,
      'Year-End Payroll Summary',
      `Financial Year ${selectedYear} — Comprehensive Tax & Contributions Report`,
      inst || {},
    );

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`TIN: ${inst?.taxId || 'N/A'}`, 14, headerY + 4);

    const body = taxReport.months.map((m) => {
      const totalNssf = (m.totalNssfEmployee ?? 0) + (m.totalNssfEmployer ?? 0);
      const empDeductions = (m.totalPaye ?? 0) + (m.totalNssfEmployee ?? 0);
      const net = (m.totalGross ?? 0) - empDeductions;
      return [
        MONTH_NAMES[(m.month ?? 1) - 1] || '',
        m.employeeCount ?? 0,
        fmtMoneyRaw(m.totalGross),
        fmtMoneyRaw(m.totalPaye),
        fmtMoneyRaw(m.totalNssfEmployee),
        fmtMoneyRaw(m.totalNssfEmployer),
        fmtMoneyRaw(totalNssf),
        fmtMoneyRaw(empDeductions),
        fmtMoneyRaw(net),
      ];
    });

    const totalNssfAll =
      (taxReport.total.nssfEmployee ?? 0) + (taxReport.total.nssfEmployer ?? 0);
    const empDeductionsAll = (taxReport.total.paye ?? 0) + (taxReport.total.nssfEmployee ?? 0);
    const totalNetAll = (taxReport.total.gross ?? 0) - empDeductionsAll;

    body.push([
      'ANNUAL TOTAL',
      '',
      fmtMoneyRaw(taxReport.total.gross),
      fmtMoneyRaw(taxReport.total.paye),
      fmtMoneyRaw(taxReport.total.nssfEmployee),
      fmtMoneyRaw(taxReport.total.nssfEmployer),
      fmtMoneyRaw(totalNssfAll),
      fmtMoneyRaw(empDeductionsAll),
      fmtMoneyRaw(totalNetAll),
    ]);

    autoTable(doc, {
      head: [[
        'Month', 'Employees', 'Gross Salary', 'PAYE',
        'NSSF (Ee 5%)', 'NSSF (Er 10%)', 'Total NSSF',
        'Total Deductions', 'Net Payable',
      ]],
      body,
      startY: headerY + 10,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
      },
      didParseCell: (data: any) => {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [224, 231, 255];
        }
      },
    });

    addPdfFooter(doc);
    doc.save(`Year_End_Summary_${selectedYear}.pdf`);
    toast.success('Year-end summary PDF downloaded');
  }

  // ── CSV Export Functions ───────────────────────────────────────────────────

  function exportPayrollSummaryCsv() {
    if (!payrollReport || !payrollReport.payslips?.length) {
      toast.error('No payroll data to export');
      return;
    }
    const monthLabel = MONTH_NAMES[(payrollReport.month ?? 1) - 1] || '';
    const headers = ['#', 'Employee', 'Emp No.', 'Basic Salary', 'Allowances', 'Gross', 'PAYE', 'NSSF (Ee)', 'NSSF (Er)', 'Total Deductions', 'Net Pay'];
    const rows = payrollReport.payslips.map((p, i) => [
      i + 1,
      p.employeeName,
      p.employeeNumber,
      n(p.basicSalary),
      n(p.grossSalary) - n(p.basicSalary),
      n(p.grossSalary),
      n(p.paye),
      n(p.nssfEmployee),
      n(p.nssfEmployer),
      n(p.totalDeductions),
      n(p.netSalary),
    ]);

    const totals = payrollReport.payslips.reduce(
      (acc, p) => ({
        basic: acc.basic + n(p.basicSalary),
        allowances: acc.allowances + (n(p.grossSalary) - n(p.basicSalary)),
        gross: acc.gross + n(p.grossSalary),
        paye: acc.paye + n(p.paye),
        nssfEmp: acc.nssfEmp + n(p.nssfEmployee),
        nssfEr: acc.nssfEr + n(p.nssfEmployer),
        deductions: acc.deductions + n(p.totalDeductions),
        net: acc.net + n(p.netSalary),
      }),
      { basic: 0, allowances: 0, gross: 0, paye: 0, nssfEmp: 0, nssfEr: 0, deductions: 0, net: 0 },
    );
    rows.push(['', 'TOTALS', '', totals.basic, totals.allowances, totals.gross, totals.paye, totals.nssfEmp, totals.nssfEr, totals.deductions, totals.net]);

    downloadCsv(`Payroll_Summary_${monthLabel}_${payrollReport.year}.csv`, headers, rows, inst || undefined);
    toast.success('Payroll summary CSV downloaded');
  }

  function exportPayeTaxCsv() {
    if (!taxReport || !taxReport.months?.length) {
      toast.error('No PAYE data to export');
      return;
    }
    const headers = ['Month', 'Employees', 'Gross Salary', 'PAYE Amount', 'Effective Rate (%)'];
    const rows = taxReport.months.map((m) => [
      `${MONTH_NAMES[(m.month ?? 1) - 1]} ${m.year}`,
      m.employeeCount ?? 0,
      m.totalGross,
      m.totalPaye,
      m.totalGross > 0 ? ((m.totalPaye / m.totalGross) * 100).toFixed(1) : '0.0',
    ]);
    rows.push(['ANNUAL TOTAL', '', taxReport.total.gross, taxReport.total.paye,
      taxReport.total.gross > 0 ? ((taxReport.total.paye / taxReport.total.gross) * 100).toFixed(1) : '0.0']);
    downloadCsv(`PAYE_Tax_Report_${selectedYear}.csv`, headers, rows, inst || undefined);
    toast.success('PAYE tax report CSV downloaded');
  }

  function exportNssfCsv() {
    if (!taxReport || !taxReport.months?.length) {
      toast.error('No NSSF data to export');
      return;
    }
    const headers = ['Month', 'Employees', 'Gross Salary', 'Employee (5%)', 'Employer (10%)', 'Total NSSF (15%)'];
    const rows = taxReport.months.map((m) => [
      `${MONTH_NAMES[(m.month ?? 1) - 1]} ${m.year}`,
      m.employeeCount ?? 0,
      m.totalGross,
      m.totalNssfEmployee,
      m.totalNssfEmployer,
      (m.totalNssfEmployee ?? 0) + (m.totalNssfEmployer ?? 0),
    ]);
    rows.push(['ANNUAL TOTAL', '', taxReport.total.gross, taxReport.total.nssfEmployee, taxReport.total.nssfEmployer,
      (taxReport.total.nssfEmployee ?? 0) + (taxReport.total.nssfEmployer ?? 0)]);
    downloadCsv(`NSSF_Remittance_${selectedYear}.csv`, headers, rows, inst || undefined);
    toast.success('NSSF remittance CSV downloaded');
  }

  function exportYearEndCsv() {
    if (!taxReport || !taxReport.months?.length) {
      toast.error('No year-end data to export');
      return;
    }
    const headers = ['Month', 'Employees', 'Gross Salary', 'PAYE', 'NSSF (Ee)', 'NSSF (Er)', 'Total NSSF', 'Total Deductions', 'Net Payable'];
    const rows = taxReport.months.map((m) => {
      const mNssf = (m.totalNssfEmployee ?? 0) + (m.totalNssfEmployer ?? 0);
      const empDed = (m.totalPaye ?? 0) + (m.totalNssfEmployee ?? 0);
      const mNet = (m.totalGross ?? 0) - empDed;
      return [
        `${MONTH_NAMES[(m.month ?? 1) - 1]} ${m.year}`,
        m.employeeCount ?? 0, m.totalGross, m.totalPaye,
        m.totalNssfEmployee, m.totalNssfEmployer, mNssf, empDed, mNet,
      ];
    });
    const totalNssfAll = (taxReport.total.nssfEmployee ?? 0) + (taxReport.total.nssfEmployer ?? 0);
    const empDedAll = (taxReport.total.paye ?? 0) + (taxReport.total.nssfEmployee ?? 0);
    const netAll = (taxReport.total.gross ?? 0) - empDedAll;
    rows.push(['ANNUAL TOTAL', '', taxReport.total.gross, taxReport.total.paye,
      taxReport.total.nssfEmployee, taxReport.total.nssfEmployer, totalNssfAll, empDedAll, netAll]);
    downloadCsv(`Year_End_Summary_${selectedYear}.csv`, headers, rows, inst || undefined);
    toast.success('Year-end summary CSV downloaded');
  }

  // ── Render Helpers ───────────────────────────────────────────────────────

  function renderLoading() {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-gray-500 text-sm">Loading report data…</span>
      </div>
    );
  }

  function renderEmpty(message: string) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <FileText className="w-12 h-12 mb-3" />
        <p className="text-sm">{message}</p>
      </div>
    );
  }

  // ── Payroll Summary Tab ──────────────────────────────────────────────────

  function renderPayrollSummary() {
    return (
      <div className="space-y-4">
        {/* Run Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Select Payroll Run:</label>
          <div className="relative">
            <select
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[260px]"
            >
              <option value="">— Choose a payroll run —</option>
              {processedRuns.map((run) => (
                <option key={run.id} value={run.id}>
                  {MONTH_NAMES[(run.month ?? 1) - 1]} {run.year} — {run.employeeCount} employees ({run.status})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {payrollReport && payrollReport.payslips?.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={generatePayrollSummaryPdf}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={exportPayrollSummaryCsv}
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                CSV / Excel
              </button>
            </div>
          )}
        </div>

        {!selectedRunId && processedRuns.length > 0 && renderEmpty('Select a payroll run above to view the summary report.')}

        {!selectedRunId && processedRuns.length === 0 && !runsLoading &&
          renderEmpty('No processed payroll runs found for the selected year.')}

        {selectedRunId && reportLoading && renderLoading()}

        {selectedRunId && !reportLoading && payrollReport && payrollReport.payslips?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Report header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                {MONTH_NAMES[(payrollReport.month ?? 1) - 1]} {payrollReport.year} — Payroll Summary
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {payrollReport.payslipCount} employees • Status: {payrollReport.status}
              </p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-semibold">#</th>
                    <th className="px-4 py-3 text-left font-semibold">Employee</th>
                    <th className="px-4 py-3 text-left font-semibold">Emp No.</th>
                    <th className="px-4 py-3 text-right font-semibold">Basic Salary</th>
                    <th className="px-4 py-3 text-right font-semibold">Allowances</th>
                    <th className="px-4 py-3 text-right font-semibold">Gross</th>
                    <th className="px-4 py-3 text-right font-semibold">PAYE</th>
                    <th className="px-4 py-3 text-right font-semibold">NSSF (Ee)</th>
                    <th className="px-4 py-3 text-right font-semibold">NSSF (Er)</th>
                    <th className="px-4 py-3 text-right font-semibold">Deductions</th>
                    <th className="px-4 py-3 text-right font-semibold">Net Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payrollReport.payslips.map((slip, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{slip.employeeName}</td>
                      <td className="px-4 py-2.5 text-gray-500">{slip.employeeNumber || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmtMoney(n(slip.basicSalary))}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {fmtMoney(n(slip.grossSalary) - n(slip.basicSalary))}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-800">{fmtMoney(n(slip.grossSalary))}</td>
                      <td className="px-4 py-2.5 text-right text-red-600">{fmtMoney(n(slip.paye))}</td>
                      <td className="px-4 py-2.5 text-right text-orange-600">{fmtMoney(n(slip.nssfEmployee))}</td>
                      <td className="px-4 py-2.5 text-right text-orange-500">{fmtMoney(n(slip.nssfEmployer))}</td>
                      <td className="px-4 py-2.5 text-right text-red-500">{fmtMoney(n(slip.totalDeductions))}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-700">{fmtMoney(n(slip.netSalary))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 font-semibold text-gray-800">
                    <td className="px-4 py-3" colSpan={3}>TOTALS</td>
                    <td className="px-4 py-3 text-right">
                      {fmtMoney(payrollReport.payslips.reduce((s, p) => s + n(p.basicSalary), 0))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {fmtMoney(payrollReport.payslips.reduce((s, p) => s + (n(p.grossSalary) - n(p.basicSalary)), 0))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {fmtMoney(payrollReport.payslips.reduce((s, p) => s + n(p.grossSalary), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {fmtMoney(payrollReport.payslips.reduce((s, p) => s + n(p.paye), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-600">
                      {fmtMoney(payrollReport.payslips.reduce((s, p) => s + n(p.nssfEmployee), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-500">
                      {fmtMoney(payrollReport.payslips.reduce((s, p) => s + n(p.nssfEmployer), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-red-500">
                      {fmtMoney(payrollReport.payslips.reduce((s, p) => s + n(p.totalDeductions), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700">
                      {fmtMoney(payrollReport.payslips.reduce((s, p) => s + n(p.netSalary), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {selectedRunId && !reportLoading && payrollReport && !payrollReport.payslips?.length &&
          renderEmpty('No payslips found for this payroll run.')}
      </div>
    );
  }

  // ── PAYE Tax Report Tab ──────────────────────────────────────────────────

  function renderPayeReport() {
    if (taxLoading) return renderLoading();
    if (!taxReport || !taxReport.months?.length) return renderEmpty('No PAYE data available for this year.');

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">PAYE Tax Report — {selectedYear}</h3>
            <p className="text-sm text-gray-500">Monthly Pay-As-You-Earn tax breakdown for URA filing</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generatePayeTaxPdf}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              URA Report (PDF)
            </button>
            <button
              onClick={exportPayeTaxCsv}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              CSV / Excel
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 text-left font-semibold">Month</th>
                  <th className="px-5 py-3 text-right font-semibold">Employees</th>
                  <th className="px-5 py-3 text-right font-semibold">Gross Salary</th>
                  <th className="px-5 py-3 text-right font-semibold">PAYE Amount</th>
                  <th className="px-5 py-3 text-right font-semibold">Effective Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {taxReport.months.map((m, idx) => {
                  const rate = m.totalGross > 0
                    ? ((m.totalPaye / m.totalGross) * 100).toFixed(1)
                    : '0.0';
                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {MONTH_NAMES[(m.month ?? 1) - 1]} {m.year}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">{m.employeeCount}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{fmtMoney(m.totalGross)}</td>
                      <td className="px-5 py-3 text-right font-medium text-red-600">{fmtMoney(m.totalPaye)}</td>
                      <td className="px-5 py-3 text-right text-gray-500">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 font-semibold text-gray-800">
                  <td className="px-5 py-3" colSpan={2}>ANNUAL TOTAL</td>
                  <td className="px-5 py-3 text-right">{fmtMoney(taxReport.total.gross)}</td>
                  <td className="px-5 py-3 text-right text-red-600">{fmtMoney(taxReport.total.paye)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">
                    {taxReport.total.gross > 0
                      ? ((taxReport.total.paye / taxReport.total.gross) * 100).toFixed(1)
                      : '0.0'}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── NSSF Remittance Tab ──────────────────────────────────────────────────

  function renderNssfReport() {
    if (taxLoading) return renderLoading();
    if (!taxReport || !taxReport.months?.length) return renderEmpty('No NSSF data available for this year.');

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">NSSF Remittance Report — {selectedYear}</h3>
            <p className="text-sm text-gray-500">Employee (5%) and Employer (10%) contribution breakdown</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generateNssfPdf}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={exportNssfCsv}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              CSV / Excel
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 text-left font-semibold">Month</th>
                  <th className="px-5 py-3 text-right font-semibold">Employees</th>
                  <th className="px-5 py-3 text-right font-semibold">Gross Salary</th>
                  <th className="px-5 py-3 text-right font-semibold">Employee (5%)</th>
                  <th className="px-5 py-3 text-right font-semibold">Employer (10%)</th>
                  <th className="px-5 py-3 text-right font-semibold">Total NSSF (15%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {taxReport.months.map((m, idx) => {
                  const total = (m.totalNssfEmployee ?? 0) + (m.totalNssfEmployer ?? 0);
                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {MONTH_NAMES[(m.month ?? 1) - 1]} {m.year}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">{m.employeeCount}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{fmtMoney(m.totalGross)}</td>
                      <td className="px-5 py-3 text-right text-orange-600">{fmtMoney(m.totalNssfEmployee)}</td>
                      <td className="px-5 py-3 text-right text-orange-500">{fmtMoney(m.totalNssfEmployer)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-emerald-700">{fmtMoney(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 font-semibold text-gray-800">
                  <td className="px-5 py-3" colSpan={2}>ANNUAL TOTAL</td>
                  <td className="px-5 py-3 text-right">{fmtMoney(taxReport.total.gross)}</td>
                  <td className="px-5 py-3 text-right text-orange-600">{fmtMoney(taxReport.total.nssfEmployee)}</td>
                  <td className="px-5 py-3 text-right text-orange-500">{fmtMoney(taxReport.total.nssfEmployer)}</td>
                  <td className="px-5 py-3 text-right text-emerald-700">
                    {fmtMoney((taxReport.total.nssfEmployee ?? 0) + (taxReport.total.nssfEmployer ?? 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* NSSF Quick Reference Card */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-emerald-800 mb-2">NSSF Contribution Rates — Uganda</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-emerald-600 font-medium">Employee Contribution:</span>
              <span className="ml-2 text-gray-700">5% of gross salary</span>
            </div>
            <div>
              <span className="text-emerald-600 font-medium">Employer Contribution:</span>
              <span className="ml-2 text-gray-700">10% of gross salary</span>
            </div>
            <div>
              <span className="text-emerald-600 font-medium">Total Contribution:</span>
              <span className="ml-2 text-gray-700">15% of gross salary</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Year-End Summary Tab ─────────────────────────────────────────────────

  function renderYearEnd() {
    if (taxLoading) return renderLoading();
    if (!taxReport || !taxReport.months?.length) return renderEmpty('No year-end data available.');

    const totalNssf = (taxReport.total.nssfEmployee ?? 0) + (taxReport.total.nssfEmployer ?? 0);
    // Net payable to employees = Gross - PAYE - NSSF Employee (employer NSSF is company cost, not deducted from pay)
    const employeeDeductions = (taxReport.total.paye ?? 0) + (taxReport.total.nssfEmployee ?? 0);
    const totalNet = (taxReport.total.gross ?? 0) - employeeDeductions;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Year-End Summary — {selectedYear}</h3>
            <p className="text-sm text-gray-500">Comprehensive payroll, tax, and statutory contributions overview</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generateYearEndPdf}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={exportYearEndCsv}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              CSV / Excel
            </button>
          </div>
        </div>

        {/* Annual Totals Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Gross', value: taxReport.total.gross, color: 'blue', icon: <DollarSign className="w-5 h-5" /> },
            { label: 'Total PAYE', value: taxReport.total.paye, color: 'red', icon: <FileText className="w-5 h-5" /> },
            { label: 'NSSF Employee', value: taxReport.total.nssfEmployee, color: 'orange', icon: <Users className="w-5 h-5" /> },
            { label: 'NSSF Employer', value: taxReport.total.nssfEmployer, color: 'amber', icon: <Building2 className="w-5 h-5" /> },
            { label: 'Net Payable', value: totalNet, color: 'green', icon: <TrendingUp className="w-5 h-5" /> },
          ].map((card) => {
            const colorMap: Record<string, string> = {
              blue: 'border-blue-100 text-blue-600',
              red: 'border-red-100 text-red-600',
              orange: 'border-orange-100 text-orange-600',
              amber: 'border-amber-100 text-amber-600',
              green: 'border-green-100 text-green-600',
            };
            const colors = colorMap[card.color] || 'border-gray-100 text-gray-600';
            const [borderClass, textClass] = colors.split(' ');
            return (
              <div
                key={card.label}
                className={`bg-white border rounded-xl p-4 shadow-sm ${borderClass}`}
              >
                <div className={`flex items-center gap-2 ${textClass} mb-1`}>
                  {card.icon}
                  <span className="text-xs font-medium uppercase tracking-wide">{card.label}</span>
                </div>
                <p className="text-lg font-bold text-gray-800">{fmtMoney(card.value)}</p>
              </div>
            );
          })}
        </div>

        {/* Monthly Breakdown Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-semibold">Month</th>
                  <th className="px-4 py-3 text-right font-semibold">Employees</th>
                  <th className="px-4 py-3 text-right font-semibold">Gross Salary</th>
                  <th className="px-4 py-3 text-right font-semibold">PAYE</th>
                  <th className="px-4 py-3 text-right font-semibold">NSSF (Ee)</th>
                  <th className="px-4 py-3 text-right font-semibold">NSSF (Er)</th>
                  <th className="px-4 py-3 text-right font-semibold">Total NSSF</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Deductions</th>
                  <th className="px-4 py-3 text-right font-semibold">Net Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {taxReport.months.map((m, idx) => {
                  const mNssf = (m.totalNssfEmployee ?? 0) + (m.totalNssfEmployer ?? 0);
                  const mEmployeeDeductions = (m.totalPaye ?? 0) + (m.totalNssfEmployee ?? 0);
                  const mNet = (m.totalGross ?? 0) - mEmployeeDeductions;
                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {MONTH_ABBREV[(m.month ?? 1) - 1]} {m.year}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{m.employeeCount}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmtMoney(m.totalGross)}</td>
                      <td className="px-4 py-2.5 text-right text-red-600">{fmtMoney(m.totalPaye)}</td>
                      <td className="px-4 py-2.5 text-right text-orange-600">{fmtMoney(m.totalNssfEmployee)}</td>
                      <td className="px-4 py-2.5 text-right text-orange-500">{fmtMoney(m.totalNssfEmployer)}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-600">{fmtMoney(mNssf)}</td>
                      <td className="px-4 py-2.5 text-right text-red-500">{fmtMoney(mEmployeeDeductions)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-700">{fmtMoney(mNet)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50 font-semibold text-gray-800">
                  <td className="px-4 py-3" colSpan={2}>ANNUAL TOTAL</td>
                  <td className="px-4 py-3 text-right">{fmtMoney(taxReport.total.gross)}</td>
                  <td className="px-4 py-3 text-right text-red-600">{fmtMoney(taxReport.total.paye)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{fmtMoney(taxReport.total.nssfEmployee)}</td>
                  <td className="px-4 py-3 text-right text-orange-500">{fmtMoney(taxReport.total.nssfEmployer)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{fmtMoney(totalNssf)}</td>
                  <td className="px-4 py-3 text-right text-red-500">{fmtMoney(employeeDeductions)}</td>
                  <td className="px-4 py-3 text-right text-green-700">{fmtMoney(totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Deductions Breakdown Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
            Annual Deductions Breakdown
          </h4>
          <div className="space-y-3">
            {[
              { label: 'PAYE (Income Tax)', value: taxReport.total.paye, pct: taxReport.total.gross > 0 ? (taxReport.total.paye / taxReport.total.gross) * 100 : 0, color: 'bg-red-500' },
              { label: 'NSSF Employee (5%)', value: taxReport.total.nssfEmployee, pct: 5, color: 'bg-orange-500', note: 'Statutory rate: 5% of gross (capped at UGX 500,000)' },
              { label: 'NSSF Employer (10%)', value: taxReport.total.nssfEmployer, pct: 10, color: 'bg-amber-500', note: 'Statutory rate: 10% of gross (capped at UGX 500,000)' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-xs">{item.pct.toFixed(1)}% of gross</span>
                    <span className="font-semibold text-gray-800 min-w-[120px] text-right">
                      {fmtMoney(item.value)}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`${item.color} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(item.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Main Render ──────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            Payroll Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate and export payroll, tax, and statutory reports
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-gray-400" />
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setSelectedRunId('');
              }}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {yearOptions().map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Payroll Expense</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmtMoney(stats.totalExpense)}</p>
            </div>
            <div className="bg-blue-100 rounded-lg p-2.5">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Gross salary for {selectedYear}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total PAYE</p>
              <p className="text-xl font-bold text-red-600 mt-1">{fmtMoney(stats.totalPaye)}</p>
            </div>
            <div className="bg-red-100 rounded-lg p-2.5">
              <Building2 className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Income tax remitted to URA</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total NSSF</p>
              <p className="text-xl font-bold text-orange-600 mt-1">{fmtMoney(stats.totalNssf)}</p>
            </div>
            <div className="bg-orange-100 rounded-lg p-2.5">
              <Users className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Employee + Employer contributions</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Net Pay</p>
              <p className="text-xl font-bold text-green-600 mt-1">{fmtMoney(stats.avgNet)}</p>
            </div>
            <div className="bg-green-100 rounded-lg p-2.5">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Average per employee</p>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto pb-px" aria-label="Report tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg
                border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {runsLoading && activeTab === 'payroll-summary' && renderLoading()}
        {!runsLoading && activeTab === 'payroll-summary' && renderPayrollSummary()}
        {activeTab === 'paye-report' && renderPayeReport()}
        {activeTab === 'nssf-report' && renderNssfReport()}
        {activeTab === 'year-end' && renderYearEnd()}
      </div>
    </div>
  );
}
