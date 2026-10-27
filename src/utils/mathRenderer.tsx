import React from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Pre-processes LaTeX math content to ensure connective English words
 * (like "when", "for", "where", "if") are properly wrapped in \text{}
 * so KaTeX formats them cleanly with proper spacing and standard font.
 */
function cleanMathContent(content: string): string {
  if (!content) return '';
  return content.replace(/\b(when|for|where|if)\b/g, (match, word, offset, str) => {
    const before = str.slice(0, offset);
    if (/\\text\{[^}]*$/.test(before) || /\\mathrm\{[^}]*$/.test(before)) {
      return match;
    }
    return `\\text{ ${word} }`;
  });
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  const parts: React.ReactNode[] = [];

  // Match $$...$$ (display math) or $...$ (inline math, where closing $ is not preceded by space and opening $ is not followed by space)
  // This cleanly distinguishes real math ($3x^2$, $x = 2.4$, etc.) from currency ($45.50, $15, etc.)
  const mathRegex = /(\$\$[\s\S]*?\$\$|\$([^\s$](?:[^\n$]*?[^\s$])?)\$)/g;

  if (text.includes('$')) {
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let hasMathMatch = false;

    while ((match = mathRegex.exec(text)) !== null) {
      hasMathMatch = true;
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
      }

      const rawFormula = match[0];
      const isDisplay = rawFormula.startsWith('$$');
      const rawContent = isDisplay ? rawFormula.slice(2, -2) : rawFormula.slice(1, -1);
      const mathContent = cleanMathContent(rawContent);

      try {
        const html = katex.renderToString(mathContent, {
          displayMode: isDisplay,
          output: 'html', // Eliminates duplicate MathML rendering!
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
      if (lastIndex < text.length) {
        parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
      }
      return <span className={className}>{parts}</span>;
    }
  }

  // 2. Handle raw LaTeX commands without dollar signs (e.g. "Solve for y: \quad \frac{y}{4} - 3 = 5" or "Evaluate: \frac{3}{4} \div \frac{1}{2}")
  const latexTriggers = ['\\frac', '\\sqrt', '\\quad', '\\cdot', '\\times', '\\pm', '\\le', '\\ge', '\\div', '\\neq', '\\approx', '^'];
  const hasLatex = latexTriggers.some((t) => text.includes(t));

  if (hasLatex) {
    // If there's a prefix like "Solve for y: " or "Evaluate: "
    const colonIndex = text.indexOf(':');
    if (colonIndex !== -1 && colonIndex < text.length - 1) {
      const prefix = text.substring(0, colonIndex + 1);
      const formula = cleanMathContent(text.substring(colonIndex + 1).replace(/^\\quad\s*/, '').trim());

      try {
        const html = katex.renderToString(formula, {
          displayMode: false,
          output: 'html',
          throwOnError: false,
        });
        return (
          <span className={className}>
            <span>{prefix} </span>
            <span
              dangerouslySetInnerHTML={{ __html: html }}
              className="inline-block mx-1 font-math"
            />
          </span>
        );
      } catch {
        // Fallback
      }
    }

    // Try rendering entire text through KaTeX with output: 'html'
    try {
      const cleaned = cleanMathContent(text.replace(/^\\quad\s*/, ''));
      const html = katex.renderToString(cleaned, {
        displayMode: false,
        output: 'html',
        throwOnError: false,
      });
      return (
        <span
          className={className}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } catch {
      // Fallback
    }
  }

  // 3. Default plain text (e.g. pure English word problems or single currency amounts like "$45.50")
  return <span className={className}>{text}</span>;
};
