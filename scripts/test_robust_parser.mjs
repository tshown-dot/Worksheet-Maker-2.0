// Test with raw pasted string from the user
const userPasted = `[
{
"prompt": "Solve for x: 2x - 5 = 11",
"question_type": "numeric",
"correct_answer": "8",
"acceptable_alternatives": ["x = 8", "8"],
"points": 2,
"rubric_notes": "1 pt for adding 5 to both sides (2x = 16), 1 pt for dividing by 2."
},
{
"prompt": "Simplify the expression: 3(x + 4) - 2x",
"question_type": "expression",
"correct_answer": "x + 12",
"acceptable_alternatives": ["12 + x", "1x + 12"],
"points": 2,
"rubric_notes": "1 pt for distributing the 3 correctly (3x + 12), 1 pt for combining like terms."
},
{
"prompt": "Evaluate the following: \\frac{3}{4} \\div \\frac{1}{2}",
"question_type": "fraction",
"correct_answer": "\\frac{3}{2}",
"acceptable_alternatives": ["1.5", "1 \\frac{1}{2}", "3/2"],
"points": 2,
"rubric_notes": "1 pt for setting up multiplication by the reciprocal, 1 pt for the simplified final answer."
},
{
"prompt": "What is 15% of 80? A) 10  B) 12  C) 15  D) 20",
"question_type": "multiple_choice",
"correct_answer": "B",
"acceptable_alternatives": ["12", "B) 12", "b"],
"points": 1,
"rubric_notes": "1 pt for selecting the correct choice."
},
{
"prompt": "Solve for y: \\frac{y - 2}{5} = 4",
"question_type": "numeric",
"correct_answer": "22",
"acceptable_alternatives": ["y = 22", "22"],
"points": 2,
"rubric_notes": "1 pt for multiplying both sides by 5 (y - 2 = 20), 1 pt for adding 2."
},
{
"prompt": "A skateboard costs $40. It is on sale for 25% off. If sales tax is 10%, what is the final total price?",
"question_type": "multi_step",
"correct_answer": "33",
"acceptable_alternatives": ["33.00", "$33", "$33.00"],
"points": 3,
"rubric_notes": "1 pt for finding the discount ($10), 1 pt for the sale price ($30), 1 pt for adding 10% tax ($3) for the final total."
}
]`;

function robustParseJson(str) {
  // Strip markdown ```json ... ``` wrapper
  let cleaned = str.replace(/```json/gi, '').replace(/```/g, '').trim();

  // Escape single backslashes that are part of LaTeX math commands like \frac, \div, \sqrt, etc.
  // In JSON, any backslash that is not followed by " \ / b f n r t u must be escaped.
  // And even \f, \b if followed by letters like frac should be escaped to \\frac.
  cleaned = cleaned.replace(/\\([a-zA-Z]+|[0-9]+)/g, (match, cmd) => {
    // If it's pure \n or \r or \t on its own:
    if (['n', 'r', 't'].includes(cmd)) return match;
    return '\\\\' + cmd;
  });

  return JSON.parse(cleaned);
}

try {
  const result = robustParseJson(userPasted);
  console.log('SUCCESS! Parsed', result.length, 'questions');
  console.log('Q3 prompt:', result[2].prompt);
  console.log('Q3 answer:', result[2].correct_answer);
  console.log('Q5 prompt:', result[4].prompt);
} catch (e) {
  console.error('PARSE FAILED:', e.message);
}
