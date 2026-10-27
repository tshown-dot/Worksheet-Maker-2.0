import React from 'react';
import { Worksheet, StylePreset } from '../types/worksheet';
import { 
  GraduationCap, 
  Layers, 
  Hash, 
  QrCode 
} from 'lucide-react';

interface WorksheetSettingsProps {
  worksheet: Worksheet;
  onChange: (updated: Partial<Worksheet>) => void;
}

export const WorksheetSettings: React.FC<WorksheetSettingsProps> = ({
  worksheet,
  onChange,
}) => {
  const presets: { id: StylePreset; label: string; desc: string; icon: string }[] = [
    {
      id: 'homework',
      label: 'Homework',
      desc: 'Solid border, clean academic style',
      icon: '📝',
    },
    {
      id: 'pod',
      label: 'Problem of the Day',
      desc: 'Dashed border, grey background badges',
      icon: '★',
    },
    {
      id: 'quiz',
      label: 'Quiz / Test',
      desc: 'Formal header, points badges & honor pledge',
      icon: '📋',
    },
    {
      id: 'exit_ticket',
      label: 'Exit Ticket',
      desc: 'Punchy 1-2 question quick assessment',
      icon: '🎫',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
      {/* Title & Metadata Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-center">
        {/* Title */}
        <div className="md:col-span-6">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Worksheet Title
          </label>
          <input
            type="text"
            value={worksheet.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. Unit 3: Solving Two-Step Equations"
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
        </div>

        {/* Grade Level */}
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center space-x-1">
            <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
            <span>Grade Level</span>
          </label>
          <select
            value={worksheet.grade_level}
            onChange={(e) => onChange({ grade_level: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          >
            <option value="6th Grade">6th Grade Math</option>
            <option value="7th Grade">7th Grade Math</option>
            <option value="8th Grade">8th Grade Math</option>
            <option value="Algebra 1">Algebra 1</option>
            <option value="Geometry">Geometry</option>
            <option value="Middle School">Middle School Math</option>
          </select>
        </div>

        {/* Short Code & QR Badge */}
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center space-x-1">
            <QrCode className="w-3.5 h-3.5 text-blue-600" />
            <span>Assignment Code</span>
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={worksheet.short_code}
              onChange={(e) => onChange({ short_code: e.target.value.toUpperCase() })}
              maxLength={10}
              className="w-full px-3 py-2 bg-blue-50/50 border border-blue-200 text-blue-800 font-mono font-bold text-sm rounded-lg uppercase tracking-wider focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Style Presets & Page Controls */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        {/* Presets selector buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1 hidden sm:inline">
            Style Theme:
          </span>
          {presets.map((p) => {
            const isSelected = worksheet.style_preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange({ style_preset: p.id })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title={p.desc}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Pages & ID Digits */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Total Pages Toggle */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-lg">
            <Layers className="w-3.5 h-3.5 text-slate-500 ml-1" />
            <button
              type="button"
              onClick={() => onChange({ total_pages: 1 })}
              className={`px-2 py-0.5 rounded font-medium ${
                worksheet.total_pages === 1
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1 Page
            </button>
            <button
              type="button"
              onClick={() => onChange({ total_pages: 2 })}
              className={`px-2 py-0.5 rounded font-medium ${
                worksheet.total_pages === 2
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2 Pages
            </button>
          </div>

          {/* Student ID Digits */}
          <div className="flex items-center space-x-1 bg-slate-100 px-2 py-1 rounded-lg">
            <Hash className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-600 font-medium">Student ID:</span>
            <span className="font-bold text-slate-900">{worksheet.student_id_digits || 3} digits</span>
          </div>
        </div>
      </div>
    </div>
  );
};
