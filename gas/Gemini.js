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

/**
 * Above this size a PDF is uploaded to Gemini's file service instead of being
 * sent inside the request (inline requests are size-limited, and base64 adds a third).
 */
const INLINE_PDF_MAX_BYTES = 14 * 1024 * 1024;

/**
 * Reply shape for the ID check: each student's ID, in page order.
 */
const ID_CHECK_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    students: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { studentId: { type: 'STRING' } },
        required: ['studentId']
      }
    }
  },
  required: ['students']
};

function getGeminiSettings_() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error("Gemini API Key is not set. Please go to '📐 Math Autograder ➔ ⚙️ Set Gemini API Key'.");
  }
  return {
    apiKey: apiKey,
    model: props.getProperty('GEMINI_MODEL') || GEMINI_MODEL,
    // The ID check is on unless the Script Property ID_CHECK is set to "off"
    idCheck: String(props.getProperty('ID_CHECK') || 'on').trim().toLowerCase() !== 'off'
  };
}

/**
 * Gets a scanned PDF ready to send to Gemini, once per file. Small PDFs travel
 * inside each request; large ones are uploaded once and referenced by address.
 * Call release() when finished so an uploaded copy is deleted.
 * @returns {{part: Object, release: Function}}
 */
function preparePdfForGemini_(pdfBlob) {
  const settings = getGeminiSettings_();
  const bytes = pdfBlob.getBytes();
  if (bytes.length <= INLINE_PDF_MAX_BYTES) {
    return {
      part: { inlineData: { mimeType: 'application/pdf', data: Utilities.base64Encode(bytes) } },
      release: function() {}
    };
  }
  const uploaded = uploadPdfToGemini_(settings.apiKey, bytes, pdfBlob.getName() || 'scan.pdf');
  return {
    part: { fileData: { mimeType: 'application/pdf', fileUri: uploaded.uri } },
    release: function() { deleteGeminiFile_(settings.apiKey, uploaded.name); }
  };
}

/**
 * Uploads a PDF to the Gemini Files API (resumable upload) and waits until
 * Gemini has finished processing it.
 */
function uploadPdfToGemini_(apiKey, bytes, displayName) {
  const start = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.length),
      'X-Goog-Upload-Header-Content-Type': 'application/pdf'
    },
    payload: JSON.stringify({ file: { display_name: String(displayName).slice(0, 120) } }),
    muteHttpExceptions: true
  });
  const startHeaders = start.getAllHeaders();
  const uploadUrlKey = Object.keys(startHeaders).filter(k => k.toLowerCase() === 'x-goog-upload-url')[0];
  if (start.getResponseCode() !== 200 || !uploadUrlKey) {
    throw new Error(`Could not start uploading the large PDF to Gemini (Status ${start.getResponseCode()}): ${start.getContentText().slice(0, 200)}`);
  }

  const upload = UrlFetchApp.fetch(startHeaders[uploadUrlKey], {
    method: 'post',
    contentType: 'application/pdf',
    headers: {
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize'
    },
    payload: bytes,
    muteHttpExceptions: true
  });
  if (upload.getResponseCode() !== 200) {
    throw new Error(`Uploading the large PDF to Gemini failed (Status ${upload.getResponseCode()}): ${upload.getContentText().slice(0, 200)}`);
  }

  let file = JSON.parse(upload.getContentText()).file || {};
  for (let waited = 0; file.state === 'PROCESSING' && waited < 90000; waited += 3000) {
    Utilities.sleep(3000);
    const check = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}?key=${apiKey}`, { muteHttpExceptions: true });
    if (check.getResponseCode() === 200) file = JSON.parse(check.getContentText());
  }
  if (!file.uri || (file.state && file.state !== 'ACTIVE')) {
    throw new Error(`Gemini could not process the large PDF (state: ${file.state || 'unknown'}).`);
  }
  return { uri: file.uri, name: file.name };
}

function deleteGeminiFile_(apiKey, name) {
  if (!name) return;
  try {
    UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/${name}?key=${apiKey}`, { method: 'delete', muteHttpExceptions: true });
  } catch (e) {
    console.warn('Could not delete uploaded PDF from Gemini (it expires on its own in 48 hours):', e);
  }
}

/**
 * Builds the grading instructions, including every answer key that may apply.
 */
function buildGradingPrompt_(manifests) {
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
   - Group pages belonging to the same student together, and output one entry per student in the "submissions" array, in the order the students appear in the PDF.

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

  if (manifests.length > 1) {
    promptText += `\n\nMORE THAN ONE ASSIGNMENT: this PDF contains worksheets for ${manifests.length} different assignments. For each student, read the Assignment Code printed on that student's page, set "assignmentCode" to it, and grade that student ONLY against the answer key with the same Short Code below.`;
  }

  manifests.forEach(manifest => {
    const wsInfo = manifest.worksheet || {};
    // Only the fields the grader needs; layout data would just be noise
    const keyForPrompt = (manifest.questions || []).map(q => ({
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
    promptText += `\n\nOFFICIAL WORKSHEET METADATA:\nTitle: ${wsInfo.title || 'Math Assignment'}\nShort Code: ${wsInfo.short_code || ''}\nTotal Pages per Student: ${wsInfo.total_pages || 1}\n\nOFFICIAL ANSWER KEY & RUBRIC (Short Code ${wsInfo.short_code || ''}):\n${JSON.stringify(keyForPrompt, null, 2)}`;
  });

  return promptText;
}

/**
 * Instructions for the ID check: read each student's ID and nothing else.
 */
function buildIdCheckPrompt_() {
  return `This PDF contains one or more students' printed math worksheets. A student's worksheet may have several pages; only its first page has the header.
For each student's worksheet, in page order, copy "studentId": the number written in the box labeled "STUDENT ID #" (or "ID #") in the top-right header. Keep leading zeros. Use "" if it is blank or unreadable. Never guess.
Read nothing else. Output ONLY valid JSON: { "students": [ { "studentId": "" } ] }`;
}

/**
 * Grades a scanned PDF against one or more answer keys.
 * When the ID check is on, a second request that reads only the student IDs is
 * sent at the same moment, and any paper whose ID it reads differently is
 * marked for review. Answers are read once.
 *
 * @param {Blob|{part: Object}} pdf - the PDF, or the result of preparePdfForGemini_
 * @param {Object|Object[]} manifestOrList - answer key manifest(s) from Supabase
 * @returns {Object} `{ assignmentCode, assignmentTitle, submissions, notes }`
 */
function gradeWorksheetWithGemini(pdf, manifestOrList) {
  requireTeacher_();
  const settings = getGeminiSettings_();
  const manifests = (Array.isArray(manifestOrList) ? manifestOrList : [manifestOrList]).filter(Boolean);

  const prepared = pdf && pdf.part ? pdf : preparePdfForGemini_(pdf);
  try {
    const jobs = [{ promptText: buildGradingPrompt_(manifests), schema: GRADING_RESPONSE_SCHEMA }];
    if (settings.idCheck) {
      jobs.push({ promptText: buildIdCheckPrompt_(), schema: ID_CHECK_RESPONSE_SCHEMA });
    }

    const results = callGeminiJobs_(settings, prepared.part, jobs);
    if (results[0].error) throw results[0].error;

    const graded = normalizeGradeResult_(results[0].value, manifests);
    graded.notes = [];
    if (settings.idCheck) {
      if (results[1].error) {
        graded.notes.push('ID check failed, so student IDs were not double-checked: ' + String(results[1].error.message || results[1].error).slice(0, 120));
      } else {
        applyIdCheck_(graded, results[1].value);
      }
    }
    return graded;
  } finally {
    if (prepared !== pdf) prepared.release();
  }
}

/**
 * Asks Gemini only which assignment(s) a scanned PDF contains, without grading.
 * Used when neither the teacher nor the file name says which answer key applies.
 * @param {Blob|{part: Object}} pdf - the PDF, or the result of preparePdfForGemini_
 * @returns {Array<{assignmentCode: string, assignmentTitle: string}>} one entry per distinct code read
 */
function identifyWorksheetWithGemini_(pdf) {
  const settings = getGeminiSettings_();
  const promptText = `This PDF is a scan of one or more printed math worksheets.
Each worksheet has a printed Assignment Code in the top-right header next to a QR code (a short code of letters and digits, sometimes with a hyphen) and a printed assignment title in the header.

Look at every page and list each DISTINCT Assignment Code that appears, with the printed title of that worksheet.
Copy the code and title exactly as printed. Do not guess: if a code cannot be read, leave it out.

Output ONLY valid JSON in this shape:
{ "worksheets": [ { "assignmentCode": "", "assignmentTitle": "" } ] }`;

  const prepared = pdf && pdf.part ? pdf : preparePdfForGemini_(pdf);
  let parsed;
  try {
    parsed = callGeminiForJson_(settings.apiKey, settings.model, promptText, prepared.part);
  } finally {
    if (prepared !== pdf) prepared.release();
  }

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

function buildGeminiRequestOptions_(promptText, pdfPart, schema) {
  const generationConfig = {
    responseMimeType: 'application/json',
    temperature: 0.1
  };
  if (schema) generationConfig.responseSchema = schema;
  return {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{ parts: [{ text: promptText }, pdfPart] }],
      generationConfig: generationConfig
    }),
    muteHttpExceptions: true
  };
}

/**
 * Reads one successful Gemini reply: records its token use, refuses a reply
 * that was cut off, and parses the JSON it contains.
 */
function parseGeminiReply_(response) {
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
 * Sends several requests about the same PDF at the same moment. Any request
 * that does not succeed first time is retried on its own with the usual
 * fallbacks. Never throws: each result is `{value}` or `{error}`.
 */
function callGeminiJobs_(settings, pdfPart, jobs) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.apiKey}`;
  let responses = [];
  try {
    responses = UrlFetchApp.fetchAll(jobs.map(job => Object.assign(
      { url: endpoint },
      buildGeminiRequestOptions_(job.promptText, pdfPart, job.schema)
    )));
  } catch (e) {
    responses = [];
  }

  return jobs.map((job, i) => {
    const response = responses[i];
    try {
      if (response && response.getResponseCode() === 200) {
        return { value: parseGeminiReply_(response) };
      }
      return { value: callGeminiForJson_(settings.apiKey, settings.model, job.promptText, pdfPart, job.schema) };
    } catch (err) {
      return { error: err };
    }
  });
}

/**
 * Sends a prompt plus a PDF to Gemini and returns the parsed JSON reply.
 * Tries the fallback models when a model name is unknown (404), waits and
 * retries when Gemini is busy (429 / 503), and refuses a reply that was cut off.
 * When a reply schema is given, Gemini must answer in exactly that shape; if the
 * model does not accept the schema (400), the request is repeated without it.
 * @param {Object} pdfPart - `{inlineData: ...}` or `{fileData: ...}` from preparePdfForGemini_
 */
function callGeminiForJson_(apiKey, configuredModel, promptText, pdfPart, responseSchema) {
  const schemaOptions = buildGeminiRequestOptions_(promptText, pdfPart, responseSchema);
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
        options = buildGeminiRequestOptions_(promptText, pdfPart, null);
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
  return parseGeminiReply_(response);
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
 * Each submission gets `manifest`: the answer key it was scored against, or
 * null when it carries a code that matches none of the keys (mixed stacks).
 * An assignment code the model could not read comes back as "" (never a guess).
 */
function normalizeGradeResult_(parsed, manifestOrList) {
  const manifests = (Array.isArray(manifestOrList) ? manifestOrList : [manifestOrList]).filter(Boolean);
  const cleanCode = v => String(v || '').trim().toUpperCase();
  const cleanTitle = v => String(v || '').trim();

  // The model occasionally returns one flat submission instead of a "submissions" array
  const rawSubmissions = Array.isArray(parsed.submissions) && parsed.submissions.length > 0
    ? parsed.submissions
    : [parsed];

  const topCode = cleanCode(parsed.assignmentCode || rawSubmissions[0].assignmentCode);
  const topTitle = cleanTitle(parsed.assignmentTitle || rawSubmissions[0].assignmentTitle);

  const byCode = {};
  manifests.forEach(m => { byCode[cleanCode(m.worksheet && m.worksheet.short_code)] = m; });

  return {
    assignmentCode: topCode,
    assignmentTitle: topTitle,
    submissions: rawSubmissions.map(s => {
      const pageCode = cleanCode(s.assignmentCode) || topCode;
      const manifest = manifests.length === 1 ? manifests[0] : (byCode[pageCode] || null);
      return {
        ...scoreSubmission_(s, getAnswerKeyDetails_(manifest)),
        assignmentCode: pageCode,
        assignmentTitle: cleanTitle(s.assignmentTitle) || topTitle,
        manifest: manifest
      };
    })
  };
}

/**
 * Maps each question's order_index to what the key says about it.
 * @returns {Object|null} e.g. { 1: {points, type, expected, rubric}, ... }, or null without a key
 */
function getAnswerKeyDetails_(manifest) {
  if (!manifest || !Array.isArray(manifest.questions) || manifest.questions.length === 0) return null;
  const details = {};
  manifest.questions.forEach(q => {
    const value = Number(q.points);
    if (q.order_index == null || !isFinite(value)) return;
    const alternatives = Array.isArray(q.acceptable_alternatives) ? q.acceptable_alternatives : [];
    details[q.order_index] = {
      points: value,
      type: String(q.question_type || '').toLowerCase(),
      expected: [q.correct_answer].concat(alternatives).map(v => String(v === undefined || v === null ? '' : v).trim()).filter(Boolean),
      rubric: String(q.rubric_notes || '')
    };
  });
  return Object.keys(details).length > 0 ? details : null;
}

/**
 * Maps each question's order_index to its point value from the answer key.
 * @returns {Object|null} e.g. { 1: 2, 2: 1 }, or null when there is no answer key
 */
function getAnswerKeyPoints_(manifest) {
  const details = getAnswerKeyDetails_(manifest);
  if (!details) return null;
  const points = {};
  Object.keys(details).forEach(n => { points[n] = details[n].points; });
  return points;
}

/** "A", "(b)", "C) 14" -> the choice letter; otherwise ''. */
function choiceLetter_(value) {
  const m = String(value || '').trim().match(/^\(?\s*([A-D])\s*\)?(?=$|[\s.):,-])/i);
  return m ? m[1].toUpperCase() : '';
}

/** Lower-case, spaceless form of an answer for exact comparison. */
function canonicalAnswerText_(value) {
  return String(value || '')
    .replace(/[−–—]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^[a-z]=/, '')
    .replace(/\$/g, '')
    .replace(/\.$/, '');
}

/**
 * Reads a written answer as a single number when it plainly is one:
 * "12", "-8", "x = 5", "$42", "15%", "0.5", ".5", "3/4", "7 7/8", "12 bouquets".
 * Lists, coordinates and expressions return null.
 */
function parseAnswerNumber_(value) {
  let t = String(value || '').trim()
    .replace(/[−–—]/g, '-')
    .replace(/^[a-z]\s*=\s*/i, '')
    .replace(/\$/g, '')
    .trim();
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?/.test(t)) t = t.replace(/,(?=\d{3})/g, '');
  t = t.replace(/\s*(%|percent|degrees?|°.*|\^\\circ.*|[a-z][a-z ]*)$/i, '').trim();

  let m = t.match(/^(-?)(\d+)\s+(\d+)\/(\d+)$/);
  if (m) {
    const whole = Number(m[2]) + Number(m[3]) / Number(m[4]);
    return Number(m[4]) === 0 ? null : (m[1] ? -whole : whole);
  }
  m = t.match(/^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/);
  if (m) {
    return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
  }
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return Number(t);
  return null;
}

/**
 * Compares a student's written answer with the key in code, without the AI.
 * @returns {string} 'match', 'mismatch', or 'unknown' when code cannot tell
 */
function checkAnswerAgainstKey_(studentAnswer, keyQuestion) {
  const answer = String(studentAnswer || '').trim();
  if (!answer || answer === '—' || !keyQuestion || keyQuestion.expected.length === 0) return 'unknown';

  if (keyQuestion.type === 'multiple_choice') {
    const keyLetter = keyQuestion.expected.map(choiceLetter_).filter(Boolean)[0];
    const studentLetter = choiceLetter_(answer);
    if (keyLetter && studentLetter) return keyLetter === studentLetter ? 'match' : 'mismatch';
  }

  const studentText = canonicalAnswerText_(answer);
  if (keyQuestion.expected.some(e => canonicalAnswerText_(e) === studentText)) return 'match';

  if (keyQuestion.type === 'numeric' || keyQuestion.type === 'fraction') {
    const studentNumber = parseAnswerNumber_(answer);
    const keyNumbers = keyQuestion.expected.map(parseAnswerNumber_).filter(n => n !== null);
    if (studentNumber !== null && keyNumbers.length > 0) {
      const equal = keyNumbers.some(k => Math.abs(k - studentNumber) <= 1e-9 * Math.max(1, Math.abs(k)));
      // An equal value in a different form may not count when the rubric demands a form
      if (equal) return /simplest|simplif|lowest terms|reduced/i.test(keyQuestion.rubric) ? 'unknown' : 'match';
      return 'mismatch';
    }
  }
  return 'unknown';
}

/**
 * Compares the ID check with the IDs the grading read saw, paper by paper in
 * page order, and marks every paper whose ID was read differently.
 */
function applyIdCheck_(graded, idCheck) {
  const students = Array.isArray(idCheck && idCheck.students) ? idCheck.students : [];
  const subs = graded.submissions;
  subs.forEach(s => { s.reviewNotes = s.reviewNotes || []; });

  if (students.length !== subs.length) {
    subs.forEach(s => s.reviewNotes.push(`ID check found ${students.length} student(s) in this PDF, grading found ${subs.length}`));
    return;
  }

  const idKey = v => normalizeStudentIdKey(String(v || '').replace(/^#/, '').trim());
  subs.forEach((s, i) => {
    const other = String(students[i].studentId || '').replace(/^#/, '').trim();
    if (idKey(s.studentId) !== idKey(other)) {
      s.reviewNotes.push(`ID check read ${other || 'blank'}`);
    }
  });
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
 * A written answer that code can confirm matches the key gets full credit; a
 * wrong multiple-choice letter gets none; a full-credit answer that code can
 * see is a different number is listed in `reviewNotes`.
 */
function scoreSubmission_(submission, keyDetails) {
  const keyPoints = keyDetails
    ? Object.keys(keyDetails).reduce((acc, n) => { acc[n] = keyDetails[n].points; return acc; }, {})
    : null;
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
  const keyCheckWarnings = [];
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
    let pointsEarned = Math.min(Math.max(0, toNumber(q.pointsEarned)), pointsPossible);
    let feedback = String(q.feedback || '');
    let isCorrect = q.isCorrect;

    // Check the written answer against the key in code, so a question with one
    // right answer cannot be scored differently from one read to the next
    const check = checkAnswerAgainstKey_(q.studentAnswer, keyDetails[n]);
    if (check === 'match' && pointsEarned < pointsPossible) {
      pointsEarned = pointsPossible;
      isCorrect = true;
      feedback = (feedback + ' (Answer-key check: the answer matches the key, so full credit.)').trim();
    } else if (check === 'mismatch' && keyDetails[n].type === 'multiple_choice' && pointsEarned > 0) {
      pointsEarned = 0;
      isCorrect = false;
      feedback = (feedback + ' (Answer-key check: a different choice than the key, so no credit.)').trim();
    } else if (check === 'mismatch' && pointsEarned >= pointsPossible) {
      keyCheckWarnings.push(`Q${n} answer "${String(q.studentAnswer).slice(0, 20)}" differs from the key but got full credit`);
    }

    return { ...q, orderIndex: n, isCorrect: isCorrect, feedback: feedback, pointsEarned: round2(pointsEarned), pointsPossible: pointsPossible };
  });

  return {
    ...submission,
    questions: questions,
    missingQuestions: missingQuestions,
    reviewNotes: (Array.isArray(submission.reviewNotes) ? submission.reviewNotes : []).concat(keyCheckWarnings),
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
