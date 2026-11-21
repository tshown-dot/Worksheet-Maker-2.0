import { jsPDF } from 'jspdf';
import { createElement, Fragment } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { getFontEmbedCSS, toJpeg } from 'html-to-image';
import { Worksheet } from '../types/worksheet';
import { WorksheetPage } from '../components/WorksheetPage';

export interface PDFExportOptions {
  isAnswerKey?: boolean;
}

// US Letter, the size WorksheetPage is laid out at
const PAGE_WIDTH_MM = 215.9;
const PAGE_HEIGHT_MM = 279.4;
// About 240 dpi: sharp enough to print and for the QR code to scan
const PIXEL_RATIO = 2.5;
const JPEG_QUALITY = 0.95;
const QR_WAIT_MS = 8000;

interface SheetSpec {
  worksheet: Worksheet;
  pageNum: number;
  isAnswerKey: boolean;
}

/**
 * Builds a PDF of one worksheet (student copy or answer key).
 * Each page is a picture of the same page the browser prints, so math looks
 * exactly as it does on screen and on paper.
 */
export async function generateWorksheetPDF(
  worksheet: Worksheet,
  options: PDFExportOptions = {}
): Promise<jsPDF> {
  return renderSheetsToPDF(sheetsFor(worksheet, options.isAnswerKey === true));
}

/**
 * Builds one PDF from several worksheets, in the same order as batch printing.
 */
export async function generateBatchWorksheetsPDF(
  worksheets: Worksheet[],
  mode: 'student' | 'key' | 'both' = 'student'
): Promise<jsPDF> {
  const sheets: SheetSpec[] = [];
  for (const ws of worksheets) {
    if (mode === 'student' || mode === 'both') sheets.push(...sheetsFor(ws, false));
    if (mode === 'key' || mode === 'both') sheets.push(...sheetsFor(ws, true));
  }
  return renderSheetsToPDF(sheets);
}

function sheetsFor(worksheet: Worksheet, isAnswerKey: boolean): SheetSpec[] {
  const pages = worksheet.total_pages || 1;
  return Array.from({ length: pages }, (_, i) => ({ worksheet, pageNum: i + 1, isAnswerKey }));
}

/**
 * Draws the pages off-screen with WorksheetPage, waits for their QR codes and
 * math fonts, then photographs each page into the PDF.
 */
async function renderSheetsToPDF(sheets: SheetSpec[]): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  if (sheets.length === 0) return doc;

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  // Off-screen but still laid out (display:none would leave nothing to photograph)
  Object.assign(host.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${PAGE_WIDTH_MM}mm`,
    pointerEvents: 'none',
  });
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    flushSync(() => {
      root.render(
        createElement(
          Fragment,
          null,
          sheets.map((s, i) =>
            createElement(WorksheetPage, {
              key: i,
              worksheet: s.worksheet,
              pageNum: s.pageNum,
              isAnswerKey: s.isAnswerKey,
            })
          )
        )
      );
    });

    const pageEls = Array.from(host.querySelectorAll<HTMLElement>('.print-sheet'));
    if (pageEls.length !== sheets.length) {
      throw new Error(`Expected ${sheets.length} page(s) to draw, found ${pageEls.length}.`);
    }

    await waitForQrCodes(pageEls);
    await document.fonts.ready;

    // Gather the web fonts (KaTeX math fonts included) once for every page
    const fontEmbedCSS = await getFontEmbedCSS(pageEls[0]);

    for (let i = 0; i < pageEls.length; i++) {
      const dataUrl = await toJpeg(pageEls[i], {
        pixelRatio: PIXEL_RATIO,
        quality: JPEG_QUALITY,
        backgroundColor: '#ffffff',
        fontEmbedCSS,
        // The page centers itself with auto margins; photograph it flush
        style: { margin: '0' },
      });
      if (i > 0) doc.addPage('letter', 'portrait');
      doc.addImage(dataUrl, 'JPEG', 0, 0, PAGE_WIDTH_MM, PAGE_HEIGHT_MM, undefined, 'FAST');
    }
    return doc;
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Waits until every page shows its QR code image, fully loaded. */
async function waitForQrCodes(pageEls: HTMLElement[]): Promise<void> {
  const deadline = Date.now() + QR_WAIT_MS;
  const ready = () =>
    pageEls.every((el) => {
      const img = el.querySelector('img');
      return !!img && img.complete && img.naturalWidth > 0;
    });
  while (!ready()) {
    if (Date.now() > deadline) {
      throw new Error('QR codes did not finish drawing, so the PDF was not made.');
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}
