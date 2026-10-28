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
        padding: '13mm 15mm',
        pageBreakAfter: 'always',
        margin: '0 auto',
      }}
    >
      {/* 4 SOLID CORNER FIDUCIAL MARKERS FOR COPIER SCANNER DESKEW (4mm clear margin from content) */}
      <div className="absolute top-[6mm] left-[6mm] w-[5mm] h-[5mm] bg-black" />
      <div className="absolute top-[6mm] right-[6mm] w-[5mm] h-[5mm] bg-black" />
      <div className="absolute bottom-[6mm] left-[6mm] w-[5mm] h-[5mm] bg-black" />
      <div className="absolute bottom-[6mm] right-[6mm] w-[5mm] h-[5mm] bg-black" />

      {/* TOP HEADER SECTION (Publishing-Grade Academic Masthead) */}
      <div className="w-full">
        {/* Answer Key Alert Banner */}
        {isAnswerKey && (
          <div className="mb-1 bg-blue-50 border border-blue-500 text-blue-900 text-[9px] font-extrabold px-2.5 py-0.5 rounded-xs uppercase tracking-wider inline-flex items-center">
            <span className="mr-1.5 text-blue-600">★</span> OFFICIAL TEACHER MASTER • ANSWER KEY
          </div>
        )}

        <div className="flex items-center justify-between pb-2 border-b-2 border-b-slate-900 gap-3">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center space-x-2.5 flex-wrap">
              <h1 className="text-[17px] font-extrabold text-slate-900 tracking-tight leading-snug">
                {worksheet.title || 'Untitled Math Worksheet'}
              </h1>
              {(worksheet.style_preset === 'spiral' || worksheet.style_preset === 'homework') && (
                <span className="text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xs">
                  🔄 Spiral Review
                </span>
              )}
              {worksheet.style_preset === 'classwork' && (
                <span className="text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xs">
                  ✏️ Classwork
                </span>
              )}
              {worksheet.style_preset === 'pod' && (
                <span className="text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 rounded-xs">
                  ★ Problem of the Day
                </span>
              )}
              {worksheet.style_preset === 'quiz' && (
                <span className="text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 bg-red-50 text-red-800 border border-red-200 rounded-xs">
                  Assessment / Quiz
                </span>
              )}
              {worksheet.style_preset === 'exit_ticket' && (
                <span className="text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xs">
                  Exit Ticket
                </span>
              )}
            </div>
            <p className="text-[9.5px] uppercase tracking-widest font-bold text-slate-500 mt-0.5">
              {worksheet.subject} • {worksheet.grade_level}
            </p>
          </div>

          {/* Large Student ID Box + QR Code Block */}
          <div className="flex items-center space-x-3 shrink-0">
            {/* Large Student ID Box to the left of QR code */}
            <div className="w-40 h-11 border-2 border-slate-900 bg-white rounded-xs flex items-stretch overflow-hidden">
              <div className="bg-slate-100 border-r border-slate-300 px-2 flex flex-col items-center justify-center shrink-0">
                <span className="text-[7px] font-black uppercase tracking-wider text-slate-500 leading-none">
                  STUDENT
                </span>
                <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-900 leading-none mt-0.5">
                  ID #
                </span>
              </div>
              <div className="flex-1 bg-white relative flex items-center justify-center">
                <div className="w-4/5 border-b border-dashed border-slate-300 translate-y-3 pointer-events-none" />
              </div>
            </div>

            {/* QR Code Block (Compact Scanner Target) */}
            <div className="flex items-center space-x-2 shrink-0">
              <div className="text-right">
                <span className="text-[9.5px] font-mono font-extrabold text-slate-900 block leading-tight">
                  {worksheet.short_code}
                </span>
                <span className="text-[8px] font-mono font-medium text-slate-500 block leading-tight mt-0.5">
                  Page {pageNum} of {worksheet.total_pages || 1}
                </span>
              </div>
              {qrUrl ? (
                <img src={qrUrl} alt="QR Code" className="w-11 h-11 border border-slate-300 p-0.5 bg-white" />
              ) : (
                <div className="w-11 h-11 bg-slate-100 border border-slate-300" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QUESTIONS GRID (Fills 100% of vertical page space with auto-stretching unified cards) */}
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
            {pageQuestions.map((q) => {
              const isClasswork = worksheet.style_preset === 'classwork';
              return (
                <div
                  key={q.id}
                  className={`rounded-xs flex flex-col justify-between bg-white h-full overflow-hidden transition-all ${
                    isClasswork
                      ? 'border-2 border-slate-700 shadow-2xs ring-1 ring-slate-300'
                      : 'border border-slate-300'
                  }`}
                >
                  {/* 1. Card Top Header Bar */}
                  <div>
                    <div
                      className={`px-2.5 py-1 flex items-center justify-between ${
                        isClasswork
                          ? 'bg-gradient-to-r from-slate-100 via-slate-50 to-emerald-50/50 border-b-2 border-slate-700'
                          : 'bg-slate-50 border-b border-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 flex-wrap">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`w-4.5 h-4.5 rounded-xs font-black text-[10px] flex items-center justify-center shrink-0 ${
                              isClasswork ? 'bg-emerald-700 text-white shadow-2xs' : 'bg-slate-900 text-white'
                            }`}
                          >
                            {q.order_index}
                          </span>
                          <span className="text-[11.5px] font-extrabold text-slate-900 tracking-tight">
                            Question {q.order_index}
                          </span>
                        </div>
                      {isAnswerKey && worksheet.track_standards !== false && q.standard && (
                        <span className="text-[8.5px] font-bold text-purple-800 bg-purple-50 px-1.5 py-0.2 rounded-xs border border-purple-200">
                          {q.standard}
                          {getStandardDescription(q.standard)
                            ? ` • ${getStandardDescription(q.standard)}`
                            : ''}
                        </span>
                      )}
                    </div>
                    {q.points && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
                        {q.points} pt{q.points > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* 2. Problem Prompt & Multiple Choice Options */}
                  <div className="px-3 pt-2 pb-1.5">
                    <div className="text-[12.5px] text-slate-900 leading-relaxed font-sans">
                      <MathText text={q.prompt} />
                    </div>

                    {q.question_type === 'multiple_choice' && q.options && q.options.length > 0 && (() => {
                      const hasLongOptions = q.options.some((o) => (o.text || '').length > 22);
                      return (
                        <div
                          className={`mt-1.5 pt-1 text-slate-900 ${
                            hasLongOptions
                              ? 'grid grid-cols-1 gap-y-1'
                              : 'grid grid-cols-2 gap-x-3 gap-y-0.5'
                          }`}
                        >
                          {q.options.map((opt) => (
                            <div key={opt.label} className="flex items-baseline space-x-1.5">
                              <span className="font-extrabold text-slate-900 text-[11px] shrink-0">
                                ({opt.label})
                              </span>
                              <div className="text-[11px] leading-snug font-sans text-slate-800">
                                <MathText text={opt.text} />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* 3. Seamless Work Area + Crisp Final Answer Box */}
                <div
                  className={`flex flex-1 min-h-0 ${
                    columns === 2
                      ? 'flex-col'
                      : 'flex-row items-stretch border-t border-dashed border-slate-200'
                  }`}
                >
                  {/* Full-width Open Work Space (No double inner borders) */}
                  <div
                    className={`px-3 py-1.5 relative bg-white flex-1 min-h-[42px] flex flex-col justify-between ${
                      columns === 2 ? 'border-t border-dashed border-slate-200' : ''
                    }`}
                    style={{
                      backgroundImage: 'radial-gradient(#cbd5e1 0.7px, transparent 0.7px)',
                      backgroundSize: '10px 10px',
                    }}
                  >
                    <span className="text-[7px] font-extrabold uppercase tracking-widest text-slate-400 bg-white/90 px-1 rounded-2xs inline-block self-start">
                      WORK SPACE
                    </span>
                    {isAnswerKey && (q.rubric_notes || (worksheet.track_standards !== false && q.standard)) && (
                      <div className="my-0.5 space-y-0.5 bg-white/95 p-1.5 rounded-xs border border-blue-100">
                        {worksheet.track_standards !== false && q.standard && (
                          <div className="text-[8px] font-semibold text-purple-800 leading-tight">
                            Standard: {q.standard}{' '}
                            {getStandardDescription(q.standard)
                              ? `(${getStandardDescription(q.standard)})`
                              : ''}
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

                  {/* FINAL ANSWER BOX (High-Contrast 2px Black Border with Clean Light Header Strip) */}
                  <div
                    className={`border-2 border-slate-900 rounded-xs bg-white flex flex-col justify-between overflow-hidden shrink-0 ${
                      columns === 2
                        ? 'h-[66px] mx-2.5 mb-2'
                        : 'w-52 my-2 mr-2.5 min-h-[64px]'
                    }`}
                  >
                    <div className="bg-slate-100 border-b border-slate-300 px-2 py-0.5 text-[7.5px] font-black uppercase tracking-widest text-slate-800 flex justify-between items-center">
                      <span>FINAL ANSWER</span>
                    </div>

                    <div className="flex-1 flex items-center justify-center px-2 py-1 bg-white relative">
                      {isAnswerKey ? (
                        <div className="text-sm font-bold text-blue-800 font-sans flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 bg-blue-50 text-blue-900 rounded-xs font-extrabold border border-blue-300 text-sm">
                            <MathText text={q.correct_answer || '—'} />
                          </span>
                          {q.question_type === 'multiple_choice' &&
                            q.options?.find(
                              (o) =>
                                o.label.toUpperCase() ===
                                q.correct_answer?.trim().toUpperCase()
                            ) && (
                              <span className="text-xs text-blue-800 font-medium truncate max-w-[140px]">
                                <MathText
                                  text={
                                    q.options.find(
                                      (o) =>
                                        o.label.toUpperCase() ===
                                        q.correct_answer?.trim().toUpperCase()
                                    )?.text || ''
                                  }
                                />
                              </span>
                            )}
                        </div>
                      ) : q.question_type === 'multiple_choice' ? (
                        /* Clean Scantron-Style Bubble Letter Choices */
                        <div className="flex items-center justify-around w-full px-2">
                          {['A', 'B', 'C', 'D'].map((letter) => (
                            <div key={letter} className="flex flex-col items-center">
                              <div className="w-6 h-6 rounded-full border-1.5 border-slate-800 flex items-center justify-center font-bold text-xs text-slate-900 bg-white">
                                {letter}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* Subtle writing baseline for student open-ended answer */
                        <div className="w-full h-full flex items-end justify-center pb-1.5 pointer-events-none">
                          <div className="w-11/12 border-b border-dashed border-slate-200" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="text-center text-[8px] uppercase tracking-widest text-slate-400 border-t border-slate-200 pt-1 flex justify-between items-center font-semibold">
        <span>Worksheet Maker 2.0 • Form {worksheet.short_code}</span>
        <span className="font-mono font-bold text-slate-500">
          Page {pageNum} of {worksheet.total_pages || 1}
        </span>
        <span>Standardized Assessment Layout</span>
      </div>
    </div>
  );
};
