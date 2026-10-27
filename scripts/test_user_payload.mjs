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
    "prompt": "Evaluate: \\frac{3}{4} \\div \\frac{1}{2}",
    "question_type": "fraction",
    "correct_answer": "3/2",
    "acceptable_alternatives": ["1 1/2", "1.5", "\\frac{3}{2}"],
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
  },
  {
    "assignmentName": "Math 6 POD Tue 10/27",
    "prompt": "How many units is it from -4 to 3 on a number line?",
    "question_type": "numeric",
    "correct_answer": "7",
    "acceptable_alternatives": ["7 units"],
    "points": 1,
    "rubric_notes": "Bridge: Counting across an axis."
  },
  {
    "assignmentName": "Math 6 POD Tue 10/27",
    "prompt": "You are graphing the point (-2, 5). Which axis do you move along first, and in which direction?",
    "question_type": "multiple_choice",
    "options": [
      {"label": "A", "text": "x-axis, left 2"},
      {"label": "B", "text": "y-axis, down 2"},
      {"label": "C", "text": "x-axis, right 5"},
      {"label": "D", "text": "y-axis, up 5"}
    ],
    "correct_answer": "A",
    "acceptable_alternatives": ["A"],
    "points": 2,
    "rubric_notes": "Recent: Coordinate Plane (2.4). Traps the reversed coordinates misconception."
  },
  {
    "assignmentName": "Math 6 POD Tue 10/27",
    "prompt": "Which point represents the opposite of -4 on the number line?",
    "question_type": "numeric",
    "correct_answer": "4",
    "acceptable_alternatives": ["+4"],
    "points": 1,
    "rubric_notes": "Distant: Rational Numbers on Line (2.2)."
  },
  {
    "assignmentName": "Math 6 POD Tue 10/27",
    "prompt": "Find the distance between (4, -2) and (4, 7) on the coordinate plane.",
    "question_type": "numeric",
    "correct_answer": "9",
    "acceptable_alternatives": ["9 units"],
    "points": 2,
    "rubric_notes": "Challenge: Find vertical distance between points."
  },
  {
    "assignmentName": "Math 6 POD Tue 10/27",
    "prompt": "A submarine is at -150 feet. A fish is at -50 feet. Which is deeper, and which has a greater absolute value?",
    "question_type": "multiple_choice",
    "options": [
      {"label": "A", "text": "Submarine is deeper, fish has greater absolute value"},
      {"label": "B", "text": "Submarine is deeper, submarine has greater absolute value"},
      {"label": "C", "text": "Fish is deeper, submarine has greater absolute value"},
      {"label": "D", "text": "Fish is deeper, fish has greater absolute value"}
    ],
    "correct_answer": "B",
    "acceptable_alternatives": ["B"],
    "points": 2,
    "rubric_notes": "Spiral (6.NS.C.7C): Magnitude and real-world context."
  },
  {
    "assignmentName": "Math 6 POD Wed 10/28",
    "prompt": "Evaluate: |-22|",
    "question_type": "numeric",
    "correct_answer": "22",
    "acceptable_alternatives": ["+22"],
    "points": 1,
    "rubric_notes": "Fluency: Absolute Value evaluation."
  },
  {
    "assignmentName": "Math 6 POD Wed 10/28",
    "prompt": "To find the distance between (-3, 4) and (5, 4), do you add or subtract the absolute values of the x-coordinates?",
    "question_type": "multiple_choice",
    "options": [
      {"label": "A", "text": "Add"},
      {"label": "B", "text": "Subtract"}
    ],
    "correct_answer": "A",
    "acceptable_alternatives": ["Add"],
    "points": 1,
    "rubric_notes": "Bridge: Forgetting to add absolute values across axis."
  },
  {
    "assignmentName": "Math 6 POD Wed 10/28",
    "prompt": "Write the coordinates of a point in Quadrant III.",
    "question_type": "expression",
    "correct_answer": "(-x, -y)",
    "acceptable_alternatives": ["any point with both negative coordinates"],
    "points": 1,
    "rubric_notes": "Recent: Coordinate Plane (2.4)."
  },
  {
    "assignmentName": "Math 6 POD Wed 10/28",
    "prompt": "Represent a withdrawal of $25 as an integer.",
    "question_type": "numeric",
    "correct_answer": "-25",
    "acceptable_alternatives": ["-$25"],
    "points": 1,
    "rubric_notes": "Distant: Understand Integers (2.1)."
  },
  {
    "assignmentName": "Math 6 POD Wed 10/28",
    "prompt": "A town map is drawn on a coordinate plane. The library is at (-4, -6) and the school is at (2, -6). If each unit represents 1 mile, how far apart are they?",
    "question_type": "numeric",
    "correct_answer": "6",
    "acceptable_alternatives": ["6 miles", "6 mi"],
    "points": 2,
    "rubric_notes": "Challenge: Distance on coordinate plane word problem."
  },
  {
    "assignmentName": "Math 6 POD Wed 10/28",
    "prompt": "Graph point A at (-2, 3) and point B at (-2, -1). What is the distance between them? Use absolute value to show your work.",
    "question_type": "multi_step",
    "correct_answer": "4",
    "acceptable_alternatives": ["4 units"],
    "points": 2,
    "rubric_notes": "Spiral (6.NS.C.8 & 6.NS.C.6C): Review target standard."
  },
  {
    "assignmentName": "Math 6 POD Thu 10/29",
    "prompt": "Divide: 432 \\div 12",
    "question_type": "numeric",
    "correct_answer": "36",
    "acceptable_alternatives": [],
    "points": 1,
    "rubric_notes": "Fluency: Long Division (6.NS.B.2 - Mastered)."
  },
  {
    "assignmentName": "Math 6 POD Thu 10/29",
    "prompt": "Find the distance between (-8, 2) and (1, 2).",
    "question_type": "numeric",
    "correct_answer": "9",
    "acceptable_alternatives": ["9 units"],
    "points": 1,
    "rubric_notes": "Lesson Practice: Distance."
  },
  {
    "assignmentName": "Math 6 POD Thu 10/29",
    "prompt": "True or False: The distance between (-5, 1) and (-5, 6) is |-5| + |6|.",
    "question_type": "multiple_choice",
    "options": [
      {"label": "A", "text": "True"},
      {"label": "B", "text": "False"}
    ],
    "correct_answer": "B",
    "acceptable_alternatives": ["False", "B"],
    "points": 1,
    "rubric_notes": "Lesson Practice: Common Misconception."
  },
  {
    "assignmentName": "Math 6 POD Thu 10/29",
    "prompt": "Which inequality is correct? A: -6 > -3, B: -2 > -5",
    "question_type": "multiple_choice",
    "options": [
      {"label": "A", "text": "-6 > -3"},
      {"label": "B", "text": "-2 > -5"}
    ],
    "correct_answer": "B",
    "acceptable_alternatives": ["B"],
    "points": 1,
    "rubric_notes": "Spiral (6.NS.C.7A): Trap buster."
  },
  {
    "assignmentName": "Math 6 POD Thu 10/29",
    "prompt": "Plot (0, -4). Which axis is this point located on?",
    "question_type": "multiple_choice",
    "options": [
      {"label": "A", "text": "x-axis"},
      {"label": "B", "text": "y-axis"}
    ],
    "correct_answer": "B",
    "acceptable_alternatives": ["B", "y-axis"],
    "points": 1,
    "rubric_notes": "Lesson Practice: 6.NS.C.6C."
  },
  {
    "assignmentName": "Math 6 POD Thu 10/29",
    "prompt": "Rectangle ABCD has vertices A(-2, 3), B(4, 3), C(4, -1), and D(-2, -1). Find the perimeter.",
    "question_type": "numeric",
    "correct_answer": "20",
    "acceptable_alternatives": ["20 units"],
    "points": 3,
    "rubric_notes": "Lesson Practice: Multi-step perimeter."
  },
  {
    "assignmentName": "Math 6 POD Fri 10/30",
    "prompt": "Multiply: 3.4 \\times 2.1",
    "question_type": "numeric",
    "correct_answer": "7.14",
    "acceptable_alternatives": [],
    "points": 1,
    "rubric_notes": "Fluency."
  },
  {
    "assignmentName": "Math 6 POD Fri 10/30",
    "prompt": "What is the distance from (3, -7) to (3, 5)?",
    "question_type": "numeric",
    "correct_answer": "12",
    "acceptable_alternatives": ["12 units"],
    "points": 1,
    "rubric_notes": "Lesson Test: Distances."
  },
  {
    "assignmentName": "Math 6 POD Fri 10/30",
    "prompt": "Identify the coordinates of the origin.",
    "question_type": "numeric",
    "correct_answer": "(0, 0)",
    "acceptable_alternatives": ["(0,0)", "0,0"],
    "points": 1,
    "rubric_notes": "Lesson Test: Basics."
  },
  {
    "assignmentName": "Math 6 POD Fri 10/30",
    "prompt": "A bank account balance is -$12. Another balance is -$5. Which balance represents more debt?",
    "question_type": "multiple_choice",
    "options": [
      {"label": "A", "text": "-$12"},
      {"label": "B", "text": "-$5"}
    ],
    "correct_answer": "A",
    "acceptable_alternatives": ["A"],
    "points": 1,
    "rubric_notes": "Spiral (6.NS.C.7B/C): Magnitude."
  },
  {
    "assignmentName": "Math 6 POD Fri 10/30",
    "prompt": "Explain the error: A student says the distance between (-3, 2) and (4, 2) is 1 unit.",
    "question_type": "multi_step",
    "correct_answer": "They subtracted the absolute values instead of adding them across the y-axis.",
    "acceptable_alternatives": ["Subtracted instead of added", "Should be 7"],
    "points": 2,
    "rubric_notes": "Lesson Test: Error Analysis."
  },
  {
    "assignmentName": "Math 6 POD Fri 10/30",
    "prompt": "If a point (x, y) is in Quadrant II, what are the signs of x and y?",
    "question_type": "multiple_choice",
    "options": [
      {"label": "A", "text": "x is positive, y is negative"},
      {"label": "B", "text": "x is negative, y is positive"},
      {"label": "C", "text": "x is negative, y is negative"}
    ],
    "correct_answer": "B",
    "acceptable_alternatives": ["B"],
    "points": 1,
    "rubric_notes": "Spiral (6.NS.C.6b)."
  }
]`;

// Test existing robustParseJson
const robustParseJson = (rawText) => {
  let cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  cleaned = cleaned.replace(/\\([a-zA-Z]+|[0-9]+)/g, (match, cmd) => {
    if (['n', 'r', 't'].includes(cmd)) return match;
    return '\\\\' + cmd;
  });
  return JSON.parse(cleaned);
};

try {
  const res = robustParseJson(input);
  console.log("Parsed questions:", res.length);
} catch (e) {
  console.log("FAIL:", e.message);
}
