import React from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // 1. If text has explicit $...$ or $$...$$ delimiters
  if (text.includes('$')) {
    const parts: React.ReactNode[] = [];
    const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>
        );
      }

      const formula = match[0];
      const isDisplay = formula.startsWith('$$');
      const mathContent = isDisplay ? formula.slice(2, -2) : formula.slice(1, -1);

      try {
        const html = katex.renderToString(mathContent, {
          displayMode: isDisplay,
          throwOnError: false,
        });
        parts.push(
          <span
            key={`math-${match.index}`}
            dangerouslySetInnerHTML={{ __html: html }}
            className={isDisplay ? 'block my-1 text-center' : 'inline-block mx-0.5'}
          />
        );
      } catch {
        parts.push(<span key={`err-${match.index}`}>{formula}</span>);
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
    }

    return <span className={className}>{parts}</span>;
  }

  // 2. If text contains common LaTeX commands without dollars (e.g. "Solve for y: \quad \frac{y}{4} - 3 = 5")
  const latexTriggers = ['\\frac', '\\sqrt', '\\quad', '\\cdot', '\\times', '\\pm', '\\le', '\\ge', '\\div', '\\neq', '\\approx', '^'];
  const hasLatex = latexTriggers.some((t) => text.includes(t));

  if (hasLatex) {
    // Check if there is a prefix like "Solve for x: "
    const colonIndex = text.indexOf(':');
    if (colonIndex !== -1 && colonIndex < text.length - 1) {
      const prefix = text.substring(0, colonIndex + 1);
      const mathPart = text.substring(colonIndex + 1).replace(/^\\quad\s*/, '').trim();

      try {
        const html = katex.renderToString(mathPart, {
          displayMode: false,
          throwOnError: false,
        });
        return (
          <span className={className}>
            <span>{prefix} </span>
            <span dangerouslySetInnerHTML={{ __html: html }} className="inline-block mx-1 font-math" />
          </span>
        );
      } catch {
        // Fallback
      }
    }

    // Try rendering entire string as math with text wrapper if needed
    try {
      const html = katex.renderToString(text, {
        displayMode: false,
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

  return <span className={className}>{text}</span>;
};
