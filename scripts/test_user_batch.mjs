const input = `[
  {
    "assignmentName": "Math 6 POD Mon 10/26",
    "prompt": "Plot the point (4, 5) on the coordinate plane. Which quadrant is it in?",
    "question_type": "multiple_choice",
    "options": [
      {"label": "A", "text": "Quadrant I"},
      {"label": "B", "text": "Quadrant II"},
      {"label": "C", "text": "Quadrant III"},
      {"label": "D", "text": "Quadrant IV"}
    ],
    "correct_answer": "A",
    "acceptable_alternatives": ["Quadrant I", "I"],
    "points": 1,
    "rubric_notes": "Fluency: 5.G.A.1 (Mastered). 1 pt for correct quadrant."
  },
  {
    "assignmentName": "Math 6 POD Mon 10/26",
    "prompt": "If you start at the origin and move 3 units left and 2 units up, what are your coordinates?",
    "question_type": "numeric",
    "correct_answer": "(-3, 2)",
    "acceptable_alternatives": ["(-3,2)"],
    "points": 1,
    "rubric_notes": "Bridge: X-axis vs Y-axis movement."
  },
  {
    "assignmentName": "Math 6 POD Mon 10/26",
    "prompt": "Evaluate: |-15| + |4|. Note: Do not treat the absolute value expression as two terms inside parentheses.",
    "question_type": "numeric",
    "correct_answer": "19",
    "acceptable_alternatives": ["19"],
    "points": 2,
    "rubric_notes": "Recent: Absolute Value (2.3). Traps misconception of absolute value expressions."
  },
  {
    "assignmentName": "Math 6 POD Mon 10/26",
    "prompt": "Evaluate: \\\\frac{3}{4} \\\\div \\\\frac{1}{2}",
    "question_type": "fraction",
    "correct_answer": "3/2",
    "acceptable_alternatives": ["1 1/2", "1.5", "\\\\frac{3}{2}"],
    "points": 1,
    "rubric_notes": "Distant: Divide Fractions."
  },
  {
    "assignmentName": "Math 6 POD Mon 10/26",
    "prompt": "A point is reflected across the x-axis, then the y-axis, ending at (3, -4). What was the original point?",
    "question_type": "numeric",
    "correct_answer": "(-3, 4)",
    "acceptable_alternatives": ["(-3,4)"],
    "points": 2,
    "rubric_notes": "Challenge: Plot point in all four quadrants."
  },
  {
    "assignmentName": "Math 6 POD Mon 10/26",
    "prompt": "Order from least to greatest: -5, -2, 0, 1. (Be careful: Is -5 greater than -2?)",
    "question_type": "numeric",
    "correct_answer": "-5, -2, 0, 1",
    "acceptable_alternatives": ["-5,-2,0,1"],
    "points": 2,
    "rubric_notes": "Spiral (6.NS.C.7A): Explicitly attacks the misconception that -5 > -2."
  },
  {
    "assignmentName": "Math 6 POD Tue 10/27",
    "prompt": "Subtract: 14.5 - 6.2",
    "question_type": "numeric",
    "correct_answer": "8.3",
    "acceptable_alternatives": ["8.30"],
    "points": 1,
    "rubric_notes": "Fluency: Basic Subtraction."
  }
]`;

function robustParseJson(rawText) {
  let cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  // Safe backslash fix: only fix backslashes that are NOT already escaped
  // and NOT followed by standard JSON escapes
  cleaned = cleaned.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\");
  return JSON.parse(cleaned);
}

const items = robustParseJson(input);

// Group by assignmentName
const groups = {};
for (const item of items) {
  const name = item.assignmentName || 'Untitled Worksheet';
  if (!groups[name]) groups[name] = [];
  groups[name].push(item);
}

console.log('Detected Assignment Groups:', Object.keys(groups));
console.log('Group 1 has:', groups['Math 6 POD Mon 10/26'].length, 'questions');
