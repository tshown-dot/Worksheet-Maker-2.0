import React, { useState } from 'react';
import { Question, QuestionType, StylePreset } from '../types/worksheet';
import { MathText } from '../utils/mathRenderer';
import { NJSLS_STANDARDS, getStandardDescription } from '../utils/standards';
import { 
  Trash2, 
  Copy, 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  Check, 
  Sparkles,
  ListOrdered,
  Target
} from 'lucide-react';

interface QuestionCardProps {
  question: Question;
  index: number;
  totalQuestions: number;
  totalPages: number;
  stylePreset: StylePreset;
  trackStandards?: boolean;
  onUpdate: (updated: Partial<Question>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  totalQuestions,
  totalPages,
  stylePreset,
  trackStandards = true,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}) => {
  const [newAltAnswer, setNewAltAnswer] = useState('');

  // Math quick-insert helper
  const insertMathSnippet = (snippet: string) => {
    onUpdate({ prompt: (question.prompt || '') + snippet });
  };

  const handleAddAltAnswer = () => {
    if (!newAltAnswer.trim()) return;
    const current = question.acceptable_alternatives || [];
    if (!current.includes(newAltAnswer.trim())) {
      onUpdate({ acceptable_alternatives: [...current, newAltAnswer.trim()] });
    }
    setNewAltAnswer('');
  };

  const handleRemoveAltAnswer = (alt: string) => {
    const current = question.acceptable_alternatives || [];
    onUpdate({ acceptable_alternatives: current.filter((a) => a !== alt) });
  };

  return (
    <div
      className={`bg-white rounded-xl border transition shadow-sm ${
        stylePreset === 'classwork'
          ? 'border-2 border-slate-700 ring-1 ring-slate-300'
          : stylePreset === 'pod'
          ? 'border-dashed border-slate-300'
          : 'border-solid border-slate-200'
      }`}
    >
      {/* Card Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 rounded-t-xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
            {question.order_index}
          </span>
          <span className="font-semibold text-sm text-slate-800">
            Problem #{question.order_index}
          </span>

          {/* Page Selector (if 2 pages) */}
          {totalPages > 1 && (
            <select
              value={question.page_number || 1}
              onChange={(e) => onUpdate({ page_number: Number(e.target.value) })}
              className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-700 font-medium"
            >
              <option value={1}>Page 1</option>
              <option value={2}>Page 2</option>
            </select>
          )}

          {/* Points input */}
          <div className="flex items-center space-x-1 ml-2 text-xs text-slate-500">
            <span>Points:</span>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={question.points}
              onChange={(e) => onUpdate({ points: parseFloat(e.target.value) || 1 })}
              className="w-14 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-center font-bold text-slate-800"
            />
          </div>
        </div>

        {/* Card Actions (Reorder, Duplicate, Delete) */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            title="Move Up"
            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200 transition"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={index === totalQuestions - 1}
            onClick={onMoveDown}
            title="Move Down"
            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200 transition"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            title="Duplicate Question"
            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200 transition"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete Question"
            className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Math Quick Tools & Prompt */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Problem Prompt / Equation
            </label>
            {/* Quick Math Toolbar */}
            <div className="flex items-center space-x-1 text-xs">
              <span className="text-slate-400 mr-1 hidden sm:inline">Insert Math:</span>
              <button
                type="button"
                onClick={() => insertMathSnippet(' \\frac{a}{b} ')}
                className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-serif"
                title="Fraction"
              >
                a/b
              </button>
              <button
                type="button"
                onClick={() => insertMathSnippet(' x^2 ')}
                className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-serif"
                title="Exponent"
              >
                x²
              </button>
              <button
                type="button"
                onClick={() => insertMathSnippet(' \\sqrt{x} ')}
                className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-serif"
                title="Square root"
              >
                √x
              </button>
              <button
                type="button"
                onClick={() => insertMathSnippet(' \\pm ')}
                className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
                title="Plus/minus"
              >
                ±
              </button>
              <button
                type="button"
                onClick={() => insertMathSnippet(' \\le ')}
                className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
                title="Less than or equal"
              >
                ≤
              </button>
              <button
                type="button"
                onClick={() => insertMathSnippet(' \\ge ')}
                className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
                title="Greater than or equal"
              >
                ≥
              </button>
            </div>
          </div>

          <textarea
            rows={2}
            value={question.prompt}
            onChange={(e) => onUpdate({ prompt: e.target.value })}
            placeholder="e.g. Solve for x:  3x + 7 = 22"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-sans transition"
          />

          {/* Live Math Render Preview */}
          {question.prompt && (
            <div className="mt-2 p-2.5 bg-blue-50/40 border border-blue-100 rounded-lg text-sm text-slate-900">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
                Live Printed Preview:
              </span>
              <MathText text={question.prompt} className="text-base font-medium" />
            </div>
          )}
        </div>

        {/* Question Type & Answer Key Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2 border-t border-slate-100">
          {/* Question Type */}
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Answer Format
            </label>
            <select
              value={question.question_type}
              onChange={(e) => onUpdate({ question_type: e.target.value as QuestionType })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value="numeric">Numeric / Decimal</option>
              <option value="fraction">Fraction (e.g. -3/4)</option>
              <option value="expression">Algebraic Expression</option>
              <option value="multiple_choice">Multiple Choice (A, B, C, D)</option>
              <option value="multi_step">Multi-Step Show Work</option>
            </select>
          </div>

          {/* Correct Answer Input */}
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1 flex items-center space-x-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Correct Answer (Key)</span>
            </label>
            {question.question_type === 'multiple_choice' ? (
              <div className="flex items-center space-x-1.5">
                {['A', 'B', 'C', 'D'].map((lbl) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => onUpdate({ correct_answer: lbl })}
                    className={`flex-1 py-1.5 rounded-lg font-bold text-xs border transition ${
                      question.correct_answer?.trim().toUpperCase() === lbl
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-emerald-50/60 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                    }`}
                  >
                    Choice {lbl}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={question.correct_answer}
                onChange={(e) => onUpdate({ correct_answer: e.target.value })}
                placeholder="e.g. 5, -3/4, or C"
                className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-lg text-sm font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500 transition"
              />
            )}
          </div>

          {/* Alternative Valid Answers */}
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Acceptable Formats
            </label>
            <div className="flex space-x-1.5">
              <input
                type="text"
                value={newAltAnswer}
                onChange={(e) => setNewAltAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAltAnswer();
                  }
                }}
                placeholder="+ Add format (e.g. 1/2)"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
              <button
                type="button"
                onClick={handleAddAltAnswer}
                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-medium text-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List of alternative tags */}
            {question.acceptable_alternatives && question.acceptable_alternatives.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {question.acceptable_alternatives.map((alt, aIdx) => (
                  <span
                    key={aIdx}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    <span>{alt}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAltAnswer(alt)}
                      className="ml-1 text-slate-400 hover:text-red-500 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Multiple Choice Options Builder (Only shown when Multiple Choice is selected) */}
        {/* Multiple Choice Options Box */}
        {question.question_type === 'multiple_choice' ? (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
                <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
                <span>Multiple Choice Options</span>
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                  {question.options?.some((o) => (o.text || '').length > 22)
                    ? 'Layout: 1 Column (Full Width)'
                    : 'Layout: 2 Columns'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const matchedOpt = question.options?.find(
                      (o) => o.label.toUpperCase() === question.correct_answer?.trim().toUpperCase()
                    );
                    onUpdate({
                      question_type: 'numeric',
                      correct_answer: matchedOpt ? matchedOpt.text : (question.correct_answer || ''),
                    });
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Convert to Open-Ended
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {['A', 'B', 'C', 'D'].map((label) => {
                const opt = question.options?.find((o) => o.label === label);
                return (
                  <div key={label} className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center shrink-0">
                      {label}
                    </span>
                    <input
                      type="text"
                      value={opt?.text || ''}
                      onChange={(e) => {
                        const currentOpts = question.options || [];
                        const filtered = currentOpts.filter((o) => o.label !== label);
                        onUpdate({
                          options: [...filtered, { label, text: e.target.value }].sort((a, b) =>
                            a.label.localeCompare(b.label)
                          ),
                        });
                      }}
                      placeholder={`Option ${label}`}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                onUpdate({
                  question_type: 'multiple_choice',
                  options: [
                    { label: 'A', text: question.correct_answer || '' },
                    { label: 'B', text: '' },
                    { label: 'C', text: '' },
                    { label: 'D', text: '' },
                  ],
                  correct_answer: 'A',
                });
              }}
              className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 flex items-center space-x-1"
            >
              <span>+ Convert to Multiple Choice</span>
            </button>
          </div>
        )}

        {/* NJSLS Standard Tagging (Shown when trackStandards is enabled) */}
        {trackStandards && (
          <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
              <label className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center space-x-1.5">
                <Target className="w-3.5 h-3.5 text-purple-600" />
                <span>NJSLS Standard Target</span>
              </label>
              {question.standard && getStandardDescription(question.standard) && (
                <span className="text-[11px] font-semibold text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200 truncate max-w-sm">
                  {getStandardDescription(question.standard)}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                list={`standards-list-${question.id}`}
                value={question.standard || ''}
                onChange={(e) => onUpdate({ standard: e.target.value.trim() })}
                placeholder="Type or select standard (e.g. 6.NS.C.7a, 6.EE.B.7, 5.NF.B.6)"
                className="flex-1 px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-mono font-medium text-purple-950 focus:ring-2 focus:ring-purple-500 placeholder-purple-300"
              />
              <datalist id={`standards-list-${question.id}`}>
                {Object.entries(NJSLS_STANDARDS).map(([code, desc]) => (
                  <option key={code} value={code}>
                    {code} — {desc}
                  </option>
                ))}
              </datalist>
            </div>
          </div>
        )}

        {/* Rubric Notes / AI Grading Instructions */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1 flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>AI Autograder Rubric & Feedback Notes (Optional)</span>
          </label>
          <input
            type="text"
            value={question.rubric_notes || ''}
            onChange={(e) => onUpdate({ rubric_notes: e.target.value })}
            placeholder="e.g. Award 1 point if student subtracted 7 correctly but divided incorrectly."
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 italic focus:bg-white focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
};
