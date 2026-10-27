import katex from 'katex';

function parseMathAndText(text) {
  // If text contains LaTeX commands like \frac, \sqrt, etc.
  // Replace currency patterns like $35 with an escaped placeholder so regex doesn't think it's math!
  const currencyPlaceholder = '___CURRENCY_DOLLAR___';
  // Match $ followed by digits: $35, $0.10, $52.50
  const protectedText = text.replace(/\$(\d+(?:\.\d+)?)/g, `${currencyPlaceholder}$1`);

  console.log('Protected:', protectedText);

  // Parse explicit math blocks $$...$$ or $...$
  const parts = [];
  const mathRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;
  let lastIdx = 0;
  let match;

  while ((match = mathRegex.exec(protectedText)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', content: protectedText.substring(lastIdx, match.index) });
    }
    const mathContent = match[0].startsWith('$$') ? match[0].slice(2, -2) : match[0].slice(1, -1);
    const html = katex.renderToString(mathContent, { output: 'html', throwOnError: false });
    parts.push({ type: 'math', content: html });
    lastIdx = mathRegex.lastIdx;
  }

  if (lastIdx < protectedText.length) {
    const remaining = protectedText.substring(lastIdx);
    // Check if remaining has raw LaTeX without dollars like \frac{y}{4} - 3 = 5
    if (remaining.includes('\\frac') || remaining.includes('\\sqrt') || remaining.includes('\\pm')) {
      // Find prefix e.g. "Solve for y: "
      const colonIdx = remaining.indexOf(':');
      if (colonIdx !== -1) {
        const prefix = remaining.substring(0, colonIdx + 1);
        const formula = remaining.substring(colonIdx + 1).replace(/^\\quad\s*/, '').trim();
        const html = katex.renderToString(formula, { output: 'html', throwOnError: false });
        parts.push({ type: 'text', content: prefix + ' ' });
        parts.push({ type: 'math', content: html });
      } else {
        const html = katex.renderToString(remaining, { output: 'html', throwOnError: false });
        parts.push({ type: 'math', content: html });
      }
    } else {
      parts.push({ type: 'text', content: remaining });
    }
  }

  // Restore currency dollar signs
  return parts.map(p => ({
    ...p,
    content: p.type === 'text' ? p.content.replace(new RegExp(currencyPlaceholder, 'g'), '$') : p.content
  }));
}

const res1 = parseMathAndText('Solve for y: \\quad \\frac{y}{4} - 3 = 5');
console.log('Problem 2 parts:', res1);

const res4 = parseMathAndText('A phone plan costs $35 per month plus $0.10 per text. Find t if bill is $52.50.');
console.log('Problem 4 parts:', res4);
