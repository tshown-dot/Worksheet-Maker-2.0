import React, { useState } from 'react';
import { Question, StylePreset } from '../types/worksheet';
import { supabase } from '../lib/supabase';
import { 
  Sparkles, 
  FileText, 
  Copy, 
  Check, 
  ArrowRight, 
  FolderOpen, 
  PlusCircle, 
  AlertCircle,
  Calendar,
  Layers
} from 'lucide-react';

interface ImportHubProps {
  onImportQuestions: (questions: Question[], metadata?: { title?: string; stylePreset?: StylePreset; totalPages?: 1 | 2 }) => void;
  onOpenBlank: () => void;
  onOpenSavedList: () => void;
}

interface AssignmentGroup {
  name: string;
  items: any[];
}

export const ImportHub: React.FC<ImportHubProps> = ({
  onImportQuestions,
  onOpenBlank,
  onOpenSavedList,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedType, setCopiedType] = useState<'convert' | 'generate' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectedGroups, setDetectedGroups] = useState<AssignmentGroup[] | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveAllMessage, setSaveAllMessage] = useState('');

  // 1. Prompt for Converting Existing Docs / Tests / PDFs
  const convertDocPrompt = `You are a middle school math curriculum assistant for Worksheet Maker 2.0. 
TASK: Extract all math problems from the attached document or text below into an OCR-ready worksheet format.
Return ONLY a valid JSON array in this exact schema (no conversational text or markdown code blocks):

[
  {
    "assignmentName": "Math 6 Quiz: Equations",
    "prompt": "Solve for x: 3x - 5 = 16",
    "question_type": "numeric",
    "correct_answer": "7",
    "acceptable_alternatives": ["x = 7", "7"],
    "points": 2,
    "rubric_notes": "1 pt for subtracting/adding, 1 pt for division."
  }
]

RULES:
- "question_type" must be one of: "numeric", "fraction", "expression", "multiple_choice", or "multi_step".
- Use standard LaTeX for fractions and equations (e.g. \\frac{a}{b}, x^2, \\sqrt{x}). Do not add raw \\quad spacing.
- For multiple choice, include "options": [{"label": "A", "text": "10"}, {"label": "B", "text": "12"}].
- Output ONLY the raw JSON array.`;

  // 2. Prompt for Generating Brand New Content
  const generateNewPrompt = `You are a middle school math curriculum generator for Worksheet Maker 2.0.
TASK: Generate high-quality math problems for middle school students on the requested topic.
Return ONLY a valid JSON array in this exact schema (no conversational text or markdown code blocks):

[
  {
    "assignmentName": "Math 6 POD: Ratios",
    "prompt": "Solve for x: \\frac{x}{3} + 4 = 10",
    "question_type": "numeric",
    "correct_answer": "18",
    "acceptable_alternatives": ["x = 18", "18"],
    "points": 2,
    "rubric_notes": "1 pt for subtracting 4 (x/3 = 6), 1 pt for multiplying by 3."
  }
]

RULES:
- "question_type" must be one of: "numeric", "fraction", "expression", "multiple_choice", or "multi_step".
- Use standard LaTeX for fractions and equations (e.g. \\frac{a}{b}, x^2, \\sqrt{x}). Do not add raw \\quad spacing.
- For multiple choice, include "options": [{"label": "A", "text": "10"}, {"label": "B", "text": "12"}].
- Output ONLY the raw JSON array.`;

  const handleCopy = (type: 'convert' | 'generate') => {
    const textToCopy = type === 'convert' ? convertDocPrompt : generateNewPrompt;
    navigator.clipboard.writeText(textToCopy);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  // ROBUST PARSER: Safely escapes single backslashes without corrupting already-escaped double backslashes
  const robustParseJson = (rawText: string): any => {
    let cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Lookbehind regex: Only escapes a backslash if it is NOT preceded by a backslash
    // and NOT followed by a valid JSON escape char (" \ / b f n r t u)
    cleaned = cleaned.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, '\\\\');

    return JSON.parse(cleaned);
  };

  const parseOptionsFromPrompt = (prompt: string) => {
    const mcRegex = /(?:^|\s+)([A-D])[\)\.]\s*([^A-D\)\.]+?)(?=\s+[A-D][\)\.]|$)/gi;
    const options: { label: string; text: string }[] = [];
    let match: RegExpExecArray | null;

    const firstMatchIdx = prompt.search(/(?:^|\s+)[A-D][\)\.]/i);
    const cleanPrompt = firstMatchIdx !== -1 ? prompt.substring(0, firstMatchIdx).trim() : prompt;

    while ((match = mcRegex.exec(prompt)) !== null) {
      options.push({
        label: match[1].toUpperCase(),
        text: match[2].trim(),
      });
    }

    return { cleanPrompt, options };
  };

  const convertRawItemsToQuestions = (items: any[]): { questions: Question[]; totalPages: 1 | 2 } => {
    const totalCount = items.length;
    const totalPages: 1 | 2 = totalCount > 6 ? 2 : 1;
    const perPageLimit = totalPages === 2 ? Math.ceil(totalCount / 2) : totalCount;

    const questions: Question[] = items.map((item, idx) => {
      let prompt = String(item.prompt || item.question || `Problem ${idx + 1}`);
      let options = item.options || [];
      let qType = item.question_type || 'numeric';

      if (qType === 'multiple_choice' && (!options || options.length === 0)) {
        const extracted = parseOptionsFromPrompt(prompt);
        if (extracted.options.length > 0) {
          prompt = extracted.cleanPrompt;
          options = extracted.options;
        }
      }

      const pageNumber = totalPages === 2 && idx >= perPageLimit ? 2 : 1;

      return {
        id: crypto.randomUUID(),
        order_index: idx + 1,
        page_number: pageNumber,
        prompt,
        question_type: qType,
        options,
        correct_answer: String(item.correct_answer || item.answer || ''),
        acceptable_alternatives: item.acceptable_alternatives || [],
        points: Number(item.points) || (qType === 'multi_step' ? 3 : 2),
        rubric_notes: item.rubric_notes || item.explanation || '',
      };
    });

    return { questions, totalPages };
  };

  const handleProcessImport = () => {
    setError(null);
    setDetectedGroups(null);
    const raw = inputText.trim();
    if (!raw) {
      setError('Please paste your questions or JSON into the box below.');
      return;
    }

    try {
      const parsed = robustParseJson(raw);
      const items: any[] = Array.isArray(parsed) ? parsed : parsed.questions || parsed.problems;

      if (Array.isArray(items) && items.length > 0) {
        // Check if there are multiple assignments bundled together (e.g. Mon, Tue, Wed...)
        const groupMap: { [key: string]: any[] } = {};
        for (const it of items) {
          const grpName = it.assignmentName || 'Main Assignment';
          if (!groupMap[grpName]) groupMap[grpName] = [];
          groupMap[grpName].push(it);
        }

        const groupKeys = Object.keys(groupMap);
        if (groupKeys.length > 1) {
          // Multiple assignments detected! Show assignment picker
          const groups: AssignmentGroup[] = groupKeys.map((name) => ({
            name,
            items: groupMap[name],
          }));
          setDetectedGroups(groups);
          return;
        }

        // Single assignment
        const title = items[0]?.assignmentName || undefined;
        const isPod = title ? title.toLowerCase().includes('pod') || title.toLowerCase().includes('problem of the day') : false;
        const { questions, totalPages } = convertRawItemsToQuestions(items);

        onImportQuestions(questions, {
          title,
          stylePreset: isPod ? 'pod' : 'homework',
          totalPages,
        });
        return;
      }
    } catch (e: any) {
      console.error(e);
    }

    // 2. Fallback: Parse plain text numbered lists
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const questions: Question[] = [];
    let currentQ: Partial<Question> | null = null;
    let qCounter = 1;

    for (const line of lines) {
      const qMatch = line.match(/^(\d+)[\.\)]\s*(.*)/i) || line.match(/^question\s*(\d+)[:\.]?\s*(.*)/i) || line.match(/^problem\s*(\d+)[:\.]?\s*(.*)/i);
      const ansMatch = line.match(/^(?:ans|answer|correct|key)[:\s]+(.*)/i);

      if (qMatch) {
        if (currentQ && currentQ.prompt) {
          questions.push(finalizeQuestion(currentQ, qCounter++));
        }
        currentQ = {
          prompt: qMatch[2] || line,
          correct_answer: '',
          question_type: 'numeric',
          points: 2,
        };
      } else if (ansMatch && currentQ) {
        currentQ.correct_answer = ansMatch[1].trim();
      } else if (currentQ) {
        currentQ.prompt = (currentQ.prompt ? currentQ.prompt + ' ' : '') + line;
      } else {
        currentQ = {
          prompt: line,
          correct_answer: '',
          question_type: 'numeric',
          points: 2,
        };
      }
    }

    if (currentQ && currentQ.prompt) {
      questions.push(finalizeQuestion(currentQ, qCounter));
    }

    if (questions.length > 0) {
      onImportQuestions(questions);
    } else {
      setError('Could not parse the pasted text. Please verify the format or copy the AI prompt above.');
    }
  };

  const handleSelectGroup = (group: AssignmentGroup) => {
    const isPod = group.name.toLowerCase().includes('pod') || group.name.toLowerCase().includes('problem of the day');
    const { questions, totalPages } = convertRawItemsToQuestions(group.items);

    onImportQuestions(questions, {
      title: group.name,
      stylePreset: isPod ? 'pod' : 'homework',
      totalPages,
    });
  };

  // One-click batch save all assignments to Supabase!
  const handleSaveAllGroups = async () => {
    if (!detectedGroups || detectedGroups.length === 0) return;
    setIsSavingAll(true);
    setSaveAllMessage('Saving assignments to your Supabase folder...');

    try {
      for (const group of detectedGroups) {
        const isPod = group.name.toLowerCase().includes('pod');
        const code = 'M' + Math.floor(1000 + Math.random() * 9000);
        const { questions, totalPages } = convertRawItemsToQuestions(group.items);

        const { data: wsData, error: wsError } = await supabase
          .from('worksheets')
          .insert({
            short_code: code,
            title: group.name,
            subject: 'Mathematics',
            grade_level: '6th Grade',
            folder_name: 'Daily Warm-Ups (POD)',
            style_preset: isPod ? 'pod' : 'homework',
            total_pages: totalPages,
            columns: 2,
            student_id_digits: 3,
            layout_config: { columns: 2, spacing: 'balanced' },
          })
          .select('id')
          .single();

        if (wsError) throw wsError;

        if (wsData && wsData.id) {
          const qPayload = questions.map((q) => ({
            worksheet_id: wsData.id,
            order_index: q.order_index,
            page_number: q.page_number,
            prompt: q.prompt,
            question_type: q.question_type,
            options: q.options,
            correct_answer: q.correct_answer,
            acceptable_alternatives: q.acceptable_alternatives,
            points: q.points,
            rubric_notes: q.rubric_notes,
            bounding_box: {},
          }));
          await supabase.from('questions').insert(qPayload);
        }
      }

      setSaveAllMessage(`🎉 All ${detectedGroups.length} assignments successfully saved to "Daily Warm-Ups (POD)"!`);
      setTimeout(() => {
        setIsSavingAll(false);
        // Load the first one
        handleSelectGroup(detectedGroups[0]);
      }, 1500);
    } catch (err: any) {
      alert('Save all failed: ' + err.message);
      setIsSavingAll(false);
    }
  };

  const finalizeQuestion = (q: Partial<Question>, idx: number): Question => ({
    id: crypto.randomUUID(),
    order_index: idx,
    page_number: 1,
    prompt: q.prompt || `Problem ${idx}`,
    question_type: q.question_type || 'numeric',
    options: [],
    correct_answer: q.correct_answer || '',
    acceptable_alternatives: [],
    points: q.points || 2,
    rubric_notes: '',
  });

  return (
    <div className="max-w-4xl mx-auto w-full py-8 px-4 sm:px-6">
      {/* Hero Header */}
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-100/80 text-blue-800 text-xs font-bold tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>INSTANT OCR WORKSHEET BUILDER</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Turn Any Test, Doc, or AI Output into an OCR Worksheet
        </h2>
        <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto">
          Convert your existing PDFs or generate fresh curriculum problems in seconds. We format the fiducials, QR codes, and answer boxes automatically for automated grading.
        </p>
      </div>

      {/* MULTI-ASSIGNMENT BATCH DETECTOR MODAL / BANNER */}
      {detectedGroups && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-400 rounded-2xl p-6 shadow-md mb-6 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-blue-200 pb-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-blue-700" />
              <h3 className="font-extrabold text-slate-900 text-base">
                Found {detectedGroups.length} Daily Assignments in Your Paste!
              </h3>
            </div>
            <button
              type="button"
              onClick={handleSaveAllGroups}
              disabled={isSavingAll}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              {isSavingAll ? 'Saving to Cloud...' : '💾 Save All 5 to Folder'}
            </button>
          </div>

          <p className="text-xs text-slate-600">
            Click any day below to open and print it immediately, or save all 5 directly into your worksheets folder:
          </p>

          {saveAllMessage && (
            <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-lg">
              {saveAllMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {detectedGroups.map((grp) => (
              <div
                key={grp.name}
                onClick={() => handleSelectGroup(grp)}
                className="p-3.5 bg-white border border-blue-200 hover:border-blue-500 rounded-xl cursor-pointer hover:shadow-md transition flex flex-col justify-between group"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
                    ★ Problem of the Day
                  </span>
                  <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition">
                    {grp.name}
                  </h4>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {grp.items.length} Questions • 1 Page
                  </span>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600">
                  <span>Open & Print</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 1: Two Prominent Copy Prompt Action Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
            1
          </span>
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
            Choose What You Want to Do with AI (ChatGPT, Claude, or Gemini)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card A: Convert Existing Document */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 transition flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2 text-blue-900 font-bold text-sm mb-1">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Option A: Convert Existing Test / PDF</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Have an existing Word document or PDF test? Copy this prompt, attach your file in ChatGPT or Claude, and let AI extract the problems.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('convert')}
              className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition cursor-pointer"
            >
              {copiedType === 'convert' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedType === 'convert' ? 'Copied Prompt to Clipboard!' : 'Copy Prompt for Existing Doc'}</span>
            </button>
          </div>

          {/* Card B: Generate Brand New Problems */}
          <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 hover:bg-purple-50 transition flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2 text-purple-900 font-bold text-sm mb-1">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Option B: Generate Brand New Questions</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Need fresh problems? Copy this prompt into ChatGPT/Gemini and tell it what topic you need (e.g. *"6 two-step equations for 7th grade"*).
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('generate')}
              className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition cursor-pointer"
            >
              {copiedType === 'generate' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedType === 'generate' ? 'Copied Prompt to Clipboard!' : 'Copy Prompt to Generate New'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* STEP 2: Large Paste Box & Conversion Trigger */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              2
            </span>
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
              Paste the AI Output or Questions Here
            </h3>
          </div>
          <span className="text-xs text-slate-400">Accepts Gemini/ChatGPT JSON or standard text</span>
        </div>

        <textarea
          rows={8}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Paste what Gemini, ChatGPT, or Claude gives you here:\n\n[\n  {\n    "assignmentName": "Math 6 POD Mon 10/26",\n    "prompt": "Solve for x: 2x - 5 = 11",\n    "question_type": "numeric",\n    "correct_answer": "8"\n  }\n]`}
          className="w-full p-4 font-mono text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 transition"
        />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleProcessImport}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center justify-center space-x-2 shadow-md shadow-blue-600/20 transition cursor-pointer"
        >
          <span>Build My OCR Worksheet</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Alternate Secondary Paths */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-500">
        <span>Or skip import:</span>
        <button
          type="button"
          onClick={onOpenBlank}
          className="flex items-center space-x-1 text-slate-700 hover:text-blue-600 underline"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Start with a blank worksheet</span>
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={onOpenSavedList}
          className="flex items-center space-x-1 text-slate-700 hover:text-blue-600 underline"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
          <span>Open a saved worksheet from folders</span>
        </button>
      </div>
    </div>
  );
};
