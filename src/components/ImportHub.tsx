import React, { useState } from 'react';
import { Question } from '../types/worksheet';
import { 
  Sparkles, 
  FileText, 
  Copy, 
  Check, 
  ArrowRight, 
  FolderOpen, 
  PlusCircle, 
  AlertCircle
} from 'lucide-react';

interface ImportHubProps {
  onImportQuestions: (questions: Question[], title?: string) => void;
  onOpenBlank: () => void;
  onOpenSavedList: () => void;
}

export const ImportHub: React.FC<ImportHubProps> = ({
  onImportQuestions,
  onOpenBlank,
  onOpenSavedList,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedType, setCopiedType] = useState<'convert' | 'generate' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Prompt for Converting Existing Docs / Tests / PDFs
  const convertDocPrompt = `You are a middle school math curriculum assistant for Worksheet Maker 2.0. 
TASK: Extract all math problems from the attached document or text below into an OCR-ready worksheet format.
Return ONLY a valid JSON array in this exact schema (no conversational introduction, markdown notes, or code blocks):

[
  {
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
- For multiple choice, include an "options" list: [{"label": "A", "text": "10"}, {"label": "B", "text": "12"}].
- Output ONLY the raw JSON array.`;

  // 2. Prompt for Generating Brand New Content
  const generateNewPrompt = `You are a middle school math curriculum generator for Worksheet Maker 2.0.
TASK: Generate 6 high-quality math problems for middle school students on the requested topic.
Return ONLY a valid JSON array in this exact schema (no conversational introduction, markdown notes, or code blocks):

[
  {
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
- Include answer keys with acceptable alternatives and brief AI rubric notes.
- Output ONLY the raw JSON array.`;

  const handleCopy = (type: 'convert' | 'generate') => {
    const textToCopy = type === 'convert' ? convertDocPrompt : generateNewPrompt;
    navigator.clipboard.writeText(textToCopy);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  // ROBUST PARSER: Handles single backslashes from LLMs (Gemini, ChatGPT) like \frac, \div, \sqrt!
  const robustParseJson = (rawText: string): any => {
    let cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Fix single backslashes in LaTeX commands that crash standard JSON.parse
    cleaned = cleaned.replace(/\\([a-zA-Z]+|[0-9]+)/g, (match, cmd) => {
      if (['n', 'r', 't'].includes(cmd)) return match;
      return '\\\\' + cmd;
    });

    return JSON.parse(cleaned);
  };

  // Helper to extract options if LLM put "A) 10 B) 12" inside the prompt string
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

  const handleProcessImport = () => {
    setError(null);
    const raw = inputText.trim();
    if (!raw) {
      setError('Please paste your questions or JSON into the box below.');
      return;
    }

    try {
      // 1. Robust JSON parsing
      const parsed = robustParseJson(raw);
      const items = Array.isArray(parsed) ? parsed : parsed.questions || parsed.problems;

      if (Array.isArray(items) && items.length > 0) {
        const questions: Question[] = items.map((item, idx) => {
          let prompt = String(item.prompt || item.question || `Problem ${idx + 1}`);
          let options = item.options || [];
          let qType = item.question_type || 'numeric';

          // If multiple choice and options are embedded in the prompt string
          if (qType === 'multiple_choice' && (!options || options.length === 0)) {
            const extracted = parseOptionsFromPrompt(prompt);
            if (extracted.options.length > 0) {
              prompt = extracted.cleanPrompt;
              options = extracted.options;
            }
          }

          return {
            id: crypto.randomUUID(),
            order_index: idx + 1,
            page_number: item.page_number || 1,
            prompt,
            question_type: qType,
            options,
            correct_answer: String(item.correct_answer || item.answer || ''),
            acceptable_alternatives: item.acceptable_alternatives || [],
            points: Number(item.points) || (qType === 'multi_step' ? 3 : 2),
            rubric_notes: item.rubric_notes || item.explanation || '',
          };
        });

        onImportQuestions(questions);
        return;
      }
    } catch {
      // JSON parse failed, try text list fallback
    }

    // 2. Fallback: Parse plain text numbered lists (from Google Docs or PDF copy-paste)
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
          placeholder={`Paste what Gemini, ChatGPT, or Claude gives you here:\n\n[\n  {\n    "prompt": "Solve for x: 2x - 5 = 11",\n    "question_type": "numeric",\n    "correct_answer": "8"\n  }\n]`}
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
