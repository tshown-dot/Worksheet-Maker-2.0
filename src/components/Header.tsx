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
  ChevronDown,
  LogOut,
  User as UserIcon,
  HardDrive
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
  user: any | null;
  onSignInWithGoogle: () => void;
  onSignOut: () => void;
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
  user,
  onSignInWithGoogle,
  onSignOut,
}) => {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

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

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Google Sign-in / User Account Button */}
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition cursor-pointer text-xs"
                title={`Signed in as ${user.email}`}
              >
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="User Avatar"
                    className="w-6 h-6 rounded-full object-cover border border-slate-300"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className="hidden lg:flex flex-col text-left">
                  <span className="font-bold text-slate-800 leading-tight truncate max-w-[120px]">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center space-x-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Drive Synced</span>
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserMenu && (
                <div
                  className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 text-xs font-medium text-slate-700"
                  onClick={() => setShowUserMenu(false)}
                >
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="font-bold text-slate-900 truncate">{user.user_metadata?.full_name || 'Teacher'}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                    <div className="mt-1.5 inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                      <HardDrive className="w-3 h-3 text-emerald-600" />
                      <span>Google Drive Saving Active</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 flex items-center space-x-2 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignInWithGoogle}
              className="flex items-center space-x-2 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition cursor-pointer"
              title="Sign in with your Google account to save worksheets directly to Google Drive"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
