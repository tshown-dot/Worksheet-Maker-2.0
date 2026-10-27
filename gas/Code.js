/**
 * ==============================================================================
 * WORKSHEET MAKER 2.0 - GOOGLE SHEETS AUTOGRADER
 * ==============================================================================
 */

/**
 * Automatically creates custom menu in Google Sheets when opened
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📐 Math Autograder')
    .addItem('📱 Open Autograder Sidebar', 'showSidebar')
    .addSeparator()
    .addItem('🚀 Grade Scanned Worksheets (from Drive)', 'gradeScannedWorksheets')
    .addItem('📊 Setup / Format Gradebook Sheet', 'setupGradebookSheet')
    .addItem('🔗 Test Connection to Worksheet Maker', 'testSupabaseConnection')
    .addItem('⚙️ Set Gemini API Key', 'setGeminiApiKeyPrompt')
    .addToUi();

  // Open sidebar automatically for teacher convenience
  showSidebar();
}

/**
 * Opens the interactive teacher sidebar panel on the right of the spreadsheet
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('📐 Math Autograder')
    .setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Teacher Settings Dialog to store Gemini API Key securely in ScriptProperties
 */
function setGeminiApiKeyPrompt() {
  const ui = SpreadsheetApp.getUi();
  const currentKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const maskedKey = currentKey ? `(Current key: ${currentKey.slice(0, 6)}...${currentKey.slice(-4)})` : '(No key set yet)';

  const response = ui.prompt(
    'Configure Gemini Vision API Key',
    `Enter your Google AI Studio / Gemini API key:\n${maskedKey}`,
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const newKey = response.getResponseText().trim();
    if (newKey) {
      PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', newKey);
      ui.alert('Success', 'Gemini API Key saved securely!', ui.ButtonSet.OK);
    } else {
      ui.alert('Notice', 'Key was not changed.', ui.ButtonSet.OK);
    }
  }
}

/**
 * Tests the connection to your Supabase database and fetches the demo key
 */
function testSupabaseConnection() {
  const ui = SpreadsheetApp.getUi();
  try {
    const manifest = fetchWorksheetManifest('ALG-701');
    ui.alert(
      'Supabase Connection Successful! ✅',
      `Connected to Worksheet Maker database.\n\n` +
      `Found Assignment: ${manifest.worksheet.title}\n` +
      `Code: ${manifest.worksheet.short_code}\n` +
      `Questions: ${manifest.questions.length} problems loaded with answer keys!`,
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('Connection Failed ❌', err.message, ui.ButtonSet.OK);
  }
}

/**
 * Sets up a clean, professionally formatted Gradebook sheet
 */
function setupGradebookSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Gradebook');
  
  if (!sheet) {
    sheet = ss.insertSheet('Gradebook');
  }

  // Define Gradebook Headers
  const headers = [
    'Timestamp',
    'Student ID',
    'Assignment Code',
    'Assignment Title',
    'Score %',
    'Points',
    'Total Pts',
    'Status',
    'Q1 Score', 'Q1 Student Ans', 'Q1 Feedback',
    'Q2 Score', 'Q2 Student Ans', 'Q2 Feedback',
    'Q3 Score', 'Q3 Student Ans', 'Q3 Feedback',
    'Q4 Score', 'Q4 Student Ans', 'Q4 Feedback',
    'Q5 Score', 'Q5 Student Ans', 'Q5 Feedback',
    'Q6 Score', 'Q6 Student Ans', 'Q6 Feedback'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Style Header Row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1e293b'); // Slate-800
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);
  headerRange.setHorizontalAlignment('center');
  sheet.setRowHeight(1, 35);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2); // Freeze Timestamp and Student ID

  SpreadsheetApp.getUi().alert('Gradebook Formatted', 'The "Gradebook" sheet has been created and styled.', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Sidebar API: Computes real-time class analytics and student stats from the sheet
 */
function getGradebookAnalytics() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Gradebook');

  if (!sheet || sheet.getLastRow() <= 1) {
    return {
      totalSubmissions: 0,
      classAverage: 0,
      passRate: 0,
      mostMissedQuestion: null,
      questionStats: [],
      students: []
    };
  }

  const data = sheet.getDataRange().getValues();
  // Row 0 is headers
  const rows = data.slice(1);

  let totalScoreSum = 0;
  let passingCount = 0;
  const students = [];

  // Question stats accumulator for Q1 to Q6
  const qAccumulator = Array.from({ length: 6 }, () => ({
    attempts: 0,
    earnedSum: 0,
    feedbackSamples: []
  }));

  for (const row of rows) {
    const studentId = String(row[1] || '???');
    const scorePctStr = String(row[4] || '0%').replace('%', '');
    const scorePct = parseFloat(scorePctStr) || 0;
    const points = parseFloat(row[5]) || 0;
    const totalPossible = parseFloat(row[6]) || 0;

    totalScoreSum += scorePct;
    if (scorePct >= 70) passingCount++;

    const studentQuestions = [];
    // Q1 starts at col index 8 (col 9 in 1-based index)
    for (let qIdx = 0; qIdx < 6; qIdx++) {
      const baseCol = 8 + (qIdx * 3);
      const qScore = parseFloat(row[baseCol]) || 0;
      const qAns = String(row[baseCol + 1] || '');
      const qFeedback = String(row[baseCol + 2] || '');

      studentQuestions.push({
        orderIndex: qIdx + 1,
        score: qScore,
        studentAnswer: qAns,
        feedback: qFeedback
      });

      if (row[baseCol] !== '' && !isNaN(parseFloat(row[baseCol]))) {
        qAccumulator[qIdx].attempts++;
        if (qScore > 0) qAccumulator[qIdx].earnedSum++;
        if (qScore === 0 && qFeedback) {
          qAccumulator[qIdx].feedbackSamples.push(qFeedback);
        }
      }
    }

    students.push({
      studentId,
      scorePct,
      points,
      totalPossible,
      questions: studentQuestions
    });
  }

  const totalSubmissions = rows.length;
  const classAverage = Math.round(totalScoreSum / totalSubmissions);
  const passRate = Math.round((passingCount / totalSubmissions) * 100);

  // Compute per-question accuracy %
  const questionStats = [];
  let lowestAccuracy = 101;
  let mostMissed = null;

  for (let i = 0; i < 6; i++) {
    const stat = qAccumulator[i];
    if (stat.attempts > 0) {
      const accuracy = Math.round((stat.earnedSum / stat.attempts) * 100);
      questionStats.push({
        orderIndex: i + 1,
        accuracy,
        commonFeedback: stat.feedbackSamples[0] || ''
      });

      if (accuracy < lowestAccuracy) {
        lowestAccuracy = accuracy;
        mostMissed = {
          orderIndex: i + 1,
          accuracy,
          commonFeedback: stat.feedbackSamples[0] || 'Lowest accuracy on this concept.'
        };
      }
    }
  }

  // Sort students by studentId
  students.sort((a, b) => a.studentId.localeCompare(b.studentId, undefined, { numeric: true }));

  return {
    totalSubmissions,
    classAverage,
    passRate,
    mostMissedQuestion: lowestAccuracy < 100 ? mostMissed : null,
    questionStats,
    students
  };
}

/**
 * Sidebar API: Runs the autograder directly from the sidebar button
 */
function runGradingFromSidebar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Gradebook');

  if (!sheet) {
    setupGradebookSheet();
    sheet = ss.getSheetByName('Gradebook');
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error("Gemini API key is not set. Click '⚙️ Set Gemini Key' at the bottom of the panel.");
  }

  const folderName = 'Worksheet Scans';
  let folders = DriveApp.getFoldersByName(folderName);
  let scanFolder;

  if (!folders.hasNext()) {
    scanFolder = DriveApp.createFolder(folderName);
    throw new Error(`Created folder "${folderName}" in your Google Drive. Drop your scanned PDFs there and click Grade again!`);
  } else {
    scanFolder = folders.next();
  }

  const pdfFiles = scanFolder.getFilesByType(MimeType.PDF);
  const filesToGrade = [];
  while (pdfFiles.hasNext()) {
    filesToGrade.push(pdfFiles.next());
  }

  if (filesToGrade.length === 0) {
    throw new Error(`No scanned PDFs found in "${folderName}". Upload your copier scans and try again.`);
  }

  let processedFolder;
  const processedSubfolders = scanFolder.getFoldersByName('Processed');
  if (processedSubfolders.hasNext()) {
    processedFolder = processedSubfolders.next();
  } else {
    processedFolder = scanFolder.createFolder('Processed');
  }

  let gradedCount = 0;
  const manifestCache = {};

  for (const file of filesToGrade) {
    try {
      const pdfBlob = file.getBlob();
      const initialGrade = gradeWorksheetWithGemini(pdfBlob, null);
      const assignmentCode = (initialGrade.assignmentCode || 'ALG-701').toUpperCase();

      if (!manifestCache[assignmentCode]) {
        try {
          manifestCache[assignmentCode] = fetchWorksheetManifest(assignmentCode);
        } catch (e) {
          manifestCache[assignmentCode] = null;
        }
      }

      const manifest = manifestCache[assignmentCode];
      let finalGrade = initialGrade;
      if (manifest) {
        finalGrade = gradeWorksheetWithGemini(pdfBlob, manifest);
      }

      const now = new Date();
      const scorePct = finalGrade.totalPossible > 0 
        ? Math.round((finalGrade.totalScore / finalGrade.totalPossible) * 100) 
        : 0;

      const row = [
        Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
        finalGrade.studentId || '???',
        assignmentCode,
        manifest ? manifest.worksheet.title : 'Scanned Assignment',
        `${scorePct}%`,
        finalGrade.totalScore,
        finalGrade.totalPossible,
        scorePct >= 70 ? 'Passed' : 'Needs Practice'
      ];

      if (finalGrade.questions && Array.isArray(finalGrade.questions)) {
        for (let i = 0; i < 6; i++) {
          const q = finalGrade.questions[i];
          if (q) {
            row.push(q.pointsEarned);
            row.push(q.studentAnswer || '—');
            row.push(q.feedback || '');
          } else {
            row.push('', '', '');
          }
        }
      }

      sheet.appendRow(row);

      const lastRow = sheet.getLastRow();
      const scoreCell = sheet.getRange(lastRow, 5);
      if (scorePct >= 80) {
        scoreCell.setBackground('#dcfce7').setFontColor('#166534').setFontWeight('bold');
      } else if (scorePct >= 60) {
        scoreCell.setBackground('#fef9c3').setFontColor('#854d0e').setFontWeight('bold');
      } else {
        scoreCell.setBackground('#fee2e2').setFontColor('#991b1b').setFontWeight('bold');
      }

      file.moveTo(processedFolder);
      gradedCount++;
    } catch (err) {
      console.error(`Grading error for ${file.getName()}:`, err);
    }
  }

  return `Graded ${gradedCount} submissions! Scores and analytics updated.`;
}

/**
 * Menu fallback function
 */
function gradeScannedWorksheets() {
  showSidebar();
}
