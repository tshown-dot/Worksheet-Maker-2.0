import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Worksheet } from '../types/worksheet';
import { 
  FolderOpen, 
  X, 
  Trash2, 
  ArrowRight, 
  Loader2, 
  Plus 
} from 'lucide-react';

interface WorksheetListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorksheet: (ws: Worksheet) => void;
  onNew: () => void;
}

export const WorksheetListModal: React.FC<WorksheetListModalProps> = ({
  isOpen,
  onClose,
  onSelectWorksheet,
  onNew,
}) => {
  const [worksheets, setWorksheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchWorksheets();
    }
  }, [isOpen]);

  const fetchWorksheets = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('worksheets')
        .select('id, short_code, title, subject, grade_level, style_preset, total_pages, student_id_digits, layout_config, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorksheets(data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch worksheets');
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async (wsId: string) => {
    setLoading(true);
    try {
      // Fetch worksheet metadata + questions
      const { data: wsData, error: wsError } = await supabase
        .from('worksheets')
        .select('*')
        .eq('id', wsId)
        .single();
      if (wsError) throw wsError;

      const { data: qData, error: qError } = await supabase
        .from('questions')
        .select('*')
        .eq('worksheet_id', wsId)
        .order('page_number', { ascending: true })
        .order('order_index', { ascending: true });
      if (qError) throw qError;

      const loaded: Worksheet = {
        id: wsData.id,
        short_code: wsData.short_code,
        title: wsData.title,
        subject: wsData.subject,
        grade_level: wsData.grade_level,
        style_preset: wsData.style_preset,
        total_pages: wsData.total_pages || 1,
        student_id_digits: wsData.student_id_digits || 3,
        layout_config: wsData.layout_config || {
          border_style: 'solid',
          header_style: 'clean',
          show_dot_grid: false,
          columns: 1,
          show_honor_pledge: false,
        },
        questions: (qData || []).map((q: any) => ({
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
          bounding_box: q.bounding_box,
        })),
      };

      onSelectWorksheet(loaded);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to load worksheet');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (wsId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this worksheet?')) return;
    try {
      const { error } = await supabase.from('worksheets').delete().eq('id', wsId);
      if (error) throw error;
      setWorksheets((prev) => prev.filter((w) => w.id !== wsId));
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">My Saved Worksheets</h3>
              <p className="text-xs text-slate-500">Stored in Supabase Cloud</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-3">
          {loading && worksheets.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-sm">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
              <span>Loading saved worksheets...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
              {error}
            </div>
          ) : worksheets.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No saved worksheets found. Create your first one!
            </div>
          ) : (
            worksheets.map((ws) => (
              <div
                key={ws.id}
                onClick={() => handleLoad(ws.id)}
                className="group p-4 bg-slate-50 hover:bg-blue-50/40 border border-slate-200 hover:border-blue-300 rounded-xl cursor-pointer transition flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                      {ws.short_code}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {ws.style_preset === 'pod'
                        ? '★ Problem of the Day'
                        : ws.style_preset === 'quiz'
                        ? 'Quiz / Test'
                        : ws.style_preset === 'exit_ticket'
                        ? 'Exit Ticket'
                        : 'Homework'}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition">
                    {ws.title}
                  </h4>
                  <div className="text-xs text-slate-500 flex items-center space-x-3 mt-1">
                    <span>{ws.subject} • {ws.grade_level}</span>
                    <span>• {ws.total_pages || 1} Page{(ws.total_pages || 1) > 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={(e) => handleDelete(ws.id, e)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete worksheet"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 flex items-center justify-center text-slate-500 transition">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onNew();
              onClose();
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Blank</span>
          </button>
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
  );
};
