function extractMultipleChoiceOptions(prompt) {
  // Check if prompt contains A) ... B) ... C) ... D)
  const mcRegex = /(?:^|\s+)([A-D])[\)\.]\s*([^A-D\)\.]+?)(?=\s+[A-D][\)\.]|$)/g;
  const options = [];
  let match;
  let cleanPrompt = prompt;

  const firstMatchIndex = prompt.search(/(?:^|\s+)[A-D][\)\.]/);
  if (firstMatchIndex !== -1) {
    cleanPrompt = prompt.substring(0, firstMatchIndex).trim();
  }

  while ((match = mcRegex.exec(prompt)) !== null) {
    options.push({
      label: match[1].toUpperCase(),
      text: match[2].trim(),
    });
  }

  return { cleanPrompt, options };
}

const test = "What is 15% of 80? A) 10  B) 12  C) 15  D) 20";
const res = extractMultipleChoiceOptions(test);
console.log('Clean prompt:', res.cleanPrompt);
console.log('Options:', res.options);
