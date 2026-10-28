import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Worksheet, Question, StylePreset } from '../types/worksheet';

export interface PDFExportOptions {
  isAnswerKey?: boolean;
}

export async function generateWorksheetPDF(
  worksheet: Worksheet,
  options: PDFExportOptions = {}
): Promise<jsPDF> {
  const { isAnswerKey = false } = options;

  // Standard US Letter: 215.9 mm x 279.4 mm (8.5" x 11")
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = 215.9;
  const pageHeight = 279.4;
  const margin = 12; // safe printable margin in mm
  const totalPages = worksheet.total_pages || 1;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (pageNum > 1) {
      doc.addPage('letter', 'portrait');
    }

    // Filter questions for current page
    const pageQuestions = worksheet.questions
      .filter((q) => (q.page_number || 1) === pageNum)
      .sort((a, b) => a.order_index - b.order_index);

    // 1. DRAW 4-CORNER FIDUCIAL MARKERS (5mm x 5mm solid black squares at 6mm inset — 4mm clear margin from content)
    const fiducialSize = 5;
    const fiducialOffset = 6;
    doc.setFillColor(0, 0, 0);
    // Top-left
    doc.rect(fiducialOffset, fiducialOffset, fiducialSize, fiducialSize, 'F');
    // Top-right
    doc.rect(pageWidth - fiducialOffset - fiducialSize, fiducialOffset, fiducialSize, fiducialSize, 'F');
    // Bottom-left
    doc.rect(fiducialOffset, pageHeight - fiducialOffset - fiducialSize, fiducialSize, fiducialSize, 'F');
    // Bottom-right
    doc.rect(pageWidth - fiducialOffset - fiducialSize, pageHeight - fiducialOffset - fiducialSize, fiducialSize, fiducialSize, 'F');

    // 2. GENERATE AND DRAW QR CODE (Compact Top-Right: 12mm x 12mm)
    const qrData = `ASG_${worksheet.short_code}:P${pageNum}`;
    const qrDataUrl = await QRCode.toDataURL(qrData, {
      margin: 1,
      width: 100,
      errorCorrectionLevel: 'M',
    });
    const qrX = pageWidth - margin - 17;
    const qrY = margin + 2;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, 12, 12);

    // QR Label below code
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(71, 85, 105);
    doc.text(`${worksheet.short_code} • P${pageNum}`, qrX + 6, qrY + 14.5, { align: 'center' });

    // 3. DRAW PAGE HEADER (Publishing-Grade Academic Masthead)
    let currentY = margin + 2.5;

    // Watermark/Header banner if Answer Key
    if (isAnswerKey) {
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin + 5, currentY - 1, 65, 5.5, 1, 1, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(29, 78, 216);
      doc.text('TEACHER MASTER / ANSWER KEY', margin + 7, currentY + 3);
      currentY += 6.5;
    }

    // Worksheet Title + Badge on same line / lockup
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    const maxTitleWidth = qrX - margin - 10 - 36;
    let displayTitle = worksheet.title || 'Untitled Math Worksheet';
    if (doc.getTextWidth(displayTitle) > maxTitleWidth) {
      displayTitle = doc.splitTextToSize(displayTitle, maxTitleWidth)[0] + '...';
    }
    doc.text(displayTitle, margin + 5, currentY + 3);
    const titleWidth = doc.getTextWidth(displayTitle);
    renderThemeBadge(doc, worksheet.style_preset, margin + 8 + titleWidth, currentY + 3);
    currentY += 4.5;

    // Subject & Grade Level Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.text(`${worksheet.subject} • ${worksheet.grade_level}`, margin + 5, currentY + 2.5);
    currentY += 4;

    // Student Info Bar & Single Large ID Box
    renderStudentHeader(doc, worksheet, margin + 5, currentY, pageWidth);
    currentY += 10.5;

    // Academic Double Divider Line
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(margin + 5, currentY, pageWidth - margin - 5, currentY);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(margin + 5, currentY + 0.6, pageWidth - margin - 5, currentY + 0.6);
    currentY += 3.5;

    // 4. DRAW QUESTIONS GRID (Dynamically fills entire page height in 1 or 2 columns)
    const columns = worksheet.columns || 1;
    const availableHeight = pageHeight - currentY - margin - 8;
    const totalQ = pageQuestions.length;
    const rowCount = columns === 2 ? Math.max(Math.ceil(totalQ / 2), 1) : Math.max(totalQ, 1);
    const cardGap = 3;
    const questionCardHeight = (availableHeight - (rowCount - 1) * cardGap) / rowCount;

    const usableWidth = pageWidth - (margin * 2) - 10;
    const colGap = 4;
    const cardWidth = columns === 2 ? (usableWidth - colGap) / 2 : usableWidth;

    pageQuestions.forEach((q, idx) => {
      let qX = margin + 5;
      let qY = currentY;

      if (columns === 2) {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        qX = margin + 5 + col * (cardWidth + colGap);
        qY = currentY + row * (questionCardHeight + cardGap);
      } else {
        qY = currentY + idx * (questionCardHeight + cardGap);
      }

      renderQuestionCard(
        doc,
        q,
        qY,
        questionCardHeight,
        qX,
        cardWidth,
        worksheet.style_preset,
        isAnswerKey,
        worksheet.track_standards !== false
      );
    });

    // 5. FOOTER (Professional Clean Running Footer)
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin + 5, pageHeight - 11, pageWidth - margin - 5, pageHeight - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Worksheet Maker 2.0 • Form ${worksheet.short_code}`, margin + 5, pageHeight - 7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 7.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text('Standardized OCR Assessment Layout', pageWidth - margin - 5, pageHeight - 7.5, { align: 'right' });
  }

  return doc;
}

// ----------------------------------------------------------------------------
// HELPER: Renders Style Preset Badge
// ----------------------------------------------------------------------------
function renderThemeBadge(doc: jsPDF, preset: StylePreset, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);

  if (preset === 'spiral' || preset === 'homework') {
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y - 3.2, 28, 4.2, 0.8, 0.8, 'FD');
    doc.setTextColor(67, 56, 202);
    doc.text('SPIRAL REVIEW', x + 1.5, y - 0.2);
  } else if (preset === 'classwork') {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y - 3.2, 22, 4.2, 0.8, 0.8, 'FD');
    doc.setTextColor(6, 95, 70);
    doc.text('CLASSWORK', x + 1.5, y - 0.2);
  } else if (preset === 'pod') {
    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(156, 163, 175);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y - 3.2, 32, 4.2, 0.8, 0.8, 'FD');
    doc.setTextColor(55, 65, 81);
    doc.text('★ PROBLEM OF DAY', x + 1.5, y - 0.2);
  } else if (preset === 'quiz') {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(239, 68, 68);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y - 3.2, 16, 4.2, 0.8, 0.8, 'FD');
    doc.setTextColor(185, 28, 28);
    doc.text('QUIZ', x + 1.5, y - 0.2);
  } else if (preset === 'exit_ticket') {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y - 3.2, 22, 4.2, 0.8, 0.8, 'FD');
    doc.setTextColor(21, 128, 61);
    doc.text('EXIT TICKET', x + 1.5, y - 0.2);
  } else {
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y - 3.2, 28, 4.2, 0.8, 0.8, 'FD');
    doc.setTextColor(67, 56, 202);
    doc.text('SPIRAL REVIEW', x + 1.5, y - 0.2);
  }
}

// ----------------------------------------------------------------------------
// HELPER: Student Info & Single Large ID Header Box
// ----------------------------------------------------------------------------
function renderStudentHeader(
  doc: jsPDF,
  _worksheet: Worksheet,
  x: number,
  y: number,
  pageWidth: number
) {
  const margin = 10;
  const qrX = pageWidth - margin - 17;
  const idBoxWidth = 28;
  const idBoxHeight = 7.5;
  const idBoxX = qrX - idBoxWidth - 3;

  // Top rule of Student Info Strip
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(x, y - 0.5, qrX - 2, y - 0.5);

  // 1. NAME FIELD (Crisp vector line)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text('NAME:', x, y + 5.2);
  const nameLabelWidth = doc.getTextWidth('NAME: ') + 1;
  const nameLineEnd = x + 60;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(x + nameLabelWidth, y + 5.7, nameLineEnd, y + 5.7);

  // 2. DATE FIELD (Crisp vector line)
  const dateStartX = nameLineEnd + 4;
  doc.setFont('helvetica', 'bold');
  doc.text('DATE:', dateStartX, y + 5.2);
  const dateLabelWidth = doc.getTextWidth('DATE: ') + 1;
  const dateLineEnd = dateStartX + 25;
  doc.line(dateStartX + dateLabelWidth, y + 5.7, dateLineEnd, y + 5.7);

  // 3. PERIOD FIELD (Crisp vector line)
  const pdStartX = dateLineEnd + 4;
  doc.setFont('helvetica', 'bold');
  doc.text('PERIOD:', pdStartX, y + 5.2);
  const pdLabelWidth = doc.getTextWidth('PERIOD: ') + 1;
  const pdLineEnd = pdStartX + 18;
  doc.line(pdStartX + pdLabelWidth, y + 5.7, pdLineEnd, y + 5.7);

  // 4. SINGLE LARGE STUDENT ID BOX with Side Label Tab (Full Vertical Room for Handwriting)
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.setFillColor(255, 255, 255);
  doc.rect(idBoxX, y + 0.8, idBoxWidth, idBoxHeight, 'FD');

  // Left side label tab inside ID box
  const tabW = 7.5;
  doc.setFillColor(241, 245, 249);
  doc.rect(idBoxX + 0.3, y + 1.1, tabW, idBoxHeight - 0.6, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(idBoxX + tabW, y + 0.8, idBoxX + tabW, y + 0.8 + idBoxHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(30, 41, 59);
  doc.text('ID #', idBoxX + (tabW / 2), y + 5.4, { align: 'center' });

  // Faint dashed handwriting baseline inside ID box
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(idBoxX + tabW + 2, y + 6.5, idBoxX + idBoxWidth - 2, y + 6.5);
  doc.setLineDashPattern([], 0);
}

// ----------------------------------------------------------------------------
// HELPER: Clean LaTeX for PDF Text Rendering
// ----------------------------------------------------------------------------
function cleanLatexForPdf(text: string): string {
  if (!text) return '';
  let s = text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `$$${m.trim()}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m.trim()}$`);

  // Protect standalone currency (e.g. $45.50.)
  const currencyPlaceholder = '___CURRENCY_DOLLAR___';
  const currencyRegex =
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?=\s+(?!(?:when|for|where|if)\b)[a-zA-Z]{2,}|[.,;!?)]|\s*$)/g;
  s = s.replace(currencyRegex, `${currencyPlaceholder}$1`);

  // Strip math delimiters $...$ and $$...$$
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  s = s.replace(/\$([^\s$](?:[^\n$]*?[^\s$])?)\$/g, '$1');

  // Convert superscripts
  s = s.replace(/\^2\b/g, '²')
       .replace(/\^3\b/g, '³')
       .replace(/\^([0-9])/g, (_, d) => ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'][Number(d)] || `^${d}`);
  // Convert fractions \frac{a}{b} -> a/b
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2');
  // Convert square roots \sqrt{x} -> √(x)
  s = s.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  // Convert common latex symbols
  s = s.replace(/\\times\b/g, '×')
       .replace(/\\div\b/g, '÷')
       .replace(/\\cdot\b/g, '·')
       .replace(/\\pm\b/g, '±')
       .replace(/\\le\b/g, '≤')
       .replace(/\\ge\b/g, '≥')
       .replace(/\\neq\b/g, '≠')
       .replace(/\\approx\b/g, '≈')
       .replace(/\\pi\b/g, 'π')
       .replace(/\\text\{([^}]+)\}/g, '$1')
       .replace(/\\mathrm\{([^}]+)\}/g, '$1')
       .replace(/\\quad\b/g, ' ');

  return s.replace(new RegExp(currencyPlaceholder, 'g'), '$');
}

// ----------------------------------------------------------------------------
// HELPER: Renders an Individual Question Card with OCR Zones
// ----------------------------------------------------------------------------
function renderQuestionCard(
  doc: jsPDF,
  q: Question,
  y: number,
  height: number,
  x: number,
  width: number,
  _preset: StylePreset,
  isAnswerKey: boolean,
  trackStandards: boolean = true
) {
  const isClasswork = _preset === 'classwork';

  // 1. Unified Outer Question Container Border
  if (isClasswork) {
    // Distinct double-line studio border for Classwork
    doc.setLineWidth(0.5);
    doc.setDrawColor(30, 41, 59); // slate-800 outer
    doc.setLineDashPattern([], 0);
    doc.roundedRect(x, y, width, height, 1, 1, 'S');

    // Inner subtle hairline frame inset by 0.7mm
    doc.setLineWidth(0.2);
    doc.setDrawColor(203, 213, 225); // slate-300 inner
    doc.roundedRect(x + 0.7, y + 0.7, width - 1.4, height - 1.4, 0.6, 0.6, 'S');
  } else {
    // Crisp Solid Border for Spiral Review, POD & Quiz
    doc.setLineWidth(0.35);
    doc.setDrawColor(180, 190, 203);
    doc.setLineDashPattern([], 0);
    doc.roundedRect(x, y, width, height, 1, 1, 'S');
  }

  // 2. Question Header Bar
  const headerHeight = 6.5;
  if (isClasswork) {
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(x + 0.8, y + 0.8, width - 1.6, headerHeight - 0.4, 'F');
    // Emerald accent line under Classwork header
    doc.setDrawColor(16, 185, 129); // emerald-500
    doc.setLineWidth(0.4);
    doc.line(x + 0.7, y + headerHeight, x + width - 0.7, y + headerHeight);
  } else {
    doc.setFillColor(248, 250, 252);
    doc.rect(x + 0.2, y + 0.2, width - 0.4, headerHeight, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(x, y + headerHeight, x + width, y + headerHeight);
  }

  // Question Number Badge (Emerald for Classwork, Dark Slate for Spiral)
  if (isClasswork) {
    doc.setFillColor(5, 150, 105); // emerald-600
  } else {
    doc.setFillColor(15, 23, 42); // slate-900
  }
  doc.roundedRect(x + 2.5, y + 1.4, 4.5, 4, 0.5, 0.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text(`${q.order_index}`, x + 4.75, y + 4.3, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(`Question ${q.order_index}`, x + 8.5, y + 4.4);

  let currentHeaderX = x + 8.5 + doc.getTextWidth(`Question ${q.order_index}`) + 2.5;

  // NJSLS Standards Badge on Answer Key
  if (isAnswerKey && trackStandards && q.standard) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(126, 34, 206); // Purple-700
    doc.text(`[${q.standard}]`, currentHeaderX, y + 4.4);
  }

  // Points Badge on Right of Header Bar
  if (q.points) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    const ptText = `${q.points} pt${q.points > 1 ? 's' : ''}`;
    doc.text(ptText, x + width - 2.5, y + 4.4, { align: 'right' });
  }

  // 3. Question Prompt Text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);

  const is2Col = width < 120;

  // Wrap prompt text cleanly (clean LaTeX commands for crisp PDF display)
  const promptMaxWidth = width - 6;
  const promptText = cleanLatexForPdf(q.prompt);
  const promptLines = doc.splitTextToSize(promptText, promptMaxWidth);
  doc.text(promptLines, x + 3, y + headerHeight + 4);

  let promptBottomY = y + headerHeight + 3 + (promptLines.length * 3.8);

  // MULTIPLE CHOICE OPTIONS: Rendered in body under prompt
  if (q.question_type === 'multiple_choice' && q.options && q.options.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(30, 41, 59);
    const halfWidth = (width - 6) / 2;
    q.options.forEach((opt, oIdx) => {
      const col = oIdx % 2;
      const row = Math.floor(oIdx / 2);
      const optX = x + 3.5 + col * halfWidth;
      const optY = promptBottomY + 2 + (row * 3.8);
      doc.setFont('helvetica', 'bold');
      doc.text(`(${opt.label}) `, optX, optY);
      const labelW = doc.getTextWidth(`(${opt.label}) `);
      doc.setFont('helvetica', 'normal');
      const optTextClean = cleanLatexForPdf(opt.text);
      const textLine = doc.splitTextToSize(optTextClean, halfWidth - labelW - 2)[0] || '';
      doc.text(textLine, optX + labelW, optY);
    });
    const totalOptionRows = Math.ceil(q.options.length / 2);
    promptBottomY += (totalOptionRows * 3.8) + 1.5;
  }

  // 4. Calculate Zones: Seamless Work Area vs Final Answer Box
  const workAreaY = promptBottomY + 1;
  let workAreaHeight: number;
  let answerBoxWidth: number;
  let answerBoxHeight: number;
  let answerBoxX: number;
  let answerBoxY: number;
  let workBoxWidth: number;

  if (is2Col) {
    // 2-Column: Final Answer Box is a bar across the bottom (Taller for student handwriting)
    answerBoxWidth = width - 5;
    answerBoxHeight = Math.min(Math.max(height * 0.3, 17.5), 21);
    answerBoxX = x + 2.5;
    answerBoxY = y + height - answerBoxHeight - 2;

    workBoxWidth = width;
    workAreaHeight = Math.max(answerBoxY - workAreaY - 1.5, 12);
  } else {
    // 1-Column: Work on Left, Answer on Right
    answerBoxWidth = 54;
    workAreaHeight = Math.max(y + height - workAreaY - 2.5, 18);
    answerBoxHeight = workAreaHeight;
    answerBoxX = x + width - answerBoxWidth - 2.5;
    answerBoxY = workAreaY;
    workBoxWidth = answerBoxX - x - 4;
  }

  // A. SEAMLESS WORK SPACE (Subtle top dashed divider instead of cramped inner box)
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(x + 0.5, workAreaY, x + width - 0.5, workAreaY);
  doc.setLineDashPattern([], 0);

  // Work Space Label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('WORK SPACE', x + 3, workAreaY + 3);

  // If Answer Key, write rubric guidance & standard in work box
  if (isAnswerKey && (q.rubric_notes || (trackStandards && q.standard))) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(37, 99, 235);
    const keyNotes: string[] = [];
    if (trackStandards && q.standard) keyNotes.push(`Target: ${q.standard}`);
    if (q.rubric_notes) keyNotes.push(`Rubric: ${cleanLatexForPdf(q.rubric_notes)}`);
    const rubricLines = doc.splitTextToSize(keyNotes.join(' • '), workBoxWidth - 6);
    doc.text(rubricLines, x + 3, workAreaY + 6.8);
  }

  // B. FINAL ANSWER BOX (HIGH CONTRAST FOR VISION OCR, CLEAN LIGHT HEADER STRIP)
  doc.setDrawColor(15, 23, 42); // slate-900 crisp border
  doc.setLineWidth(0.65);
  doc.setFillColor(255, 255, 255);
  doc.rect(answerBoxX, answerBoxY, answerBoxWidth, answerBoxHeight, 'FD');

  // Final Answer Header inside box (Clean light-slate strip instead of heavy black bar)
  doc.setFillColor(241, 245, 249);
  doc.rect(answerBoxX + 0.3, answerBoxY + 0.3, answerBoxWidth - 0.6, 3.8, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.line(answerBoxX, answerBoxY + 4.1, answerBoxX + answerBoxWidth, answerBoxY + 4.1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(30, 41, 59);
  doc.text('FINAL ANSWER', answerBoxX + 2, answerBoxY + 2.9);

  // Answer Box Content: Multiple Choice vs Text / Numeric
  if (q.question_type === 'multiple_choice') {
    if (isAnswerKey) {
      const keyBadgeW = Math.min(answerBoxWidth - 8, 26);
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.35);
      doc.roundedRect(answerBoxX + (answerBoxWidth - keyBadgeW) / 2, answerBoxY + 5.2, keyBadgeW, answerBoxHeight - 6.5, 0.8, 0.8, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(29, 78, 216);
      doc.text(cleanLatexForPdf(q.correct_answer || ''), answerBoxX + (answerBoxWidth / 2), answerBoxY + (answerBoxHeight / 2) + 2.5, { align: 'center' });
    } else {
      // 4 clean Scantron-style bubbles for student to bubble/circle
      const letters = ['A', 'B', 'C', 'D'];
      const bubbleSpacing = answerBoxWidth / 5;
      const bubbleY = answerBoxY + (answerBoxHeight / 2) + 2.1;
      letters.forEach((letter, bIdx) => {
        const bx = answerBoxX + (bIdx + 1) * bubbleSpacing;
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(0.35);
        doc.setFillColor(255, 255, 255);
        doc.circle(bx, bubbleY - 0.5, 2.6, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(15, 23, 42);
        doc.text(letter, bx, bubbleY + 0.5, { align: 'center' });
      });
    }
  } else if (isAnswerKey) {
    const keyBadgeW = Math.min(answerBoxWidth - 8, 34);
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.35);
    doc.roundedRect(answerBoxX + (answerBoxWidth - keyBadgeW) / 2, answerBoxY + 5.2, keyBadgeW, answerBoxHeight - 6.5, 0.8, 0.8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(29, 78, 216);
    doc.text(cleanLatexForPdf(q.correct_answer || ''), answerBoxX + (answerBoxWidth / 2), answerBoxY + (answerBoxHeight / 2) + 2.5, { align: 'center' });
  } else {
    // Faint dashed handwriting baseline at bottom of open-ended answer box
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(answerBoxX + 4, answerBoxY + answerBoxHeight - 3.2, answerBoxX + answerBoxWidth - 4, answerBoxY + answerBoxHeight - 3.2);
    doc.setLineDashPattern([], 0);
  }

  // Update question's bounding_box coordinates for the autograder manifest
  q.bounding_box = {
    work_box: {
      x_mm: Math.round(x + 3),
      y_mm: Math.round(workAreaY),
      w_mm: Math.round(workBoxWidth),
      h_mm: Math.round(workAreaHeight),
    },
    answer_box: {
      x_mm: Math.round(answerBoxX),
      y_mm: Math.round(answerBoxY),
      w_mm: Math.round(answerBoxWidth),
      h_mm: Math.round(answerBoxHeight),
    },
  };
}
