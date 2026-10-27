import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Worksheet, Question } from './types/worksheet';
import { Header } from './components/Header';
import { WorksheetSettings } from './components/WorksheetSettings';
import { QuestionCard } from './components/QuestionCard';
import { WorksheetPreview } from './components/WorksheetPreview';
import { WorksheetPage } from './components/WorksheetPage';
import { ImportHub } from './components/ImportHub';
import { AIImportModal } from './components/AIImportModal';
import { WorksheetListModal } from './components/WorksheetListModal';
import { generateWorksheetPDF } from './utils/pdfGenerator';
import { Plus, Eye, Edit3, Sparkles, ArrowLeft } from 'lucide-react';

const INITIAL_WORKSHEET: Worksheet = {
  id: '',
  short_code: 'ALG-701',
  folder_name: 'Unit 2: Expressions & Equations',
  title: 'Unit 3: Two-Step & Multi-Step Equations',
  subject: 'Mathematics',
  grade_level: '7th Grade',
  style_preset: 'homework',
  total_pages: 1,
  columns: 2,
  spacing: 'balanced',
  student_id_digits: 3,
  layout_config: {
    border_style: 'solid',
    header_style: 'clean',
    show_dot_grid: false,
    columns: 2,
    spacing: 'balanced',
    show_honor_pledge: false,
  },
  questions: [], // Starts empty so the Import Hub leads!
};

export function App() {
  const [worksheet, setWorksheet] = useState<Worksheet>(INITIAL_WORKSHEET);
  const [viewMode, setViewMode] = useState<'import' | 'editor'>('import');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatusText, setSaveStatusText] = useState('');
  const [isAIImportOpen, setIsAIImportOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [printIsAnswerKey, setPrintIsAnswerKey] = useState<boolean>(false);

  useEffect(() => {
    if (!worksheet.short_code) {
      const code = 'M' + Math.floor(1000 + Math.random() * 9000);
      setWorksheet((prev) => ({ ...prev, short_code: code }));
    }
  }, []);

  const handleUpdateWorksheet = (updated: Partial<Worksheet>) => {
    setWorksheet((prev) => ({ ...prev, ...updated }));
  };

  const handleAddQuestion = () => {
    const nextIndex = worksheet.questions.length + 1;
    const newQuestion: Question = {
      id: crypto.randomUUID(),
      order_index: nextIndex,
      page_number: 1,
      prompt: '',
      question_type: 'numeric',
      options: [],
      correct_answer: '',
      acceptable_alternatives: [],
      points: 1,
      rubric_notes: '',
    };
    setWorksheet((prev) => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));
  };

  const handleUpdateQuestion = (qId: string, updated: Partial<Question>) => {
    setWorksheet((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === qId ? { ...q, ...updated } : q)),
    }));
  };

  const handleDeleteQuestion = (qId: string) => {
    setWorksheet((prev) => {
      const filtered = prev.questions.filter((q) => q.id !== qId);
      const reindexed = filtered.map((q, idx) => ({ ...q, order_index: idx + 1 }));
      return { ...prev, questions: reindexed };
    });
  };

  const handleDuplicateQuestion = (qId: string) => {
    const target = worksheet.questions.find((q) => q.id === qId);
    if (!target) return;
    const duplicate: Question = {
      ...target,
      id: crypto.randomUUID(),
      order_index: worksheet.questions.length + 1,
    };
    setWorksheet((prev) => ({
      ...prev,
      questions: [...prev.questions, duplicate],
    }));
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= worksheet.questions.length) return;

    const list = [...worksheet.questions];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const reindexed = list.map((q, idx) => ({ ...q, order_index: idx + 1 }));
    setWorksheet((prev) => ({ ...prev, questions: reindexed }));
  };

  // When questions are imported from the leading ImportHub
  const handleHubImport = (imported: Question[]) => {
    setWorksheet((prev) => ({
      ...prev,
      questions: imported,
    }));
    setViewMode('editor');
  };

  const handleModalImport = (imported: Question[]) => {
    setWorksheet((prev) => {
      const startIndex = prev.questions.length;
      const reindexed = imported.map((q, idx) => ({
        ...q,
        order_index: startIndex + idx + 1,
      }));
      return {
        ...prev,
        questions: [...prev.questions, ...reindexed],
      };
    });
  };

  const handleSaveToSupabase = async () => {
    setIsSaving(true);
    setSaveStatusText('');
    try {
      let wsId = worksheet.id;
      if (!wsId) {
        const { data: existing } = await supabase
          .from('worksheets')
          .select('id')
          .eq('short_code', worksheet.short_code)
          .maybeSingle();

        if (existing) {
          wsId = existing.id;
        }
      }

      const wsPayload = {
        short_code: worksheet.short_code,
        title: worksheet.title,
        subject: worksheet.subject,
        grade_level: worksheet.grade_level,
        folder_name: worksheet.folder_name || 'General',
        style_preset: worksheet.style_preset,
        total_pages: worksheet.total_pages,
        columns: worksheet.columns || 2,
        student_id_digits: worksheet.student_id_digits,
        layout_config: {
          ...worksheet.layout_config,
          columns: worksheet.columns || 2,
          spacing: worksheet.spacing || 'balanced',
        },
        updated_at: new Date().toISOString(),
      };

      let savedId = wsId;
      if (wsId) {
        const { error } = await supabase.from('worksheets').update(wsPayload).eq('id', wsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('worksheets')
          .insert(wsPayload)
          .select('id')
          .single();
        if (error) throw error;
        savedId = data.id;
      }

      setWorksheet((prev) => ({ ...prev, id: savedId }));

      if (savedId) {
        await supabase.from('questions').delete().eq('worksheet_id', savedId);

        const qPayload = worksheet.questions.map((q, idx) => ({
          worksheet_id: savedId,
          order_index: idx + 1,
          page_number: q.page_number || 1,
          prompt: q.prompt,
          diagram_url: q.diagram_url || null,
          question_type: q.question_type,
          options: q.options || [],
          correct_answer: q.correct_answer,
          acceptable_alternatives: q.acceptable_alternatives || [],
          points: q.points || 1,
          rubric_notes: q.rubric_notes || '',
          bounding_box: q.bounding_box || {},
        }));

        const { error: qError } = await supabase.from('questions').insert(qPayload);
        if (qError) throw qError;
      }

      setSaveStatusText('Saved to Supabase!');
      setTimeout(() => setSaveStatusText(''), 3000);
    } catch (err: any) {
      console.error(err);
      alert('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = (isKey: boolean) => {
    setPrintIsAnswerKey(isKey);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleDownloadStudentPDF = async () => {
    try {
      const doc = await generateWorksheetPDF(worksheet, { isAnswerKey: false });
      const filename = `${worksheet.short_code}_${worksheet.title.replace(/[^a-zA-Z0-9]/g, '_')}_Student.pdf`;
      doc.save(filename);
    } catch (err: any) {
      alert('PDF download error: ' + err.message);
    }
  };

  const handleDownloadKeyPDF = async () => {
    try {
      const doc = await generateWorksheetPDF(worksheet, { isAnswerKey: true });
      const filename = `${worksheet.short_code}_${worksheet.title.replace(/[^a-zA-Z0-9]/g, '_')}_AnswerKey.pdf`;
      doc.save(filename);
    } catch (err: any) {
      alert('PDF download error: ' + err.message);
    }
  };

  const handleNewWorksheet = () => {
    const code = 'M' + Math.floor(1000 + Math.random() * 9000);
    setWorksheet({
      ...INITIAL_WORKSHEET,
      id: '',
      short_code: code,
      title: 'Untitled Math Worksheet',
      questions: [],
    });
    setViewMode('import'); // Return to the high-conversion import hub
  };

  const totalPages = worksheet.total_pages || 1;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* App Header */}
      <Header
        onNew={handleNewWorksheet}
        onOpenList={() => setIsListModalOpen(true)}
        onOpenAIImport={() => setIsAIImportOpen(true)}
        onSave={handleSaveToSupabase}
        onPrintStudent={() => handlePrint(false)}
        onPrintKey={() => handlePrint(true)}
        onDownloadStudentPDF={handleDownloadStudentPDF}
        onDownloadKeyPDF={handleDownloadKeyPDF}
        isSaving={isSaving}
        saveStatusText={saveStatusText}
      />

      {/* VIEW MODE 1: THE LEADING IMPORT & CONVERSION HUB */}
      {viewMode === 'import' ? (
        <main className="flex-1 flex items-center justify-center">
          <ImportHub
            onImportQuestions={handleHubImport}
            onOpenBlank={() => setViewMode('editor')}
            onOpenSavedList={() => setIsListModalOpen(true)}
          />
        </main>
      ) : (
        /* VIEW MODE 2: THE RICH QUESTION EDITOR & LIVE PRINT PREVIEW */
        <main className="no-print flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Back to Import Hub & Switch bar */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMode('import')}
              className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Import Hub</span>
            </button>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsAIImportOpen(true)}
                className="px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center space-x-1.5 shadow-xs transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>+ Paste More Questions</span>
              </button>
            </div>
          </div>

          {/* Worksheet Metadata & Style Preset Bar */}
          <WorksheetSettings worksheet={worksheet} onChange={handleUpdateWorksheet} />

          {/* Mobile View Toggle Bar (Editor vs Print Preview) */}
          <div className="lg:hidden flex bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 transition ${
                activeTab === 'editor' ? 'bg-blue-600 text-white' : 'text-slate-600'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Question Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 transition ${
                activeTab === 'preview' ? 'bg-blue-600 text-white' : 'text-slate-600'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Sheet Preview</span>
            </button>
          </div>

          {/* Split Grid View (Editor Left, Live Preview Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT: Question Cards Editor */}
            <div
              className={`lg:col-span-6 xl:col-span-7 space-y-4 ${
                activeTab === 'editor' ? 'block' : 'hidden lg:block'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                  <span>Questions ({worksheet.questions.length})</span>
                  <span className="text-xs font-normal text-slate-500">
                    Total Points: {worksheet.questions.reduce((sum, q) => sum + (q.points || 1), 0)}
                  </span>
                </h3>

                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center space-x-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add 1 Problem</span>
                </button>
              </div>

              {/* Question Cards List */}
              <div className="space-y-4">
                {worksheet.questions.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200 space-y-3">
                    <p className="text-slate-500 text-sm">No questions in this worksheet yet.</p>
                    <button
                      type="button"
                      onClick={() => setViewMode('import')}
                      className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm"
                    >
                      Paste Questions from AI or Document
                    </button>
                  </div>
                ) : (
                  worksheet.questions.map((question, index) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      index={index}
                      totalQuestions={worksheet.questions.length}
                      totalPages={worksheet.total_pages || 1}
                      stylePreset={worksheet.style_preset}
                      onUpdate={(updated) => handleUpdateQuestion(question.id, updated)}
                      onDelete={() => handleDeleteQuestion(question.id)}
                      onDuplicate={() => handleDuplicateQuestion(question.id)}
                      onMoveUp={() => handleMoveQuestion(index, 'up')}
                      onMoveDown={() => handleMoveQuestion(index, 'down')}
                    />
                  ))
                )}

                {worksheet.questions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="w-full py-4 border-2 border-dashed border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/30 rounded-xl text-slate-600 hover:text-blue-700 font-bold text-sm flex items-center justify-center space-x-2 transition shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Another Math Problem</span>
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT: Live WYSIWYG Print Preview */}
            <div
              className={`lg:col-span-6 xl:col-span-5 sticky top-20 ${
                activeTab === 'preview' ? 'block' : 'hidden lg:block'
              }`}
            >
              <WorksheetPreview
                worksheet={worksheet}
                onPrint={handlePrint}
                onDownloadPDF={handleDownloadStudentPDF}
              />
            </div>
          </div>
        </main>
      )}

      {/* DEDICATED PRINTABLE CONTAINER (Only visible during print) */}
      <div className="printable-area hidden print:block">
        {Array.from({ length: totalPages }).map((_, idx) => (
          <WorksheetPage
            key={idx + 1}
            worksheet={worksheet}
            pageNum={idx + 1}
            isAnswerKey={printIsAnswerKey}
          />
        ))}
      </div>

      {/* Modals */}
      <AIImportModal
        isOpen={isAIImportOpen}
        onClose={() => setIsAIImportOpen(false)}
        onImportQuestions={handleModalImport}
      />

      <WorksheetListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        onSelectWorksheet={(ws) => {
          setWorksheet(ws);
          setViewMode('editor');
        }}
        onNew={handleNewWorksheet}
      />
    </div>
  );
}
