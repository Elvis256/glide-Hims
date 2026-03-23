/**
 * Lab Report PDF Generator
 *
 * Generates professional lab report PDFs in two formats:
 * - Standard: Full clinical format (Amani-style) — per-test, with facility header,
 *   patient demographics, specimen info, parameter table with abnormal flags,
 *   analysed/verified by, and facility footer.
 * - Simplified: Compact summary of results without full clinical formatting.
 *
 * Usage:
 *   import { generateLabReportPdf, printLabReport } from '../lib/labReport';
 *   generateLabReportPdf({ format: 'standard', ... }); // downloads PDF
 *   printLabReport({ format: 'standard', ... });        // opens print dialog
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { printService, type InstitutionInfo } from './print';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LabReportFormat = 'standard' | 'simplified';

export interface LabReportParam {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  normalMin?: number;
  normalMax?: number;
  criticalLow?: number;
  criticalHigh?: number;
  textNormal?: string;
}

export interface LabReportData {
  format: LabReportFormat;
  institution: InstitutionInfo;

  // Patient
  patientName: string;
  patientMrn?: string;
  patientAge?: string;
  patientGender?: string;
  patientDob?: string;
  patientPhone?: string;
  visitNo?: string;

  // Test / sample
  testName: string;
  testCode?: string;
  testCategory?: string;
  sampleType?: string;
  sampleNumber?: string;
  orderNumber?: string;

  // Dates
  sampleDate?: string;
  testDate?: string;
  validatedDate?: string;

  // Clinical
  referringDoctor?: string;
  parameters: LabReportParam[];
  comments?: string;

  // Staff
  analysedBy?: string;
  verifiedBy?: string;
}

// ---------------------------------------------------------------------------
// Abnormal flag helpers
// ---------------------------------------------------------------------------

function getFlag(p: LabReportParam): string {
  if (!p.value || p.value === '—') return '';
  const num = parseFloat(p.value);
  if (isNaN(num)) {
    // Qualitative: compare text to textNormal
    if (p.textNormal && p.value.toLowerCase() !== p.textNormal.toLowerCase()) return '#';
    return '';
  }
  if (p.criticalLow !== undefined && num < p.criticalLow) return '**';
  if (p.criticalHigh !== undefined && num > p.criticalHigh) return '##';
  if (p.normalMin !== undefined && num < p.normalMin) return '*';
  if (p.normalMax !== undefined && num > p.normalMax) return '#';
  return '';
}

function getFlagColor(flag: string): [number, number, number] {
  if (flag === '##' || flag === '**') return [220, 38, 38];  // red
  if (flag === '#' || flag === '*') return [234, 88, 12];     // orange
  return [0, 0, 0];
}

// ---------------------------------------------------------------------------
// Standard (Amani-style) PDF
// ---------------------------------------------------------------------------

function generateStandardPdf(data: LabReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  let y = 12;

  // ── Facility header (with logo if available) ──
  if (data.institution.logo) {
    try {
      doc.addImage(data.institution.logo, 'PNG', (pw - 18) / 2, y, 18, 18);
      y += 20;
    } catch { /* skip logo if invalid */ }
  }
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(data.institution.name || 'Hospital', pw / 2, y, { align: 'center' });
  y += 5;

  const tagline = [data.institution.address, data.institution.phone, data.institution.email]
    .filter(Boolean).join('  |  ');
  if (tagline) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(tagline, pw / 2, y, { align: 'center' });
    y += 4;
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(14, y, pw - 14, y);
  y += 6;

  // ── Patient info block (two-column) ──
  doc.setFontSize(9);
  const leftCol = 14;
  const rightCol = pw / 2 + 5;
  const labelW = 30;

  const drawField = (label: string, value: string, x: number, yPos: number) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, x, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(value || '—', x + labelW, yPos);
  };

  const leftFields = [
    ['Patient Name:', data.patientName],
    ['Age/Gender:', [data.patientAge, data.patientGender].filter(Boolean).join(' / ') || '—'],
    ['DOB:', data.patientDob || '—'],
    ['Ph No.:', data.patientPhone || '—'],
    ['Specimen:', data.sampleType || '—'],
    ['Doctor:', data.referringDoctor || '—'],
  ];

  const rightFields = [
    ['MR No:', data.patientMrn || '—'],
    ['Visit No:', data.visitNo || '—'],
    ['Lab ID No:', data.sampleNumber || '—'],
    ['Sample Date:', data.sampleDate || '—'],
    ['Test Date:', data.testDate || '—'],
    ['Validated:', data.validatedDate || '—'],
  ];

  const rows = Math.max(leftFields.length, rightFields.length);
  for (let i = 0; i < rows; i++) {
    if (leftFields[i]) drawField(leftFields[i][0], leftFields[i][1], leftCol, y);
    if (rightFields[i]) drawField(rightFields[i][0], rightFields[i][1], rightCol, y);
    y += 4.5;
  }

  y += 3;
  doc.setLineWidth(0.3);
  doc.line(14, y, pw - 14, y);
  y += 6;

  // ── Section title ──
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('LABORATORY REPORT', pw / 2, y, { align: 'center' });
  y += 5;

  const categoryLabel = (data.testCategory || 'general').toUpperCase().replace(/_/g, ' ');
  doc.setFontSize(10);
  doc.text(categoryLabel, pw / 2, y, { align: 'center' });
  y += 6;

  // ── Test panel name ──
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(data.testName.toUpperCase(), leftCol, y);
  y += 6;

  // ── Results table ──
  const tableRows = data.parameters.map(p => {
    const flag = getFlag(p);
    const displayValue = p.value || '—';
    return [
      p.name,
      flag ? `${displayValue} ${flag}` : displayValue,
      p.referenceRange || '',
      p.unit || '',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Test Description', 'Result', 'Reference Range', 'SI Units']],
    body: tableRows,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.3, lineColor: [0, 0, 0] },
    bodyStyles: { lineWidth: 0.1, lineColor: [200, 200, 200] },
    columnStyles: {
      0: { cellWidth: 65 },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 45, halign: 'center' },
      3: { cellWidth: 30, halign: 'center' },
    },
    didParseCell: (hookData) => {
      // Color abnormal result cells
      if (hookData.section === 'body' && hookData.column.index === 1) {
        const raw = String(hookData.cell.raw || '');
        if (raw.includes('##') || raw.includes('**')) {
          hookData.cell.styles.textColor = [220, 38, 38];
          hookData.cell.styles.fontStyle = 'bold';
        } else if (raw.includes('#') || raw.includes('*')) {
          hookData.cell.styles.textColor = [234, 88, 12];
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Key interpretation ──
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Interpretation :  * = LOW,   # = HIGH,   ** = CRITICAL LOW,   ## = CRITICAL HIGH', leftCol, y);
  y += 8;

  // ── Comments ──
  if (data.comments) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Comments:', leftCol, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.comments, leftCol + 22, y);
    y += 6;
  }

  // ── Analysed / Verified ──
  y += 4;
  doc.setLineWidth(0.3);
  doc.line(14, y, pw - 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (data.analysedBy) {
    doc.text(`Analysed By: ${data.analysedBy}`, leftCol, y);
  }
  if (data.verifiedBy) {
    doc.text(`Verified By: ${data.verifiedBy}`, rightCol, y);
  }
  y += 8;

  // ── Signature lines ──
  const sigWidth = 55;
  const sigY = Math.min(y + 10, ph - 40);
  doc.setLineWidth(0.3);
  doc.line(leftCol, sigY, leftCol + sigWidth, sigY);
  doc.line(rightCol, sigY, rightCol + sigWidth, sigY);
  doc.setFontSize(8);
  doc.text('Lab Technologist', leftCol, sigY + 4);
  doc.text('Pathologist / Supervisor', rightCol, sigY + 4);

  y = sigY + 10;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('*** End of Report ***', pw / 2, y, { align: 'center' });

  // ── Footer on every page ──
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Repeat facility name at top of continuation pages
    if (i > 1 && data.institution.name) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text(`${data.institution.name} — ${data.testName} (cont.)`, pw / 2, 8, { align: 'center' });
    }

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);

    // Confidentiality disclaimer
    doc.text(
      'This report is confidential and intended solely for the requesting clinician. Results should be interpreted in clinical context.',
      pw / 2, ph - 16, { align: 'center', maxWidth: pw - 28 }
    );

    const footerParts = [
      data.institution.address,
      data.institution.phone,
      data.institution.email,
    ].filter(Boolean);
    if (footerParts.length > 0) {
      doc.text(footerParts.join('  |  '), pw / 2, ph - 10, { align: 'center' });
    }
    doc.text(`Page ${i} of ${totalPages}`, pw - 14, ph - 6, { align: 'right' });
    doc.text(
      `Report generated: ${new Date().toLocaleString('en-GB')}`,
      14, ph - 6
    );
    doc.setTextColor(0);
  }

  return doc;
}

// ---------------------------------------------------------------------------
// Simplified PDF
// ---------------------------------------------------------------------------

function generateSimplifiedPdf(data: LabReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  let y = 15;

  // ── Header (with logo if available) ──
  if (data.institution.logo) {
    try {
      doc.addImage(data.institution.logo, 'PNG', (pw - 18) / 2, y, 18, 18);
      y += 20;
    } catch { /* skip logo if invalid */ }
  }
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.institution.name || 'Hospital', pw / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Laboratory Results', pw / 2, y, { align: 'center' });
  y += 4;
  doc.setLineWidth(0.5);
  doc.line(14, y, pw - 14, y);
  y += 6;

  // ── Patient + test info ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Patient:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.patientName}  (${data.patientMrn || 'N/A'})`, 34, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Test:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.testName} (${data.testCode || ''})`, 34, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.sampleDate || new Date().toLocaleDateString(), 34, y);
  y += 8;

  // ── Results table ──
  const tableRows = data.parameters.map(p => {
    const flag = getFlag(p);
    return [
      p.name,
      p.value || '—',
      p.unit || '',
      p.referenceRange || '',
      flag || '—',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Parameter', 'Result', 'Unit', 'Reference Range', 'Flag']],
    body: tableRows,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255 },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 4) {
        const flag = String(hookData.cell.raw || '');
        if (flag.includes('#') || flag.includes('*')) {
          hookData.cell.styles.textColor = getFlagColor(flag);
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
      if (hookData.section === 'body' && hookData.column.index === 1) {
        const rowIdx = hookData.row.index;
        const flag = String(tableRows[rowIdx]?.[4] || '');
        if (flag.includes('#') || flag.includes('*')) {
          hookData.cell.styles.textColor = getFlagColor(flag);
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  if (data.comments) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(`Comments: ${data.comments}`, 14, y);
    y += 6;
  }

  // ── Footer ──
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    if (i > 1 && data.institution.name) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text(`${data.institution.name} — Lab Summary (cont.)`, pw / 2, 8, { align: 'center' });
    }

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(
      'This report is confidential and intended solely for the requesting clinician.',
      pw / 2, ph - 14, { align: 'center', maxWidth: pw - 28 }
    );
    doc.text(`Generated by ${data.institution.name || 'Hospital'} Lab System`, 14, ph - 8);
    doc.text(`Report generated: ${new Date().toLocaleString('en-GB')}`, 14, ph - 4);
    doc.text(`Page ${i} of ${totalPages}`, pw - 14, ph - 8, { align: 'right' });
    doc.setTextColor(0);
  }

  return doc;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate and download a lab report PDF.
 */
export function generateLabReportPdf(data: LabReportData, filename?: string): void {
  const doc = data.format === 'standard'
    ? generateStandardPdf(data)
    : generateSimplifiedPdf(data);

  const fname = filename || `Lab_Report_${data.testCode || 'TEST'}_${data.patientMrn || 'patient'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fname);
}

/**
 * Generate lab report HTML and send to printer via printService.
 */
export function printLabReport(data: LabReportData): void {
  const doc = data.format === 'standard'
    ? generateStandardPdf(data)
    : generateSimplifiedPdf(data);

  // Convert jsPDF to blob URL, open in iframe for printing
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      iframe.contentWindow?.print();
    } catch {
      window.open(url, '_blank');
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 2000);
  };

  iframe.src = url;
}

/**
 * Build LabReportParam array from the sample parameters + entered result values.
 */
export function buildReportParams(
  parameters: { name: string; unit: string; referenceRange: string; criticalLow?: number; criticalHigh?: number; textNormal?: string }[],
  resultValues: Record<string, string>,
): LabReportParam[] {
  return parameters.map(p => {
    const range = p.referenceRange || '';
    let normalMin: number | undefined;
    let normalMax: number | undefined;

    // Parse "min-max" range string
    const match = range.match(/^([\d.]+)\s*[-–]\s*([\d.]+)/);
    if (match) {
      normalMin = parseFloat(match[1]);
      normalMax = parseFloat(match[2]);
    } else {
      // Handle "<value" or ">value"
      const ltMatch = range.match(/^[<≤]\s*([\d.]+)/);
      if (ltMatch) normalMax = parseFloat(ltMatch[1]);
      const gtMatch = range.match(/^[>≥]\s*([\d.]+)/);
      if (gtMatch) normalMin = parseFloat(gtMatch[1]);
    }

    return {
      name: p.name,
      value: resultValues[p.name] || '',
      unit: p.unit,
      referenceRange: range,
      normalMin,
      normalMax,
      criticalLow: p.criticalLow,
      criticalHigh: p.criticalHigh,
      textNormal: p.textNormal,
    };
  });
}
