/**
 * Lab Report PDF Generator — Professional Clinical Format
 *
 * Supports:
 * - Standard: Per-test clinical report (ISO 15189 compliant)
 * - Simplified: Compact summary of all tests
 *
 * Paper formats: POS/thermal (80mm), A4, A5, Letter
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InstitutionInfo } from './print';
import type { PagePreset } from './print';

// ─── Colors ─────────────────────────────────────────────────────────
// Aligned with system theme (blue-600 primary)

const PRIMARY     = [37, 99, 235] as const;   // blue-600 — primary header/accents
const PRIMARY_DK  = [29, 78, 216] as const;   // blue-700 — darker accent
const PRIMARY_LT  = [239, 246, 255] as const; // blue-50  — light bg
const SLATE       = [51, 65, 85] as const;    // slate-700 — body text
const SLATE_LT    = [148, 163, 184] as const; // slate-400 — muted text
const WHITE       = [255, 255, 255] as const;
const RED         = [220, 38, 38] as const;
const AMBER       = [217, 119, 6] as const;
const ROW_ALT     = [248, 250, 252] as const; // slate-50 — alternating row bg
const BORDER      = [226, 232, 240] as const; // slate-200 — table borders

// ─── Types ──────────────────────────────────────────────────────────

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
  paperFormat?: PagePreset;
  institution: InstitutionInfo;

  patientName: string;
  patientMrn?: string;
  patientAge?: string;
  patientGender?: string;
  patientDob?: string;
  patientPhone?: string;
  visitNo?: string;

  testName: string;
  testCode?: string;
  testCategory?: string;
  sampleType?: string;
  sampleNumber?: string;
  orderNumber?: string;

  sampleDate?: string;
  testDate?: string;
  validatedDate?: string;

  referringDoctor?: string;
  parameters: LabReportParam[];
  comments?: string;

  analysedBy?: string;
  verifiedBy?: string;
}

// ─── Paper format → jsPDF config ────────────────────────────────────

interface PaperConfig {
  format: string | [number, number];
  orientation: 'portrait' | 'landscape';
  marginX: number;
  marginTop: number;
  fontSize: number;
  compact: boolean;
}

function getPaperConfig(preset?: PagePreset): PaperConfig {
  switch (preset) {
    case 'receipt':
      return { format: [80, 297], orientation: 'portrait', marginX: 4, marginTop: 4, fontSize: 7, compact: true };
    case 'a5':
      return { format: 'a5', orientation: 'portrait', marginX: 10, marginTop: 10, fontSize: 8, compact: false };
    case 'letter':
      return { format: 'letter', orientation: 'portrait', marginX: 14, marginTop: 12, fontSize: 9, compact: false };
    default: // a4
      return { format: 'a4', orientation: 'portrait', marginX: 14, marginTop: 12, fontSize: 9, compact: false };
  }
}

// ─── Flag helpers ───────────────────────────────────────────────────

function getFlag(p: LabReportParam): string {
  if (!p.value || p.value === '—') return '';
  const num = parseFloat(p.value);
  if (isNaN(num)) {
    if (p.textNormal && p.value.toLowerCase() !== p.textNormal.toLowerCase()) return '#';
    return '';
  }
  if (p.criticalLow !== undefined && num < p.criticalLow) return '**';
  if (p.criticalHigh !== undefined && num > p.criticalHigh) return '##';
  if (p.normalMin !== undefined && num < p.normalMin) return '*';
  if (p.normalMax !== undefined && num > p.normalMax) return '#';
  return '';
}

function getFlagLabel(flag: string): string {
  switch (flag) {
    case '**': return 'CRIT LOW';
    case '##': return 'CRIT HIGH';
    case '*': return 'LOW';
    case '#': return 'HIGH';
    default: return '';
  }
}

function getFlagColor(flag: string): readonly [number, number, number] {
  if (flag === '##' || flag === '**') return RED;
  if (flag === '#' || flag === '*') return AMBER;
  return SLATE;
}

// ─── Draw helpers ───────────────────────────────────────────────────

function addLogo(doc: jsPDF, logo: string | undefined, x: number, y: number, size: number): boolean {
  if (!logo) return false;
  try {
    doc.addImage(logo, 'PNG', x, y, size, size);
    return true;
  } catch { return false; }
}

function drawRoundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, color: readonly [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(x, y, w, h, r, r, 'F');
}

// ─── Standard PDF ───────────────────────────────────────────────────

function generateStandardPdf(data: LabReportData): jsPDF {
  const cfg = getPaperConfig(data.paperFormat);
  const doc = new jsPDF({ orientation: cfg.orientation, unit: 'mm', format: cfg.format });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mx = cfg.marginX;
  const contentW = pw - mx * 2;
  let y = cfg.marginTop;

  // ── Colored header bar ──
  const headerH = cfg.compact ? 16 : 28;
  drawRoundedRect(doc, mx, y, contentW, headerH, 2, PRIMARY);

  const logoSize = cfg.compact ? 10 : 16;
  const hasLogo = addLogo(doc, data.institution.logo, mx + 3, y + (headerH - logoSize) / 2, logoSize);
  const textX = hasLogo ? mx + logoSize + 6 : mx + 5;

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(cfg.compact ? 9 : 14);
  doc.text(data.institution.name || 'Hospital', textX, y + (cfg.compact ? 6 : 10));

  const tagline = [data.institution.address, data.institution.phone, data.institution.email].filter(Boolean).join('  •  ');
  if (tagline) {
    doc.setFontSize(cfg.compact ? 5 : 7);
    doc.setFont('helvetica', 'normal');
    doc.text(tagline, textX, y + (cfg.compact ? 10 : 15), { maxWidth: contentW - (textX - mx) - 5 });
  }

  // "LABORATORY REPORT" badge on right side of header
  if (!cfg.compact) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    const badgeText = 'LABORATORY REPORT';
    const badgeW = doc.getTextWidth(badgeText) + 8;
    drawRoundedRect(doc, pw - mx - badgeW - 2, y + 3, badgeW, 8, 1.5, PRIMARY_DK);
    doc.setTextColor(...WHITE);
    doc.text(badgeText, pw - mx - badgeW / 2 - 2, y + 8.5, { align: 'center' });
  }

  y += headerH + 4;

  // ── Patient info bordered box ──
  const patBoxH = cfg.compact ? 20 : 28;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(mx, y, contentW, patBoxH, 1.5, 1.5, 'S');

  // Light teal left accent strip
  drawRoundedRect(doc, mx, y, 2, patBoxH, 0.5, PRIMARY);

  const fs = cfg.compact ? 6 : 8;
  doc.setFontSize(fs);
  const leftCol = mx + 5;
  const rightCol = mx + contentW / 2 + 2;
  const labelW = cfg.compact ? 18 : 28;
  let py = y + (cfg.compact ? 4 : 5.5);
  const rowH = cfg.compact ? 3.5 : 4.5;

  const drawField = (label: string, value: string, x: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE);
    doc.text(label, x, py);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    doc.text(value || '—', x + labelW, py);
  };

  const leftFields = [
    ['Patient:', data.patientName],
    ['Age/Sex:', [data.patientAge, data.patientGender].filter(Boolean).join(' / ') || '—'],
    ['DOB:', data.patientDob || '—'],
    ['Doctor:', data.referringDoctor || '—'],
  ];
  const rightFields = [
    ['MRN:', data.patientMrn || '—'],
    ['Sample ID:', data.sampleNumber || '—'],
    ['Specimen:', data.sampleType || '—'],
    ['Date:', data.sampleDate || '—'],
  ];

  if (cfg.compact) {
    // Compact: 2 rows x 2 cols
    for (let i = 0; i < Math.min(leftFields.length, 3); i++) {
      drawField(leftFields[i][0], leftFields[i][1], leftCol);
      if (rightFields[i]) drawField(rightFields[i][0], rightFields[i][1], rightCol);
      py += rowH;
    }
  } else {
    for (let i = 0; i < Math.max(leftFields.length, rightFields.length); i++) {
      if (leftFields[i]) drawField(leftFields[i][0], leftFields[i][1], leftCol);
      if (rightFields[i]) drawField(rightFields[i][0], rightFields[i][1], rightCol);
      py += rowH;
    }
  }

  y += patBoxH + 4;

  // ── Test panel header bar ──
  const panelH = cfg.compact ? 6 : 8;
  drawRoundedRect(doc, mx, y, contentW, panelH, 1.5, PRIMARY_LT);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.3);
  doc.line(mx, y + panelH, mx + contentW, y + panelH);

  doc.setFontSize(cfg.compact ? 7 : 9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_DK);
  const panelLabel = `${data.testName.toUpperCase()}${data.testCode ? ` (${data.testCode})` : ''}`;
  doc.text(panelLabel, mx + 4, y + (cfg.compact ? 4.2 : 5.5));

  if (data.testCategory) {
    doc.setFontSize(cfg.compact ? 5 : 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_LT);
    doc.text(data.testCategory.toUpperCase(), pw - mx - 4, y + (cfg.compact ? 4.2 : 5.5), { align: 'right' });
  }

  y += panelH + 2;

  // ── Results table ──
  const tableRows = data.parameters.map(p => {
    const flag = getFlag(p);
    return {
      cells: [
        p.name,
        p.value || '—',
        p.unit || '',
        p.referenceRange || '',
        flag ? getFlagLabel(flag) : '—',
      ],
      flag,
    };
  });

  autoTable(doc, {
    startY: y,
    head: [['Test Parameter', 'Result', 'Unit', 'Reference Range', 'Flag']],
    body: tableRows.map(r => r.cells),
    styles: {
      fontSize: cfg.compact ? 6 : cfg.fontSize,
      cellPadding: cfg.compact ? 1.5 : 2.5,
      lineColor: [...BORDER] as [number, number, number],
      lineWidth: 0.2,
      textColor: [...SLATE] as [number, number, number],
    },
    headStyles: {
      fillColor: [...PRIMARY] as [number, number, number],
      textColor: [...WHITE] as [number, number, number],
      fontStyle: 'bold',
      halign: 'left',
      lineWidth: 0,
    },
    bodyStyles: {
      lineWidth: 0.15,
      lineColor: [...BORDER] as [number, number, number],
    },
    alternateRowStyles: {
      fillColor: [...ROW_ALT] as [number, number, number],
    },
    columnStyles: cfg.compact
      ? { 0: { cellWidth: 22 }, 1: { cellWidth: 14, halign: 'center' as const }, 2: { cellWidth: 12, halign: 'center' as const }, 3: { cellWidth: 16, halign: 'center' as const }, 4: { cellWidth: 12, halign: 'center' as const } }
      : { 0: { cellWidth: 55 }, 1: { cellWidth: 30, halign: 'center' as const }, 2: { cellWidth: 25, halign: 'center' as const }, 3: { cellWidth: 35, halign: 'center' as const }, 4: { cellWidth: 25, halign: 'center' as const } },
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        const rowIdx = hookData.row.index;
        const flag = tableRows[rowIdx]?.flag || '';
        // Color the Result and Flag columns for abnormals
        if ((hookData.column.index === 1 || hookData.column.index === 4) && flag) {
          const color = getFlagColor(flag);
          hookData.cell.styles.textColor = [...color] as [number, number, number];
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: mx, right: mx },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ── Flag legend ──
  if (!cfg.compact) {
    drawRoundedRect(doc, mx, y, contentW, 7, 1, PRIMARY_LT);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY_DK);
    doc.text('Key:', mx + 3, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE);
    doc.text('LOW (*)  •  HIGH (#)  •  CRITICAL LOW (**)  •  CRITICAL HIGH (##)', mx + 14, y + 4.5);
    y += 9;
  } else {
    doc.setFontSize(5);
    doc.setTextColor(...SLATE_LT);
    doc.text('* LOW  # HIGH  ** CRIT LOW  ## CRIT HIGH', mx, y + 3);
    y += 5;
  }

  // ── Comments ──
  if (data.comments) {
    doc.setFontSize(cfg.compact ? 6 : 8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE);
    doc.text('Comments:', mx, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.comments, mx + 20, y, { maxWidth: contentW - 22 });
    y += 6;
  }

  // ── Signature section ──
  if (!cfg.compact) {
    y = Math.max(y + 6, Math.min(ph - 50, y + 12));
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(mx, y, mx + contentW, y);
    y += 6;

    const sigW = 50;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE);

    if (data.analysedBy) doc.text(`Analysed By: ${data.analysedBy}`, mx, y);
    if (data.verifiedBy) doc.text(`Verified By: ${data.verifiedBy}`, rightCol, y);
    y += 10;

    // Signature lines
    doc.setLineWidth(0.3);
    doc.setDrawColor(...SLATE_LT);
    doc.line(mx, y, mx + sigW, y);
    doc.line(rightCol, y, rightCol + sigW, y);
    y += 3;
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_LT);
    doc.text('Lab Technologist', mx, y);
    doc.text('Pathologist / Supervisor', rightCol, y);
    y += 6;
  }

  // ── End of report ──
  doc.setFontSize(cfg.compact ? 5 : 7);
  doc.setTextColor(...SLATE_LT);
  doc.text('— End of Report —', pw / 2, Math.min(y + 2, ph - 25), { align: 'center' });

  // ── Footer on every page ──
  addFooters(doc, data, cfg);

  return doc;
}

// ─── Simplified PDF ─────────────────────────────────────────────────

function generateSimplifiedPdf(data: LabReportData): jsPDF {
  const cfg = getPaperConfig(data.paperFormat);
  const doc = new jsPDF({ orientation: cfg.orientation, unit: 'mm', format: cfg.format });
  const pw = doc.internal.pageSize.getWidth();
  const mx = cfg.marginX;
  const contentW = pw - mx * 2;
  let y = cfg.marginTop;

  // ── Header ──
  const headerH = cfg.compact ? 12 : 20;
  drawRoundedRect(doc, mx, y, contentW, headerH, 2, PRIMARY);

  const logoSize = cfg.compact ? 8 : 12;
  const hasLogo = addLogo(doc, data.institution.logo, mx + 3, y + (headerH - logoSize) / 2, logoSize);
  const textX = hasLogo ? mx + logoSize + 5 : mx + 4;

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(cfg.compact ? 8 : 12);
  doc.text(data.institution.name || 'Hospital', textX, y + (cfg.compact ? 5 : 8));
  doc.setFontSize(cfg.compact ? 5 : 7);
  doc.setFont('helvetica', 'normal');
  doc.text('Laboratory Summary Report', textX, y + (cfg.compact ? 9 : 13));

  y += headerH + 3;

  // ── Patient info ──
  doc.setFontSize(cfg.compact ? 6 : 8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SLATE);
  doc.text('Patient:', mx, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.text(`${data.patientName}  (${data.patientMrn || 'N/A'})  •  ${data.patientAge || '—'} / ${data.patientGender || '—'}`, mx + 16, y);
  y += cfg.compact ? 3.5 : 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SLATE);
  doc.text('Date:', mx, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.text(data.sampleDate || new Date().toLocaleDateString(), mx + 16, y);
  y += cfg.compact ? 4 : 6;

  // ── Results table ──
  const tableRows = data.parameters.map(p => {
    const flag = getFlag(p);
    return {
      cells: [p.name, p.value || '—', p.unit || '', p.referenceRange || '', flag ? getFlagLabel(flag) : '—'],
      flag,
    };
  });

  autoTable(doc, {
    startY: y,
    head: [['Parameter', 'Result', 'Unit', 'Reference', 'Flag']],
    body: tableRows.map(r => r.cells),
    styles: {
      fontSize: cfg.compact ? 5.5 : cfg.fontSize,
      cellPadding: cfg.compact ? 1.2 : 2,
      lineColor: [...BORDER] as [number, number, number],
      lineWidth: 0.15,
      textColor: [...SLATE] as [number, number, number],
    },
    headStyles: {
      fillColor: [...PRIMARY] as [number, number, number],
      textColor: [...WHITE] as [number, number, number],
      fontStyle: 'bold',
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: [...ROW_ALT] as [number, number, number] },
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        const rowIdx = hookData.row.index;
        const flag = tableRows[rowIdx]?.flag || '';
        if ((hookData.column.index === 1 || hookData.column.index === 4) && flag) {
          hookData.cell.styles.textColor = [...getFlagColor(flag)] as [number, number, number];
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: mx, right: mx },
  });

  if (data.comments) {
    y = (doc as any).lastAutoTable.finalY + 4;
    doc.setFontSize(cfg.compact ? 5.5 : 8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...SLATE);
    doc.text(`Comments: ${data.comments}`, mx, y, { maxWidth: contentW });
  }

  addFooters(doc, data, cfg);
  return doc;
}

// ─── Shared footer ──────────────────────────────────────────────────

function addFooters(doc: jsPDF, data: LabReportData, cfg: PaperConfig) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mx = cfg.marginX;
  const totalPages = (doc as any).internal.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Continuation header on pages 2+
    if (i > 1 && data.institution.name && !cfg.compact) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PRIMARY_DK);
      doc.text(`${data.institution.name} — ${data.testName} (cont.)`, pw / 2, 7, { align: 'center' });
    }

    const footerY = ph - (cfg.compact ? 6 : 18);

    // Separator line
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(mx, footerY, pw - mx, footerY);

    doc.setTextColor(...SLATE_LT);

    if (cfg.compact) {
      doc.setFontSize(4.5);
      doc.text(`${data.institution.name || ''} | ${new Date().toLocaleString('en-GB')} | Page ${i}/${totalPages}`, pw / 2, footerY + 3, { align: 'center' });
    } else {
      // Confidentiality disclaimer
      doc.setFontSize(6);
      doc.setFont('helvetica', 'italic');
      doc.text(
        'This report is confidential and intended solely for the requesting clinician. Results should be interpreted in clinical context.',
        pw / 2, footerY + 4, { align: 'center', maxWidth: pw - mx * 2 - 10 }
      );

      // Facility contact
      const footerLine = [data.institution.address, data.institution.phone, data.institution.email].filter(Boolean).join('  •  ');
      if (footerLine) {
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(footerLine, pw / 2, footerY + 9, { align: 'center' });
      }

      // Page number + timestamp
      doc.setFontSize(6);
      doc.text(`Report generated: ${new Date().toLocaleString('en-GB')}`, mx, footerY + 13);
      doc.text(`Page ${i} of ${totalPages}`, pw - mx, footerY + 13, { align: 'right' });
    }

    doc.setTextColor(0);
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export function generateLabReportPdf(data: LabReportData, filename?: string): void {
  const doc = data.format === 'standard'
    ? generateStandardPdf(data)
    : generateSimplifiedPdf(data);

  const fname = filename
    || `LR-${(data.testName || 'TEST').replace(/\s+/g, '_').toUpperCase()}_${data.patientMrn || 'patient'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fname);
}

export function printLabReport(data: LabReportData): void {
  const doc = data.format === 'standard'
    ? generateStandardPdf(data)
    : generateSimplifiedPdf(data);

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0';
  document.body.appendChild(iframe);
  iframe.onload = () => {
    try { iframe.contentWindow?.print(); }
    catch { window.open(url, '_blank'); }
    setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); }, 2000);
  };
  iframe.src = url;
}

export function buildReportParams(
  parameters: { name: string; unit: string; referenceRange: string; criticalLow?: number; criticalHigh?: number; textNormal?: string }[],
  resultValues: Record<string, string>,
): LabReportParam[] {
  return parameters.map(p => {
    const range = p.referenceRange || '';
    let normalMin: number | undefined;
    let normalMax: number | undefined;

    const match = range.match(/^([\d.]+)\s*[-–]\s*([\d.]+)/);
    if (match) {
      normalMin = parseFloat(match[1]);
      normalMax = parseFloat(match[2]);
    } else {
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
