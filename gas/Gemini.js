/**
 * ==============================================================================
 * WORKSHEET MAKER 2.0 - GEMINI VISION AI GRADING ENGINE
 * ==============================================================================
 */

/**
 * Sends a scanned worksheet PDF directly to Gemini Vision to extract
 * each student's ID # (from the unified ID # box), handwritten Name,
 * Assignment Code, and grade every problem against the official answer key.
 *
 * Supports both:
 *  - Single-student PDF scans (1 or 2 pages)
 *  - Multi-student batch PDFs scanned at the school copier (many worksheets in 1 PDF)
 *
 * @param {Blob} pdfBlob - The PDF file blob from Google Drive
 * @param {Object|null} manifest - The answer key manifest from Supabase (optional)
 * @returns {Object} Normalized object containing `{ assignmentCode, submissions: [...] }`
 */
const GEMINI_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];

/**
 * The exact reply shape Gemini must use when grading, so the format no longer
 * depends on an example in the prompt (example values used to leak into results).
 */
const GRADING_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    assignmentCode: { type: 'STRING' },
    assignmentTitle: { type: 'STRING' },
    submissions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          studentId: { type: 'STRING' },
          studentName: { type: 'STRING' },
          assignmentCode: { type: 'STRING' },
          assignmentTitle: { type: 'STRING' },
          confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
          questions: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                orderIndex: { type: 'INTEGER' },
                standard: { type: 'STRING' },
                studentAnswer: { type: 'STRING' },
                workShown: { type: 'STRING' },
                isCorrect: { type: 'BOOLEAN' },
                pointsEarned: { type: 'NUMBER' },
                pointsPossible: { type: 'NUMBER' },
                feedback: { type: 'STRING' }
              },
              required: ['orderIndex', 'studentAnswer', 'workShown', 'isCorrect', 'pointsEarned', 'pointsPossible', 'feedback']
            }
          }
        },
        required: ['studentId', 'confidence', 'questions']
      }
    }
  },
  required: ['submissions']
};

/**
 * Price of the grading model in US dollars per million tokens, used only for
 * the cost estimate shown after grading. These are the reported Gemini 3.8
 * Flash rates through Dec 31, 2026 (expected to double on Jan 1, 2027).
 * Override without editing code by setting the Script Properties
 * GEMINI_PRICE_INPUT_PER_MILLION and GEMINI_PRICE_OUTPUT_PER_MILLION.
 */
const GEMINI_PRICE_INPUT_PER_MILLION = 0.75;
const GEMINI_PRICE_OUTPUT_PER_MILLION = 3.75;

// Tokens used by Gemini calls during the current run (reset when grading starts)
var GEMINI_USAGE_ = { calls: 0, inputTokens: 0, outputTokens: 0 };

function resetGeminiUsage_() {
  GEMINI_USAGE_ = { calls: 0, inputTokens: 0, outputTokens: 0 };
}

/**
 * Adds one reply's token counts to the running total. Output includes the
 * model's hidden "thinking" tokens, which are billed at the output rate.
 */
function recordGeminiUsage_(usageMetadata) {
  const usage = usageMetadata || {};
  GEMINI_USAGE_.calls++;
  GEMINI_USAGE_.inputTokens += Number(usage.promptTokenCount) || 0;
  GEMINI_USAGE_.outputTokens += (Number(usage.candidatesTokenCount) || 0) + (Number(usage.thoughtsTokenCount) || 0);
}

/**
 * One-line summary of what the current run's Gemini calls cost, or '' if none ran.
 */
function describeGeminiUsage_() {
  if (GEMINI_USAGE_.calls === 0) return '';
  const props = PropertiesService.getScriptProperties();
  const priceIn = Number(props.getProperty('GEMINI_PRICE_INPUT_PER_MILLION')) || GEMINI_PRICE_INPUT_PER_MILLION;
  const priceOut = Number(props.getProperty('GEMINI_PRICE_OUTPUT_PER_MILLION')) || GEMINI_PRICE_OUTPUT_PER_MILLION;
  const withCommas = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (GEMINI_USAGE_.inputTokens + GEMINI_USAGE_.outputTokens === 0) {
    return `💲 AI usage: ${GEMINI_USAGE_.calls} request(s); Gemini did not report token counts, so no cost estimate.`;
  }

  const dollars = (GEMINI_USAGE_.inputTokens * priceIn + GEMINI_USAGE_.outputTokens * priceOut) / 1000000;
  const cents = dollars * 100;
  const costText = cents < 1 ? 'under 1¢' : (cents < 100 ? `about ${Math.round(cents)}¢` : `about $${dollars.toFixed(2)}`);
  return `💲 AI cost for this run: ${costText} (${withCommas(GEMINI_USAGE_.inputTokens)} tokens in, ${withCommas(GEMINI_USAGE_.outputTokens)} out, ${GEMINI_USAGE_.calls} request(s), priced at $${priceIn} / $${priceOut} per million).`;
}

function gradeWorksheetWithGemini(pdfBlob, manifest) {
  requireTeacher_();
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error("Gemini API Key is not set. Please go to '📐 Math Autograder ➔ ⚙️ Set Gemini API Key'.");
  }

  const configuredModel = props.getProperty('GEMINI_MODEL') || GEMINI_MODEL;
  const base64Data = Utilities.base64Encode(pdfBlob.getBytes());

  let promptText = `You are an expert automated grading system for middle school math worksheets (Worksheet Maker 2.0) scanned at 300 DPI.
Your job is to read the handwritten student submission(s) in this PDF and grade each student's work with high accuracy.

LAYOUT & HEADER EXTRACTION RULES:
1. STUDENT ID ("studentId"):
   - Look in the top-right header area directly to the left of the QR code for the large box labeled "STUDENT ID #" (or "ID #").
   - Copy the exact 2-digit or 3-digit number written inside the box, keeping any leading zero. Strip any leading "#" or spaces.
   - If the box is blank or you cannot read it with confidence, return "". Never guess a number.
2. STUDENT NAME ("studentName"):
   - Privacy-safe OCR worksheets only use the Student ID box and do not have a Name line; return "" unless a legacy worksheet has a handwritten name.
3. ASSIGNMENT CODE ("assignmentCode"):
   - Copy the printed Assignment Code in the top-right corner next to the QR code or in the header, exactly as printed on that student's page.
   - If you cannot read it, return "". Never fill it in from memory or from these instructions.
4. ASSIGNMENT TITLE ("assignmentTitle"):
   - Copy the exact printed assignment title in the header. If you cannot read it, return "".
5. MULTI-PAGE / COPIER BATCH SUPPORT:
   - A single PDF file may contain ONE student's worksheet (1 or 2 pages) OR a stack of MULTIPLE students' worksheets scanned together at the copier.
   - Group pages belonging to the same student together, and output one entry per student in the "submissions" array.

GRADING & MATHEMATICAL EQUIVALENCE RULES:
For each question on the student's worksheet:
- Use the question's number as "orderIndex". When an Official Answer Key is given below, return exactly one entry for every question in the key, using the key's order_index, even if the student left it blank (then "studentAnswer" is "" and "pointsEarned" is 0).
- Identify the NJSLS / Common Core Standard from the Official Answer Key or the standard badge printed on the question header, and return it as "standard".
- Read the student's final answer in the "FINAL ANSWER" box (or selected bubble A/B/C/D for multiple choice). Write down what the student actually wrote, even when it is wrong; do not replace it with the expected answer.
- Mathematical Equivalence: Accept mathematically equivalent answers (for example a decimal and its equal fraction, or an answer with and without "x =") unless the prompt or rubric explicitly requires a specific form (such as simplest fraction form).

SCRATCH WORK & PARTIAL CREDIT (apply to EVERY question, not only correct ones):
- The scratch work in the open workspace above the answer box is part of the student's answer. Read it for every question BEFORE deciding the score, and describe what you saw in "workShown" in a few words (for example which steps or calculations are written). Use "no work shown" only when the workspace is truly empty.
- Full credit: the final answer is correct or mathematically equivalent.
- Answer outside the box: if the "FINAL ANSWER" box is empty but the student clearly reached a final answer in the workspace (for example it is circled, boxed, underlined, or is the last line of the work), treat that as the student's final answer. Record it in "studentAnswer", say in the feedback that it was found in the work area, and give full credit if it is correct. Only report a blank answer when no final answer appears anywhere for that question.
- Partial credit: when the final answer is wrong, incomplete or blank, go through the question's rubric notes one step at a time and award the points for every step the student's work clearly shows done correctly. For example, on a 2-point question whose rubric gives 1 point for the setup and 1 point for the result, a correct setup followed by a calculation slip earns 1 point.
- Award a rubric step only for something the student actually wrote. If a step describes what the student should recognise or understand, give the point only when the written work or the answer shows it. Never give a point merely because a number from the question was left unchanged or copied; the answer must also show the change the question asks for.
- If a question has no rubric notes, award up to half of its points when the work shows a correct method that went wrong through a small calculation, sign or copying slip.
- Do not award partial credit for a wrong answer with no supporting work, and never give more than the question's points.
- Diagnostic Feedback: Provide a concise, constructive note saying which steps were earned and where the work went wrong, ending with the question's standard code in square brackets.

CONFIDENCE ("confidence"), one value per student:
- "high": the Student ID and every answer were clearly legible.
- "medium": one or two characters were unclear but you are fairly sure of your reading.
- "low": the Student ID or any answer was hard to read, smudged, cut off or ambiguous.

Output ONLY valid JSON: an object with "assignmentCode", "assignmentTitle" and a "submissions" array.
Each submission has "studentId", "studentName", "assignmentCode", "assignmentTitle", "confidence" and a "questions" array.
Each question has "orderIndex" (number), "standard", "studentAnswer", "workShown", "isCorrect" (true/false), "pointsEarned" (number), "pointsPossible" (number) and "feedback".`;

  if (manifest && manifest.questions) {
    const wsInfo = manifest.worksheet || {};
    // Only the fields the grader needs; layout data would just be noise
    const keyForPrompt = manifest.questions.map(q => ({
      order_index: q.order_index,
      page_number: q.page_number,
      question_type: q.question_type,
      standard: q.standard,
      prompt: q.prompt,
      options: q.options,
      correct_answer: q.correct_answer,
      acceptable_alternatives: q.acceptable_alternatives,
      points: q.points,
      rubric_notes: q.rubric_notes
    }));
    promptText += `\n\nOFFICIAL WORKSHEET METADATA:\nTitle: ${wsInfo.title || 'Math Assignment'}\nShort Code: ${wsInfo.short_code || ''}\nTotal Pages per Student: ${wsInfo.total_pages || 1}\n\nOFFICIAL ANSWER KEY & RUBRIC:\n${JSON.stringify(keyForPrompt, null, 2)}`;
  }

  return normalizeGradeResult_(callGeminiForJson_(apiKey, configuredModel, promptText, base64Data, GRADING_RESPONSE_SCHEMA), manifest);
}

/**
 * Asks Gemini only which assignment(s) a scanned PDF contains, without grading.
 * Used when neither the teacher nor the file name says which answer key applies.
 * @returns {Array<{assignmentCode: string, assignmentTitle: string}>} one entry per distinct code read
 */
function identifyWorksheetWithGemini_(pdfBlob) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error("Gemini API Key is not set. Please go to '📐 Math Autograder ➔ ⚙️ Set Gemini API Key'.");
  }

  const promptText = `This PDF is a scan of one or more printed math worksheets.
Each worksheet has a printed Assignment Code in the top-right header next to a QR code (a short code of letters and digits, sometimes with a hyphen) and a printed assignment title in the header.

Look at every page and list each DISTINCT Assignment Code that appears, with the printed title of that worksheet.
Copy the code and title exactly as printed. Do not guess: if a code cannot be read, leave it out.

Output ONLY valid JSON in this shape:
{ "worksheets": [ { "assignmentCode": "", "assignmentTitle": "" } ] }`;

  const parsed = callGeminiForJson_(
    apiKey,
    props.getProperty('GEMINI_MODEL') || GEMINI_MODEL,
    promptText,
    Utilities.base64Encode(pdfBlob.getBytes())
  );

  const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.worksheets) ? parsed.worksheets : [parsed]);
  const seen = {};
  const worksheets = [];
  list.forEach(w => {
    const code = String((w && w.assignmentCode) || '').trim().toUpperCase();
    if (!code || seen[code]) return;
    seen[code] = true;
    worksheets.push({ assignmentCode: code, assignmentTitle: String((w && w.assignmentTitle) || '').trim() });
  });
  return worksheets;
}

/**
 * Sends a prompt plus a PDF to Gemini and returns the parsed JSON reply.
 * Tries the fallback models when a model name is unknown (404), waits and
 * retries when Gemini is busy (429 / 503), and refuses a reply that was cut off.
 * When a reply schema is given, Gemini must answer in exactly that shape; if the
 * model does not accept the schema (400), the request is repeated without it.
 */
function callGeminiForJson_(apiKey, configuredModel, promptText, base64Pdf, responseSchema) {
  const buildOptions = function(schema) {
    const generationConfig = {
      responseMimeType: 'application/json',
      temperature: 0.1
    };
    if (schema) generationConfig.responseSchema = schema;
    return {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inlineData: { mimeType: 'application/pdf', data: base64Pdf } }
          ]
        }],
        generationConfig: generationConfig
      }),
      muteHttpExceptions: true
    };
  };
  const schemaOptions = buildOptions(responseSchema);
  let options = schemaOptions;

  const modelsToTry = [configuredModel, ...FALLBACK_MODELS.filter(m => m !== configuredModel)];
  const busyWaitsMs = [4000, 12000];
  let response = null;
  let status = 0;

  for (const modelName of modelsToTry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    for (let attempt = 0; ; attempt++) {
      response = UrlFetchApp.fetch(endpoint, options);
      status = response.getResponseCode();
      if ((status === 429 || status === 503) && attempt < busyWaitsMs.length) {
        Utilities.sleep(busyWaitsMs[attempt]);
        continue;
      }
      if (status === 400 && responseSchema && options === schemaOptions) {
        // This model rejected the reply-shape rules: ask again without them
        options = buildOptions(null);
        attempt = -1;
        continue;
      }
      break;
    }
    if (status !== 404) break;
  }

  if (status !== 200) {
    throw new Error(`Gemini API Error (Status ${status}): ${response.getContentText().slice(0, 300)}`);
  }

  const resJson = JSON.parse(response.getContentText());
  recordGeminiUsage_(resJson.usageMetadata);
  const firstCandidate = resJson.candidates?.[0];
  if (firstCandidate?.finishReason === 'MAX_TOKENS') {
    throw new Error('Gemini ran out of room before finishing its reply. Scan fewer worksheets into one PDF and try again.');
  }

  const text = firstCandidate?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No response generated from Gemini Vision.');
  }
  return parseGradingJson_(text);
}

/**
 * Parses the model's JSON reply, tolerating a ```json code fence around it.
 */
function parseGradingJson_(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Gemini returned a reply that is not valid JSON: ${cleaned.slice(0, 200)}`);
  }
}

/**
 * Normalizes the model reply so callers always receive
 * `{ assignmentCode, assignmentTitle, submissions: [...] }`, with every
 * submission's totals recomputed in code from its questions.
 * An assignment code the model could not read comes back as "" (never a guess).
 */
function normalizeGradeResult_(parsed, manifest) {
  const cleanCode = v => String(v || '').trim().toUpperCase();
  const cleanTitle = v => String(v || '').trim();

  // The model occasionally returns one flat submission instead of a "submissions" array
  const rawSubmissions = Array.isArray(parsed.submissions) && parsed.submissions.length > 0
    ? parsed.submissions
    : [parsed];

  const topCode = cleanCode(parsed.assignmentCode || rawSubmissions[0].assignmentCode);
  const topTitle = cleanTitle(parsed.assignmentTitle || rawSubmissions[0].assignmentTitle);
  const keyPoints = getAnswerKeyPoints_(manifest);

  return {
    assignmentCode: topCode,
    assignmentTitle: topTitle,
    submissions: rawSubmissions.map(s => ({
      ...scoreSubmission_(s, keyPoints),
      assignmentCode: cleanCode(s.assignmentCode) || topCode,
      assignmentTitle: cleanTitle(s.assignmentTitle) || topTitle
    }))
  };
}

/**
 * Maps each question's order_index to its point value from the answer key.
 * @returns {Object|null} e.g. { 1: 2, 2: 1 }, or null when there is no answer key
 */
function getAnswerKeyPoints_(manifest) {
  if (!manifest || !Array.isArray(manifest.questions) || manifest.questions.length === 0) return null;
  const points = {};
  manifest.questions.forEach(q => {
    const value = Number(q.points);
    if (q.order_index != null && isFinite(value)) points[q.order_index] = value;
  });
  return Object.keys(points).length > 0 ? points : null;
}

/**
 * Recomputes a submission's totals from its questions instead of trusting the
 * model's arithmetic.
 *
 * With an answer key, the questions are lined up to the key by question number:
 * every key question appears exactly once, in order. A question the model did
 * not return is added as "not graded" (worth 0, listed in `missingQuestions`)
 * so later answers can never slide into the wrong question's column.
 * Points possible come from the key; points earned are clamped to 0..possible.
 */
function scoreSubmission_(submission, keyPoints) {
  const round2 = n => Math.round(n * 100) / 100;
  const toNumber = v => {
    const n = parseFloat(v);
    return isFinite(n) ? n : 0;
  };
  const sum = values => round2(values.reduce((total, v) => total + v, 0));
  const rawQuestions = Array.isArray(submission.questions) ? submission.questions : [];

  if (!keyPoints) {
    if (rawQuestions.length === 0) {
      // Nothing to add up: keep whatever totals the model reported
      return {
        ...submission,
        questions: [],
        missingQuestions: [],
        totalScore: toNumber(submission.totalScore),
        totalPossible: toNumber(submission.totalPossible)
      };
    }
    const questions = rawQuestions.map(q => {
      const pointsPossible = Math.max(0, toNumber(q.pointsPossible));
      const pointsEarned = Math.min(Math.max(0, toNumber(q.pointsEarned)), pointsPossible);
      return { ...q, pointsEarned: round2(pointsEarned), pointsPossible: round2(pointsPossible) };
    });
    return {
      ...submission,
      questions: questions,
      missingQuestions: [],
      totalScore: sum(questions.map(q => q.pointsEarned)),
      totalPossible: sum(questions.map(q => q.pointsPossible))
    };
  }

  const keyNumbers = Object.keys(keyPoints).map(Number).sort((x, y) => x - y);

  // Match the model's questions to the key by question number (first one wins)
  const byNumber = {};
  rawQuestions.forEach(q => {
    const n = parseInt(q.orderIndex, 10);
    if (keyPoints[n] !== undefined && byNumber[n] === undefined) byNumber[n] = q;
  });
  // If the model numbered nothing usefully but returned exactly one answer per
  // key question, its order is the only information there is: use it.
  if (Object.keys(byNumber).length === 0 && rawQuestions.length === keyNumbers.length) {
    keyNumbers.forEach((n, i) => { byNumber[n] = rawQuestions[i]; });
  }

  const missingQuestions = [];
  const questions = keyNumbers.map(n => {
    const pointsPossible = round2(keyPoints[n]);
    const q = byNumber[n];
    if (!q) {
      missingQuestions.push(n);
      return {
        orderIndex: n,
        studentAnswer: '',
        isCorrect: false,
        pointsEarned: 0,
        pointsPossible: pointsPossible,
        feedback: 'Not graded: the AI did not return this question.',
        notGraded: true
      };
    }
    const pointsEarned = Math.min(Math.max(0, toNumber(q.pointsEarned)), pointsPossible);
    return { ...q, orderIndex: n, pointsEarned: round2(pointsEarned), pointsPossible: pointsPossible };
  });

  return {
    ...submission,
    questions: questions,
    missingQuestions: missingQuestions,
    totalScore: sum(questions.map(q => q.pointsEarned)),
    totalPossible: sum(questions.map(q => q.pointsPossible))
  };
}

/**
 * Lightweight helper to detect the Assignment Code from a PDF filename first,
 * avoiding an extra Gemini Vision call whenever the filename already starts
 * with or contains the code (e.g. "ALG-701_Scan.pdf" or "M4821.pdf").
 *
 * @param {string} fileName - Name of the file in Google Drive
 * @returns {string|null} Detected short code or null
 */
function detectAssignmentCodeFromFileName(fileName) {
  if (!fileName) return null;
  // Match patterns like ALG-701, M1024, MATH-101, etc.
  // Letters/digits must not touch the code, but "_" may (as in "ALG-701_Scan.pdf")
  const match = String(fileName).match(/(?<![A-Za-z0-9])([A-Z]{1,5}-?\d{3,5})(?![A-Za-z0-9])/i);
  return match ? match[1].toUpperCase() : null;
}
