import React, { useState } from 'react';
import { 
  FileText, 
  Printer, 
  Key, 
  Save, 
  FolderOpen, 
  Sparkles, 
  PlusCircle, 
  CheckCircle2, 
  Loader2,
  Download,
  ChevronDown
} from 'lucide-react';

interface HeaderProps {
  onNew: () => void;
  onOpenList: () => void;
  onOpenAIImport: () => void;
  onSave: () => void;
  onPrintStudent: () => void;
  onPrintKey: () => void;
  onDownloadStudentPDF: () => void;
  onDownloadKeyPDF: () => void;
  isSaving: boolean;
  saveStatusText: string;
}

export const Header: React.FC<HeaderProps> = ({
  onNew,
  onOpenList,
  onOpenAIImport,
  onSave,
  onPrintStudent,
  onPrintKey,
  onDownloadStudentPDF,
  onDownloadKeyPDF,
  isSaving,
  saveStatusText,
}) => {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg text-slate-900 tracking-tight">Worksheet Maker</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">2.0 OCR</span>
            </div>
            <p className="text-xs text-slate-500">For Google Classroom & Vision Autograder</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Status text */}
          {saveStatusText && (
            <div className="hidden md:flex items-center text-xs text-emerald-600 font-medium space-x-1 mr-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{saveStatusText}</span>
            </div>
          )}

          {/* New Button */}
          <button
            type="button"
            onClick={onNew}
            title="Create fresh worksheet"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          >
            <PlusCircle className="w-5 h-5" />
          </button>

          {/* Open Saved Worksheets */}
          <button
            type="button"
            onClick={onOpenList}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <FolderOpen className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">My Worksheets</span>
          </button>

          {/* AI / Document Import */}
          <button
            type="button"
            onClick={onOpenAIImport}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>AI / Paste</span>
          </button>

          {/* Save to Supabase */}
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg shadow-sm transition"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* PRIMARY: Print Test Directly (Browser Print Dialog) */}
          <button
            type="button"
            onClick={onPrintStudent}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-600/20 transition cursor-pointer"
            title="Open print dialog to send to copier/printer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Test</span>
          </button>

          {/* Print Answer Key */}
          <button
            type="button"
            onClick={onPrintKey}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition"
            title="Print Teacher Master with answers filled in"
          >
            <Key className="w-4 h-4 text-amber-600" />
            <span className="hidden md:inline">Print Key</span>
          </button>

          {/* Secondary: Download PDF Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition"
              title="Download PDF files"
            >
              <Download className="w-4 h-4" />
            </button>

            {showDownloadMenu && (
              <div
                className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 text-xs font-medium text-slate-700"
                onClick={() => setShowDownloadMenu(false)}
              >
                <button
                  type="button"
                  onClick={onDownloadStudentPDF}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center space-x-2"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Download Student PDF</span>
                </button>
                <button
                  type="button"
                  onClick={onDownloadKeyPDF}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center space-x-2"
                >
                  <Key className="w-3.5 h-3.5 text-amber-600" />
                  <span>Download Answer Key PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
