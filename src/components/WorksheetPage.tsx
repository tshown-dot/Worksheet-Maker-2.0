import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Worksheet, Question } from '../types/worksheet';
import { MathText } from '../utils/mathRenderer';
import { getStandardDescription } from '../utils/standards';
import { getWorksheetTheme, rgb } from '../utils/worksheetTheme';

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

  const theme = getWorksheetTheme(worksheet);
  const isSolid = theme.headerStyle === 'solid';
  const accent = rgb(theme.accent);
  const cardBorderStyle: React.CSSProperties = (() => {
    switch (theme.borderStyle) {
      case 'double':
        return { border: `4px double ${accent}` };
      case 'heavy-double':
        return { border: `8px double ${accent}`, borderRadius: 4 };
      case 'dashed':
        return { border: `3.5px dashed ${accent}`, borderRadius: 6 };
      case 'heavy':
        return { border: `4px solid ${accent}` };
      case 'thick':
        return { border: `2.5px solid ${accent}` };
      default:
        return { border: `1.5px solid ${accent}` };
    }
  })();

  const hs = theme.headerStyle;
  const headerBarStyle: React.CSSProperties =
    hs === 'solid'
      ? { backgroundColor: accent, borderBottom: `1.5px solid ${accent}` }
      : hs === 'hatch'
        ? {
            backgroundColor: rgb(theme.tint),
            backgroundImage: `repeating-linear-gradient(-45deg, ${accent} 0 2px, transparent 2px 6px)`,
            borderBottom: `3px solid ${accent}`,
          }
        : hs === 'outline'
          ? { backgroundColor: '#fff', borderBottom: `3px dashed ${accent}` }
          : { backgroundColor: rgb(theme.tint), borderBottom: `1.5px solid ${accent}` };
  // White chips keep text readable over the striped (hatch) header
  const chipStyle: React.CSSProperties =
    hs === 'hatch'
      ? { backgroundColor: '#fff', border: `1px solid ${accent}`, borderRadius: 4, padding: '1px 6px' }
      : {};

  const columns = worksheet.columns || 1;
  const rowCount = columns === 2 ? Math.max(Math.ceil(pageQuestions.length / 2), 1) : Math.max(pageQuestions.length, 1);

  return (
    <div
      className={`print-sheet relative bg-white select-none box-border flex flex-col justify-between ${className}`}
      style={{
        width: '215.9mm',
        minHeight: '279.4mm',
        height: '279.4mm',
        padding: '9mm 9.5mm',
        pageBreakAfter: 'always',
        margin: '0 auto',
      }}
    >
      {/* 4 SOLID CORNER FIDUCIAL MARKERS FOR COPIER SCANNER DESKEW */}
      <div className="absolute top-[3.5mm] left-[3.5mm] w-[4mm] h-[4mm] bg-black" />
      <div className="absolute top-[3.5mm] right-[3.5mm] w-[4mm] h-[4mm] bg-black" />
      <div className="absolute bottom-[3.5mm] left-[3.5mm] w-[4mm] h-[4mm] bg-black" />
      <div className="absolute bottom-[3.5mm] right-[3.5mm] w-[4mm] h-[4mm] bg-black" />

      {/* OPTIONAL PAGE FRAME (Accelerated POD): bold dashed perimeter between the fiducials */}
      {theme.pageFrame === 'dashed' && (
        <>
          <div className="absolute pointer-events-none" style={{ top: '4.95mm', left: '9.5mm', right: '9.5mm', borderTop: `1.1mm dashed ${accent}` }} />
          <div className="absolute pointer-events-none" style={{ bottom: '4.95mm', left: '9.5mm', right: '9.5mm', borderTop: `1.1mm dashed ${accent}` }} />
          <div className="absolute pointer-events-none" style={{ left: '4.95mm', top: '9.5mm', bottom: '9.5mm', borderLeft: `1.1mm dashed ${accent}` }} />
          <div className="absolute pointer-events-none" style={{ right: '4.95mm', top: '9.5mm', bottom: '9.5mm', borderLeft: `1.1mm dashed ${accent}` }} />
        </>
      )}

      {/* TOP HEADER SECTION (Publishing-Grade Academic Masthead) */}
      <div className="w-full">
        {/* Answer Key Alert Banner */}
        {isAnswerKey && (
          <div className="mb-1 bg-blue-50 border border-blue-500 text-blue-900 text-[9px] font-extrabold px-2.5 py-0.5 rounded-xs uppercase tracking-wider inline-flex items-center">
            <span className="mr-1.5 text-blue-600">★</span> OFFICIAL TEACHER MASTER • ANSWER KEY
          </div>
        )}

        <div className="flex items-center justify-between pb-1.5 gap-3" style={{ borderBottom: `3px solid ${accent}` }}>
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center space-x-2.5 flex-wrap">
              <h1 className="text-[18px] font-extrabold text-slate-900 tracking-tight leading-snug">
                {worksheet.title || 'Untitled Math Worksheet'}
              </h1>
              <span
                className="text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-xs"
                style={
                  isSolid
                    ? { backgroundColor: accent, color: '#fff', border: `1px solid ${accent}` }
                    : { backgroundColor: rgb(theme.tint), color: rgb(theme.ink), border: `1px solid ${accent}` }
                }
              >
                {theme.badgeIcon} {theme.badgeLabel}
              </span>
            </div>
            <p className="text-[9.5px] uppercase tracking-widest font-bold text-slate-500 mt-0.5 flex items-center gap-2">
              {theme.classLabel && (
                <span
                  className="text-[10px] font-black tracking-wider px-2 py-0.5 rounded-xs text-white"
                  style={{ backgroundColor: accent }}
                >
                  {theme.classLabel}
                </span>
              )}
              <span>{worksheet.subject} • {worksheet.grade_level}</span>
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
              return (
                <div
                  key={q.id}
                  className="rounded-xs flex flex-col justify-between bg-white h-full overflow-hidden transition-all"
                  style={cardBorderStyle}
                >
                  {/* 1. Card Top Header Bar (solid / tint / striped / dashed-outline by type) */}
                  <div>
                    <div
                      className="px-2.5 py-1 flex items-center justify-between"
                      style={headerBarStyle}
                    >
                      <div className="flex items-center space-x-2 flex-wrap">
                        <div className="flex items-center space-x-1.5" style={chipStyle}>
                          <span
                            className={`w-5 h-5 font-black text-[10.5px] flex items-center justify-center shrink-0 ${
                              theme.numberShape === 'circle' ? 'rounded-full' : 'rounded-xs'
                            }`}
                            style={
                              isSolid
                                ? { backgroundColor: '#fff', color: accent }
                                : { backgroundColor: accent, color: '#fff' }
                            }
                          >
                            {q.order_index}
                          </span>
                          <span
                            className="text-[12.5px] font-extrabold tracking-tight"
                            style={{ color: isSolid ? '#fff' : rgb(theme.ink) }}
                          >
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
                    <div className="flex items-center gap-2 shrink-0" style={chipStyle}>
                      {theme.classLabel && (
                        <span
                          className="text-[8.5px] font-black uppercase tracking-widest"
                          style={{ color: isSolid ? '#fff' : rgb(theme.ink) }}
                        >
                          {theme.classLabel}
                        </span>
                      )}
                      {q.points && (
                        <span
                          className="text-[9.5px] font-bold uppercase tracking-wider"
                          style={{ color: isSolid ? '#fff' : rgb(theme.ink) }}
                        >
                          {q.points} pt{q.points > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 2. Problem Prompt & Multiple Choice Options */}
                  <div className="px-3 pt-2 pb-1.5">
                    <div className="text-[14px] text-slate-900 leading-snug font-sans">
                      <MathText text={q.prompt} />
                    </div>

                    {q.question_type === 'multiple_choice' && q.options && q.options.length > 0 && (() => {
                      const hasLongOptions = q.options.some((o) => (o.text || '').length > 22);
                      return (
                        <div
                          className={`mt-1.5 pt-0.5 text-slate-900 ${
                            hasLongOptions
                              ? 'grid grid-cols-1 gap-y-1'
                              : 'grid grid-cols-2 gap-x-3 gap-y-0.5'
                          }`}
                        >
                          {q.options.map((opt) => (
                            <div key={opt.label} className="flex items-baseline space-x-1.5">
                              <span className="font-extrabold text-slate-900 text-[12.5px] shrink-0">
                                ({opt.label})
                              </span>
                              <div className="text-[12.5px] leading-snug font-sans text-slate-800">
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
