/**
 * Print utilities for printing specific elements
 */

/**
 * Print a specific element by its ID or ref
 * Opens a new window with only the content to print
 */
export function printElement(elementId: string, title?: string): void {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id "${elementId}" not found`);
    return;
  }

  printContent(element.innerHTML, title);
}

/**
 * Print HTML content in a new window
 */
export function printContent(content: string, title?: string): void {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    alert('Please allow popups to print');
    return;
  }

  const styles = `
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: 'Times New Roman', Times, serif;
        font-size: 12pt;
        line-height: 1.5;
        padding: 20mm;
        background: white;
        color: black;
      }
      .certificate-container {
        max-width: 100%;
        margin: 0 auto;
      }
      h1, h2, h3 {
        font-family: Arial, sans-serif;
      }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .text-left { text-align: left; }
      .font-bold, .font-semibold { font-weight: bold; }
      .font-medium { font-weight: 500; }
      .border { border: 1px solid #333; }
      .border-b { border-bottom: 1px solid #333; }
      .border-t { border-top: 1px solid #333; }
      .rounded-lg { border-radius: 8px; }
      .p-4 { padding: 16px; }
      .p-8 { padding: 32px; }
      .mb-2 { margin-bottom: 8px; }
      .mb-4 { margin-bottom: 16px; }
      .mb-6 { margin-bottom: 24px; }
      .mt-4 { margin-top: 16px; }
      .mt-8 { margin-top: 32px; }
      .pt-8 { padding-top: 32px; }
      .pb-6 { padding-bottom: 24px; }
      .space-y-3 > * + * { margin-top: 12px; }
      .space-y-5 > * + * { margin-top: 20px; }
      .grid { display: grid; }
      .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
      .col-span-2 { grid-column: span 2; }
      .gap-4 { gap: 16px; }
      .flex { display: flex; }
      .flex-1 { flex: 1; }
      .items-end { align-items: flex-end; }
      .justify-between { justify-content: space-between; }
      .w-24 { width: 96px; }
      .w-48 { width: 192px; }
      .text-xs { font-size: 10pt; }
      .text-sm { font-size: 11pt; }
      .text-2xl { font-size: 18pt; }
      .text-gray-500, .text-gray-600, .text-gray-700 { color: #444; }
      .text-gray-900 { color: #000; }
      .bg-gray-50 { background-color: #f9f9f9; }
      .bg-white { background-color: white; }
      .opacity-75 { opacity: 0.75; }
      
      /* Print-specific styles */
      @media print {
        body {
          padding: 0;
          margin: 0;
        }
        @page {
          size: A4;
          margin: 15mm;
        }
      }
      
      /* Hide elements marked as no-print */
      .no-print { display: none !important; }
    </style>
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title || 'Print'}</title>
        ${styles}
      </head>
      <body>
        <div class="certificate-container">
          ${content}
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    // Close after a short delay to allow print dialog
    setTimeout(() => {
      printWindow.close();
    }, 500);
  };
}

/**
 * Alternative: Print using CSS @media print
 * Add 'printable' class to the element you want to print
 * Add 'no-print' class to elements you want to hide during printing
 */
export function addPrintStyles(): void {
  const styleId = 'print-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @media print {
      body * {
        visibility: hidden;
      }
      .printable, .printable * {
        visibility: visible;
      }
      .printable {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        padding: 20mm;
        background: white !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print {
        display: none !important;
      }
      @page {
        size: A4;
        margin: 10mm;
      }
    }
  `;
  document.head.appendChild(style);
}

export default {
  printElement,
  printContent,
  addPrintStyles,
};
