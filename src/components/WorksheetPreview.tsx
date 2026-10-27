import React, { useState } from 'react';
import { Worksheet } from '../types/worksheet';
import { WorksheetPage } from './WorksheetPage';
import { Eye, EyeOff, Printer, Download } from 'lucide-react';

interface WorksheetPreviewProps {
  worksheet: Worksheet;
  onPrint: (isKey: boolean) => void;
  onDownloadPDF: (isKey: boolean) => void;
}

export const WorksheetPreview: React.FC<WorksheetPreviewProps> = ({
  worksheet,
  onPrint,
  onDownloadPDF,
}) => {
  const [activePage, setActivePage] = useState<number>(1);
  const [showKey, setShowKey] = useState<boolean>(false);

  const totalPages = worksheet.total_pages || 1;

  return (
    <div className="no-print bg-slate-200/90 p-4 sm:p-5 rounded-2xl border border-slate-300 flex flex-col items-center shadow-inner">
      {/* Preview Header & Controls */}
      <div className="w-full max-w-[650px] mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-700">
        {/* Page Switcher */}
        <div className="flex items-center space-x-2">
          <span className="text-slate-500 uppercase tracking-wider text-[11px]">Page:</span>
          <div className="flex bg-white rounded-lg p-0.5 border border-slate-300 shadow-xs">
            <button
              type="button"
              onClick={() => setActivePage(1)}
              className={`px-2.5 py-1 rounded font-bold transition ${
                activePage === 1 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Page 1
            </button>
            {totalPages > 1 && (
              <button
                type="button"
                onClick={() => setActivePage(2)}
                className={`px-2.5 py-1 rounded font-bold transition ${
                  activePage === 2 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Page 2
              </button>
            )}
          </div>
        </div>

        {/* Answer Key Toggle */}
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg border font-semibold transition ${
            showKey
              ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          {showKey ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
          <span>{showKey ? 'Showing Answer Key' : 'Student View'}</span>
        </button>

        {/* Quick Action Buttons in Preview Header */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => onPrint(showKey)}
            className="flex items-center space-x-1 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition"
            title="Open browser print dialog directly"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sheet</span>
          </button>
          <button
            type="button"
            onClick={() => onDownloadPDF(showKey)}
            className="p-1 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-xs transition"
            title="Download PDF file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Render the Exact Printable Sheet scaled to fit the preview column */}
      <div className="w-full flex justify-center overflow-x-auto py-1">
        <div
          className="shadow-2xl border border-slate-300 rounded-xs bg-white origin-top"
          style={{
            transform: 'scale(0.72)',
            transformOrigin: 'top center',
            marginBottom: '-75mm', // Compensate for scale transform height in DOM
          }}
        >
          <WorksheetPage
            worksheet={worksheet}
            pageNum={activePage}
            isAnswerKey={showKey}
          />
        </div>
      </div>
    </div>
  );
};
