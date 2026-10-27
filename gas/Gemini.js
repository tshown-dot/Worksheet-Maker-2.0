/**
 * ==============================================================================
 * WORKSHEET MAKER 2.0 - GEMINI VISION AI GRADING ENGINE
 * ==============================================================================
 */

/**
 * Sends the scanned worksheet PDF directly to Gemini Vision to extract
 * the 3-digit Student ID and grade every problem against the answer key.
 * 
 * @param {Blob} pdfBlob - The PDF file blob from Google Drive
 * @param {Object} manifest - The answer key manifest from Supabase (optional, if already known)
 * @returns {Object} Structured grading results
 */
function gradeWorksheetWithGemini(pdfBlob, manifest) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error("Gemini API Key is not set. Please go to '📐 Math Autograder ➔ Settings: Set Gemini API Key'.");
  }

  // Model endpoint - using gemini-2.5-flash (fast, accurate for handwriting & math)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  // Base64 encode the PDF
  const base64Data = Utilities.base64Encode(pdfBlob.getBytes());

  // Prepare system instructions and prompt
  let promptText = `You are an automated grading system for middle school math worksheets scanned at 300 DPI.
Your job is to read the handwritten submission and grade it with high accuracy.

INSTRUCTIONS:
1. Extract the 3-digit Student ID written in the three boxes at the top right header (e.g. "104", "023").
2. Read the Assignment Code in the header or next to the QR code (e.g. "ALG-701", "M7-4821").
3. For each question on the page:
   - Identify the Common Core Standard (e.g. "6.NS.C.7a", "5.G.A.1", "6.EE.B.7") from the question or rubric notes.
   - Read the student's handwritten final answer in the "FINAL ANSWER" box.
   - Inspect their scratch work in the "Show your work" box.
   - Compare the student's answer against the correct answer and rubric notes.
   - Assign points earned and provide a diagnostic note with standard tag e.g. "Student reversed coordinates. [5.G.A.1]".

Output ONLY a JSON object in this exact schema:
{
  "studentId": "104",
  "assignmentCode": "ALG-701",
  "pageNumber": 1,
  "confidence": "high",
  "questions": [
    {
      "orderIndex": 1,
      "standard": "6.NS.C.7a",
      "studentAnswer": "5",
      "isCorrect": true,
      "pointsEarned": 2.0,
      "pointsPossible": 2.0,
      "feedback": "Correct solution. [6.NS.C.7a]"
    }
  ],
  "totalScore": 2.0,
  "totalPossible": 2.0
}`;

  // If answer key manifest is provided, include it in prompt
  if (manifest && manifest.questions) {
    promptText += `\n\nOFFICIAL ANSWER KEY & RUBRIC:\n${JSON.stringify(manifest.questions, null, 2)}`;
  }

  const payload = {
    contents: [
      {
        parts: [
          {
            text: promptText
          },
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

  const response = UrlFetchApp.fetch(endpoint, options);
  const status = response.getResponseCode();

  if (status !== 200) {
    throw new Error(`Gemini API Error (Status ${status}): ${response.getContentText()}`);
  }

  const resJson = JSON.parse(response.getContentText());
  const candidate = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!candidate) {
    throw new Error("No response generated from Gemini Vision.");
  }

  return JSON.parse(candidate);
}
