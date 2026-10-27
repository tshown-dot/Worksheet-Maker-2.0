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

      {/* TOP HEADER SECTION (Publishing-Grade Academic Header) */}
      <div className="w-full">
        {/* Answer Key Alert Banner */}
        {isAnswerKey && (
          <div className="mb-1.5 bg-blue-50 border border-blue-500 text-blue-900 text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-xs uppercase tracking-wider inline-flex items-center shadow-2xs">
            <span className="mr-1.5 text-blue-600">★</span> OFFICIAL TEACHER MASTER • ANSWER KEY
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex-1 pr-3">
            <div className="flex items-center space-x-2 flex-wrap">
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                {worksheet.title || 'Untitled Math Worksheet'}
              </h1>
              {worksheet.style_preset === 'pod' && (
                <span className="text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-xs">
                  ★ Problem of the Day
                </span>
              )}
              {worksheet.style_preset === 'quiz' && (
                <span className="text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-xs">
                  Quiz Assessment
                </span>
              )}
              {worksheet.style_preset === 'exit_ticket' && (
                <span className="text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xs">
                  Exit Ticket
                </span>
              )}
            </div>
            <p className="text-[9.5px] uppercase tracking-wider font-semibold text-slate-500 mt-0.5">
              {worksheet.subject} • {worksheet.grade_level}
            </p>
          </div>

          {/* QR Code Block (Compact Scanner Target) */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="text-right">
              <span className="text-[9px] font-mono font-bold text-slate-800 block leading-tight">
                {worksheet.short_code}
              </span>
              <span className="text-[8px] font-mono text-slate-500 block leading-tight">
                Page {pageNum} of {worksheet.total_pages || 1}
              </span>
            </div>
            {qrUrl ? (
              <img src={qrUrl} alt="QR Code" className="w-9 h-9 border border-slate-200" />
            ) : (
              <div className="w-9 h-9 bg-slate-100 border border-slate-300" />
            )}
          </div>
        </div>

        {/* Professional Academic Form Bar: Sleek Underlined Fields + Single Large Student ID Box */}
        <div className="mt-1.5 pt-1.5 border-t-2 border-slate-900 flex items-end justify-between">
          <div className="flex-1 flex items-end space-x-5 mr-3">
            {/* Student Name */}
            <div className="flex items-baseline space-x-1.5 flex-1 min-w-[140px]">
              <span className="text-[9px] font-bold tracking-wider text-slate-800 uppercase shrink-0">
                NAME:
              </span>
              <div className="flex-1 border-b border-slate-500 h-3.5" />
            </div>

            {/* Date */}
            <div className="flex items-baseline space-x-1.5 w-28 shrink-0">
              <span className="text-[9px] font-bold tracking-wider text-slate-800 uppercase shrink-0">
                DATE:
              </span>
              <div className="flex-1 border-b border-slate-500 h-3.5" />
            </div>

            {/* Period */}
            <div className="flex items-baseline space-x-1.5 w-20 shrink-0">
              <span className="text-[9px] font-bold tracking-wider text-slate-800 uppercase shrink-0">
                PERIOD:
              </span>
              <div className="flex-1 border-b border-slate-500 h-3.5" />
            </div>
          </div>

          {/* Single Large Professional Student ID Box */}
          <div className="shrink-0 flex items-center">
            <div className="w-24 h-[30px] border-2 border-slate-900 bg-white rounded-xs flex flex-col justify-between overflow-hidden shadow-2xs">
              <div className="bg-slate-100 border-b border-slate-300 px-1 py-0.2 text-[7px] font-bold uppercase tracking-widest text-slate-700 text-center leading-none">
                STUDENT ID #
              </div>
              <div className="flex-1 flex items-center justify-center relative bg-white">
                <div className="w-full border-t border-dashed border-slate-200 pointer-events-none" />
              </div>
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
                className={`rounded-xs border p-2.5 flex flex-col justify-between bg-white h-full overflow-hidden shadow-2xs ${
                  worksheet.style_preset === 'pod'
                    ? 'border-dashed border-slate-300'
                    : 'border-slate-300'
                }`}
              >
                {/* Question Header, Rendered Prompt & Multiple Choice Options */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-150">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-5 h-5 rounded-xs bg-slate-900 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                          {q.order_index}
                        </span>
                        <span className="text-xs font-bold text-slate-900 tracking-tight">
                          Question {q.order_index}
                        </span>
                      </div>
                      {isAnswerKey && worksheet.track_standards !== false && q.standard && (
                        <span className="text-[9px] font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded-xs border border-purple-200">
                          {q.standard}{getStandardDescription(q.standard) ? ` • ${getStandardDescription(q.standard)}` : ''}
                        </span>
                      )}
                    </div>
                    {q.points && (
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
                        [{q.points} pt{q.points > 1 ? 's' : ''}]
                      </span>
                    )}
                  </div>

                  {/* Math text rendered via KaTeX */}
                  <div className="text-[12px] text-slate-900 leading-relaxed font-sans mt-0.5">
                    <MathText text={q.prompt} />
                  </div>

                  {/* MULTIPLE CHOICE OPTIONS: Academic Clean Grid */}
                  {q.question_type === 'multiple_choice' && q.options && q.options.length > 0 && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 my-2 pt-1 text-xs text-slate-900">
                      {q.options.map((opt) => (
                        <div key={opt.label} className="flex items-baseline space-x-1.5">
                          <span className="font-extrabold text-slate-900 text-xs shrink-0 tracking-tight">
                            ({opt.label})
                          </span>
                          <div className="text-xs leading-relaxed font-sans text-slate-800">
                            <MathText text={opt.text} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Row: Scratch Work Area + Final Answer Box */}
                <div
                  className={`flex mt-2 gap-2 flex-1 min-h-0 ${
                    columns === 2 ? 'flex-col' : 'flex-row items-stretch'
                  }`}
                >
                  {/* Scratch Work Area with subtle academic dot-grid background */}
                  <div
                    className="border border-slate-200 rounded-xs p-2 relative bg-white flex-1 min-h-[44px] flex flex-col justify-between"
                    style={{
                      backgroundImage: 'radial-gradient(#cbd5e1 0.75px, transparent 0.75px)',
                      backgroundSize: '10px 10px',
                    }}
                  >
                    <span className="text-[7.5px] font-extrabold uppercase tracking-widest text-slate-400 bg-white/90 px-1 py-0.2 rounded-2xs inline-block self-start border border-slate-100">
                      WORK SPACE
                    </span>
                    {isAnswerKey && (
                      <div className="mt-0.5 space-y-0.5 bg-white/95 p-1 rounded-xs border border-blue-100">
                        {worksheet.track_standards !== false && q.standard && (
                          <div className="text-[8px] font-semibold text-purple-800 leading-tight">
                            Target: {q.standard} {getStandardDescription(q.standard) ? `(${getStandardDescription(q.standard)})` : ''}
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
                    className={`border-2 border-slate-900 rounded-xs bg-white flex flex-col justify-between overflow-hidden shadow-2xs shrink-0 ${
                      columns === 2 ? 'h-[74px] w-full' : 'w-52 h-full min-h-[64px]'
                    }`}
                  >
                    <div className="bg-slate-900 text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-widest flex justify-between items-center">
                      <span>FINAL ANSWER</span>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-1.5 bg-white">
                      {isAnswerKey ? (
                        <div className="text-base font-bold text-blue-700 font-sans flex items-center space-x-2">
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-900 rounded-xs font-mono text-base font-black border border-blue-300">
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
                        /* Clean Scantron-Style Bubble Letter Choices */
                        <div className="flex items-center justify-around w-full px-2 py-1">
                          {['A', 'B', 'C', 'D'].map((letter) => (
                            <div key={letter} className="flex flex-col items-center">
                              <div className="w-6 h-6 rounded-full border-1.5 border-slate-900 flex items-center justify-center font-bold text-xs text-slate-900 bg-white shadow-2xs">
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
      <div className="text-center text-[8.5px] uppercase tracking-wider text-slate-400 border-t border-slate-200 pt-1.5 flex justify-between items-center font-medium">
        <span>Worksheet Maker 2.0 • Form {worksheet.short_code}</span>
        <span className="font-mono font-bold text-slate-500">
          Page {pageNum} of {worksheet.total_pages || 1}
        </span>
        <span>Standardized OCR Assessment Layout</span>
      </div>
    </div>
  );
};
