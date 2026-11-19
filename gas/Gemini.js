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
   - Extract the exact 2-digit or 3-digit ID number written inside the box (e.g., "14", "07", "23", "104", "215"). Strip any leading "#" or spaces. If blank or unreadable, return "".
2. STUDENT NAME ("studentName"):
   - Privacy-safe OCR worksheets only use the Student ID box and do not have a Name line; return "" unless a legacy worksheet has a handwritten name.
3. ASSIGNMENT CODE ("assignmentCode"):
   - Read the printed Assignment Code in the top-right corner next to the QR code or in the header (e.g., "ALG-701", "M4821", "M8539", "M6287").
4. ASSIGNMENT TITLE ("assignmentTitle"):
   - Read the exact printed assignment title in the header (e.g., "Math 6 POD Mon 11/2", "Math 6 POD Tue 11/3", "Accelerated POD Mon 11/2", "Accelerated POD Tue 11/3").
5. MULTI-PAGE / COPIER BATCH SUPPORT:
   - A single PDF file may contain ONE student's worksheet (1 or 2 pages) OR a stack of MULTIPLE students' worksheets scanned together at the copier.
   - Group pages belonging to the same student together, and output one entry per student in the "submissions" array.

GRADING & MATHEMATICAL EQUIVALENCE RULES:
For each question on the student's worksheet:
- Identify the NJSLS / Common Core Standard (e.g., "7.EE.B.4", "6.NS.C.7a") from the Official Answer Key or the standard badge printed on the question header.
- Read the student's final answer in the "FINAL ANSWER" box (or selected bubble A/B/C/D for multiple choice).
- Inspect the student's scratch work in the open workspace area above the answer box.
- Mathematical Equivalence: Accept mathematically equivalent answers (e.g., "0.5", ".5", and "1/2"; or "x = 4" and "4") unless the prompt or rubric explicitly requires a specific form (such as simplest fraction form).
- Partial Credit: If the final answer has a minor arithmetic sign/rounding error but the workspace clearly demonstrates the correct algebraic method, award appropriate partial credit if warranted by the rubric notes.
- Diagnostic Feedback: Provide a concise, constructive diagnostic note ending with the standard tag in brackets, e.g., "Correct solution. [7.EE.B.4]" or "Distributed -3 to first term only; sign error on constant. [7.EE.A.1]".

Output ONLY valid JSON matching this exact schema:
{
  "assignmentCode": "ALG-701",
  "assignmentTitle": "Accelerated POD Mon 11/2",
  "submissions": [
    {
      "studentId": "104",
      "studentName": "Alex Rivera",
      "assignmentCode": "ALG-701",
      "assignmentTitle": "Accelerated POD Mon 11/2",
      "confidence": "high",
      "questions": [
        {
          "orderIndex": 1,
          "standard": "7.EE.A.1",
          "studentAnswer": "12.78",
          "isCorrect": true,
          "pointsEarned": 2.0,
          "pointsPossible": 2.0,
          "feedback": "Correct substitution and evaluation. [7.EE.A.1]"
        }
      ],
      "totalScore": 2.0,
      "totalPossible": 2.0
    }
  ]
}`;

  if (manifest && manifest.questions) {
    const wsInfo = manifest.worksheet || {};
    promptText += `\n\nOFFICIAL WORKSHEET METADATA:\nTitle: ${wsInfo.title || 'Math Assignment'}\nShort Code: ${wsInfo.short_code || ''}\nTotal Pages per Student: ${wsInfo.total_pages || 1}\n\nOFFICIAL ANSWER KEY & RUBRIC:\n${JSON.stringify(manifest.questions, null, 2)}`;
  }

  return normalizeGradeResult_(callGeminiForJson_(apiKey, configuredModel, promptText, base64Data), manifest);
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
 */
function callGeminiForJson_(apiKey, configuredModel, promptText, base64Pdf) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{
        parts: [
          { text: promptText },
          { inlineData: { mimeType: 'application/pdf', data: base64Pdf } }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    }),
    muteHttpExceptions: true
  };

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
      break;
    }
    if (status !== 404) break;
  }

  if (status !== 200) {
    throw new Error(`Gemini API Error (Status ${status}): ${response.getContentText().slice(0, 300)}`);
  }

  const resJson = JSON.parse(response.getContentText());
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
