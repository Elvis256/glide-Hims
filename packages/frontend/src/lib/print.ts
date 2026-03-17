/**
 * Centralised Print Service
 *
 * Supports any printer / paper size via hidden-iframe technique
 * (avoids popup-blocker issues with window.open).
 *
 * Usage:
 *   import { printService } from '../lib/print';
 *   printService.printReceipt(html);
 *   printService.printLabel(html);
 *   printService.printDocument(html);
 *   printService.printCustom(html, { pageSize: '148mm 210mm', margin: '5mm' });
 *
 *   // With hospital header:
 *   const header = printService.buildHeader(inst);
 *   printService.printReceipt(header + bodyHtml);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstitutionInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  taxId?: string;
}

export type PagePreset = 'label' | 'receipt' | 'a4' | 'a5' | 'letter';

export interface PrintOptions {
  /** CSS @page size value, e.g. '80mm 40mm', 'A4 portrait' */
  pageSize?: string;
  /** CSS margin for @page */
  margin?: string;
  /** Document title (shown in browser print dialog) */
  title?: string;
  /** Extra <style> block injected into <head> */
  extraCss?: string;
  /** If true, print silently (kiosk mode – not supported by all browsers) */
  silent?: boolean;
}

// ---------------------------------------------------------------------------
// Preset page configs
// ---------------------------------------------------------------------------

const PAGE_PRESETS: Record<PagePreset, { size: string; margin: string; bodyStyle: string }> = {
  label: {
    size: '80mm 40mm',
    margin: '0',
    bodyStyle: 'margin:2mm; font-family:Arial,sans-serif; font-size:9pt; line-height:1.3;',
  },
  receipt: {
    size: '80mm auto',
    margin: '0',
    bodyStyle: "margin:0; padding:3mm; font-family:'Courier New',monospace; font-size:11px; line-height:1.4; width:80mm;",
  },
  a4: {
    size: 'A4 portrait',
    margin: '15mm',
    bodyStyle: "margin:0; padding:0; font-family:'Segoe UI',Arial,sans-serif; font-size:12pt; line-height:1.5; color:#1a1a2e;",
  },
  a5: {
    size: '148mm 210mm',
    margin: '10mm',
    bodyStyle: "margin:0; padding:0; font-family:'Segoe UI',Arial,sans-serif; font-size:10pt; line-height:1.4; color:#1a1a2e;",
  },
  letter: {
    size: 'letter portrait',
    margin: '15mm',
    bodyStyle: "margin:0; padding:0; font-family:'Segoe UI',Arial,sans-serif; font-size:12pt; line-height:1.5; color:#1a1a2e;",
  },
};

// ---------------------------------------------------------------------------
// Core print engine (hidden iframe)
// ---------------------------------------------------------------------------

function printViaIframe(html: string, opts: PrintOptions = {}): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for images/fonts to load, then print
  const win = iframe.contentWindow!;
  const doPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* cross-origin or iframe detached */
    }
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch { /* already removed */ }
    }, 1500);
  };

  // If document has images, wait for them
  const images = doc.querySelectorAll('img');
  if (images.length > 0) {
    let loaded = 0;
    const onLoad = () => { loaded++; if (loaded >= images.length) doPrint(); };
    images.forEach((img) => {
      if (img.complete) { onLoad(); } else {
        img.addEventListener('load', onLoad);
        img.addEventListener('error', onLoad);
      }
    });
    // Fallback timeout
    setTimeout(doPrint, 3000);
  } else {
    setTimeout(doPrint, 300);
  }
}

// ---------------------------------------------------------------------------
// Build full HTML document from content + preset/options
// ---------------------------------------------------------------------------

function buildHtmlDocument(
  bodyContent: string,
  preset: PagePreset | null,
  opts: PrintOptions = {},
): string {
  const cfg = preset ? PAGE_PRESETS[preset] : null;
  const pageSize = opts.pageSize || cfg?.size || 'auto';
  const pageMargin = opts.margin || cfg?.margin || '10mm';
  const bodyStyle = cfg?.bodyStyle || "font-family:Arial,sans-serif; font-size:12pt;";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${opts.title || 'Print'}</title>
<style>
  @page { size: ${pageSize}; margin: ${pageMargin}; }
  * { box-sizing: border-box; }
  body { ${bodyStyle} }
  p { margin: 0 0 2px; }

  /* Utility classes available in all print templates */
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-left { text-align: left; }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .font-medium { font-weight: 500; }
  .font-mono { font-family: 'Courier New', monospace; }
  .text-xs { font-size: 9px; }
  .text-sm { font-size: 11px; }
  .text-lg { font-size: 16px; }
  .text-xl { font-size: 20px; }
  .text-2xl { font-size: 24px; }
  .text-3xl { font-size: 30px; }
  .text-5xl { font-size: 48px; }
  .text-muted { color: #666; }
  .text-light { color: #999; }
  .mb-1 { margin-bottom: 4px; }
  .mb-2 { margin-bottom: 8px; }
  .mb-3 { margin-bottom: 12px; }
  .mb-4 { margin-bottom: 16px; }
  .mt-2 { margin-top: 8px; }
  .mt-4 { margin-top: 16px; }
  .py-2 { padding: 8px 0; }
  .py-3 { padding: 12px 0; }
  .px-2 { padding: 0 8px; }
  .flex { display: flex; }
  .justify-between { justify-content: space-between; }
  .items-center { align-items: center; }
  .gap-2 { gap: 8px; }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .border-dashed { border-top: 1px dashed #333; }
  .border-b-dashed { border-bottom: 1px dashed #333; }
  .w-full { width: 100%; }
  .capitalize { text-transform: capitalize; }
  .uppercase { text-transform: uppercase; }
  .tracking-wide { letter-spacing: 1px; }

  svg { display: block; max-width: 100%; }
  img { max-width: 100%; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
  td { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #f1f5f9; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  ${opts.extraCss || ''}
</style>
</head><body>${bodyContent}</body></html>`;
}

// ---------------------------------------------------------------------------
// Header / footer builders
// ---------------------------------------------------------------------------

/**
 * Build a printable institution header block.
 * Works for any paper size — adapts via CSS.
 *
 * @param variant 'receipt' = compact single column, 'document' = wide with columns
 */
function buildHeader(
  inst: InstitutionInfo,
  variant: 'receipt' | 'document' = 'document',
): string {
  const logoHtml = inst.logo
    ? `<img src="${inst.logo}" alt="logo" style="max-height:${variant === 'receipt' ? '60' : '80'}px; margin: 0 auto 4px;" />`
    : '';

  const meta = [
    inst.address,
    inst.phone ? `Tel: ${inst.phone}` : '',
    inst.email ? `Email: ${inst.email}` : '',
    inst.taxId ? `TIN: ${inst.taxId}` : '',
  ].filter(Boolean);

  if (variant === 'receipt') {
    return `<div class="text-center mb-3">
  ${logoHtml}
  <div class="font-bold" style="font-size:14px;">${inst.name}</div>
  ${meta.map((m) => `<div class="text-xs text-muted">${m}</div>`).join('')}
</div>
<div class="border-dashed mb-2"></div>`;
  }

  // Document / A4 variant — logo left, info right
  return `<div style="display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:12px; margin-bottom:16px; border-bottom:3px solid #2563eb;">
  <div>
    ${logoHtml ? `<div style="margin-bottom:6px;">${logoHtml}</div>` : ''}
    <div style="font-size:18px; font-weight:700; color:#2563eb; margin-bottom:2px;">${inst.name}</div>
    ${meta.map((m) => `<div style="font-size:10px; color:#666;">${m}</div>`).join('')}
  </div>
</div>`;
}

/**
 * Build a standard footer line for receipts/documents.
 */
function buildFooter(inst: InstitutionInfo, variant: 'receipt' | 'document' = 'document'): string {
  if (variant === 'receipt') {
    return `<div class="border-dashed" style="margin-top:8px; padding-top:8px;">
  <div class="text-center text-xs text-muted">
    <p class="font-semibold">Thank you for choosing ${inst.name}!</p>
    <p style="font-size:9px; margin-top:2px;">Get well soon • Computer generated</p>
  </div>
</div>`;
  }

  return `<div style="margin-top:32px; padding-top:12px; border-top:1px solid #e2e8f0; text-align:center; font-size:10px; color:#999;">
  <p>Thank you for choosing ${inst.name}</p>
  <p>This is a computer-generated document</p>
</div>`;
}

/**
 * Build a key-value row for receipts/labels.
 */
function kvRow(label: string, value: string, bold = false): string {
  return `<div class="flex justify-between mb-1">
  <span class="text-muted">${label}</span>
  <span class="${bold ? 'font-bold' : 'font-medium'}">${value}</span>
</div>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const printService = {
  /**
   * Print a small label (80×40mm) — lab samples, wristbands, specimen tubes.
   */
  printLabel(bodyHtml: string, opts?: PrintOptions) {
    const html = buildHtmlDocument(bodyHtml, 'label', { title: 'Label', ...opts });
    printViaIframe(html, opts);
  },

  /**
   * Print a thermal receipt (80mm wide) — tokens, payment receipts, pharmacy slips.
   */
  printReceipt(bodyHtml: string, opts?: PrintOptions) {
    const html = buildHtmlDocument(bodyHtml, 'receipt', { title: 'Receipt', ...opts });
    printViaIframe(html, opts);
  },

  /**
   * Print an A4 document — invoices, prescriptions, discharge summaries, reports.
   */
  printDocument(bodyHtml: string, opts?: PrintOptions) {
    const html = buildHtmlDocument(bodyHtml, 'a4', { title: 'Document', ...opts });
    printViaIframe(html, opts);
  },

  /**
   * Print with a specific preset.
   */
  printPreset(bodyHtml: string, preset: PagePreset, opts?: PrintOptions) {
    const html = buildHtmlDocument(bodyHtml, preset, opts);
    printViaIframe(html, opts);
  },

  /**
   * Print with fully custom options (no preset).
   */
  printCustom(bodyHtml: string, opts: PrintOptions) {
    const html = buildHtmlDocument(bodyHtml, null, opts);
    printViaIframe(html, opts);
  },

  /** Build institution header HTML. */
  buildHeader,

  /** Build footer HTML. */
  buildFooter,

  /** Build a key-value row. */
  kvRow,

  /** Available presets for reference. */
  presets: PAGE_PRESETS,
};

// Legacy exports for backward compatibility
export function printElement(elementId: string, title?: string): void {
  const el = document.getElementById(elementId);
  if (!el) return;
  printService.printDocument(el.innerHTML, { title });
}

export function printContent(content: string, title?: string): void {
  printService.printDocument(content, { title });
}

export function addPrintStyles(): void {
  const id = 'print-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `@media print {
    body * { visibility: hidden; }
    .printable, .printable * { visibility: visible; }
    .printable { position: absolute; left:0; top:0; width:100%; padding:20mm; background:white!important; }
    .no-print { display: none!important; }
    @page { size: A4; margin: 10mm; }
  }`;
  document.head.appendChild(style);
}

export default printService;
