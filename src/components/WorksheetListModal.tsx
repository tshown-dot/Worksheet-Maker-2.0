import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Worksheet } from '../types/worksheet';
import { findWorksheetsDeletedInDrive, trashWorksheetInDrive } from '../utils/googleDrive';
import { generateBatchWorksheetsPDF } from '../utils/pdfGenerator';
import {
  FolderOpen,
  X,
  Trash2,
  ArrowRight,
  Loader2,
  Plus,
  Folder,
  Search,
  RefreshCw,
  Printer,
  Key,
  CheckSquare,
  Square,
  Download,
  Layers,
} from 'lucide-react';

interface WorksheetListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorksheet: (ws: Worksheet) => void;
  onBatchPrint?: (worksheets: Worksheet[], mode: 'student' | 'key' | 'both') => void;
  onNew: () => void;
  teacherId?: string | null;
  providerToken?: string | null;
  onDriveTokenExpired?: () => void;
}

export const WorksheetListModal: React.FC<WorksheetListModalProps> = ({
  isOpen,
  onClose,
  onSelectWorksheet,
  onBatchPrint,
  onNew,
  teacherId,
  providerToken,
  onDriveTokenExpired,
}) => {
  const [worksheets, setWorksheets] = useState<any[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Multi-select state for batch opening / printing
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSyncMessage(null);
      setSelectedIds([]);
      loadData(false);
    }
  }, [isOpen, teacherId]);

  const loadData = async (isManualSync = false) => {
    setLoading(true);
    if (isManualSync) setSyncingDrive(true);
    setError(null);
    try {
      // 1. Fetch folders
      const { data: folderData } = await supabase.from('folders').select('name').order('name');
      const folderSet = new Set<string>(folderData?.map((f: any) => f.name) || []);

      // 2. Fetch all saved worksheets (always accessible even if Google session expired!)
      const { data: wsData, error: wsError } = await supabase
        .from('worksheets')
        .select(
          'id, short_code, title, subject, grade_level, folder_name, style_preset, total_pages, columns, spacing, track_standards, student_id_digits, layout_config, created_at, teacher_id'
        )
        .order('created_at', { ascending: false });

      if (wsError) throw wsError;
      let currentList = wsData || [];

      for (const w of currentList) {
        if (w.folder_name) folderSet.add(w.folder_name);
      }
      if (folderSet.size === 0) folderSet.add('General');
      setFolders(Array.from(folderSet).sort());

      setWorksheets(currentList);
      setLoading(false);

      // 3. Background or manual two-way Google Drive reconciliation (never blocks opening!)
      if (currentList.length > 0 && isManualSync) {
        try {
          const { idsToDelete } = await findWorksheetsDeletedInDrive(providerToken, currentList);
          if (idsToDelete.length > 0) {
            await supabase.from('questions').delete().in('worksheet_id', idsToDelete);
            await supabase.from('worksheets').delete().in('id', idsToDelete);
            const deletedSet = new Set(idsToDelete);
            currentList = currentList.filter((w: any) => !deletedSet.has(w.id));
            setWorksheets(currentList);
            setSyncMessage(
              `🔄 Drive Sync: Removed ${idsToDelete.length} worksheet(s) that were deleted in Google Drive.`
            );
          } else {
            setSyncMessage('✓ Synced with Google Drive — all worksheets are up to date.');
          }
        } catch (driveErr: any) {
          console.warn('Drive reconciliation error:', driveErr);
          if (driveErr?.message === 'DRIVE_AUTH_EXPIRED' && onDriveTokenExpired) {
            onDriveTokenExpired();
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch worksheets');
      setLoading(false);
    } finally {
      setSyncingDrive(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const name = newFolderName.trim();
    try {
      await supabase.from('folders').insert({ name, teacher_id: teacherId || null });
      setFolders((prev) => Array.from(new Set([...prev, name])).sort());
      setSelectedFolder(name);
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (err: any) {
      alert('Could not create folder: ' + err.message);
    }
  };

  const handleDeleteFolder = async (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !confirm(
        `Are you sure you want to delete the folder "${folderName}"? Worksheets inside will move to General.`
      )
    )
      return;
    try {
      await supabase.from('folders').delete().eq('name', folderName);
      await supabase
        .from('worksheets')
        .update({ folder_name: 'General' })
        .eq('folder_name', folderName);
      setFolders((prev) => prev.filter((f) => f !== folderName));
      if (selectedFolder === folderName) setSelectedFolder('ALL');
      setWorksheets((prev) =>
        prev.map((w) => (w.folder_name === folderName ? { ...w, folder_name: 'General' } : w))
      );
    } catch (err: any) {
      alert('Delete folder failed: ' + err.message);
    }
  };

  // Helper to fetch full Worksheet objects with questions for 1 or many worksheet IDs
  const fetchFullWorksheets = async (wsIds: string[]): Promise<Worksheet[]> => {
    const { data: wsRows, error: wsError } = await supabase
      .from('worksheets')
      .select('*')
      .in('id', wsIds);
    if (wsError) throw wsError;

    const { data: qRows, error: qError } = await supabase
      .from('questions')
      .select('*')
      .in('worksheet_id', wsIds)
      .order('page_number', { ascending: true })
      .order('order_index', { ascending: true });
    if (qError) throw qError;

    const qByWs = new Map<string, any[]>();
    for (const q of qRows || []) {
      const list = qByWs.get(q.worksheet_id) || [];
      list.push(q);
      qByWs.set(q.worksheet_id, list);
    }

    const rowMap = new Map<string, any>((wsRows || []).map((r: any) => [r.id, r]));

    // Preserve the exact selection/list order
    return wsIds
      .map((id) => rowMap.get(id))
      .filter(Boolean)
      .map((wsData: any) => ({
        id: wsData.id,
        short_code: wsData.short_code,
        title: wsData.title,
        subject: wsData.subject,
        grade_level: wsData.grade_level,
        folder_name: wsData.folder_name || 'General',
        style_preset: wsData.style_preset,
        total_pages: wsData.total_pages || 1,
        columns: wsData.columns || wsData.layout_config?.columns || 2,
        spacing: wsData.spacing || wsData.layout_config?.spacing || 'balanced',
        track_standards: wsData.track_standards !== false,
        student_id_digits: wsData.student_id_digits || 3,
        layout_config: wsData.layout_config || {
          border_style: 'solid',
          header_style: 'clean',
          show_dot_grid: false,
          columns: 2,
          show_honor_pledge: false,
        },
        questions: (qByWs.get(wsData.id) || []).map((q: any) => ({
          id: q.id,
          order_index: q.order_index,
          page_number: q.page_number,
          prompt: q.prompt,
          diagram_url: q.diagram_url,
          question_type: q.question_type,
          options: q.options || [],
          correct_answer: q.correct_answer,
          acceptable_alternatives: q.acceptable_alternatives || [],
          points: q.points || 1,
          rubric_notes: q.rubric_notes || '',
          standard: q.standard || undefined,
          bounding_box: q.bounding_box,
        })),
      }));
  };

  const handleLoad = async (wsId: string) => {
    setLoading(true);
    try {
      const loadedList = await fetchFullWorksheets([wsId]);
      if (loadedList.length > 0) {
        onSelectWorksheet(loadedList[0]);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load worksheet');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrintSingle = async (
    wsId: string,
    mode: 'student' | 'key',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!onBatchPrint) return;
    setBatchLoading(true);
    try {
      const loadedList = await fetchFullWorksheets([wsId]);
      if (loadedList.length > 0) {
        onBatchPrint(loadedList, mode);
      }
    } catch (err: any) {
      alert('Quick print failed: ' + err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchPrintSelected = async (mode: 'student' | 'key' | 'both') => {
    if (selectedIds.length === 0 || !onBatchPrint) return;
    setBatchLoading(true);
    try {
      // Order selectedIds according to how they appear in filteredWorksheets (or worksheets)
      const orderedIds = worksheets
        .filter((w) => selectedIds.includes(w.id))
        .map((w) => w.id);
      const loadedList = await fetchFullWorksheets(orderedIds);
      if (loadedList.length > 0) {
        onBatchPrint(loadedList, mode);
      }
    } catch (err: any) {
      alert('Batch print failed: ' + err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchDownloadPDF = async (mode: 'student' | 'key' | 'both') => {
    if (selectedIds.length === 0) return;
    setBatchLoading(true);
    try {
      const orderedIds = worksheets
        .filter((w) => selectedIds.includes(w.id))
        .map((w) => w.id);
      const loadedList = await fetchFullWorksheets(orderedIds);
      if (loadedList.length > 0) {
        const doc = await generateBatchWorksheetsPDF(loadedList, mode);
        const suffix =
          mode === 'student' ? 'StudentPacket' : mode === 'key' ? 'AnswerKeys' : 'CompletePacket';
        doc.save(`Worksheet_Batch_${loadedList.length}_${suffix}.pdf`);
      }
    } catch (err: any) {
      alert('Batch PDF download failed: ' + err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleDelete = async (wsId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !confirm(
        'Are you sure you want to delete this worksheet (and move its Google Drive PDFs to Trash)?'
      )
    )
      return;
    try {
      const targetWs = worksheets.find((w) => w.id === wsId);
      await supabase.from('questions').delete().eq('worksheet_id', wsId);
      const { error } = await supabase.from('worksheets').delete().eq('id', wsId);
      if (error) throw error;
      setWorksheets((prev) => prev.filter((w) => w.id !== wsId));
      setSelectedIds((prev) => prev.filter((id) => id !== wsId));

      if (targetWs) {
        trashWorksheetInDrive(
          providerToken,
          targetWs.short_code,
          targetWs.layout_config?.drive_student_file_id,
          targetWs.layout_config?.drive_key_file_id
        ).catch((driveErr) => console.warn('Could not trash worksheet in Drive:', driveErr));
      }
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleBatchDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete ${selectedIds.length} selected worksheet(s)?`
      )
    )
      return;
    setBatchLoading(true);
    try {
      const targets = worksheets.filter((w) => selectedIds.includes(w.id));
      await supabase.from('questions').delete().in('worksheet_id', selectedIds);
      const { error } = await supabase.from('worksheets').delete().in('id', selectedIds);
      if (error) throw error;

      const delSet = new Set(selectedIds);
      setWorksheets((prev) => prev.filter((w) => !delSet.has(w.id)));
      setSelectedIds([]);

      for (const t of targets) {
        trashWorksheetInDrive(
          providerToken,
          t.short_code,
          t.layout_config?.drive_student_file_id,
          t.layout_config?.drive_key_file_id
        ).catch(() => {});
      }
    } catch (err: any) {
      alert('Batch delete failed: ' + err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleMoveWorksheetFolder = async (
    wsId: string,
    targetFolder: string,
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('worksheets')
        .update({ folder_name: targetFolder })
        .eq('id', wsId);
      if (error) throw error;
      setWorksheets((prev) =>
        prev.map((w) => (w.id === wsId ? { ...w, folder_name: targetFolder } : w))
      );
    } catch (err: any) {
      alert('Move failed: ' + err.message);
    }
  };

  const toggleSelectOne = (wsId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(wsId) ? prev.filter((id) => id !== wsId) : [...prev, wsId]
    );
  };

  // Filter worksheets by folder and search
  const filteredWorksheets = worksheets.filter((ws) => {
    const matchesFolder =
      selectedFolder === 'ALL' || (ws.folder_name || 'General') === selectedFolder;
    const matchesSearch =
      !searchQuery.trim() ||
      ws.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ws.short_code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  const allFilteredSelected =
    filteredWorksheets.length > 0 &&
    filteredWorksheets.every((ws) => selectedIds.includes(ws.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredWorksheets.map((w) => w.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const combined = new Set([...selectedIds, ...filteredWorksheets.map((w) => w.id)]);
      setSelectedIds(Array.from(combined));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[88vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-xs">
              <FolderOpen className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Worksheet Library & Batch Print Center
              </h3>
              <p className="text-xs text-slate-500">
                Check multiple worksheets to print a whole week or unit packet at once
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={syncingDrive || loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer disabled:opacity-50"
              title="Reconcile deleted files with Google Drive"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingDrive ? 'animate-spin' : ''}`} />
              <span>{syncingDrive ? 'Syncing Drive...' : 'Sync Drive'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between">
            <span>{syncMessage}</span>
            <button
              type="button"
              onClick={() => setSyncMessage(null)}
              className="text-emerald-600 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* BATCH PRINT ACTION BAR (Appears whenever 1+ worksheets are checked) */}
        {selectedIds.length > 0 && (
          <div className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-200 shrink-0" />
              <span className="text-xs sm:text-sm font-extrabold">
                {selectedIds.length} Worksheet{selectedIds.length > 1 ? 's' : ''} Selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-[11px] text-blue-200 hover:text-white underline ml-2 cursor-pointer"
              >
                Clear selection
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={batchLoading}
                onClick={() => handleBatchPrintSelected('student')}
                className="px-3.5 py-1.5 bg-white text-blue-700 hover:bg-blue-50 rounded-lg text-xs font-extrabold flex items-center space-x-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {batchLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                <span>Print {selectedIds.length} Student Copies</span>
              </button>

              <button
                type="button"
                disabled={batchLoading}
                onClick={() => handleBatchPrintSelected('key')}
                className="px-3 py-1.5 bg-amber-400 text-slate-950 hover:bg-amber-300 rounded-lg text-xs font-extrabold flex items-center space-x-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Print {selectedIds.length} Answer Keys</span>
              </button>

              <button
                type="button"
                disabled={batchLoading}
                onClick={() => handleBatchPrintSelected('both')}
                className="px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white border border-blue-400/40 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                title="Print each Student Worksheet followed immediately by its Answer Key"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Both (Student + Key)</span>
              </button>

              <button
                type="button"
                disabled={batchLoading}
                onClick={() => handleBatchDownloadPDF('student')}
                className="px-2.5 py-1.5 bg-blue-800/80 hover:bg-blue-900 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition cursor-pointer disabled:opacity-50"
                title="Download combined multi-worksheet PDF packet"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Combined PDF</span>
              </button>

              <button
                type="button"
                disabled={batchLoading}
                onClick={handleBatchDeleteSelected}
                className="p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg text-xs transition cursor-pointer disabled:opacity-50"
                title="Delete selected worksheets"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Search & Top Action Bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Select All Checkbox */}
          <button
            type="button"
            onClick={toggleSelectAllFiltered}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            {allFilteredSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {allFilteredSelected
                ? 'Unselect All'
                : `Select All in Folder (${filteredWorksheets.length})`}
            </span>
          </button>

          {/* Search box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search worksheets by title or code (e.g. POD, Mon, M8539)..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* New Folder Button */}
          {!isCreatingFolder ? (
            <button
              type="button"
              onClick={() => setIsCreatingFolder(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Folder</span>
            </button>
          ) : (
            <div className="flex items-center space-x-1.5">
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') setIsCreatingFolder(false);
                }}
                placeholder="Folder name..."
                className="px-2.5 py-1 text-xs border border-amber-400 rounded-lg focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={handleCreateFolder}
                className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(false)}
                className="px-1.5 py-1 text-slate-400 text-xs"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Main Body (Folder Sidebar + Worksheet List) */}
        <div className="flex-1 flex overflow-hidden">
          {/* FOLDERS SIDEBAR */}
          <div className="w-56 bg-slate-50 border-r border-slate-200 p-3 overflow-y-auto space-y-1 shrink-0 hidden sm:block">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-2">
              Folders
            </span>

            {/* All Worksheets tab */}
            <button
              type="button"
              onClick={() => setSelectedFolder('ALL')}
              className={`w-full px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
                selectedFolder === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-4 h-4" />
                <span>All Worksheets</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedFolder === 'ALL' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {worksheets.length}
              </span>
            </button>

            {/* Individual Folders */}
            {folders.map((folder) => {
              const count = worksheets.filter(
                (w) => (w.folder_name || 'General') === folder
              ).length;
              const isSelected = selectedFolder === folder;
              return (
                <div
                  key={folder}
                  onClick={() => setSelectedFolder(folder)}
                  className={`group w-full px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition ${
                    isSelected
                      ? 'bg-amber-100 text-amber-950 border border-amber-300'
                      : 'text-slate-700 hover:bg-slate-200/60'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <Folder
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-amber-700' : 'text-amber-500'
                      }`}
                    />
                    <span className="truncate">{folder}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                    {folder !== 'General' && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteFolder(folder, e)}
                        title="Delete folder"
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* WORKSHEETS LIST */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-2.5 bg-white">
            {/* Quick Folder Navigation Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedFolder('ALL')}
                className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition ${
                  selectedFolder === 'ALL'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({worksheets.length})
              </button>
              {folders.map((f) => {
                const count = worksheets.filter((w) => (w.folder_name || 'General') === f).length;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSelectedFolder(f)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition flex items-center space-x-1.5 ${
                      selectedFolder === f
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>📁 {f}</span>
                    <span className="text-[10px] opacity-80 font-bold">({count})</span>
                  </button>
                );
              })}
            </div>

            {loading && worksheets.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-sm">
                <Loader2 className="w-7 h-7 animate-spin text-blue-600 mb-2" />
                <span>Loading worksheets...</span>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {error}
              </div>
            ) : filteredWorksheets.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm flex flex-col items-center">
                <FolderOpen className="w-10 h-10 text-slate-300 mb-2 stroke-1" />
                <span>No worksheets found in this folder.</span>
              </div>
            ) : (
              filteredWorksheets.map((ws) => {
                const isChecked = selectedIds.includes(ws.id);
                return (
                  <div
                    key={ws.id}
                    onClick={() => handleLoad(ws.id)}
                    className={`group p-3.5 border rounded-xl cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
                      isChecked
                        ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-300'
                        : 'bg-slate-50 hover:bg-blue-50/30 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0">
                      {/* Multi-select checkbox */}
                      <button
                        type="button"
                        onClick={(e) => toggleSelectOne(ws.id, e)}
                        className="mt-0.5 sm:mt-0 p-1 rounded hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition shrink-0 cursor-pointer"
                        title="Select for batch printing"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1 flex-wrap gap-1">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                            {ws.short_code}
                          </span>
                          {ws.folder_name && (
                            <span className="text-xs font-medium px-2 py-0.5 bg-amber-100/70 text-amber-900 border border-amber-200 rounded-md flex items-center space-x-1">
                              <Folder className="w-3 h-3 text-amber-600 inline shrink-0" />
                              <span>{ws.folder_name}</span>
                            </span>
                          )}
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            {ws.style_preset === 'spiral'
                              ? '🔄 Spiral Review'
                              : ws.style_preset === 'classwork'
                              ? '✏️ Classwork'
                              : ws.style_preset === 'pod'
                              ? '★ Problem of the Day'
                              : ws.style_preset === 'quiz'
                              ? 'Quiz / Test'
                              : ws.style_preset === 'exit_ticket'
                              ? 'Exit Ticket'
                              : '🔄 Spiral Review'}
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition truncate">
                          {ws.title}
                        </h4>
                        <div className="text-xs text-slate-500 flex items-center space-x-3 mt-0.5">
                          <span>
                            {ws.subject} • {ws.grade_level}
                          </span>
                          <span>
                            • {ws.total_pages || 1} Page{(ws.total_pages || 1) > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions: Quick Print + Quick Key + Move to Folder + Delete + Open */}
                    <div
                      className="flex items-center space-x-1.5 self-end sm:self-center shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {onBatchPrint && (
                        <>
                          <button
                            type="button"
                            disabled={batchLoading}
                            onClick={(e) => handleQuickPrintSingle(ws.id, 'student', e)}
                            className="px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-200 rounded-lg flex items-center space-x-1 transition cursor-pointer"
                            title="Print Student Copy immediately"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Print</span>
                          </button>
                          <button
                            type="button"
                            disabled={batchLoading}
                            onClick={(e) => handleQuickPrintSingle(ws.id, 'key', e)}
                            className="px-2 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-500 hover:text-white border border-amber-200 rounded-lg flex items-center space-x-1 transition cursor-pointer"
                            title="Print Answer Key immediately"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Key</span>
                          </button>
                        </>
                      )}

                      {/* Move to Folder Dropdown */}
                      <select
                        value={ws.folder_name || 'General'}
                        onChange={(e) => handleMoveWorksheetFolder(ws.id, e.target.value, e)}
                        className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-700 font-medium hover:border-amber-400 focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-2xs max-w-[130px]"
                        title="Move to another folder"
                      >
                        {folders.map((f) => (
                          <option key={f} value={f}>
                            📁 {f}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(ws.id, e)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete worksheet"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoad(ws.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 flex items-center space-x-1 text-xs font-bold text-slate-600 transition shadow-2xs"
                        title="Open worksheet in editor"
                      >
                        <span>Edit</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onNew();
              onClose();
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Blank Worksheet</span>
          </button>
          <div className="flex items-center space-x-3">
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Tip: Check multiple boxes above to print an entire week of assignments in one click!
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
