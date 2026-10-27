import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Worksheet, Question } from '../types/worksheet';
import { MathText } from '../utils/mathRenderer';
import { getStandardDescription } from '../utils/standards';

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
  const rowCount = columns === 2 ? Math.max(Math.ceil(pageQuestions.length / 2), 1) : Math.max(pageQuestions.length, 1);

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

      {/* TOP HEADER SECTION (Compact & Space-Saving) */}
      <div className="w-full">
        {/* Answer Key Alert Banner */}
        {isAnswerKey && (
          <div className="mb-1 bg-blue-50 border border-blue-400 text-blue-800 text-[9.5px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide inline-block">
            ★ Teacher Master / Answer Key
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex-1 pr-3">
            <div className="flex items-center space-x-2 flex-wrap">
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-none">
                {worksheet.title || 'Untitled Math Worksheet'}
              </h1>
              {worksheet.style_preset === 'pod' && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 bg-slate-100 text-slate-700 border border-slate-300 rounded-sm">
                  ★ Problem of the Day
                </span>
              )}
              {worksheet.style_preset === 'quiz' && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 bg-red-50 text-red-700 border border-red-200 rounded-sm">
                  Quiz
                </span>
              )}
              {worksheet.style_preset === 'exit_ticket' && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm">
                  Exit Ticket
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
              {worksheet.subject} • {worksheet.grade_level}
            </p>
          </div>

          {/* QR Code Block (Compact) */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <div className="text-right">
              <span className="text-[9px] font-mono font-bold text-slate-700 block leading-tight">
                {worksheet.short_code}
              </span>
              <span className="text-[8px] font-mono text-slate-400 block leading-tight">
                P{pageNum} of {worksheet.total_pages || 1}
              </span>
            </div>
            {qrUrl ? (
              <img src={qrUrl} alt="QR Code" className="w-9 h-9" />
            ) : (
              <div className="w-9 h-9 bg-slate-100 border border-slate-300" />
            )}
          </div>
        </div>

        {/* Compact Student Name / Period / Date / 3-Digit ID Bar */}
        <div className="mt-1 pt-1 border-t border-slate-300 flex items-center justify-between text-[11px] text-slate-800">
          <div className="flex items-center space-x-4">
            <span>Name: _______________________________</span>
            <span>Period: _____</span>
            <span>Date: _________</span>
          </div>

          {/* Standardized 3-Digit Student ID Box */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[9.5px] font-bold text-slate-900 uppercase tracking-wider">
              ID:
            </span>
            <div className="flex space-x-1">
              {Array.from({ length: worksheet.student_id_digits || 3 }).map((_, i) => (
                <div
                  key={i}
                  className="w-4.5 h-5 border-2 border-black bg-white flex items-center justify-center relative"
                >
                  <div className="w-full border-t border-dashed border-slate-200 pointer-events-none" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* QUESTIONS GRID (Fills 100% of vertical page space with auto-stretching cards) */}
      <div className="flex-1 my-2 overflow-hidden flex flex-col">
        {pageQuestions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm italic">
            No questions assigned to Page {pageNum}.
          </div>
        ) : (
          <div
            className={`grid gap-2.5 flex-1 h-full ${
              columns === 2 ? 'grid-cols-2' : 'grid-cols-1'
            }`}
            style={{
              gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
            }}
          >
            {pageQuestions.map((q) => (
              <div
                key={q.id}
                className={`rounded border p-2 flex flex-col justify-between bg-white h-full overflow-hidden ${
                  worksheet.style_preset === 'pod'
                    ? 'border-dashed border-slate-300'
                    : 'border-slate-300'
                }`}
              >
                {/* Question Header, Rendered Prompt & Multiple Choice Options */}
                <div>
                  <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-100">
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">
                        Problem {q.order_index}.
                      </span>
                      {isAnswerKey && worksheet.track_standards !== false && q.standard && (
                        <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                          {q.standard}{getStandardDescription(q.standard) ? ` • ${getStandardDescription(q.standard)}` : ''}
                        </span>
                      )}
                    </div>
                    {q.points && (
                      <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                        [{q.points} pt{q.points > 1 ? 's' : ''}]
                      </span>
                    )}
                  </div>

                  {/* Math text rendered via KaTeX */}
                  <div className="text-xs text-slate-900 leading-relaxed font-sans mt-0.5">
                    <MathText text={q.prompt} />
                  </div>

                  {/* MULTIPLE CHOICE OPTIONS: Rendered in the problem body */}
                  {q.question_type === 'multiple_choice' && q.options && q.options.length > 0 && (
                    <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 my-1.5 pt-0.5 text-xs text-slate-800">
                      {q.options.map((opt) => (
                        <div key={opt.label} className="flex items-baseline space-x-1 bg-slate-50/70 px-1.5 py-0.5 rounded border border-slate-150">
                          <span className="font-bold text-slate-900 text-xs shrink-0">({opt.label})</span>
                          <div className="text-xs leading-snug">
                            <MathText text={opt.text} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Row: Scratch Work Area + Final Answer Box */}
                <div
                  className={`flex mt-1.5 gap-2 flex-1 min-h-0 ${
                    columns === 2 ? 'flex-col' : 'flex-row items-stretch'
                  }`}
                >
                  {/* Scratch Work Area (flex-1 so it expands to absorb ALL page height) */}
                  <div className="border border-slate-200 rounded-sm p-1.5 relative bg-white flex-1 min-h-[42px] flex flex-col justify-between">
                    <span className="text-[8px] text-slate-400 italic block">
                      Show your work:
                    </span>
                    {isAnswerKey && (
                      <div className="mt-0.5 space-y-0.5">
                        {worksheet.track_standards !== false && q.standard && (
                          <div className="text-[8px] font-semibold text-purple-800 leading-tight">
                            Standard: {q.standard} {getStandardDescription(q.standard) ? `(${getStandardDescription(q.standard)})` : ''}
                          </div>
                        )}
                        {q.rubric_notes && (
                          <div className="text-[8.5px] text-blue-700 italic leading-tight font-sans">
                            Rubric: {q.rubric_notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* FINAL ANSWER BOX (High Contrast for OCR Scanner) */}
                  <div
                    className={`border-2 border-black rounded-sm bg-white flex flex-col justify-between overflow-hidden shadow-xs shrink-0 ${
                      columns === 2 ? 'h-[74px] w-full' : 'w-52 h-full min-h-[64px]'
                    }`}
                  >
                    <div className="bg-slate-100 border-b border-slate-300 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-black flex justify-between items-center">
                      <span>FINAL ANSWER:</span>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-1.5">
                      {isAnswerKey ? (
                        <div className="text-base font-bold text-blue-700 font-sans flex items-center space-x-2">
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-900 rounded font-mono text-base font-extrabold border border-blue-300">
                            {q.correct_answer || '—'}
                          </span>
                          {q.question_type === 'multiple_choice' &&
                            q.options?.find((o) => o.label.toUpperCase() === q.correct_answer?.trim().toUpperCase()) && (
                              <span className="text-xs text-blue-800 font-medium truncate max-w-[150px]">
                                {q.options.find((o) => o.label.toUpperCase() === q.correct_answer?.trim().toUpperCase())?.text}
                              </span>
                            )}
                        </div>
                      ) : q.question_type === 'multiple_choice' ? (
                        /* Clean Bubble Letter Choices for Student to Circle / Fill */
                        <div className="flex items-center justify-around w-full px-3 py-1">
                          {['A', 'B', 'C', 'D'].map((letter) => (
                            <div key={letter} className="flex flex-col items-center">
                              <div className="w-6 h-6 rounded-full border-2 border-slate-500 flex items-center justify-center font-bold text-xs text-slate-800 bg-slate-50 shadow-2xs">
                                {letter}
                              </div>
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
