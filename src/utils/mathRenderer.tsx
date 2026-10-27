import React from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Pre-processes LaTeX math content to ensure connective English words
 * (like "when", "for", "where", "if", "and", "or") are properly wrapped in \text{}
 * so KaTeX formats them cleanly with proper spacing and standard upright font.
 */
function cleanMathContent(content: string): string {
  if (!content) return '';
  return content.replace(
    /(?<![\\a-zA-Z])\b(when|for|where|if|and|or)\b(?![a-zA-Z])/g,
    (match, word, offset, str) => {
      const before = str.slice(0, offset);
      if (/\\(?:text|mathrm|textbf|textit)\{[^}]*$/.test(before)) {
        return match;
      }
      return `\\text{ ${word} }`;
    }
  );
}

/**
 * Renders a plain-text segment that may contain unmarked LaTeX math tokens
 * (e.g., "Evaluate the expression 3x^2 - 4.5 when x = 2.4" or "What is \frac{3}{4} of 20?").
 * Only the mathematical sub-expressions are rendered through KaTeX so English words stay upright.
 */
function renderUnmarkedSegment(segment: string, keyPrefix: string): React.ReactNode {
  if (!segment) return null;

  const latexTriggers = [
    '\\frac',
    '\\sqrt',
    '\\quad',
    '\\cdot',
    '\\times',
    '\\pm',
    '\\le',
    '\\ge',
    '\\div',
    '\\neq',
    '\\approx',
    '\\pi',
    '^',
  ];
  const hasLatex = latexTriggers.some((t) => segment.includes(t));
  if (!hasLatex) {
    return <span key={keyPrefix}>{segment}</span>;
  }

  const cleaned = segment.replace(/\\quad\s*/g, ' ');

  // Check if it is "Instruction: <pure math>" (e.g. "Evaluate: \frac{3}{4} \div \frac{1}{2}")
  const colonIndex = cleaned.indexOf(':');
  if (colonIndex !== -1 && colonIndex < cleaned.length - 1) {
    const prefix = cleaned.substring(0, colonIndex + 1);
    const rhs = cleaned.substring(colonIndex + 1).trim();
    // Only treat the entire RHS as a single formula if it doesn't contain long English prose sentences
    const hasLongProse = /\b[a-zA-Z]{5,}\b/.test(rhs.replace(/\\[a-zA-Z]+/g, ''));
    if (!hasLongProse) {
      try {
        const html = katex.renderToString(cleanMathContent(rhs), {
          displayMode: false,
          output: 'html',
          throwOnError: false,
        });
        return (
          <span key={keyPrefix}>
            <span>{prefix} </span>
            <span
              dangerouslySetInnerHTML={{ __html: html }}
              className="inline-block mx-0.5 font-math"
            />
          </span>
        );
      } catch {
        // Fallback to token splitter below
      }
    }
  }

  // Tokenize individual math expressions inside unmarked prose
  const tokenRegex =
    /(\$?(?:\\frac\{[^}]+\}\{[^}]+\}|\\sqrt(?:\[[^\]]+\])?\{[^}]+\}|[a-zA-Z0-9.\-+*/()]+\^[a-zA-Z0-9.\-+*/(){}]+|\\(?:div|times|cdot|pm|le|ge|neq|approx|pi)\b)(?:\s*(?:[+\-*/=]|\\(?:div|times|cdot|pm|le|ge|neq|approx)\b)\s*(?:\\frac\{[^}]+\}\{[^}]+\}|\\sqrt(?:\[[^\]]+\])?\{[^}]+\}|[a-zA-Z0-9.\-+*/()^]+))*\$?)/g;

  const subParts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(cleaned)) !== null) {
    if (match.index > lastIdx) {
      subParts.push(
        <span key={`${keyPrefix}-t-${lastIdx}`}>{cleaned.substring(lastIdx, match.index)}</span>
      );
    }

    // Strip any trailing sentence period or stray orphan $ from the math token
    let rawToken = match[0];
    let trailingPunct = '';
    if (rawToken.endsWith('.') || rawToken.endsWith(',')) {
      trailingPunct = rawToken.slice(-1);
      rawToken = rawToken.slice(0, -1);
    }
    const strippedToken = rawToken.replace(/^\$|\$$/g, '');

    try {
      const html = katex.renderToString(cleanMathContent(strippedToken), {
        displayMode: false,
        output: 'html',
        throwOnError: false,
      });
      subParts.push(
        <span
          key={`${keyPrefix}-m-${match.index}`}
          dangerouslySetInnerHTML={{ __html: html }}
          className="inline-block mx-0.5 font-math"
        />
      );
      if (trailingPunct) {
        subParts.push(<span key={`${keyPrefix}-p-${match.index}`}>{trailingPunct}</span>);
      }
    } catch {
      subParts.push(<span key={`${keyPrefix}-e-${match.index}`}>{match[0]}</span>);
    }

    lastIdx = tokenRegex.lastIndex;
  }

  if (subParts.length > 0) {
    if (lastIdx < cleaned.length) {
      subParts.push(<span key={`${keyPrefix}-end`}>{cleaned.substring(lastIdx)}</span>);
    }
    return <span key={keyPrefix}>{subParts}</span>;
  }

  return <span key={keyPrefix}>{segment}</span>;
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // 1. Normalize \[ ... \] and \( ... \) into $$ ... $$ and $ ... $
  const normalized = text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `$$${m.trim()}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m.trim()}$`);

  // 2. Protect standalone currency values (e.g. "$45.50.", "$15 and", "$1,200,")
  // Only matches $ followed by a plain number when immediately followed by punctuation, end-of-string, or an English prose word (excluding math connectives).
  const currencyPlaceholder = '___CURRENCY_DOLLAR___';
  const currencyRegex =
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?=\s+(?!(?:when|for|where|if)\b)[a-zA-Z]{2,}|[.,;!?)]|\s*$)/g;
  const protectedText = normalized.replace(currencyRegex, `${currencyPlaceholder}$1`);

  const restoreCurrency = (s: string) => s.replace(new RegExp(currencyPlaceholder, 'g'), '$');

  // 3. Match $$...$$ (display math) or $...$ (inline math)
  const mathRegex = /(\$\$[\s\S]*?\$\$|\$([^\s$](?:[^\n$]*?[^\s$])?)\$)/g;

  if (protectedText.includes('$')) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let hasMathMatch = false;

    while ((match = mathRegex.exec(protectedText)) !== null) {
      hasMathMatch = true;
      if (match.index > lastIndex) {
        const textSeg = restoreCurrency(protectedText.substring(lastIndex, match.index));
        parts.push(renderUnmarkedSegment(textSeg, `seg-${lastIndex}`));
      }

      const rawFormula = match[0];
      const isDisplay = rawFormula.startsWith('$$');
      const rawContent = restoreCurrency(
        isDisplay ? rawFormula.slice(2, -2) : rawFormula.slice(1, -1)
      );
      const mathContent = cleanMathContent(rawContent);

      try {
        const html = katex.renderToString(mathContent, {
          displayMode: isDisplay,
          output: 'html',
          throwOnError: false,
        });
        parts.push(
          <span
            key={`math-${match.index}`}
            dangerouslySetInnerHTML={{ __html: html }}
            className={isDisplay ? 'block my-1 text-center font-math' : 'inline-block mx-0.5 font-math'}
          />
        );
      } catch {
        parts.push(<span key={`err-${match.index}`}>{rawFormula}</span>);
      }

      lastIndex = mathRegex.lastIndex;
    }

    if (hasMathMatch) {
      if (lastIndex < protectedText.length) {
        const tailSeg = restoreCurrency(protectedText.substring(lastIndex));
        parts.push(renderUnmarkedSegment(tailSeg, `tail-${lastIndex}`));
      }
      return <span className={className}>{parts}</span>;
    }
  }

  // 4. Handle unmarked text (no paired $ delimiters)
  const restored = restoreCurrency(protectedText);
  return <span className={className}>{renderUnmarkedSegment(restored, 'root')}</span>;
};
