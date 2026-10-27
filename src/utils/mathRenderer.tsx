import React from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // 1. Protect currency patterns (e.g. $35, $0.10, $52.50) from being misidentified as LaTeX delimiters
  const currencyPlaceholder = '___CURRENCY_DOLLAR___';
  const protectedText = text.replace(/\$(\d+(?:\.\d+)?)/g, `${currencyPlaceholder}$1`);

  const parts: React.ReactNode[] = [];

  // 2. Check for explicit math blocks $$...$$ or $...$
  if (protectedText.includes('$')) {
    const mathRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = mathRegex.exec(protectedText)) !== null) {
      if (match.index > lastIndex) {
        const textSegment = protectedText.substring(lastIndex, match.index).replace(new RegExp(currencyPlaceholder, 'g'), '$');
        parts.push(<span key={`text-${lastIndex}`}>{textSegment}</span>);
      }

      const rawFormula = match[0];
      const isDisplay = rawFormula.startsWith('$$');
      const mathContent = isDisplay ? rawFormula.slice(2, -2) : rawFormula.slice(1, -1);

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

    if (lastIndex < protectedText.length) {
      const remaining = protectedText.substring(lastIndex).replace(new RegExp(currencyPlaceholder, 'g'), '$');
      parts.push(<span key={`text-${lastIndex}`}>{remaining}</span>);
    }

    return <span className={className}>{parts}</span>;
  }

  // 3. Handle raw LaTeX commands without dollar signs (e.g. "Solve for y: \quad \frac{y}{4} - 3 = 5")
  const latexTriggers = ['\\frac', '\\sqrt', '\\quad', '\\cdot', '\\times', '\\pm', '\\le', '\\ge', '\\div', '\\neq', '\\approx', '^'];
  const hasLatex = latexTriggers.some((t) => protectedText.includes(t));

  if (hasLatex) {
    // If there's a prefix like "Solve for y: " or "1. "
    const colonIndex = protectedText.indexOf(':');
    if (colonIndex !== -1 && colonIndex < protectedText.length - 1) {
      const prefix = protectedText.substring(0, colonIndex + 1).replace(new RegExp(currencyPlaceholder, 'g'), '$');
      const formula = protectedText.substring(colonIndex + 1).replace(/^\\quad\s*/, '').trim();

      try {
        const html = katex.renderToString(formula, {
          displayMode: false,
          output: 'html', // Output HTML only
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
      const cleaned = protectedText.replace(/^\\quad\s*/, '').replace(new RegExp(currencyPlaceholder, 'g'), '$');
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

  // 4. Default plain text (restore any protected currency symbols)
  const plain = protectedText.replace(new RegExp(currencyPlaceholder, 'g'), '$');
  return <span className={className}>{plain}</span>;
};
