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
    .addItem('🚀 Grade Scanned Worksheets (from Drive)', 'gradeScannedWorksheets')
    .addSeparator()
    .addItem('📊 Setup / Format Gradebook Sheet', 'setupGradebookSheet')
    .addItem('🔗 Test Connection to Worksheet Maker', 'testSupabaseConnection')
    .addItem('⚙️ Set Gemini API Key', 'setGeminiApiKeyPrompt')
    .addToUi();
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
 * Main Autograder Function:
 * 1. Reads PDF scans from Google Drive folder
 * 2. Fetches answer key from Supabase
 * 3. Uses Gemini Vision to grade handwriting
 * 4. Populates Gradebook rows in real time
 */
function gradeScannedWorksheets() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Gradebook');

  if (!sheet) {
    setupGradebookSheet();
    sheet = ss.getSheetByName('Gradebook');
  }

  // Verify Gemini API Key exists
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    ui.alert(
      'Gemini API Key Required',
      'Please set your Gemini API key first via:\n"📐 Math Autograder ➔ ⚙️ Set Gemini API Key"',
      ui.ButtonSet.OK
    );
    return;
  }

  // Ask for Google Drive folder name (default: "Worksheet Scans")
  const folderPrompt = ui.prompt(
    'Scan Ingestion Folder',
    'Enter the Google Drive folder name where your copier scanner places the PDFs:\n(Default is "Worksheet Scans")',
    ui.ButtonSet.OK_CANCEL
  );

  if (folderPrompt.getSelectedButton() !== ui.Button.OK) return;

  const folderName = folderPrompt.getResponseText().trim() || 'Worksheet Scans';
  const folders = DriveApp.getFoldersByName(folderName);

  if (!folders.hasNext()) {
    // Offer to create the folder
    const createConfirm = ui.alert(
      'Folder Not Found',
      `The folder "${folderName}" does not exist in your Google Drive.\nWould you like me to create it now so you can drop scans into it?`,
      ui.ButtonSet.YES_NO
    );

    if (createConfirm === ui.Button.YES) {
      DriveApp.createFolder(folderName);
      ui.alert('Folder Created', `Created "${folderName}" in your Google Drive.\nDrop your scanned PDFs into that folder and click Grade again!`, ui.ButtonSet.OK);
    }
    return;
  }

  const scanFolder = folders.next();
  const pdfFiles = scanFolder.getFilesByType(MimeType.PDF);

  const filesToGrade = [];
  while (pdfFiles.hasNext()) {
    filesToGrade.push(pdfFiles.next());
  }

  if (filesToGrade.length === 0) {
    ui.alert('No Scans Found', `No PDF files found inside "${folderName}".\nPlease upload your scanner PDFs and try again.`, ui.ButtonSet.OK);
    return;
  }

  // Create an archive folder for processed files so they aren't graded twice
  let processedFolder;
  const processedSubfolders = scanFolder.getFoldersByName('Processed');
  if (processedSubfolders.hasNext()) {
    processedFolder = processedSubfolders.next();
  } else {
    processedFolder = scanFolder.createFolder('Processed');
  }

  let gradedCount = 0;
  let errorCount = 0;

  // Cache manifests so we don't refetch the same assignment key 50 times
  const manifestCache = {};

  for (const file of filesToGrade) {
    try {
      const pdfBlob = file.getBlob();

      // Step 1: Run Gemini Vision to detect assignment code & student ID
      const initialGrade = gradeWorksheetWithGemini(pdfBlob, null);
      const assignmentCode = (initialGrade.assignmentCode || 'ALG-701').toUpperCase();

      // Step 2: Fetch manifest from Supabase if not cached
      if (!manifestCache[assignmentCode]) {
        try {
          manifestCache[assignmentCode] = fetchWorksheetManifest(assignmentCode);
        } catch (e) {
          manifestCache[assignmentCode] = null;
        }
      }

      const manifest = manifestCache[assignmentCode];

      // Step 3: Run final grade with official key if we have the manifest
      let finalGrade = initialGrade;
      if (manifest) {
        finalGrade = gradeWorksheetWithGemini(pdfBlob, manifest);
      }

      // Step 4: Write row to Google Sheet Gradebook
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

      // Add individual question results (Q1 to Q6)
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

      // Colorize the score cell
      const lastRow = sheet.getLastRow();
      const scoreCell = sheet.getRange(lastRow, 5); // Score % column
      if (scorePct >= 80) {
        scoreCell.setBackground('#dcfce7').setFontColor('#166534').setFontWeight('bold'); // Green
      } else if (scorePct >= 60) {
        scoreCell.setBackground('#fef9c3').setFontColor('#854d0e').setFontWeight('bold'); // Yellow
      } else {
        scoreCell.setBackground('#fee2e2').setFontColor('#991b1b').setFontWeight('bold'); // Red
      }

      // Move processed PDF file to archive folder
      file.moveTo(processedFolder);
      gradedCount++;

    } catch (err) {
      console.error(`Error grading ${file.getName()}:`, err);
      errorCount++;
    }
  }

  ui.alert(
    'Grading Complete! 🎉',
    `Successfully graded: ${gradedCount} submissions.\n` +
    `Errors: ${errorCount}\n` +
    `Processed files moved to "${folderName}/Processed".\n` +
    `Check the "Gradebook" sheet for scores and feedback!`,
    ui.ButtonSet.OK
  );
}
