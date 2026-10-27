import React from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Split by inline math delimiter $...$ or $$...$$
  const parts: React.ReactNode[] = [];
  const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.substring(lastIndex, match.index)}
        </span>
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
          className={isDisplay ? 'block my-2 text-center' : 'inline-block mx-0.5'}
        />
      );
    } catch {
      parts.push(<span key={`err-${match.index}`}>{formula}</span>);
    }

    lastIndex = regex.lastIndex;
  }

  // Remaining text
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex);
    // If there was no $ delimiter but the user typed LaTeX like \frac{a}{b} or \sqrt{x}
    if (parts.length === 0 && (remaining.includes('\\frac') || remaining.includes('\\sqrt') || remaining.includes('\\pm') || remaining.includes('\\cdot'))) {
      try {
        const html = katex.renderToString(remaining, {
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
        // Fallback to plain text
      }
    }
    parts.push(<span key={`text-${lastIndex}`}>{remaining}</span>);
  }

  return <span className={className}>{parts}</span>;
};
