import React, { useState, useRef, useEffect } from 'react';
import { Worksheet } from '../types/worksheet';
import { WorksheetPage } from './WorksheetPage';
import { Eye, EyeOff, Printer, Download, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

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
  const [manualZoom, setManualZoom] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScale, setAutoScale] = useState<number>(0.55);

  const totalPages = worksheet.total_pages || 1;
  const sheetWidthPx = 816; // 215.9 mm at 96 DPI
  const sheetHeightPx = 1056; // 279.4 mm at 96 DPI

  // Dynamically compute exact scale factor so the sheet NEVER clips on left or right!
  useEffect(() => {
    if (!containerRef.current) return;

    const calculateScale = () => {
      if (!containerRef.current) return;
      const availableWidth = containerRef.current.clientWidth - 16; // 16px buffer
      if (availableWidth > 50) {
        const computed = availableWidth / sheetWidthPx;
        setAutoScale(Math.min(computed, 1.0));
      }
    };

    calculateScale();

    const observer = new ResizeObserver(() => {
      calculateScale();
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const currentScale = manualZoom !== null ? manualZoom : autoScale;

  return (
    <div className="no-print bg-slate-200/90 p-3 sm:p-4 rounded-2xl border border-slate-300 flex flex-col shadow-inner w-full">
      {/* Preview Header & Controls */}
      <div className="w-full mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-700">
        {/* Page Switcher */}
        <div className="flex items-center space-x-1.5">
          <span className="text-slate-500 uppercase tracking-wider text-[10px]">Page:</span>
          <div className="flex bg-white rounded-lg p-0.5 border border-slate-300 shadow-xs">
            <button
              type="button"
              onClick={() => setActivePage(1)}
              className={`px-2 py-1 rounded font-bold transition ${
                activePage === 1 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Page 1
            </button>
            {totalPages > 1 && (
              <button
                type="button"
                onClick={() => setActivePage(2)}
                className={`px-2 py-1 rounded font-bold transition ${
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
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border font-semibold transition ${
            showKey
              ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          {showKey ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
          <span>{showKey ? 'Showing Key' : 'Student View'}</span>
        </button>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-1 bg-white border border-slate-300 rounded-lg p-0.5 shadow-xs">
          <button
            type="button"
            onClick={() => setManualZoom(null)}
            title="Fit to Column Width"
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              manualZoom === null ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Fit
          </button>
          <button
            type="button"
            onClick={() => setManualZoom((prev) => Math.max((prev ?? autoScale) - 0.1, 0.3))}
            className="p-1 text-slate-600 hover:bg-slate-100 rounded"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono px-1 font-bold text-slate-600">
            {Math.round(currentScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setManualZoom((prev) => Math.min((prev ?? autoScale) + 0.1, 1.2))}
            className="p-1 text-slate-600 hover:bg-slate-100 rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Print & Download Action Buttons */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => onPrint(showKey)}
            className="flex items-center space-x-1 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition"
            title="Open browser print dialog"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={() => onDownloadPDF(showKey)}
            className="p-1 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-xs transition"
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Responsive Sheet Preview Viewport */}
      <div
        ref={containerRef}
        className="w-full flex justify-center overflow-x-auto overflow-y-hidden bg-slate-300/60 rounded-xl p-2 border border-slate-300"
      >
        <div
          style={{
            width: `${sheetWidthPx * currentScale}px`,
            height: `${sheetHeightPx * currentScale}px`,
            position: 'relative',
            overflow: 'hidden',
          }}
          className="shadow-2xl rounded-xs bg-white"
        >
          <div
            style={{
              width: `${sheetWidthPx}px`,
              height: `${sheetHeightPx}px`,
              transform: `scale(${currentScale})`,
              transformOrigin: 'top left',
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
    </div>
  );
};
