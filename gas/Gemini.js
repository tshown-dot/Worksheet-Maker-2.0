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
   - Look in the top-right header area for the unified box labeled "ID #" (or legacy digit boxes).
   - Extract the exact ID number written inside the box (e.g., "104", "23", "1042"). Strip any leading "#" or spaces. If blank or unreadable, return "".
2. STUDENT NAME ("studentName"):
   - Look in the top-left header area on the "Name:" line.
   - Read the student's handwritten name if written (e.g., "Alex Rivera"). If blank, return "".
3. ASSIGNMENT CODE ("assignmentCode"):
   - Read the printed Assignment Code in the top-right corner next to the QR code (e.g., "ALG-701", "M4821").
4. MULTI-PAGE / COPIER BATCH SUPPORT:
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
  "submissions": [
    {
      "studentId": "104",
      "studentName": "Alex Rivera",
      "assignmentCode": "ALG-701",
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

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const modelsToTry = [configuredModel, ...FALLBACK_MODELS.filter(m => m !== configuredModel)];
  let response = null;
  let status = 0;

  for (const modelName of modelsToTry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    response = UrlFetchApp.fetch(endpoint, options);
    status = response.getResponseCode();
    if (status !== 404) {
      break;
    }
  }

  if (status !== 200) {
    throw new Error(`Gemini API Error (Status ${status}): ${response.getContentText()}`);
  }

  const resJson = JSON.parse(response.getContentText());
  const candidate = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!candidate) {
    throw new Error("No response generated from Gemini Vision.");
  }

  const parsed = JSON.parse(candidate);

  // Normalize response so callers always receive { assignmentCode, submissions: [...] }
  if (Array.isArray(parsed.submissions) && parsed.submissions.length > 0) {
    const topCode = parsed.assignmentCode || parsed.submissions[0].assignmentCode || 'ALG-701';
    return {
      assignmentCode: String(topCode).trim().toUpperCase(),
      submissions: parsed.submissions
    };
  }

  // Fallback if model returned single flat submission object
  return {
    assignmentCode: String(parsed.assignmentCode || 'ALG-701').trim().toUpperCase(),
    submissions: [parsed]
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
  const match = String(fileName).match(/\b([A-Z]{1,5}-?\d{3,5})\b/i);
  return match ? match[1].toUpperCase() : null;
}
