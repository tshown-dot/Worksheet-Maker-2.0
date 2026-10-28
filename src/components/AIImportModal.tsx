import React, { useState } from 'react';
import { Question } from '../types/worksheet';
import { Sparkles, X, Copy, Check, AlertCircle, FileText } from 'lucide-react';

interface AIImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportQuestions: (questions: Question[]) => void;
}

export const AIImportModal: React.FC<AIImportModalProps> = ({
  isOpen,
  onClose,
  onImportQuestions,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const aiSystemPromptTemplate = `You are a middle school math curriculum assistant for Worksheet Maker 2.0.
TASK: Return a valid JSON array in this exact schema (no conversational text or markdown code blocks):

[
  {
    "prompt": "Solve for x: \\frac{x}{3} + 4 = 10",
    "question_type": "numeric",
    "standard": "6.EE.B.7",
    "correct_answer": "18",
    "acceptable_alternatives": ["x = 18", "18"],
    "points": 2,
    "rubric_notes": "1 pt for subtracting 4 (x/3 = 6), 1 pt for multiplying by 3."
  }
]

RULES:
- "standard" must be the middle school NJSLS / Common Core math standard (e.g. "6.NS.C.7a", "6.EE.B.7", "5.NF.B.6", "7.RP.A.2").
- Wrap inline math expressions in $...$ delimiters (e.g. "Evaluate $3x^2 - 4.5$ when $x = 2.4$."). Keep English words like "when" outside the $...$ delimiters, and do not add raw \\quad spacing.`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(aiSystemPromptTemplate);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const robustParseJson = (rawText: string): any => {
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/```(?:json)?/gi, '').replace(/```/g, '');

    const firstArray = cleaned.indexOf('[');
    const firstObj = cleaned.indexOf('{');
    let start = -1;
    if (firstArray !== -1 && firstObj !== -1) start = Math.min(firstArray, firstObj);
    else start = firstArray !== -1 ? firstArray : firstObj;

    const lastArray = cleaned.lastIndexOf(']');
    const lastObj = cleaned.lastIndexOf('}');
    const end = Math.max(lastArray, lastObj);

    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
    }

    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
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

  const handleProcessImport = () => {
    setError(null);
    const raw = inputText.trim();
    if (!raw) {
      setError('Please paste JSON or text before importing.');
      return;
    }

    try {
      const parsed = robustParseJson(raw);
      const items = Array.isArray(parsed) ? parsed : parsed.questions || parsed.problems;

      if (Array.isArray(items) && items.length > 0) {
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

          // Extract or infer standard
          let standard = item.standard || '';
          if (!standard && item.rubric_notes) {
            const stdMatch = String(item.rubric_notes).match(/([4-8]\.[A-Z]+\.[A-Z]+(?:\.[0-9a-zA-Z]+)?)/i);
            if (stdMatch) standard = stdMatch[1];
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
            standard: standard || undefined,
          };
        });

        onImportQuestions(questions);
        setInputText('');
        onClose();
        return;
      }
    } catch {}

    // Fallback: Parse plain text numbered lists
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const questions: Question[] = [];
    let currentQ: Partial<Question> | null = null;
    let qCounter = 1;

    for (const line of lines) {
      const qMatch = line.match(/^(\d+)[\.\)]\s*(.*)/i) || line.match(/^question\s*(\d+)[:\.]?\s*(.*)/i);
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
      setInputText('');
      onClose();
    } else {
      setError('Could not extract questions from the pasted text.');
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Add Questions via AI or Text</h3>
              <p className="text-xs text-slate-500">Paste Gemini, ChatGPT, or Claude output</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-purple-900 block">
                Using ChatGPT, Claude, or Gemini?
              </span>
              <span className="text-xs text-purple-700">
                Copy our custom AI prompt to get instant, formatted math problems.
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs transition shrink-0 ml-3 cursor-pointer"
            >
              {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPrompt ? 'Copied!' : 'Copy Prompt'}</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Paste JSON or Plain Text Below:</span>
            </label>
            <textarea
              rows={9}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Paste output from Gemini or ChatGPT here...`}
              className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-slate-800"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200/50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleProcessImport}
            className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm shadow-purple-600/20 transition cursor-pointer"
          >
            Add Questions to Worksheet
          </button>
        </div>
      </div>
    </div>
  );
};
