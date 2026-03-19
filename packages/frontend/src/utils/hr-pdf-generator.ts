import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../lib/currency';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface InstitutionInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
  taxId: string;
}

export interface EmployeeData {
  id: string;
  fullName: string;
  employeeNumber?: string;
  jobTitle?: string;
  department?: { id: string; name: string } | string;
  email?: string;
  phone?: string;
  hireDate?: string;
  terminationDate?: string;
  employmentType?: string;
  basicSalary?: number;
  allowances?: { name: string; amount: number; taxable?: boolean }[];
  deductions?: { name: string; amount: number; type?: string }[];
  nationalId?: string;
  gender?: string;
  address?: string;
  bankName?: string;
  bankAccountNumber?: string;
}

export interface PayslipData {
  id: string;
  basicSalary: number;
  allowances?: { name: string; amount: number }[];
  overtimePay: number;
  overtimeHours: number;
  grossSalary: number;
  paye: number;
  nssfEmployee: number;
  nssfEmployer: number;
  otherDeductions?: { name: string; amount: number }[];
  totalDeductions: number;
  netSalary: number;
  daysWorked: number;
  daysAbsent: number;
  isPaid: boolean;
  paidDate?: string;
  payrollRun?: { month: number; year: number; paymentDate?: string };
  employee?: { fullName: string; jobTitle?: string; department?: { name: string } };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = {
  darkBlue: '#1e3a5f' as const,
  black: '#000000' as const,
  gray: '#666666' as const,
  lightGray: '#f5f5f5' as const,
  white: '#ffffff' as const,
};

const DARK_BLUE_RGB: [number, number, number] = [30, 58, 95];

const MARGINS = { left: 20, right: 15, top: 15 };

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Helper Functions ────────────────────────────────────────────────────────

function getDepartmentName(department: EmployeeData['department']): string {
  if (!department) return 'General';
  if (typeof department === 'string') return department || 'General';
  return department.name || 'General';
}

function getPronouns(gender?: string): { subject: string; possessive: string; object: string } {
  const g = (gender || '').toLowerCase();
  if (g === 'female' || g === 'f') return { subject: 'she', possessive: 'her', object: 'her' };
  if (g === 'male' || g === 'm') return { subject: 'he', possessive: 'his', object: 'him' };
  return { subject: 'they', possessive: 'their', object: 'them' };
}

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  return `${day}${getOrdinalSuffix(day)} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function generateRefNumber(prefix: string): string {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}/${year}/${random}`;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

function setColor(doc: jsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

function getPageWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth();
}

function getContentWidth(doc: jsPDF): number {
  return getPageWidth(doc) - MARGINS.left - MARGINS.right;
}

function getPageHeight(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight();
}

/** Draws the institution letterhead and returns the Y position after it. */
function drawLetterhead(doc: jsPDF, inst: InstitutionInfo): number {
  let y = MARGINS.top;
  const pageWidth = getPageWidth(doc);
  const centerX = pageWidth / 2;

  // Logo
  if (inst.logo && inst.logo.startsWith('data:image')) {
    try {
      doc.addImage(inst.logo, 'PNG', centerX - 12, y, 24, 24);
      y += 27;
    } catch {
      // Skip logo on error
    }
  }

  // Institution name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  setColor(doc, COLORS.darkBlue);
  doc.text(inst.name, centerX, y, { align: 'center' });
  y += 6;

  // Address (only if present)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, COLORS.gray);
  if (inst.address) {
    doc.text(inst.address, centerX, y, { align: 'center' });
    y += 4;
  }

  // Contact line — built dynamically from available fields
  const contactParts: string[] = [];
  if (inst.phone) contactParts.push(`Tel: ${inst.phone}`);
  if (inst.email) contactParts.push(`Email: ${inst.email}`);
  if (contactParts.length > 0) {
    doc.text(contactParts.join('  |  '), centerX, y, { align: 'center' });
    y += 4;
  }

  if (inst.taxId) {
    doc.text(`TIN: ${inst.taxId}`, centerX, y, { align: 'center' });
    y += 4;
  }

  // Separator line
  y += 2;
  doc.setDrawColor(...DARK_BLUE_RGB);
  doc.setLineWidth(0.5);
  doc.line(MARGINS.left, y, pageWidth - MARGINS.right, y);
  // Thin secondary accent line
  doc.setLineWidth(0.2);
  doc.line(MARGINS.left, y + 1.5, pageWidth - MARGINS.right, y + 1.5);
  y += 8;

  return y;
}

/** Draws a signature block and returns the Y position after it. */
function drawSignatureBlock(
  doc: jsPDF,
  y: number,
  signatoryName?: string,
  signatoryTitle?: string,
  instName?: string,
): number {
  if (y > getPageHeight(doc) - 60) {
    doc.addPage();
    y = MARGINS.top;
  }

  y += 20;

  // Signature line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(MARGINS.left, y, MARGINS.left + 60, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, COLORS.black);
  doc.text(signatoryName || '____________________', MARGINS.left, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(doc, COLORS.gray);
  doc.text(signatoryTitle || 'Authorized Signatory', MARGINS.left, y);
  y += 5;

  if (instName) {
    doc.text(instName, MARGINS.left, y);
    y += 5;
  }

  doc.text(`Date: ${formatDate(new Date())}`, MARGINS.left, y);
  y += 5;

  return y;
}

/** Draws the standard footer at the bottom of the page. */
function drawFooter(doc: jsPDF, instName: string): void {
  const pageHeight = getPageHeight(doc);
  const pageWidth = getPageWidth(doc);
  const centerX = pageWidth / 2;

  doc.setDrawColor(...DARK_BLUE_RGB);
  doc.setLineWidth(0.3);
  doc.line(MARGINS.left, pageHeight - 18, pageWidth - MARGINS.right, pageHeight - 18);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  setColor(doc, COLORS.gray);
  doc.text(
    'This is a computer-generated document and does not require a physical signature.',
    centerX,
    pageHeight - 13,
    { align: 'center' },
  );
  doc.text(instName, centerX, pageHeight - 9, { align: 'center' });
}

/** Writes a paragraph of body text and returns the new Y position. */
function writeBodyText(doc: jsPDF, text: string, y: number, maxWidth?: number): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setColor(doc, COLORS.black);
  const width = maxWidth || getContentWidth(doc);
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, MARGINS.left, y);
  return y + lines.length * 5.5;
}

/** Returns the autoTable final Y for further placement. */
function getAutoTableEndY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 0;
}

/** Draws a decorative certificate border */
function drawCertificateBorder(doc: jsPDF): void {
  const pw = getPageWidth(doc);
  const ph = getPageHeight(doc);

  // Outer border - dark blue
  doc.setDrawColor(...DARK_BLUE_RGB);
  doc.setLineWidth(1.5);
  doc.rect(8, 8, pw - 16, ph - 16);

  // Inner border - lighter blue
  doc.setDrawColor(70, 130, 180);
  doc.setLineWidth(0.5);
  doc.rect(12, 12, pw - 24, ph - 24);

  // Corner ornaments (small squares at each corner of the inner border)
  const ornSize = 4;
  doc.setFillColor(...DARK_BLUE_RGB);
  doc.rect(10, 10, ornSize, ornSize, 'F');
  doc.rect(pw - 10 - ornSize, 10, ornSize, ornSize, 'F');
  doc.rect(10, ph - 10 - ornSize, ornSize, ornSize, 'F');
  doc.rect(pw - 10 - ornSize, ph - 10 - ornSize, ornSize, ornSize, 'F');
}

/** Draws a diagonal watermark text across the page */
function drawWatermark(doc: jsPDF, text: string): void {
  const pw = getPageWidth(doc);
  const ph = getPageHeight(doc);
  doc.saveGraphicsState();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(60);
  doc.setTextColor(230, 230, 230);
  doc.setGState(doc.GState({ opacity: 0.15 }));

  const centerX = pw / 2;
  const centerY = ph / 2;
  doc.text(text, centerX, centerY, {
    align: 'center',
    angle: 45,
  });
  doc.restoreGraphicsState();
}

/** Draws a verification serial number bar */
function drawSerialNumber(doc: jsPDF, refNumber: string): void {
  const pw = getPageWidth(doc);
  const ph = getPageHeight(doc);
  const barY = ph - 28;

  doc.setFillColor(245, 245, 250);
  doc.rect(MARGINS.left, barY, pw - MARGINS.left - MARGINS.right, 8, 'F');
  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.2);
  doc.rect(MARGINS.left, barY, pw - MARGINS.left - MARGINS.right, 8, 'S');

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 120);
  doc.text(
    `Document ID: ${refNumber}  |  Verification: ${generateVerificationCode()}  |  Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
    pw / 2, barY + 5, { align: 'center' },
  );
}

/** Generates a pseudo verification code */
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─── Exported PDF Generator Functions ────────────────────────────────────────

export function generatePayslipPDF(
  payslip: PayslipData,
  employee: EmployeeData,
  inst: InstitutionInfo,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = getPageWidth(doc);
  const centerX = pageWidth / 2;

  // ── Header ──
  let y = MARGINS.top;

  if (inst.logo && inst.logo.startsWith('data:image')) {
    try {
      doc.addImage(inst.logo, 'PNG', MARGINS.left, y, 18, 18);
    } catch {
      // skip
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setColor(doc, COLORS.darkBlue);
  doc.text(inst.name, centerX, y + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(doc, COLORS.gray);
  doc.text(inst.address, centerX, y + 10, { align: 'center' });

  // Contact info — only show if available
  const payslipContact: string[] = [];
  if (inst.phone) payslipContact.push(`Tel: ${inst.phone}`);
  if (inst.email) payslipContact.push(inst.email);
  if (payslipContact.length > 0) {
    doc.text(payslipContact.join('  |  '), centerX, y + 14, { align: 'center' });
  }

  if (inst.taxId) {
    doc.text(`TIN: ${inst.taxId}`, centerX, y + 18, { align: 'center' });
  }

  y += 24;
  doc.setDrawColor(...DARK_BLUE_RGB);
  doc.setLineWidth(0.6);
  doc.line(MARGINS.left, y, pageWidth - MARGINS.right, y);
  y += 6;

  // ── Title ──
  const monthName = payslip.payrollRun
    ? MONTH_NAMES[payslip.payrollRun.month - 1] || ''
    : '';
  const yearStr = payslip.payrollRun?.year?.toString() || '';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  setColor(doc, COLORS.darkBlue);
  doc.text('PAYSLIP', centerX, y, { align: 'center' });
  y += 6;

  if (monthName && yearStr) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    setColor(doc, COLORS.gray);
    doc.text(`For the month of ${monthName} ${yearStr}`, centerX, y, { align: 'center' });
    y += 8;
  }

  // ── Employee Details ──
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40, textColor: DARK_BLUE_RGB },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', cellWidth: 40, textColor: DARK_BLUE_RGB },
      3: { cellWidth: 55 },
    },
    body: [
      ['Name:', employee.fullName, 'Employee No:', employee.employeeNumber || '—'],
      ['Job Title:', employee.jobTitle || '—', 'Department:', getDepartmentName(employee.department)],
      ['Bank Name:', employee.bankName || '—', 'Bank Account:', employee.bankAccountNumber || '—'],
    ],
  });

  y = getAutoTableEndY(doc) + 6;

  // ── Earnings Table ──
  const earningsBody: (string | number)[][] = [
    ['Basic Salary', formatCurrency(payslip.basicSalary)],
  ];
  if (payslip.allowances) {
    for (const a of payslip.allowances) {
      earningsBody.push([a.name, formatCurrency(a.amount)]);
    }
  }
  if (payslip.overtimePay > 0) {
    earningsBody.push([`Overtime (${payslip.overtimeHours} hrs)`, formatCurrency(payslip.overtimePay)]);
  }
  earningsBody.push([{ content: 'Gross Salary', styles: { fontStyle: 'bold' } } as any, { content: formatCurrency(payslip.grossSalary), styles: { fontStyle: 'bold' } } as any]);

  autoTable(doc, {
    startY: y,
    head: [['Earnings', 'Amount']],
    body: earningsBody,
    theme: 'striped',
    headStyles: { fillColor: DARK_BLUE_RGB, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'right' } },
  });

  y = getAutoTableEndY(doc) + 6;

  // ── Deductions Table ──
  const deductionsBody: any[][] = [
    ['PAYE (Income Tax)', formatCurrency(payslip.paye)],
    ['NSSF (Employee)', formatCurrency(payslip.nssfEmployee)],
    ['NSSF (Employer) — employer contribution', formatCurrency(payslip.nssfEmployer)],
  ];
  if (payslip.otherDeductions) {
    for (const d of payslip.otherDeductions) {
      deductionsBody.push([d.name, formatCurrency(d.amount)]);
    }
  }
  deductionsBody.push([
    { content: 'Total Deductions', styles: { fontStyle: 'bold' } },
    { content: formatCurrency(payslip.totalDeductions), styles: { fontStyle: 'bold' } },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Deductions', 'Amount']],
    body: deductionsBody,
    theme: 'striped',
    headStyles: { fillColor: [139, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'right' } },
  });

  y = getAutoTableEndY(doc) + 10;

  // ── Net Pay ──
  doc.setFillColor(...DARK_BLUE_RGB);
  doc.roundedRect(MARGINS.left, y, getContentWidth(doc), 14, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('NET PAY', MARGINS.left + 6, y + 9);
  doc.text(formatCurrency(payslip.netSalary), pageWidth - MARGINS.right - 6, y + 9, { align: 'right' });
  y += 20;

  // ── Payment Details ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, COLORS.gray);
  doc.text(`Payment Status: ${payslip.isPaid ? 'Paid' : 'Pending'}`, MARGINS.left, y);
  y += 5;

  if (payslip.isPaid && payslip.paidDate) {
    doc.text(`Payment Date: ${formatDate(payslip.paidDate)}`, MARGINS.left, y);
    y += 5;
  } else if (payslip.payrollRun?.paymentDate) {
    doc.text(`Payment Date: ${formatDate(payslip.payrollRun.paymentDate)}`, MARGINS.left, y);
    y += 5;
  }

  doc.text(`Days Worked: ${payslip.daysWorked}  |  Days Absent: ${payslip.daysAbsent}`, MARGINS.left, y);

  // ── Footer ──
  drawFooter(doc, inst.name);

  const safeName = sanitizeName(employee.fullName);
  doc.save(`Payslip_${safeName}_${monthName}_${yearStr}.pdf`);
}

export function generateCertificateOfService(
  employee: EmployeeData,
  inst: InstitutionInfo,
  endDate?: string,
  signatoryName?: string,
  signatoryTitle?: string,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);
  const centerX = pageWidth / 2;
  const refNum = generateRefNumber('COS');

  // Security features
  drawCertificateBorder(doc);
  drawWatermark(doc, inst.name.toUpperCase());

  let y = 22;

  // Logo
  if (inst.logo && inst.logo.startsWith('data:image')) {
    try {
      doc.addImage(inst.logo, 'PNG', centerX - 15, y, 30, 30);
      y += 34;
    } catch {
      y += 4;
    }
  }

  // Institution name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  setColor(doc, COLORS.darkBlue);
  doc.text(inst.name.toUpperCase(), centerX, y, { align: 'center' });
  y += 7;

  // Address & contact (only show what exists)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, COLORS.gray);
  if (inst.address) {
    doc.text(inst.address, centerX, y, { align: 'center' });
    y += 4;
  }
  const contactParts: string[] = [];
  if (inst.phone) contactParts.push(`Tel: ${inst.phone}`);
  if (inst.email) contactParts.push(`Email: ${inst.email}`);
  if (inst.taxId) contactParts.push(`TIN: ${inst.taxId}`);
  if (contactParts.length > 0) {
    doc.text(contactParts.join('  \u2022  '), centerX, y, { align: 'center' });
    y += 4;
  }

  // Decorative double line
  y += 3;
  doc.setDrawColor(...DARK_BLUE_RGB);
  doc.setLineWidth(0.8);
  doc.line(40, y, pageWidth - 40, y);
  doc.setLineWidth(0.3);
  doc.line(40, y + 2, pageWidth - 40, y + 2);
  y += 10;

  // Reference number
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(doc, COLORS.gray);
  doc.text(`Ref: ${refNum}`, pageWidth - MARGINS.right - 8, y, { align: 'right' });
  y += 8;

  // Title with decorative elements
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  setColor(doc, COLORS.darkBlue);
  doc.text('CERTIFICATE OF SERVICE', centerX, y, { align: 'center' });

  const titleW = doc.getTextWidth('CERTIFICATE OF SERVICE');
  y += 3;
  doc.setDrawColor(...DARK_BLUE_RGB);
  doc.setLineWidth(0.6);
  doc.line(centerX - titleW / 2 - 5, y, centerX + titleW / 2 + 5, y);
  doc.setFillColor(...DARK_BLUE_RGB);
  doc.circle(centerX - titleW / 2 - 8, y, 1, 'F');
  doc.circle(centerX + titleW / 2 + 8, y, 1, 'F');
  y += 14;

  // Body text
  const pronouns = getPronouns(employee.gender);
  const hireFormatted = formatDate(employee.hireDate);
  const endFormatted = endDate
    ? formatDate(endDate)
    : employee.terminationDate
      ? formatDate(employee.terminationDate)
      : '';
  const dept = getDepartmentName(employee.department);
  const jobTitle = employee.jobTitle || 'staff member';

  // "To Whom It May Concern"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setColor(doc, COLORS.black);
  doc.text('TO WHOM IT MAY CONCERN', centerX, y, { align: 'center' });
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setLineHeightFactor(1.8);

  const contentWidth = pageWidth - 80;

  // Paragraph 1 — Employment confirmation
  let bodyText = `This is to certify that ${employee.fullName.toUpperCase()}`;
  if (employee.nationalId) {
    bodyText += `, holder of National ID No. ${employee.nationalId},`;
  }
  if (employee.employeeNumber) {
    bodyText += ` (Employee No. ${employee.employeeNumber})`;
  }

  if (hireFormatted && endFormatted) {
    bodyText += ` was employed by ${inst.name} from ${hireFormatted} to ${endFormatted}`;
  } else if (hireFormatted) {
    bodyText += ` has been employed by ${inst.name} since ${hireFormatted} and continues to serve`;
  } else {
    bodyText += ` has been employed by ${inst.name}`;
  }

  bodyText += `, serving in the capacity of ${jobTitle.toUpperCase()}`;
  if (dept !== 'General') {
    bodyText += ` in the ${dept} Department`;
  }
  bodyText += '.';

  const lines1 = doc.splitTextToSize(bodyText, contentWidth);
  doc.text(lines1, 40, y);
  y += lines1.length * 6.5 + 6;

  // Paragraph 2 — Character reference
  const capSubject = pronouns.subject.charAt(0).toUpperCase() + pronouns.subject.slice(1);
  const para2 = `During ${pronouns.possessive} tenure with the organization, ${pronouns.subject} discharged ${pronouns.possessive} duties and responsibilities with diligence, professionalism, and dedication. ${capSubject} demonstrated good conduct and maintained a satisfactory standard of work throughout ${pronouns.possessive} period of service.`;
  const lines2 = doc.splitTextToSize(para2, contentWidth);
  doc.text(lines2, 40, y);
  y += lines2.length * 6.5 + 6;

  // Paragraph 3 — Purpose
  const para3 = 'This certificate is issued at the request of the above-named individual for whatever lawful purpose it may serve.';
  const lines3 = doc.splitTextToSize(para3, contentWidth);
  doc.text(lines3, 40, y);
  y += lines3.length * 6.5 + 6;

  // Paragraph 4 — Wishes (only if they left)
  if (endFormatted) {
    const para4 = `We wish ${pronouns.object} all the best in ${pronouns.possessive} future endeavors.`;
    const lines4 = doc.splitTextToSize(para4, contentWidth);
    doc.text(lines4, 40, y);
    y += lines4.length * 6.5;
  }

  y += 15;

  // Signature block
  if (y > pageHeight - 80) {
    doc.addPage();
    drawCertificateBorder(doc);
    y = 30;
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(40, y, 110, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, COLORS.black);
  doc.text(signatoryName || '____________________________', 40, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(doc, COLORS.gray);
  doc.text(signatoryTitle || 'Human Resources Manager', 40, y);
  y += 5;
  doc.text(inst.name, 40, y);
  y += 5;
  doc.text(`Date: ${formatDate(new Date())}`, 40, y);

  // Official stamp placeholder (right side)
  const stampX = pageWidth - 40 - 35;
  const stampY = y - 25;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([2, 2], 0);
  doc.circle(stampX + 17.5, stampY + 12.5, 15, 'S');
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  setColor(doc, COLORS.gray);
  doc.text('Official', stampX + 17.5, stampY + 11, { align: 'center' });
  doc.text('Stamp', stampX + 17.5, stampY + 15, { align: 'center' });

  // Serial number / verification bar
  drawSerialNumber(doc, refNum);

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  setColor(doc, COLORS.gray);
  doc.text(
    'This is a computer-generated document. Verify authenticity with the issuing institution.',
    centerX, pageHeight - 12, { align: 'center' },
  );

  doc.save(`Certificate_of_Service_${sanitizeName(employee.fullName)}.pdf`);
}

export function generateEmploymentLetter(
  employee: EmployeeData,
  inst: InstitutionInfo,
  options?: {
    startDate?: string;
    probationMonths?: number;
    reportingTo?: string;
    workLocation?: string;
    signatoryName?: string;
    signatoryTitle?: string;
  },
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = getPageWidth(doc);

  let y = drawLetterhead(doc, inst);

  // Reference & Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(doc, COLORS.black);
  doc.text(`Ref: ${generateRefNumber('EMP')}`, MARGINS.left, y);
  doc.text(`Date: ${formatDate(new Date())}`, pageWidth - MARGINS.right, y, { align: 'right' });
  y += 8;

  // Employee address
  if (employee.address) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    setColor(doc, COLORS.black);
    doc.text(employee.fullName, MARGINS.left, y);
    y += 5;
    const addrLines = doc.splitTextToSize(employee.address, 80);
    doc.text(addrLines, MARGINS.left, y);
    y += addrLines.length * 5 + 4;
  }

  y += 4;

  // Title
  const centerX = pageWidth / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setColor(doc, COLORS.darkBlue);
  doc.text('LETTER OF EMPLOYMENT', centerX, y, { align: 'center' });

  const titleWidth = doc.getTextWidth('LETTER OF EMPLOYMENT');
  doc.setDrawColor(...DARK_BLUE_RGB);
  doc.setLineWidth(0.5);
  doc.line(centerX - titleWidth / 2, y + 1.5, centerX + titleWidth / 2, y + 1.5);
  y += 12;

  // Salutation
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setColor(doc, COLORS.black);
  doc.text(`Dear ${employee.fullName},`, MARGINS.left, y);
  y += 8;

  // Intro paragraph
  const startDate = options?.startDate || employee.hireDate || '';
  const probationMonths = options?.probationMonths ?? 3;
  const dept = getDepartmentName(employee.department);

  const intro = `We are pleased to offer you the position of ${employee.jobTitle || 'staff member'} in the ${dept} Department at ${inst.name}.${formatDate(startDate) ? ` Your employment will commence on ${formatDate(startDate)}.` : ''} This appointment is subject to a probation period of ${probationMonths} month(s).`;
  y = writeBodyText(doc, intro, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, COLORS.darkBlue);
  doc.text('Terms and Conditions of Employment:', MARGINS.left, y);
  y += 7;

  // Build terms
  const terms: string[] = [
    `Position: ${employee.jobTitle || 'As discussed'}`,
    `Department: ${dept}`,
  ];
  if (formatDate(startDate)) {
    terms.push(`Commencement Date: ${formatDate(startDate)}`);
  }
  terms.push(
    `Employment Type: ${employee.employmentType || 'Full-Time'}`,
    `Monthly Salary: ${formatCurrency(employee.basicSalary)}`,
  );

  if (employee.allowances && employee.allowances.length > 0) {
    const allowanceList = employee.allowances.map(a => `${a.name}: ${formatCurrency(a.amount)}`).join('; ');
    terms.push(`Allowances: ${allowanceList}`);
  }

  terms.push('Working Hours: Monday to Friday, 8:00 AM to 5:00 PM');
  terms.push(`Probation Period: ${probationMonths} month(s)`);
  terms.push('Leave Entitlement: 21 working days per annum');
  terms.push('Notice Period: 1 month by either party');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(doc, COLORS.black);

  terms.forEach((term, idx) => {
    if (y > getPageHeight(doc) - 50) {
      doc.addPage();
      y = MARGINS.top;
    }
    const num = `${idx + 1}.`;
    doc.text(num, MARGINS.left + 2, y);
    const lines = doc.splitTextToSize(term, getContentWidth(doc) - 14);
    doc.text(lines, MARGINS.left + 12, y);
    y += lines.length * 5 + 2;
  });

  y += 4;

  if (options?.reportingTo) {
    y = writeBodyText(doc, `You will report directly to ${options.reportingTo}.`, y);
    y += 3;
  }
  if (options?.workLocation) {
    y = writeBodyText(doc, `Your primary work location will be ${options.workLocation}.`, y);
    y += 3;
  }

  y += 2;
  y = writeBodyText(doc, 'We look forward to a successful working relationship.', y);
  y += 2;
  y = writeBodyText(doc, 'Yours sincerely,', y);

  // Employer signature
  y = drawSignatureBlock(doc, y, options?.signatoryName, options?.signatoryTitle, inst.name);

  // Employee acceptance
  y += 10;
  if (y > getPageHeight(doc) - 60) {
    doc.addPage();
    y = MARGINS.top;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, COLORS.darkBlue);
  doc.text('ACCEPTANCE BY EMPLOYEE', MARGINS.left, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(doc, COLORS.black);
  doc.text('I hereby accept the above terms and conditions of employment.', MARGINS.left, y);
  y += 15;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(MARGINS.left, y, MARGINS.left + 60, y);
  y += 5;
  doc.text(`Name: ${employee.fullName}`, MARGINS.left, y);
  y += 5;
  doc.text('Signature: ____________________', MARGINS.left, y);
  y += 5;
  doc.text('Date: ____________________', MARGINS.left, y);

  drawFooter(doc, inst.name);

  doc.save(`Employment_Letter_${sanitizeName(employee.fullName)}.pdf`);
}

export function generateSalaryCertificate(
  employee: EmployeeData,
  inst: InstitutionInfo,
  signatoryName?: string,
  signatoryTitle?: string,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);
  const centerX = pageWidth / 2;
  const refNum = generateRefNumber('SAL');

  // Security features
  drawCertificateBorder(doc);
  drawWatermark(doc, inst.name.toUpperCase());

  let y = 22;

  // Logo
  if (inst.logo && inst.logo.startsWith('data:image')) {
    try {
      doc.addImage(inst.logo, 'PNG', centerX - 15, y, 30, 30);
      y += 34;
    } catch {
      y += 4;
    }
  }

  // Institution name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  setColor(doc, COLORS.darkBlue);
  doc.text(inst.name.toUpperCase(), centerX, y, { align: 'center' });
  y += 7;

  // Address & contact (only show what exists)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, COLORS.gray);
  if (inst.address) {
    doc.text(inst.address, centerX, y, { align: 'center' });
    y += 4;
  }
  const salContactParts: string[] = [];
  if (inst.phone) salContactParts.push(`Tel: ${inst.phone}`);
  if (inst.email) salContactParts.push(`Email: ${inst.email}`);
  if (inst.taxId) salContactParts.push(`TIN: ${inst.taxId}`);
  if (salContactParts.length > 0) {
    doc.text(salContactParts.join('  \u2022  '), centerX, y, { align: 'center' });
    y += 4;
  }

  // Decorative double line
  y += 3;
  doc.setDrawColor(...DARK_BLUE_RGB);
  doc.setLineWidth(0.8);
  doc.line(40, y, pageWidth - 40, y);
  doc.setLineWidth(0.3);
  doc.line(40, y + 2, pageWidth - 40, y + 2);
  y += 10;

  // Reference number
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(doc, COLORS.gray);
  doc.text(`Ref: ${refNum}`, pageWidth - MARGINS.right - 8, y, { align: 'right' });
  y += 8;

  // Title with decorative elements
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  setColor(doc, COLORS.darkBlue);
  doc.text('SALARY CERTIFICATE', centerX, y, { align: 'center' });

  const titleW = doc.getTextWidth('SALARY CERTIFICATE');
  y += 3;
  doc.setDrawColor(...DARK_BLUE_RGB);
  doc.setLineWidth(0.6);
  doc.line(centerX - titleW / 2 - 5, y, centerX + titleW / 2 + 5, y);
  doc.setFillColor(...DARK_BLUE_RGB);
  doc.circle(centerX - titleW / 2 - 8, y, 1, 'F');
  doc.circle(centerX + titleW / 2 + 8, y, 1, 'F');
  y += 14;

  // "To Whom It May Concern"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setColor(doc, COLORS.black);
  doc.text('TO WHOM IT MAY CONCERN', centerX, y, { align: 'center' });
  y += 12;

  // Body
  const pronouns = getPronouns(employee.gender);
  const dept = getDepartmentName(employee.department);
  const jobTitle = employee.jobTitle || 'staff member';
  const contentWidth = pageWidth - 80;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setColor(doc, COLORS.black);
  doc.setLineHeightFactor(1.8);

  let para1 = `This is to certify that ${employee.fullName.toUpperCase()}`;
  if (employee.employeeNumber) {
    para1 += `, Employee No. ${employee.employeeNumber},`;
  }
  para1 += ` is currently employed at ${inst.name} as ${jobTitle.toUpperCase()}`;
  if (dept !== 'General') {
    para1 += ` in the ${dept} Department`;
  }
  para1 += '.';

  const lines1 = doc.splitTextToSize(para1, contentWidth);
  doc.text(lines1, 40, y);
  y += lines1.length * 6.5 + 6;

  const para2 = `The details of ${pronouns.possessive} current monthly remuneration are as follows:`;
  const lines2 = doc.splitTextToSize(para2, contentWidth);
  doc.text(lines2, 40, y);
  y += lines2.length * 6.5 + 4;

  // Salary table
  const salaryBody: any[][] = [
    ['Basic Salary', formatCurrency(employee.basicSalary)],
  ];

  let totalGross = employee.basicSalary || 0;
  if (employee.allowances) {
    for (const a of employee.allowances) {
      salaryBody.push([a.name, formatCurrency(a.amount)]);
      totalGross += a.amount;
    }
  }
  salaryBody.push([
    { content: 'Gross Monthly Salary', styles: { fontStyle: 'bold' } },
    { content: formatCurrency(totalGross), styles: { fontStyle: 'bold' } },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Amount (Monthly)']],
    body: salaryBody,
    theme: 'striped',
    headStyles: { fillColor: DARK_BLUE_RGB, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'right' } },
    margin: { left: 40, right: 40 },
  });

  y = getAutoTableEndY(doc) + 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setColor(doc, COLORS.black);
  const closing = 'This certificate is issued at the request of the above-named employee for bank, loan, or other official purposes.';
  const closingLines = doc.splitTextToSize(closing, contentWidth);
  doc.text(closingLines, 40, y);
  y += closingLines.length * 6.5 + 10;

  // Signature block
  if (y > pageHeight - 80) {
    doc.addPage();
    drawCertificateBorder(doc);
    y = 30;
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(40, y, 110, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, COLORS.black);
  doc.text(signatoryName || '____________________________', 40, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(doc, COLORS.gray);
  doc.text(signatoryTitle || 'Human Resources Manager', 40, y);
  y += 5;
  doc.text(inst.name, 40, y);
  y += 5;
  doc.text(`Date: ${formatDate(new Date())}`, 40, y);

  // Serial number / verification bar
  drawSerialNumber(doc, refNum);

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  setColor(doc, COLORS.gray);
  doc.text(
    'This is a computer-generated document. Verify authenticity with the issuing institution.',
    centerX, pageHeight - 12, { align: 'center' },
  );

  doc.save(`Salary_Certificate_${sanitizeName(employee.fullName)}.pdf`);
}

export function generateExperienceCertificate(
  employee: EmployeeData,
  inst: InstitutionInfo,
  endDate?: string,
  achievements?: string,
  signatoryName?: string,
  signatoryTitle?: string,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);
  const centerX = pageWidth / 2;
  const refNum = generateRefNumber('EXP');

  // Security features
  drawCertificateBorder(doc);
  drawWatermark(doc, inst.name.toUpperCase());

  let y = 22;

  // Logo
  if (inst.logo && inst.logo.startsWith('data:image')) {
    try {
      doc.addImage(inst.logo, 'PNG', centerX - 15, y, 30, 30);
      y += 34;
    } catch {
      y += 4;
    }
  }

  // Institution name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  setColor(doc, COLORS.darkBlue);
  doc.text(inst.name.toUpperCase(), centerX, y, { align: 'center' });
  y += 7;

  // Address & contact (only show what exists)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, COLORS.gray);
  if (inst.address) {
    doc.text(inst.address, centerX, y, { align: 'center' });
    y += 4;
  }
  const expContactParts: string[] = [];
  if (inst.phone) expContactParts.push(`Tel: ${inst.phone}`);
  if (inst.email) expContactParts.push(`Email: ${inst.email}`);
  if (inst.taxId) expContactParts.push(`TIN: ${inst.taxId}`);
  if (expContactParts.length > 0) {
    doc.text(expContactParts.join('  \u2022  '), centerX, y, { align: 'center' });
    y += 4;
  }

  // Decorative double line
  y += 3;
  doc.setDrawColor(...DARK_BLUE_RGB);
  doc.setLineWidth(0.8);
  doc.line(40, y, pageWidth - 40, y);
  doc.setLineWidth(0.3);
  doc.line(40, y + 2, pageWidth - 40, y + 2);
  y += 10;

  // Reference number
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(doc, COLORS.gray);
  doc.text(`Ref: ${refNum}`, pageWidth - MARGINS.right - 8, y, { align: 'right' });
  y += 8;

  // Title with decorative elements
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  setColor(doc, COLORS.darkBlue);
  doc.text('EXPERIENCE CERTIFICATE', centerX, y, { align: 'center' });

  const titleW = doc.getTextWidth('EXPERIENCE CERTIFICATE');
  y += 3;
  doc.setDrawColor(...DARK_BLUE_RGB);
  doc.setLineWidth(0.6);
  doc.line(centerX - titleW / 2 - 5, y, centerX + titleW / 2 + 5, y);
  doc.setFillColor(...DARK_BLUE_RGB);
  doc.circle(centerX - titleW / 2 - 8, y, 1, 'F');
  doc.circle(centerX + titleW / 2 + 8, y, 1, 'F');
  y += 14;

  // "To Whom It May Concern"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setColor(doc, COLORS.black);
  doc.text('TO WHOM IT MAY CONCERN', centerX, y, { align: 'center' });
  y += 12;

  // Body
  const pronouns = getPronouns(employee.gender);
  const dept = getDepartmentName(employee.department);
  const jobTitle = employee.jobTitle || 'staff member';
  const hireFormatted = formatDate(employee.hireDate);
  const endFormatted = endDate
    ? formatDate(endDate)
    : employee.terminationDate
      ? formatDate(employee.terminationDate)
      : '';
  const capSubject = pronouns.subject.charAt(0).toUpperCase() + pronouns.subject.slice(1);
  const contentWidth = pageWidth - 80;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setColor(doc, COLORS.black);
  doc.setLineHeightFactor(1.8);

  // Paragraph 1 — Employment period
  let bodyText = `This is to certify that ${employee.fullName.toUpperCase()}`;
  if (employee.nationalId) {
    bodyText += `, holder of National ID No. ${employee.nationalId},`;
  }
  if (hireFormatted && endFormatted) {
    bodyText += ` was employed at ${inst.name} from ${hireFormatted} to ${endFormatted}.`;
  } else if (hireFormatted) {
    bodyText += ` has been employed at ${inst.name} since ${hireFormatted}.`;
  } else {
    bodyText += ` was employed at ${inst.name}.`;
  }

  const lines1 = doc.splitTextToSize(bodyText, contentWidth);
  doc.text(lines1, 40, y);
  y += lines1.length * 6.5 + 6;

  // Paragraph 2 — Role and performance
  let para2 = `During ${pronouns.possessive} tenure, ${pronouns.subject} served in the capacity of ${jobTitle.toUpperCase()}`;
  if (dept !== 'General') {
    para2 += ` in the ${dept} Department`;
  }
  para2 += `. ${capSubject} demonstrated strong professional competence and was a valued member of our team.`;
  const lines2 = doc.splitTextToSize(para2, contentWidth);
  doc.text(lines2, 40, y);
  y += lines2.length * 6.5 + 6;

  // Paragraph 3 — Achievements (if provided)
  if (achievements) {
    const para3 = `Key contributions and achievements during ${pronouns.possessive} tenure include: ${achievements}`;
    const lines3 = doc.splitTextToSize(para3, contentWidth);
    doc.text(lines3, 40, y);
    y += lines3.length * 6.5 + 6;
  }

  // Paragraph 4 — Character reference
  const para4 = `${capSubject} discharged ${pronouns.possessive} duties with diligence, integrity, and dedication throughout ${pronouns.possessive} period of service.`;
  const lines4 = doc.splitTextToSize(para4, contentWidth);
  doc.text(lines4, 40, y);
  y += lines4.length * 6.5 + 6;

  // Paragraph 5 — Wishes
  if (endFormatted) {
    const para5 = `We wish ${pronouns.object} all the best in ${pronouns.possessive} future endeavors.`;
    const lines5 = doc.splitTextToSize(para5, contentWidth);
    doc.text(lines5, 40, y);
    y += lines5.length * 6.5 + 4;
  }

  const para6 = 'This certificate is issued upon request for whatever lawful purpose it may serve.';
  const lines6 = doc.splitTextToSize(para6, contentWidth);
  doc.text(lines6, 40, y);
  y += lines6.length * 6.5;

  y += 15;

  // Signature block
  if (y > pageHeight - 80) {
    doc.addPage();
    drawCertificateBorder(doc);
    y = 30;
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(40, y, 110, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, COLORS.black);
  doc.text(signatoryName || '____________________________', 40, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(doc, COLORS.gray);
  doc.text(signatoryTitle || 'Human Resources Manager', 40, y);
  y += 5;
  doc.text(inst.name, 40, y);
  y += 5;
  doc.text(`Date: ${formatDate(new Date())}`, 40, y);

  // Official stamp placeholder
  const stampX = pageWidth - 40 - 35;
  const stampY = y - 25;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([2, 2], 0);
  doc.circle(stampX + 17.5, stampY + 12.5, 15, 'S');
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  setColor(doc, COLORS.gray);
  doc.text('Official', stampX + 17.5, stampY + 11, { align: 'center' });
  doc.text('Stamp', stampX + 17.5, stampY + 15, { align: 'center' });

  // Serial number / verification bar
  drawSerialNumber(doc, refNum);

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  setColor(doc, COLORS.gray);
  doc.text(
    'This is a computer-generated document. Verify authenticity with the issuing institution.',
    centerX, pageHeight - 12, { align: 'center' },
  );

  doc.save(`Experience_Certificate_${sanitizeName(employee.fullName)}.pdf`);
}

export function generateWarningLetter(
  employee: EmployeeData,
  inst: InstitutionInfo,
  options: {
    warningType: 'verbal' | 'first_written' | 'second_written' | 'final';
    reason: string;
    incident_date: string;
    details: string;
    expectedImprovement: string;
    consequenceIfNotImproved: string;
    signatoryName?: string;
    signatoryTitle?: string;
  },
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = getPageWidth(doc);
  const centerX = pageWidth / 2;

  let y = drawLetterhead(doc, inst);

  const warningTitleMap: Record<string, string> = {
    verbal: 'VERBAL WARNING',
    first_written: 'FIRST WRITTEN WARNING',
    second_written: 'SECOND WRITTEN WARNING',
    final: 'FINAL WARNING',
  };
  const warningTitle = warningTitleMap[options.warningType] || 'WARNING';

  // Reference & Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(doc, COLORS.black);
  doc.text(`Ref: ${generateRefNumber('DIS')}`, MARGINS.left, y);
  doc.text(`Date: ${formatDate(new Date())}`, pageWidth - MARGINS.right, y, { align: 'right' });
  y += 8;

  // Addressee
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setColor(doc, COLORS.black);
  doc.text(employee.fullName, MARGINS.left, y);
  y += 5;
  if (employee.jobTitle) {
    doc.text(employee.jobTitle, MARGINS.left, y);
    y += 5;
  }
  doc.text(`${getDepartmentName(employee.department)} Department`, MARGINS.left, y);
  y += 10;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setColor(doc, COLORS.darkBlue);
  doc.text(warningTitle, centerX, y, { align: 'center' });
  const titleWidth = doc.getTextWidth(warningTitle);
  doc.setDrawColor(...DARK_BLUE_RGB);
  doc.setLineWidth(0.5);
  doc.line(centerX - titleWidth / 2, y + 1.5, centerX + titleWidth / 2, y + 1.5);
  y += 12;

  // Body
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setColor(doc, COLORS.black);
  doc.text(`Dear ${employee.fullName},`, MARGINS.left, y);
  y += 8;

  const intro = `This letter serves as a formal ${warningTitle.toLowerCase()} regarding your conduct/performance. The details of the concern are as follows:`;
  y = writeBodyText(doc, intro, y);
  y += 6;

  // Reason
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, COLORS.darkBlue);
  doc.text('Reason:', MARGINS.left, y);
  y += 5;
  y = writeBodyText(doc, options.reason, y);
  y += 4;

  // Incident Date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, COLORS.darkBlue);
  doc.text('Date of Incident:', MARGINS.left, y);
  y += 5;
  y = writeBodyText(doc, formatDate(options.incident_date), y);
  y += 4;

  // Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, COLORS.darkBlue);
  doc.text('Details:', MARGINS.left, y);
  y += 5;
  y = writeBodyText(doc, options.details, y);
  y += 4;

  // Expected Improvement
  if (y > getPageHeight(doc) - 80) {
    doc.addPage();
    y = MARGINS.top;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, COLORS.darkBlue);
  doc.text('Expected Improvement:', MARGINS.left, y);
  y += 5;
  y = writeBodyText(doc, options.expectedImprovement, y);
  y += 4;

  // Consequences
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, COLORS.darkBlue);
  doc.text('Consequences if Not Improved:', MARGINS.left, y);
  y += 5;
  y = writeBodyText(doc, options.consequenceIfNotImproved, y);
  y += 6;

  const closing = 'We trust that you will take this matter seriously and make the necessary improvements.';
  y = writeBodyText(doc, closing, y);

  y = drawSignatureBlock(doc, y, options.signatoryName, options.signatoryTitle, inst.name);

  // Acknowledgment section
  y += 10;
  if (y > getPageHeight(doc) - 55) {
    doc.addPage();
    y = MARGINS.top;
  }

  doc.setDrawColor(...DARK_BLUE_RGB);
  doc.setLineWidth(0.3);
  doc.line(MARGINS.left, y, pageWidth - MARGINS.right, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, COLORS.darkBlue);
  doc.text('EMPLOYEE ACKNOWLEDGMENT', MARGINS.left, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(doc, COLORS.black);
  doc.text('I acknowledge receipt of this warning letter and understand its contents.', MARGINS.left, y);
  y += 14;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(MARGINS.left, y, MARGINS.left + 60, y);
  doc.line(MARGINS.left + 90, y, MARGINS.left + 150, y);
  y += 5;
  doc.text('Employee Signature', MARGINS.left, y);
  doc.text('Date', MARGINS.left + 90, y);

  drawFooter(doc, inst.name);

  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`Warning_Letter_${sanitizeName(employee.fullName)}_${dateStr}.pdf`);
}

export function generatePromotionLetter(
  employee: EmployeeData,
  inst: InstitutionInfo,
  options: {
    newTitle: string;
    newDepartment?: string;
    newSalary?: number;
    effectiveDate: string;
    signatoryName?: string;
    signatoryTitle?: string;
  },
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = getPageWidth(doc);
  const centerX = pageWidth / 2;

  let y = drawLetterhead(doc, inst);

  // Reference & Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(doc, COLORS.black);
  doc.text(`Ref: ${generateRefNumber('PROM')}`, MARGINS.left, y);
  doc.text(`Date: ${formatDate(new Date())}`, pageWidth - MARGINS.right, y, { align: 'right' });
  y += 8;

  // Addressee
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setColor(doc, COLORS.black);
  doc.text(employee.fullName, MARGINS.left, y);
  y += 5;
  if (employee.jobTitle) {
    doc.text(employee.jobTitle, MARGINS.left, y);
    y += 5;
  }
  doc.text(`${getDepartmentName(employee.department)} Department`, MARGINS.left, y);
  y += 10;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setColor(doc, COLORS.darkBlue);
  doc.text('LETTER OF PROMOTION', centerX, y, { align: 'center' });
  const titleWidth = doc.getTextWidth('LETTER OF PROMOTION');
  doc.setDrawColor(...DARK_BLUE_RGB);
  doc.setLineWidth(0.5);
  doc.line(centerX - titleWidth / 2, y + 1.5, centerX + titleWidth / 2, y + 1.5);
  y += 12;

  // Body
  doc.text(`Dear ${employee.fullName},`, MARGINS.left, y);
  y += 8;

  const para1 = `We are pleased to inform you that, in recognition of your outstanding performance and dedication, you have been promoted from the position of ${employee.jobTitle || 'your current role'} to the position of ${options.newTitle}, effective ${formatDate(options.effectiveDate)}.`;
  y = writeBodyText(doc, para1, y);
  y += 6;

  if (options.newDepartment) {
    const para2 = `You will be transitioning to the ${options.newDepartment} Department in your new capacity.`;
    y = writeBodyText(doc, para2, y);
    y += 6;
  }

  if (options.newSalary != null) {
    const para3 = `Your new monthly remuneration will be ${formatCurrency(options.newSalary)}, effective from the date of your promotion.`;
    y = writeBodyText(doc, para3, y);
    y += 6;
  }

  const para4 = 'This promotion is a testament to your hard work, commitment, and the value you bring to our organization. We are confident that you will continue to excel in your new role and contribute significantly to the growth of the institution.';
  y = writeBodyText(doc, para4, y);
  y += 6;

  const para5 = 'Congratulations on this well-deserved achievement. We look forward to your continued success.';
  y = writeBodyText(doc, para5, y);
  y += 4;

  y = writeBodyText(doc, 'Yours sincerely,', y);

  y = drawSignatureBlock(doc, y, options.signatoryName, options.signatoryTitle, inst.name);

  drawFooter(doc, inst.name);

  doc.save(`Promotion_Letter_${sanitizeName(employee.fullName)}.pdf`);
}

export function generateIdCard(employee: EmployeeData, inst: InstitutionInfo): void {
  const cardWidth = 85.6;
  const cardHeight = 53.98;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [cardHeight, cardWidth] });

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, cardWidth, cardHeight, 'F');

  // Top accent bar
  doc.setFillColor(...DARK_BLUE_RGB);
  doc.rect(0, 0, cardWidth, 12, 'F');

  // Logo on accent bar
  if (inst.logo && inst.logo.startsWith('data:image')) {
    try {
      doc.addImage(inst.logo, 'PNG', 3, 1.5, 9, 9);
    } catch {
      // skip
    }
  }

  // Institution name on accent bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  const nameLines = doc.splitTextToSize(inst.name, 60);
  doc.text(nameLines, inst.logo ? 14 : 4, 5.5);

  // Photo placeholder
  const photoX = 5;
  const photoY = 16;
  const photoSize = 18;
  doc.setFillColor(220, 220, 220);
  doc.roundedRect(photoX, photoY, photoSize, photoSize, 1, 1, 'F');

  // Initials in photo placeholder
  const initials = employee.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n.charAt(0).toUpperCase())
    .join('');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(120, 120, 120);
  doc.text(initials, photoX + photoSize / 2, photoY + photoSize / 2 + 2, { align: 'center' });

  // Employee details
  const detailX = photoX + photoSize + 4;
  let detailY = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(doc, COLORS.darkBlue);
  const nameTextLines = doc.splitTextToSize(employee.fullName, cardWidth - detailX - 4);
  doc.text(nameTextLines, detailX, detailY);
  detailY += nameTextLines.length * 4 + 1;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setColor(doc, COLORS.black);

  if (employee.jobTitle) {
    doc.text(employee.jobTitle, detailX, detailY);
    detailY += 3.5;
  }

  if (employee.department) {
    doc.text(getDepartmentName(employee.department), detailX, detailY);
    detailY += 3.5;
  }

  if (employee.employeeNumber) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setColor(doc, COLORS.gray);
    doc.text(`ID: ${employee.employeeNumber}`, detailX, detailY);
  }

  // Bottom accent bar
  doc.setFillColor(...DARK_BLUE_RGB);
  doc.rect(0, cardHeight - 5, cardWidth, 5, 'F');

  // Institution contact in bottom bar
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(255, 255, 255);
  const idCardContact: string[] = [];
  if (inst.phone) idCardContact.push(inst.phone);
  if (inst.email) idCardContact.push(inst.email);
  if (idCardContact.length > 0) {
    doc.text(idCardContact.join('  |  '), cardWidth / 2, cardHeight - 1.8, { align: 'center' });
  }

  doc.save(`ID_Card_${sanitizeName(employee.fullName)}.pdf`);
}
