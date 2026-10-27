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

    // 1. DRAW 4-CORNER FIDUCIAL MARKERS (6mm x 6mm solid black squares at 8mm inset)
    const fiducialSize = 6;
    const fiducialOffset = 8;
    doc.setFillColor(0, 0, 0);
    // Top-left
    doc.rect(fiducialOffset, fiducialOffset, fiducialSize, fiducialSize, 'F');
    // Top-right
    doc.rect(pageWidth - fiducialOffset - fiducialSize, fiducialOffset, fiducialSize, fiducialSize, 'F');
    // Bottom-left
    doc.rect(fiducialOffset, pageHeight - fiducialOffset - fiducialSize, fiducialSize, fiducialSize, 'F');
    // Bottom-right
    doc.rect(pageWidth - fiducialOffset - fiducialSize, pageHeight - fiducialOffset - fiducialSize, fiducialSize, fiducialSize, 'F');

    // 2. GENERATE AND DRAW QR CODE (Top-Right: 16mm x 16mm)
    const qrData = `ASG_${worksheet.short_code}:P${pageNum}`;
    const qrDataUrl = await QRCode.toDataURL(qrData, {
      margin: 1,
      width: 120,
      errorCorrectionLevel: 'M',
    });
    const qrX = pageWidth - margin - 22;
    const qrY = margin + 3;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, 18, 18);

    // QR Label below code
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    doc.text(`${worksheet.short_code} • P${pageNum}`, qrX + 9, qrY + 21, { align: 'center' });

    // 3. DRAW PAGE HEADER
    let currentY = margin + 4;

    // Watermark/Header banner if Answer Key
    if (isAnswerKey) {
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.6);
      doc.roundedRect(margin + 5, currentY - 2, 75, 7, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(29, 78, 216);
      doc.text('TEACHER MASTER / ANSWER KEY', margin + 7, currentY + 3);
      currentY += 8;
    }

    // Assignment Type Badge (Theme Preset)
    renderThemeBadge(doc, worksheet.style_preset, margin + 5, currentY);
    currentY += 6;

    // Worksheet Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.text(worksheet.title, margin + 5, currentY);
    currentY += 5;

    // Subject & Grade Level Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    doc.text(`${worksheet.subject} • ${worksheet.grade_level}`, margin + 5, currentY);
    currentY += 5;

    // Student Info Bar & 3-Digit ID Grid
    renderStudentHeader(doc, worksheet, margin + 5, currentY, pageWidth);
    currentY += 16;

    // Decorative Separator Line
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.5);
    if (worksheet.style_preset === 'pod') {
      doc.setLineDashPattern([2, 2], 0);
    } else {
      doc.setLineDashPattern([], 0);
    }
    doc.line(margin + 5, currentY, pageWidth - margin - 5, currentY);
    doc.setLineDashPattern([], 0); // reset
    currentY += 4;

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

    // 5. FOOTER
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Worksheet Maker 2.0 • Page ${pageNum} of ${totalPages} • Code: ${worksheet.short_code}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  return doc;
}

// ----------------------------------------------------------------------------
// HELPER: Renders Style Preset Badge
// ----------------------------------------------------------------------------
function renderThemeBadge(doc: jsPDF, preset: StylePreset, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);

  if (preset === 'pod') {
    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(156, 163, 175);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y - 3, 38, 5, 1, 1, 'FD');
    doc.setTextColor(55, 65, 81);
    doc.text('★ PROBLEM OF THE DAY', x + 2, y + 0.5);
  } else if (preset === 'quiz') {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(239, 68, 68);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y - 3, 34, 5, 1, 1, 'FD');
    doc.setTextColor(185, 28, 28);
    doc.text('ASSESSMENT / QUIZ', x + 2, y + 0.5);
  } else if (preset === 'exit_ticket') {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y - 3, 26, 5, 1, 1, 'FD');
    doc.setTextColor(21, 128, 61);
    doc.text('EXIT TICKET', x + 2, y + 0.5);
  } else {
    // Homework (clean solid)
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y - 3, 36, 5, 1, 1, 'FD');
    doc.setTextColor(75, 85, 99);
    doc.text('HOMEWORK PRACTICE', x + 2, y + 0.5);
  }
}

// ----------------------------------------------------------------------------
// HELPER: Student Info & 3-Digit ID Header Box
// ----------------------------------------------------------------------------
function renderStudentHeader(
  doc: jsPDF,
  worksheet: Worksheet,
  x: number,
  y: number,
  pageWidth: number
) {
  const idDigits = worksheet.student_id_digits || 3;
  const boxWidth = 9;
  const boxHeight = 11;

  // Name, Date, Period blanks
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99);

  doc.text('Name: _______________________________', x, y + 5);
  doc.text('Period: _____', x + 68, y + 5);
  doc.text('Date: _________', x + 92, y + 5);

  // Student ID Block at Right (before QR code)
  const idStartX = pageWidth - 42 - (idDigits * boxWidth);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(31, 41, 55);
  doc.text('STUDENT ID #:', idStartX, y + 1);

  // Draw 3 distinct digit boxes
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.setFillColor(255, 255, 255);

  for (let i = 0; i < idDigits; i++) {
    const curBoxX = idStartX + i * boxWidth;
    doc.rect(curBoxX, y + 3, boxWidth - 1, boxHeight, 'S');

    // Light guideline cross or dashed center in box
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(curBoxX + 1, y + 3 + (boxHeight / 2), curBoxX + boxWidth - 2, y + 3 + (boxHeight / 2));
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
  }
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
  preset: StylePreset,
  isAnswerKey: boolean,
  trackStandards: boolean = true
) {
  // 1. Outer Question Container Border
  doc.setLineWidth(0.4);
  if (preset === 'pod') {
    doc.setDrawColor(156, 163, 175);
    doc.setLineDashPattern([2, 1.5], 0);
  } else {
    doc.setDrawColor(180, 185, 195);
    doc.setLineDashPattern([], 0);
  }
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'S');
  doc.setLineDashPattern([], 0); // reset

  // 2. Question Header Bar (Pill / Badge)
  const headerHeight = 7;
  if (preset === 'pod') {
    doc.setFillColor(243, 244, 246);
    doc.rect(x + 0.2, y + 0.2, width - 0.4, headerHeight, 'F');
  } else if (preset === 'quiz') {
    doc.setFillColor(248, 250, 252);
    doc.rect(x + 0.2, y + 0.2, width - 0.4, headerHeight, 'F');
  }

  // Question Number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text(`Question ${q.order_index}.`, x + 3, y + 5);

  let currentHeaderX = x + 26;

  // Points Badge
  if (q.points) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    const ptText = `[ ${q.points} pt${q.points > 1 ? 's' : ''} ]`;
    doc.text(ptText, currentHeaderX, y + 4.8);
    currentHeaderX += doc.getTextWidth(ptText) + 3;
  }

  // NJSLS Standards Badge on Answer Key
  if (isAnswerKey && trackStandards && q.standard) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(126, 34, 206); // Purple-700
    doc.text(`[ NJSLS: ${q.standard} ]`, currentHeaderX, y + 4.8);
  }

  // 3. Question Prompt Text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55);

  const is2Col = width < 120;

  // Wrap prompt text cleanly
  const promptMaxWidth = width - 8;
  const promptLines = doc.splitTextToSize(q.prompt, promptMaxWidth);
  doc.text(promptLines, x + 3, y + headerHeight + 4.2);

  let promptBottomY = y + headerHeight + 3.2 + (promptLines.length * 3.8);

  // MULTIPLE CHOICE OPTIONS: Rendered in body under prompt
  if (q.question_type === 'multiple_choice' && q.options && q.options.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(31, 41, 55);
    const halfWidth = (width - 8) / 2;
    q.options.forEach((opt, oIdx) => {
      const col = oIdx % 2;
      const row = Math.floor(oIdx / 2);
      const optX = x + 4 + col * halfWidth;
      const optY = promptBottomY + 2 + (row * 3.8);
      doc.setFont('helvetica', 'bold');
      doc.text(`(${opt.label}) `, optX, optY);
      const labelW = doc.getTextWidth(`(${opt.label}) `);
      doc.setFont('helvetica', 'normal');
      const textLine = doc.splitTextToSize(opt.text, halfWidth - labelW - 2)[0] || '';
      doc.text(textLine, optX + labelW, optY);
    });
    const totalOptionRows = Math.ceil(q.options.length / 2);
    promptBottomY += (totalOptionRows * 3.8) + 1.5;
  }

  // 4. Calculate Zones: Scratch Work Area vs Final Answer Box
  const workAreaY = promptBottomY + 1;
  let workAreaHeight: number;
  let answerBoxWidth: number;
  let answerBoxHeight: number;
  let answerBoxX: number;
  let answerBoxY: number;
  let workBoxWidth: number;

  if (is2Col) {
    // 2-Column: Final Answer Box is a bar across the bottom (Taller for student handwriting)
    answerBoxWidth = width - 6;
    answerBoxHeight = Math.min(Math.max(height * 0.32, 18), 22);
    answerBoxX = x + 3;
    answerBoxY = y + height - answerBoxHeight - 2;

    workBoxWidth = width - 6;
    workAreaHeight = Math.max(answerBoxY - workAreaY - 1.5, 12);
  } else {
    // 1-Column: Work on Left, Answer on Right
    answerBoxWidth = 54;
    workAreaHeight = Math.max(y + height - workAreaY - 2.5, 18);
    answerBoxHeight = workAreaHeight;
    answerBoxX = x + width - answerBoxWidth - 3;
    answerBoxY = workAreaY;
    workBoxWidth = answerBoxX - x - 5;
  }

  // A. WORK SPACE (SCRATCH WORK)
  doc.setDrawColor(220, 225, 232);
  doc.setLineWidth(0.3);
  doc.rect(x + 3, workAreaY, workBoxWidth, workAreaHeight, 'S');

  // Work Space Label
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text('Show your work:', x + 5, workAreaY + 3.5);

  // If Answer Key, write rubric guidance & standard in work box
  if (isAnswerKey && (q.rubric_notes || (trackStandards && q.standard))) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(37, 99, 235);
    const keyNotes: string[] = [];
    if (trackStandards && q.standard) keyNotes.push(`Target: ${q.standard}`);
    if (q.rubric_notes) keyNotes.push(`Rubric: ${q.rubric_notes}`);
    const rubricLines = doc.splitTextToSize(keyNotes.join(' • '), workBoxWidth - 4);
    doc.text(rubricLines, x + 5, workAreaY + 7.5);
  }

  // B. FINAL ANSWER BOX (HIGH CONTRAST FOR VISION OCR)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8); // Thick crisp border
  doc.setFillColor(255, 255, 255);
  doc.rect(answerBoxX, answerBoxY, answerBoxWidth, answerBoxHeight, 'FD');

  // Final Answer Header inside box
  doc.setFillColor(243, 244, 246);
  doc.rect(answerBoxX, answerBoxY, answerBoxWidth, 4.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text('FINAL ANSWER:', answerBoxX + 2, answerBoxY + 3.4);

  // Answer Box Content: Multiple Choice vs Text / Numeric
  if (q.question_type === 'multiple_choice') {
    if (isAnswerKey) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(29, 78, 216);
      doc.text(q.correct_answer || '', answerBoxX + (answerBoxWidth / 2), answerBoxY + (answerBoxHeight / 2) + 2.5, { align: 'center' });
    } else {
      // 4 clean bubbles for student to bubble/circle
      const letters = ['A', 'B', 'C', 'D'];
      const bubbleSpacing = answerBoxWidth / 5;
      const bubbleY = answerBoxY + (answerBoxHeight / 2) + 2;
      letters.forEach((letter, bIdx) => {
        const bx = answerBoxX + (bIdx + 1) * bubbleSpacing;
        doc.setDrawColor(156, 163, 175);
        doc.setLineWidth(0.3);
        doc.circle(bx, bubbleY - 0.5, 2.5, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(55, 65, 81);
        doc.text(letter, bx, bubbleY + 0.5, { align: 'center' });
      });
    }
  } else if (isAnswerKey) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(29, 78, 216);
    doc.text(q.correct_answer || '', answerBoxX + (answerBoxWidth / 2), answerBoxY + (answerBoxHeight / 2) + 2.5, { align: 'center' });
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
