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

  const aiSystemPromptTemplate = `Please generate math questions for a worksheet. Return ONLY a valid JSON array in this exact format:
[
  {
    "prompt": "Solve for x: \\\\quad 3x - 5 = 16",
    "question_type": "numeric",
    "correct_answer": "7",
    "acceptable_alternatives": ["x = 7", "7"],
    "points": 2,
    "rubric_notes": "1 point for adding 5 (3x = 21), 1 point for dividing by 3."
  }
]`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(aiSystemPromptTemplate);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const handleProcessImport = () => {
    setError(null);
    const raw = inputText.trim();
    if (!raw) {
      setError('Please paste JSON or text before importing.');
      return;
    }

    try {
      // 1. Try parsing as JSON first
      let parsed: any;
      if (raw.startsWith('[') || raw.startsWith('{')) {
        // Strip markdown code blocks if present
        const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed) && parsed.questions) {
          parsed = parsed.questions;
        }
      }

      if (Array.isArray(parsed)) {
        const importedQuestions: Question[] = parsed.map((item, idx) => ({
          id: crypto.randomUUID(),
          order_index: idx + 1,
          page_number: item.page_number || 1,
          prompt: item.prompt || item.question || `Question ${idx + 1}`,
          question_type: item.question_type || 'numeric',
          options: item.options || [],
          correct_answer: String(item.correct_answer || item.answer || ''),
          acceptable_alternatives: item.acceptable_alternatives || [],
          points: Number(item.points) || 1,
          rubric_notes: item.rubric_notes || item.explanation || '',
        }));

        onImportQuestions(importedQuestions);
        setInputText('');
        onClose();
        return;
      }
    } catch {
      // Not pure JSON, fall back to plain text parser
    }

    // 2. Fallback: Parse plain text numbered lists (e.g., from Docs or PDF copy-paste)
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const questions: Question[] = [];
    let currentQ: Partial<Question> | null = null;
    let qCounter = 1;

    for (const line of lines) {
      // Detect question start: "1." or "1)" or "Question 1:"
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
          points: 1,
        };
      } else if (ansMatch && currentQ) {
        currentQ.correct_answer = ansMatch[1].trim();
      } else if (currentQ) {
        currentQ.prompt = (currentQ.prompt ? currentQ.prompt + ' ' : '') + line;
      } else {
        // First line wasn't numbered
        currentQ = {
          prompt: line,
          correct_answer: '',
          question_type: 'numeric',
          points: 1,
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
      setError('Could not extract questions from the pasted text. Try using the AI prompt template above.');
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
    points: q.points || 1,
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
              <h3 className="font-bold text-base text-slate-900">Import from AI, PDF, or Docs</h3>
              <p className="text-xs text-slate-500">Paste questions or LLM JSON to auto-build cards</p>
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
          {/* Quick AI Prompt Helper */}
          <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-purple-900 block">
                Using ChatGPT, Claude, or Gemini?
              </span>
              <span className="text-xs text-purple-700">
                Copy our custom AI prompt to get instant, perfectly formatted math problems.
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs transition shrink-0 ml-3"
            >
              {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPrompt ? 'Copied!' : 'Copy Prompt'}</span>
            </button>
          </div>

          {/* Paste area */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Paste JSON or Plain Text Below:</span>
            </label>
            <textarea
              rows={9}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Paste output from ChatGPT, or paste standard text from your Doc:\n\n1. Solve for x:  2x + 7 = 19\nAnswer: 6\n\n2. Solve for y:  y/4 - 3 = 5\nAnswer: 32`}
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
            className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm shadow-purple-600/20 transition"
          >
            Generate Question Cards
          </button>
        </div>
      </div>
    </div>
  );
};
