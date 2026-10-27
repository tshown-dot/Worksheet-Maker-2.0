import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Worksheet, Question } from '../types/worksheet';
import { MathText } from '../utils/mathRenderer';

interface WorksheetPageProps {
  worksheet: Worksheet;
  pageNum: number;
  isAnswerKey: boolean;
  className?: string;
}

export const WorksheetPage: React.FC<WorksheetPageProps> = ({
  worksheet,
  pageNum,
  isAnswerKey,
  className = '',
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(`ASG_${worksheet.short_code}:P${pageNum}`, {
      margin: 1,
      width: 140,
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrUrl(url))
      .catch((err) => console.error(err));
  }, [worksheet.short_code, pageNum]);

  // Questions for this page
  const pageQuestions = worksheet.questions
    .filter((q) => (q.page_number || 1) === pageNum)
    .sort((a, b) => a.order_index - b.order_index);

  const columns = worksheet.columns || 1;
  const spacing = worksheet.spacing || 'balanced';

  // Height calculations based on spacing mode
  const getCardHeightClass = () => {
    if (columns === 2) {
      if (spacing === 'compact') return 'min-h-[145px]';
      if (spacing === 'spacious') return 'min-h-[210px]';
      return 'min-h-[175px]';
    } else {
      if (spacing === 'compact') return 'min-h-[105px]';
      if (spacing === 'spacious') return 'min-h-[170px]';
      return 'min-h-[135px]';
    }
  };

  const getWorkAreaHeightClass = () => {
    if (columns === 2) {
      if (spacing === 'compact') return 'h-16';
      if (spacing === 'spacious') return 'h-28';
      return 'h-20';
    } else {
      if (spacing === 'compact') return 'h-14';
      if (spacing === 'spacious') return 'h-28';
      return 'h-20';
    }
  };

  return (
    <div
      className={`print-sheet relative bg-white select-none box-border flex flex-col justify-between ${className}`}
      style={{
        width: '215.9mm',
        minHeight: '279.4mm',
        height: '279.4mm',
        padding: '12mm 14mm',
        pageBreakAfter: 'always',
        margin: '0 auto',
      }}
    >
      {/* 4 SOLID CORNER FIDUCIAL MARKERS FOR COPIER SCANNER DESKEW */}
      <div className="absolute top-[8mm] left-[8mm] w-[6mm] h-[6mm] bg-black" />
      <div className="absolute top-[8mm] right-[8mm] w-[6mm] h-[6mm] bg-black" />
      <div className="absolute bottom-[8mm] left-[8mm] w-[6mm] h-[6mm] bg-black" />
      <div className="absolute bottom-[8mm] right-[8mm] w-[6mm] h-[6mm] bg-black" />

      {/* TOP HEADER SECTION */}
      <div className="w-full">
        {/* Answer Key Alert Banner */}
        {isAnswerKey && (
          <div className="mb-2 bg-blue-50 border border-blue-400 text-blue-800 text-[11px] font-bold px-3 py-1 rounded-sm uppercase tracking-wide inline-block">
            ★ Teacher Master / Answer Key
          </div>
        )}

        <div className="flex items-start justify-between">
          <div className="flex-1 pr-4">
            {/* Theme Badge */}
            <div className="mb-1">
              {worksheet.style_preset === 'pod' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-sm">
                  ★ Problem of the Day
                </span>
              )}
              {worksheet.style_preset === 'quiz' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-sm">
                  Assessment / Quiz
                </span>
              )}
              {worksheet.style_preset === 'exit_ticket' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm">
                  Exit Ticket
                </span>
              )}
              {worksheet.style_preset === 'homework' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-sm">
                  Homework Practice
                </span>
              )}
            </div>

            {/* Title & Subject */}
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {worksheet.title || 'Untitled Math Worksheet'}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {worksheet.subject} • {worksheet.grade_level}
            </p>
          </div>

          {/* QR Code Block */}
          <div className="flex flex-col items-center shrink-0">
            {qrUrl ? (
              <img src={qrUrl} alt="QR Code" className="w-14 h-14" />
            ) : (
              <div className="w-14 h-14 bg-slate-100 border border-slate-300" />
            )}
            <span className="text-[9px] font-mono font-bold text-slate-600 mt-0.5">
              {worksheet.short_code} • P{pageNum}
            </span>
          </div>
        </div>

        {/* Student Name / Period / Date / 3-Digit ID Bar */}
        <div className="mt-3 pt-2 border-t border-slate-300 flex items-center justify-between text-xs text-slate-800">
          <div className="flex items-center space-x-5">
            <span>Name: _______________________________</span>
            <span>Period: _____</span>
            <span>Date: _________</span>
          </div>

          {/* Standardized 3-Digit Student ID Box */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">
              Student ID:
            </span>
            <div className="flex space-x-1">
              {Array.from({ length: worksheet.student_id_digits || 3 }).map((_, i) => (
                <div
                  key={i}
                  className="w-5 h-6 border-2 border-black bg-white flex items-center justify-center relative"
                >
                  {/* Faint middle guideline for student digit alignment */}
                  <div className="w-full border-t border-dashed border-slate-200 pointer-events-none" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Decorative Divider */}
        <div
          className={`mt-2 border-b ${
            worksheet.style_preset === 'pod'
              ? 'border-dashed border-slate-300'
              : 'border-slate-300'
          }`}
        />
      </div>

      {/* QUESTIONS GRID (Supports 1 Column or 2 Columns) */}
      <div className="flex-1 my-3 flex flex-col justify-between">
        {pageQuestions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm italic">
            No questions assigned to Page {pageNum}.
          </div>
        ) : (
          <div
            className={`grid gap-3 ${
              columns === 2 ? 'grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {pageQuestions.map((q) => (
              <div
                key={q.id}
                className={`rounded border p-2.5 flex flex-col justify-between bg-white ${getCardHeightClass()} ${
                  worksheet.style_preset === 'pod'
                    ? 'border-dashed border-slate-300'
                    : 'border-slate-300'
                }`}
              >
                {/* Question Header & Rendered Math Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900">
                      Problem {q.order_index}.
                    </span>
                    {q.points && (
                      <span className="text-[10px] font-semibold text-slate-500">
                        [{q.points} pt{q.points > 1 ? 's' : ''}]
                      </span>
                    )}
                  </div>

                  {/* Math text rendered via KaTeX */}
                  <div className="text-xs text-slate-900 leading-relaxed font-sans mt-1">
                    <MathText text={q.prompt} />
                  </div>
                </div>

                {/* Bottom Row: Work Area + Final Answer Box */}
                <div
                  className={`flex mt-2 gap-2 ${
                    columns === 2 ? 'flex-col' : 'flex-row items-stretch'
                  }`}
                >
                  {/* Scratch Work Area */}
                  <div
                    className={`border border-slate-200 rounded-sm p-1 relative bg-white ${
                      columns === 2 ? getWorkAreaHeightClass() : 'flex-1 ' + getWorkAreaHeightClass()
                    }`}
                  >
                    <span className="text-[8px] text-slate-400 italic block">
                      Show your work:
                    </span>
                    {isAnswerKey && q.rubric_notes && (
                      <div className="text-[9px] text-blue-700 italic mt-1 leading-tight font-sans">
                        Rubric: {q.rubric_notes}
                      </div>
                    )}
                  </div>

                  {/* FINAL ANSWER BOX (High Contrast for OCR Scanner) */}
                  <div
                    className={`border-2 border-black rounded-sm bg-white flex flex-col justify-between overflow-hidden shadow-xs shrink-0 ${
                      columns === 2 ? 'h-12 w-full' : 'w-44 ' + getWorkAreaHeightClass()
                    }`}
                  >
                    <div className="bg-slate-100 border-b border-slate-300 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-black flex justify-between items-center">
                      <span>FINAL ANSWER:</span>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-1">
                      {isAnswerKey ? (
                        <div className="text-sm font-bold text-blue-700 font-sans">
                          <MathText text={q.correct_answer || '—'} />
                        </div>
                      ) : q.question_type === 'multiple_choice' && q.options?.length ? (
                        <div className="text-[8.5px] text-slate-700 space-y-0.5 w-full font-medium">
                          {q.options.slice(0, 4).map((opt) => (
                            <div key={opt.label}>
                              [{opt.label}] {opt.text}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="text-center text-[9px] text-slate-400 border-t border-slate-200 pt-1.5 flex justify-between items-center">
        <span>Worksheet Maker 2.0 • OCR Alignment Grid</span>
        <span className="font-mono">
          Page {pageNum} of {worksheet.total_pages || 1}
        </span>
        <span className="font-mono">Code: {worksheet.short_code}</span>
      </div>
    </div>
  );
};
