/**
 * MedSynapse Isolated Diagnostic Report PDF Generator
 * Extracts and prints ONLY the active clinical report document currently showing on screen,
 * ensuring no outer page chrome, forms, tabs, or sidebars are included in the PDF export.
 */

export function printReportDocument(targetOrSelector = '.clinical-report-sheet', defaultTitle = 'MedSynapse_Clinical_Diagnostic_Report') {
  // 1. Locate the currently showing report container
  let target = null;
  if (typeof targetOrSelector === 'string') {
    target = document.querySelector(targetOrSelector);
  } else if (targetOrSelector && targetOrSelector.nodeType) {
    target = targetOrSelector;
  }
  
  if (!target) {
    // Search for any active clinical report sheet or result card
    target = document.querySelector('.clinical-report-sheet') || 
             document.querySelector('[data-report-sheet="true"]') ||
             document.querySelector('.report-paper-container');
  }

  if (!target) {
    console.warn('MedSynapse: No active clinical report found on screen to print.');
    window.print();
    return;
  }

  // 2. Derive dynamic filename from report content or document title
  let reportTitle = defaultTitle;
  const refIdEl = target.querySelector('[class*="ref"], [style*="monospace"]');
  const refIdText = refIdEl ? refIdEl.textContent.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) : '';
  if (refIdText) {
    reportTitle = `${defaultTitle}_${refIdText}`.replace(/_+/g, '_');
  }

  // 3. Clone the report node cleanly
  const clone = target.cloneNode(true);

  // Strip all non-printable interactive elements from the clone
  const elementsToRemove = clone.querySelectorAll(
    '.no-print, button, input, select, .side-level-tracker-dock, .side-level-flyout, .process-tracker-container'
  );
  elementsToRemove.forEach(el => el.remove());

  // 4. Construct comprehensive, pristine medical report print styling
  const printStyles = `
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 12mm 14mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      font-size: 9.5pt !important;
      line-height: 1.4 !important;
      width: 100% !important;
    }
    .clinical-report-sheet {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      background: #ffffff !important;
      color: #0f172a !important;
      border: 1.5px solid #0f172a !important;
      border-radius: 4px !important;
      padding: 16px 20px !important;
      margin: 0 auto !important;
      box-shadow: none !important;
    }
    .print-header {
      display: flex !important;
      justify-content: space-between !important;
      align-items: flex-start !important;
      border-bottom: 2.5px solid #0f172a !important;
      padding-bottom: 12px !important;
      margin-bottom: 16px !important;
    }
    table, .print-table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 10px 0 !important;
    }
    th, td, .print-table th, .print-table td {
      border: 1px solid #cbd5e1 !important;
      padding: 6px 10px !important;
      font-size: 8.5pt !important;
      text-align: left !important;
    }
    th, .print-table th {
      background-color: #f1f5f9 !important;
      color: #0f172a !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      font-size: 7.5pt !important;
      letter-spacing: 0.5px !important;
    }
    .print-status-box {
      border: 1.5px solid #0f172a !important;
      background-color: #f8fafc !important;
      padding: 8px 12px !important;
      border-radius: 4px !important;
      margin: 10px 0 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .print-grid-2 {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 12px !important;
    }
    .print-grid-3 {
      display: grid !important;
      grid-template-columns: 1fr 1fr 1fr !important;
      gap: 8px !important;
    }
    .print-footer-sign {
      display: flex !important;
      justify-content: space-between !important;
      align-items: flex-end !important;
      margin-top: 20px !important;
      padding-top: 10px !important;
      border-top: 1.5px solid #0f172a !important;
      font-size: 8pt !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      font-size: 7.5pt;
      font-weight: 700;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    img {
      max-width: 100% !important;
      height: auto !important;
    }
    .no-print, button, input, select {
      display: none !important;
      visibility: hidden !important;
    }
  `;

  // 5. Create a hidden printing iframe
  const oldFrame = document.getElementById('medsynapse-isolated-print-frame');
  if (oldFrame) {
    oldFrame.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'medsynapse-isolated-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.border = 'none';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${reportTitle}</title>
        <style>
          ${printStyles}
        </style>
      </head>
      <body>
        ${clone.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  // 6. Trigger print once fonts and images in the iframe settle
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.error('Isolated print failed, fallback to native window.print():', err);
      window.print();
    } finally {
      setTimeout(() => {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 2500);
    }
  }, 350);
}

export default printReportDocument;
