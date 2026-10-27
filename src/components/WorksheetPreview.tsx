import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Worksheet } from '../types/worksheet';
import { MathText } from '../utils/mathRenderer';
import { Eye, EyeOff } from 'lucide-react';

interface WorksheetPreviewProps {
  worksheet: Worksheet;
}

export const WorksheetPreview: React.FC<WorksheetPreviewProps> = ({ worksheet }) => {
  const [activePage, setActivePage] = useState<number>(1);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const totalPages = worksheet.total_pages || 1;

  useEffect(() => {
    // Generate QR code for current page preview
    QRCode.toDataURL(`ASG_${worksheet.short_code}:P${activePage}`, {
      margin: 1,
      width: 120,
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error(err));
  }, [worksheet.short_code, activePage]);

  // Questions for active page
  const pageQuestions = worksheet.questions
    .filter((q) => (q.page_number || 1) === activePage)
    .sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="bg-slate-200/80 p-4 sm:p-6 rounded-2xl border border-slate-300 flex flex-col items-center">
      {/* Preview Controls Bar */}
      <div className="w-full max-w-[650px] mb-4 flex items-center justify-between text-xs font-semibold text-slate-700">
        {/* Page Switcher */}
        <div className="flex items-center space-x-2">
          <span className="text-slate-500 uppercase tracking-wider">Preview Page:</span>
          <div className="flex bg-white rounded-lg p-1 border border-slate-300 shadow-xs">
            <button
              onClick={() => setActivePage(1)}
              className={`px-3 py-1 rounded font-bold transition ${
                activePage === 1 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Page 1
            </button>
            {totalPages > 1 && (
              <button
                onClick={() => setActivePage(2)}
                className={`px-3 py-1 rounded font-bold transition ${
                  activePage === 2 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Page 2
              </button>
            )}
          </div>
        </div>

        {/* Toggle Answer Key View */}
        <button
          onClick={() => setShowKey(!showKey)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-semibold transition ${
            showKey
              ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          {showKey ? <EyeOff className="w-4 h-4 text-amber-700" /> : <Eye className="w-4 h-4 text-slate-500" />}
          <span>{showKey ? 'Previewing Answer Key' : 'Preview Student Test'}</span>
        </button>
      </div>

      {/* Sheet Canvas (Simulating 8.5" x 11" US Letter Sheet) */}
      <div
        className="w-full max-w-[650px] aspect-[8.5/11] bg-white rounded-sm shadow-xl border border-slate-300 p-6 relative flex flex-col justify-between select-none overflow-hidden"
        style={{ minHeight: '840px' }}
      >
        {/* 4 CORNER FIDUCIAL MARKERS (Solid black squares) */}
        <div className="absolute top-2.5 left-2.5 w-3.5 h-3.5 bg-black" />
        <div className="absolute top-2.5 right-2.5 w-3.5 h-3.5 bg-black" />
        <div className="absolute bottom-2.5 left-2.5 w-3.5 h-3.5 bg-black" />
        <div className="absolute bottom-2.5 right-2.5 w-3.5 h-3.5 bg-black" />

        {/* TOP HEADER SECTION */}
        <div>
          {/* Answer Key Banner */}
          {showKey && (
            <div className="mb-2 bg-blue-50 border border-blue-300 text-blue-800 text-[11px] font-bold px-3 py-1 rounded inline-block">
              TEACHER MASTER / ANSWER KEY
            </div>
          )}

          <div className="flex items-start justify-between">
            <div>
              {/* Theme Badge */}
              <div className="mb-1">
                {worksheet.style_preset === 'pod' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded">
                    ★ Problem of the Day
                  </span>
                )}
                {worksheet.style_preset === 'quiz' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded">
                    Assessment / Quiz
                  </span>
                )}
                {worksheet.style_preset === 'exit_ticket' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                    Exit Ticket
                  </span>
                )}
                {worksheet.style_preset === 'homework' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded">
                    Homework Practice
                  </span>
                )}
              </div>

              {/* Title & Subtitle */}
              <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">
                {worksheet.title || 'Untitled Worksheet'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {worksheet.subject} • {worksheet.grade_level}
              </p>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-14 h-14" />
              ) : (
                <div className="w-14 h-14 bg-slate-100 border border-slate-300" />
              )}
              <span className="text-[9px] font-mono font-bold text-slate-500 mt-0.5">
                {worksheet.short_code} • P{activePage}
              </span>
            </div>
          </div>

          {/* Student Header Bar & 3-Digit ID Grid */}
          <div className="mt-3 flex items-center justify-between text-xs text-slate-700 border-t border-slate-200 pt-2.5">
            <div className="flex space-x-4">
              <span>Name: __________________________</span>
              <span>Period: _____</span>
              <span>Date: _________</span>
            </div>

            {/* 3-Digit Student ID Box */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-bold text-slate-800 uppercase">Student ID:</span>
              <div className="flex space-x-0.5">
                {Array.from({ length: worksheet.student_id_digits || 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-5 h-6 border-2 border-black bg-white flex items-center justify-center font-mono font-bold text-xs"
                  >
                    {/* Blank for student to write in */}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className={`mt-2 border-b ${
              worksheet.style_preset === 'pod' ? 'border-dashed border-slate-300' : 'border-slate-200'
            }`}
          />
        </div>

        {/* QUESTIONS CONTAINER */}
        <div className="flex-1 my-3 flex flex-col justify-around space-y-3">
          {pageQuestions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm italic">
              No questions on Page {activePage}. Add questions using the editor!
            </div>
          ) : (
            pageQuestions.map((q) => (
              <div
                key={q.id}
                className={`rounded border p-3 flex flex-col justify-between relative ${
                  worksheet.style_preset === 'pod'
                    ? 'border-dashed border-slate-400 bg-slate-50/20'
                    : 'border-slate-300 bg-white'
                }`}
                style={{ minHeight: '110px' }}
              >
                {/* Question Header & Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">
                      Question {q.order_index}.
                    </span>
                    {q.points && (
                      <span className="text-[10px] font-bold text-slate-500">
                        [{q.points} pt{q.points > 1 ? 's' : ''}]
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-800 leading-relaxed font-sans mb-2">
                    <MathText text={q.prompt} />
                  </div>
                </div>

                {/* Bottom Row: Work Area (Left) & Final Answer Box (Right) */}
                <div className="flex items-stretch space-x-3 mt-1 h-20">
                  {/* Scratch Work Area */}
                  <div className="flex-1 border border-slate-200 rounded p-1 relative bg-white">
                    <span className="text-[9px] text-slate-400 italic block">
                      Show your work:
                    </span>
                    {showKey && q.rubric_notes && (
                      <div className="text-[10px] text-blue-700 italic mt-1 leading-tight">
                        Rubric: {q.rubric_notes}
                      </div>
                    )}
                  </div>

                  {/* FINAL ANSWER BOX (High Contrast for Copier OCR) */}
                  <div className="w-36 border-2 border-black rounded bg-white flex flex-col justify-between overflow-hidden shadow-xs">
                    <div className="bg-slate-100 border-b border-slate-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
                      Final Answer:
                    </div>

                    {/* Answer content */}
                    <div className="flex-1 flex items-center justify-center p-1">
                      {showKey ? (
                        <span className="text-sm font-bold text-blue-700">
                          {q.correct_answer || '—'}
                        </span>
                      ) : q.question_type === 'multiple_choice' && q.options?.length ? (
                        <div className="text-[8px] text-slate-500 space-y-0.5 w-full">
                          {q.options.slice(0, 4).map((opt) => (
                            <div key={opt.label}>
                              [{opt.label}] {opt.text.slice(0, 10)}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER */}
        <div className="text-center text-[9px] text-slate-400 border-t border-slate-200 pt-1.5 flex justify-between items-center">
          <span>Worksheet Maker 2.0 • OCR Ready</span>
          <span className="font-mono">
            Page {activePage} of {totalPages}
          </span>
          <span className="font-mono">ID: {worksheet.short_code}</span>
        </div>
      </div>
    </div>
  );
};
