import { 
  GraduationCap, 
  Layers, 
  Hash, 
  QrCode,
  Folder,
  Columns,
  Maximize2,
  Target
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Worksheet, StylePreset, SpacingMode } from '../types/worksheet';

interface WorksheetSettingsProps {
  worksheet: Worksheet;
  onChange: (updated: Partial<Worksheet>) => void;
}

export const WorksheetSettings: React.FC<WorksheetSettingsProps> = ({
  worksheet,
  onChange,
}) => {
  const [folders, setFolders] = useState<string[]>([]);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState('');

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const { data } = await supabase.from('folders').select('name').order('name');
      if (data && data.length > 0) {
        setFolders(data.map((f: any) => f.name));
      } else {
        setFolders(['General', 'Unit 1: Number Systems', 'Unit 2: Expressions & Equations', 'Daily Warm-Ups (POD)']);
      }
    } catch {
      setFolders(['General', 'Unit 1: Number Systems', 'Unit 2: Expressions & Equations', 'Daily Warm-Ups (POD)']);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderInput.trim()) return;
    const folderName = newFolderInput.trim();
    try {
      await supabase.from('folders').insert({ name: folderName });
    } catch {}
    if (!folders.includes(folderName)) {
      setFolders((prev) => [...prev, folderName].sort());
    }
    onChange({ folder_name: folderName });
    setNewFolderInput('');
    setIsAddingFolder(false);
  };

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
    <div className="no-print bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
      {/* Title & Metadata Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-center">
        {/* Title */}
        <div className="md:col-span-5">
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

        {/* Folder Selector */}
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <Folder className="w-3.5 h-3.5 text-amber-500" />
              <span>Folder / Unit</span>
            </span>
            {!isAddingFolder && (
              <button
                type="button"
                onClick={() => setIsAddingFolder(true)}
                className="text-[10px] text-blue-600 hover:text-blue-800 font-bold"
              >
                + New
              </button>
            )}
          </label>

          {isAddingFolder ? (
            <div className="flex space-x-1">
              <input
                type="text"
                autoFocus
                value={newFolderInput}
                onChange={(e) => setNewFolderInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') setIsAddingFolder(false);
                }}
                placeholder="Folder name..."
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-blue-400 rounded-lg focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleCreateFolder}
                className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setIsAddingFolder(false)}
                className="px-1.5 py-1 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            </div>
          ) : (
            <select
              value={worksheet.folder_name || 'General'}
              onChange={(e) => onChange({ folder_name: e.target.value })}
              className="w-full px-3 py-2 bg-amber-50/50 border border-amber-200/80 rounded-lg text-sm font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
            >
              {folders.map((f) => (
                <option key={f} value={f}>
                  📁 {f}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Grade Level */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center space-x-1">
            <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
            <span>Grade Level</span>
          </label>
          <select
            value={worksheet.grade_level}
            onChange={(e) => onChange({ grade_level: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          >
            <option value="6th Grade">6th Grade</option>
            <option value="7th Grade">7th Grade</option>
            <option value="8th Grade">8th Grade</option>
            <option value="Algebra 1">Algebra 1</option>
            <option value="Geometry">Geometry</option>
          </select>
        </div>

        {/* Short Code & QR Badge */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center space-x-1">
            <QrCode className="w-3.5 h-3.5 text-blue-600" />
            <span>Code</span>
          </label>
          <input
            type="text"
            value={worksheet.short_code}
            onChange={(e) => onChange({ short_code: e.target.value.toUpperCase() })}
            maxLength={10}
            className="w-full px-3 py-2 bg-blue-50/50 border border-blue-200 text-blue-800 font-mono font-bold text-sm rounded-lg uppercase tracking-wider focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Style Presets, Column Selector & Spacing Controls */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        {/* Presets selector buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1 hidden sm:inline">
            Style:
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
                    ? 'bg-blue-600 text-white shadow-xs'
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

        {/* Layout Customization Controls (Columns & Spacing) */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Columns Toggle (1 vs 2) */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
            <Columns className="w-3.5 h-3.5 text-slate-500 ml-1" />
            <button
              type="button"
              onClick={() => onChange({ columns: 1 })}
              className={`px-2 py-0.5 rounded font-bold transition ${
                (worksheet.columns || 1) === 1
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1 Col
            </button>
            <button
              type="button"
              onClick={() => onChange({ columns: 2 })}
              className={`px-2 py-0.5 rounded font-bold transition ${
                worksheet.columns === 2
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2 Col
            </button>
          </div>

          {/* Spacing Control */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
            <Maximize2 className="w-3.5 h-3.5 text-slate-500 ml-1" />
            {(['compact', 'balanced', 'spacious'] as SpacingMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onChange({ spacing: mode })}
                className={`px-2 py-0.5 rounded font-medium capitalize transition ${
                  (worksheet.spacing || 'balanced') === mode
                    ? 'bg-white text-blue-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Total Pages Toggle */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
            <Layers className="w-3.5 h-3.5 text-slate-500 ml-1" />
            <button
              type="button"
              onClick={() => onChange({ total_pages: 1 })}
              className={`px-2 py-0.5 rounded font-medium ${
                worksheet.total_pages === 1
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
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
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2 Pages
            </button>
          </div>

          {/* NJSLS Standards Tracking Toggle */}
          <button
            type="button"
            onClick={() => onChange({ track_standards: worksheet.track_standards === false ? true : false })}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
              worksheet.track_standards !== false
                ? 'bg-purple-50 text-purple-800 border-purple-300 shadow-xs'
                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
            }`}
            title="Toggle whether NJSLS math standards are tagged per problem and included on the Answer Key"
          >
            <Target className={`w-3.5 h-3.5 ${worksheet.track_standards !== false ? 'text-purple-600' : 'text-slate-400'}`} />
            <span>NJSLS Standards:</span>
            <span className={`px-1 py-0.2 rounded text-[10px] font-bold ${
              worksheet.track_standards !== false ? 'bg-purple-600 text-white' : 'bg-slate-300 text-slate-700'
            }`}>
              {worksheet.track_standards !== false ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Student ID Digits */}
          <div className="flex items-center space-x-1 bg-slate-100 px-2 py-1 rounded-lg">
            <Hash className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-600">ID:</span>
            <span className="font-bold text-slate-900">{worksheet.student_id_digits || 3} digits</span>
          </div>
        </div>
      </div>
    </div>
  );
};
