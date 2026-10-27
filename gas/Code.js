/**
 * ==============================================================================
 * WORKSHEET MAKER 2.0 - GOOGLE SHEETS AUTOGRADER & STUDENT ROSTER ENGINE
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
    .addItem('👥 Open / Format Student Roster', 'openRosterSheet')
    .addItem('📈 Refresh Student Standards Monitoring', 'updateStudentMonitoringSheet')
    .addItem('📊 Setup / Format All Sheets (Roster, Gradebook & Standards)', 'setupAllSheets')
    .addSeparator()
    .addItem('🔗 Test Connection to Worksheet Maker', 'testSupabaseConnection')
    .addItem('⚙️ Set Gemini API Key', 'setGeminiApiKeyPrompt')
    .addToUi();

  showSidebar();
}

/**
 * Opens the interactive teacher sidebar panel on the right of the spreadsheet
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('📐 Math Autograder')
    .setWidth(370);
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
      ui.alert('Success ✅', 'Gemini API Key saved securely!', ui.ButtonSet.OK);
    } else {
      ui.alert('Notice', 'Key was not changed.', ui.ButtonSet.OK);
    }
  }
}

/**
 * Tests the connection to your Supabase database and fetches the demo or latest key
 */
function testSupabaseConnection() {
  const ui = SpreadsheetApp.getUi();
  try {
    const recent = typeof fetchRecentWorksheetsList === 'function' ? fetchRecentWorksheetsList() : [];
    const codeToTest = recent.length > 0 ? recent[0].short_code : 'ALG-701';
    const manifest = fetchWorksheetManifest(codeToTest);
    ui.alert(
      'Worksheet Maker Connection Successful! ✅',
      `Connected to Worksheet Maker 2.0 database.\n\n` +
      `Latest Assignment: ${manifest.worksheet.title}\n` +
      `Code: ${manifest.worksheet.short_code}\n` +
      `Questions: ${manifest.questions.length} problems loaded with answer keys!`,
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('Connection Failed ❌', err.message, ui.ButtonSet.OK);
  }
}

/**
 * Sets up Student Roster, Gradebook, Standards Map, and Student Monitoring sheets
 */
function setupAllSheets() {
  setupRosterSheet(true);
  setupGradebookSheet(true);
  setupStandardsMapSheet();
  updateStudentMonitoringSheet();
  SpreadsheetApp.getUi().alert(
    'Sheets Formatted ✅',
    'Created and styled "Student Roster", "Gradebook", "Student Monitoring", and "Standards Map" sheets.\n\n' +
    'Enter your students and their ID numbers in the "Student Roster" tab to automatically tie scanned worksheets to student names!',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Creates or formats the "Student Roster" tab so teachers can map Student IDs
 * (written in the worksheet ID # box) to Student Names and Class Periods.
 * Preserves any existing student rows.
 */
function setupRosterSheet(silent) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Student Roster');

  if (!sheet) {
    sheet = ss.insertSheet('Student Roster', 0);
  }

  const headers = ['Student ID', 'Student Name', 'Class / Period', 'Notes / Accommodations'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1e293b');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);
  headerRange.setHorizontalAlignment('center');
  sheet.setRowHeight(1, 35);
  sheet.setFrozenRows(1);

  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 140);
  sheet.setColumnWidth(4, 240);

  // If the roster is brand new (no rows below header), add starter example rows
  if (sheet.getLastRow() <= 1) {
    const starterRows = [
      ['101', 'Example Student 1 (Edit Me)', 'Period 1', ''],
      ['102', 'Example Student 2 (Edit Me)', 'Period 1', ''],
      ['103', 'Example Student 3 (Edit Me)', 'Period 1', '']
    ];
    sheet.getRange(2, 1, starterRows.length, 4).setValues(starterRows);
    sheet.getRange(2, 1, 200, 1).setHorizontalAlignment('center').setFontWeight('bold');
  }

  if (!silent) {
    ss.setActiveSheet(sheet);
    SpreadsheetApp.getUi().alert(
      'Student Roster Ready 👥',
      'Add your students\' ID numbers and names in the "Student Roster" sheet. Every graded worksheet will automatically tie the student\'s ID # to their name and period!',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
  return sheet;
}

/**
 * Activates the Student Roster sheet so the teacher can view/edit their class list
 */
function openRosterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Student Roster');
  if (!sheet) {
    sheet = setupRosterSheet(true);
  }
  ss.setActiveSheet(sheet);
  return true;
}

/**
 * Normalizes a Student ID for reliable matching (strips leading '#', spaces, and leading zeros for numeric IDs)
 */
function normalizeStudentIdKey(rawId) {
  const cleaned = String(rawId || '').replace(/^#/, '').trim();
  if (!cleaned || cleaned === '???') return '';
  if (/^\d+$/.test(cleaned)) {
    return String(parseInt(cleaned, 10));
  }
  return cleaned.toUpperCase();
}

/**
 * Reads all rows from the "Student Roster" sheet and builds lookup maps by ID and by Name
 */
function getRosterData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Student Roster');
  if (!sheet) {
    sheet = setupRosterSheet(true);
  }

  const byId = {};
  const byNormalizedId = {};
  const byName = {};
  const list = [];

  if (sheet.getLastRow() <= 1) {
    return { byId, byNormalizedId, byName, list };
  }

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rawId = String(data[i][0] || '').replace(/^#/, '').trim();
    const rawName = String(data[i][1] || '').trim();
    const rawPeriod = String(data[i][2] || '').trim();
    const rawNotes = String(data[i][3] || '').trim();

    if (!rawId && !rawName) continue;
    // Skip untouched starter placeholder rows when computing missing students if desired,
    // or include them if they have an ID
    const isPlaceholder = rawName.toLowerCase().includes('(edit me)');

    const entry = {
      studentId: rawId || `ROW-${i}`,
      studentName: rawName,
      classPeriod: rawPeriod,
      notes: rawNotes,
      rowIndex: i + 1,
      isPlaceholder
    };

    if (rawId) {
      byId[rawId] = entry;
      byNormalizedId[normalizeStudentIdKey(rawId)] = entry;
    }
    if (rawName && !isPlaceholder) {
      byName[rawName.toLowerCase()] = entry;
    }
    if (!isPlaceholder) {
      list.push(entry);
    }
  }

  return { byId, byNormalizedId, byName, list };
}

/**
 * Resolves a student's canonical ID, Name, and Class/Period from the Student Roster
 * using either the scanned ID # box OR the handwritten Name line.
 */
function resolveStudentFromRoster(rawId, rawName, existingRosterInfo) {
  const roster = existingRosterInfo || getRosterData();
  const cleanId = String(rawId || '').replace(/^#/, '').trim();
  const normId = normalizeStudentIdKey(cleanId);
  const cleanName = String(rawName || '').trim();

  // 1. Direct or numeric-normalized Student ID match in Roster
  if (cleanId && cleanId !== '???') {
    const matchById = roster.byId[cleanId] || roster.byNormalizedId[normId];
    if (matchById && !matchById.isPlaceholder) {
      return {
        studentId: matchById.studentId,
        studentName: matchById.studentName || cleanName || 'Unnamed Student',
        classPeriod: matchById.classPeriod || '',
        matchedInRoster: true
      };
    }
  }

  // 2. Fallback: Match by handwritten Student Name on the worksheet if ID was blank/unmatched
  if (cleanName) {
    const lowerName = cleanName.toLowerCase();
    if (roster.byName[lowerName]) {
      const m = roster.byName[lowerName];
      return {
        studentId: m.studentId || cleanId || '???',
        studentName: m.studentName,
        classPeriod: m.classPeriod || '',
        matchedInRoster: true
      };
    }

    // Partial first+last or token match if unique in roster
    const partialMatches = roster.list.filter(s => {
      const rLower = s.studentName.toLowerCase();
      return rLower.includes(lowerName) || lowerName.includes(rLower);
    });
    if (partialMatches.length === 1) {
      const m = partialMatches[0];
      return {
        studentId: m.studentId || cleanId || '???',
        studentName: m.studentName,
        classPeriod: m.classPeriod || '',
        matchedInRoster: true
      };
    }
  }

  // 3. Not found in roster yet — return whatever was extracted from the worksheet
  return {
    studentId: cleanId || '???',
    studentName: cleanName || '',
    classPeriod: '',
    matchedInRoster: false
  };
}

/**
 * Adds or updates a student in the "Student Roster" tab (callable from Sidebar or auto-registration)
 */
function addOrUpdateRosterStudent(studentId, studentName, classPeriod, notes) {
  const cleanId = String(studentId || '').replace(/^#/, '').trim();
  const cleanName = String(studentName || '').trim();
  const cleanPeriod = String(classPeriod || '').trim();
  const cleanNotes = String(notes || '').trim();

  if (!cleanId || !cleanName) {
    throw new Error('Both Student ID and Student Name are required.');
  }

  const sheet = setupRosterSheet(true);
  const data = sheet.getDataRange().getValues();
  const normTarget = normalizeStudentIdKey(cleanId);

  let updatedRow = -1;
  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][0] || '').replace(/^#/, '').trim();
    const rowName = String(data[i][1] || '').trim();
    // Overwrite matching ID or first untouched "(Edit Me)" starter row
    if (normalizeStudentIdKey(rowId) === normTarget || rowName.toLowerCase().includes('(edit me)')) {
      updatedRow = i + 1;
      break;
    }
  }

  if (updatedRow !== -1) {
    sheet.getRange(updatedRow, 1, 1, 4).setValues([[cleanId, cleanName, cleanPeriod, cleanNotes]]);
    sheet.getRange(updatedRow, 1).setHorizontalAlignment('center').setFontWeight('bold');
  } else {
    sheet.appendRow([cleanId, cleanName, cleanPeriod, cleanNotes]);
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1).setHorizontalAlignment('center').setFontWeight('bold');
  }

  try {
    updateStudentMonitoringSheet();
  } catch (e) {
    console.warn('Monitoring refresh warning:', e);
  }

  return getGradebookAnalytics();
}

/**
 * Builds the canonical Gradebook headers (including Student ID, Student Name, Class / Period, and Q1..Q10)
 */
function getCanonicalGradebookHeaders() {
  const headers = [
    'Timestamp',
    'Student ID',
    'Student Name',
    'Class / Period',
    'Assignment Code',
    'Assignment Title',
    'Score %',
    'Points',
    'Total Pts',
    'Status'
  ];
  for (let i = 1; i <= 10; i++) {
    headers.push(`Q${i} Score`, `Q${i} Student Ans`, `Q${i} Feedback`);
  }
  return headers;
}

/**
 * Ensures an existing Gradebook sheet has the "Student Name" and "Class / Period" columns
 * right after "Student ID" without losing any existing graded rows.
 */
function ensureGradebookColumns(sheet) {
  if (!sheet) return;
  if (sheet.getLastRow() === 0) {
    const headers = getCanonicalGradebookHeaders();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 10)).getValues()[0];
  const lowerHeaders = firstRow.map(h => String(h || '').trim().toLowerCase());

  // If old layout (Col B = Student ID, Col C = Assignment Code), insert 2 columns after Col B
  if (lowerHeaders[1] === 'student id' && lowerHeaders[2] === 'assignment code') {
    sheet.insertColumnsAfter(2, 2);
    sheet.getRange(1, 3).setValue('Student Name');
    sheet.getRange(1, 4).setValue('Class / Period');

    // Backfill VLOOKUP formulas for any existing graded rows so they tie to Student Roster immediately
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      for (let r = 2; r <= lastRow; r++) {
        sheet.getRange(r, 3).setFormula(
          `=IFERROR(VLOOKUP(B${r}, 'Student Roster'!$A:$C, 2, FALSE), IFERROR(VLOOKUP(VALUE(B${r}), 'Student Roster'!$A:$C, 2, FALSE), IFERROR(VLOOKUP(TO_TEXT(B${r}), 'Student Roster'!$A:$C, 2, FALSE), "")))`
        );
        sheet.getRange(r, 4).setFormula(
          `=IFERROR(VLOOKUP(B${r}, 'Student Roster'!$A:$C, 3, FALSE), IFERROR(VLOOKUP(VALUE(B${r}), 'Student Roster'!$A:$C, 3, FALSE), IFERROR(VLOOKUP(TO_TEXT(B${r}), 'Student Roster'!$A:$C, 3, FALSE), "")))`
        );
      }
    }
  }

  const headers = getCanonicalGradebookHeaders();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1e293b');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);
  headerRange.setHorizontalAlignment('center');
  sheet.setRowHeight(1, 35);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3); // Freeze Timestamp, Student ID, Student Name
}

/**
 * Creates or formats the "Gradebook" sheet (preserving existing rows)
 */
function setupGradebookSheet(silent) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupRosterSheet(true);

  let sheet = ss.getSheetByName('Gradebook');
  if (!sheet) {
    sheet = ss.insertSheet('Gradebook');
  }

  ensureGradebookColumns(sheet);

  if (!silent) {
    SpreadsheetApp.getUi().alert(
      'Gradebook Formatted ✅',
      'The "Gradebook" sheet is formatted and linked to "Student Roster" (with Student ID, Student Name, and Class / Period columns).',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
  return sheet;
}

/**
 * Sidebar API: Computes real-time class analytics, roster coverage, and student stats
 */
function getGradebookAnalytics() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterInfo = getRosterData();
  const recentWorksheets = typeof fetchRecentWorksheetsList === 'function' ? fetchRecentWorksheetsList() : [];
  const sheet = ss.getSheetByName('Gradebook');

  if (!sheet || sheet.getLastRow() <= 1) {
    return {
      totalSubmissions: 0,
      rosterCount: rosterInfo.list.length,
      roster: rosterInfo.list,
      missingStudents: rosterInfo.list.map(s => ({ studentId: s.studentId, studentName: s.studentName, classPeriod: s.classPeriod })),
      recentWorksheets,
      classAverage: 0,
      passRate: 0,
      mostMissedQuestion: null,
      questionStats: [],
      students: []
    };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h || '').trim().toLowerCase());
  const rows = data.slice(1);

  const idCol = headers.indexOf('student id') !== -1 ? headers.indexOf('student id') : 1;
  const nameCol = headers.indexOf('student name');
  const periodCol = headers.indexOf('class / period');
  const codeCol = headers.indexOf('assignment code') !== -1 ? headers.indexOf('assignment code') : 2;
  const scorePctCol = headers.indexOf('score %') !== -1 ? headers.indexOf('score %') : 4;
  const ptsCol = headers.indexOf('points') !== -1 ? headers.indexOf('points') : 5;
  const totalPtsCol = headers.indexOf('total pts') !== -1 ? headers.indexOf('total pts') : 6;
  const q1ScoreCol = headers.indexOf('q1 score') !== -1 ? headers.indexOf('q1 score') : 8;

  let totalScoreSum = 0;
  let passingCount = 0;
  const students = [];
  const submittedNormalizedIds = new Set();

  const qAccumulator = Array.from({ length: 10 }, () => ({
    attempts: 0,
    earnedSum: 0,
    possibleSum: 0,
    feedbackSamples: []
  }));

  for (const row of rows) {
    const rawId = String(row[idCol] || '???').trim();
    const rawName = nameCol !== -1 ? String(row[nameCol] || '').trim() : '';
    const rawPeriod = periodCol !== -1 ? String(row[periodCol] || '').trim() : '';
    const assignmentCode = String(row[codeCol] || '').trim();

    const resolved = resolveStudentFromRoster(rawId, rawName, rosterInfo);
    const studentId = resolved.studentId || rawId || '???';
    const studentName = resolved.studentName || rawName || 'Unlisted in Roster';
    const classPeriod = resolved.classPeriod || rawPeriod || '';

    const normId = normalizeStudentIdKey(studentId);
    if (normId) submittedNormalizedIds.add(normId);

    const rawScoreVal = row[scorePctCol];
    let scorePct = 0;
    if (typeof rawScoreVal === 'number') {
      // Handle Google Sheets percentage decimals (e.g. 0.83 vs 83)
      scorePct = rawScoreVal <= 1 && rawScoreVal > 0 ? Math.round(rawScoreVal * 100) : Math.round(rawScoreVal);
    } else {
      scorePct = parseFloat(String(rawScoreVal || '0').replace('%', '')) || 0;
    }

    const points = parseFloat(row[ptsCol]) || 0;
    const totalPossible = parseFloat(row[totalPtsCol]) || 0;

    totalScoreSum += scorePct;
    if (scorePct >= 70) passingCount++;

    const studentQuestions = [];
    const studentStandards = {};

    for (let qIdx = 0; qIdx < 10; qIdx++) {
      const baseCol = q1ScoreCol + (qIdx * 3);
      if (baseCol + 2 >= row.length) break;

      const cellVal = row[baseCol];
      if (cellVal === '' || cellVal === null || cellVal === undefined) continue;

      const qScore = parseFloat(cellVal) || 0;
      const qAns = String(row[baseCol + 1] || '');
      const qFeedback = String(row[baseCol + 2] || '');

      studentQuestions.push({
        orderIndex: qIdx + 1,
        score: qScore,
        studentAnswer: qAns,
        feedback: qFeedback
      });

      if (!isNaN(parseFloat(cellVal))) {
        qAccumulator[qIdx].attempts++;
        if (qScore > 0) qAccumulator[qIdx].earnedSum++;
        if (qScore === 0 && qFeedback) {
          qAccumulator[qIdx].feedbackSamples.push(qFeedback);
        }
      }

      const stdMatch = qFeedback.match(/([4-8]\.[A-Z]+\.[A-Z0-9\.]+)/i);
      const stdCode = stdMatch ? stdMatch[1].toUpperCase() : null;
      if (stdCode) {
        if (!studentStandards[stdCode]) {
          studentStandards[stdCode] = { attempts: 0, correct: 0 };
        }
        studentStandards[stdCode].attempts++;
        if (qScore > 0) studentStandards[stdCode].correct++;
      }
    }

    // Compute per-student Blocker (<20%) and Gap (20-69%) for Sidebar Conferencing card
    let blocker = null;
    let gap = null;
    for (const [code, stat] of Object.entries(studentStandards)) {
      if (stat.attempts === 0) continue;
      const rate = Math.round((stat.correct / stat.attempts) * 100);
      const plain = typeof translateStandard === 'function' ? translateStandard(code) : code;
      if (rate < 20 && !blocker) {
        blocker = `${plain} (${code}) — ${rate}%`;
      } else if (rate >= 20 && rate < 70 && !gap) {
        gap = `${plain} (${code}) — ${rate}%`;
      }
    }

    students.push({
      studentId,
      studentName,
      classPeriod,
      assignmentCode,
      scorePct,
      points,
      totalPossible,
      blocker,
      gap,
      questions: studentQuestions
    });
  }

  const totalSubmissions = rows.length;
  const classAverage = totalSubmissions > 0 ? Math.round(totalScoreSum / totalSubmissions) : 0;
  const passRate = totalSubmissions > 0 ? Math.round((passingCount / totalSubmissions) * 100) : 0;

  const questionStats = [];
  let lowestAccuracy = 101;
  let mostMissed = null;

  for (let i = 0; i < 10; i++) {
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
          commonFeedback: stat.feedbackSamples[0] || 'Lowest class accuracy on this question.'
        };
      }
    }
  }

  students.sort((a, b) => String(a.studentId).localeCompare(String(b.studentId), undefined, { numeric: true }));

  const missingStudents = rosterInfo.list
    .filter(r => !submittedNormalizedIds.has(normalizeStudentIdKey(r.studentId)))
    .map(r => ({
      studentId: r.studentId,
      studentName: r.studentName,
      classPeriod: r.classPeriod
    }));

  return {
    totalSubmissions,
    rosterCount: rosterInfo.list.length,
    roster: rosterInfo.list,
    missingStudents,
    recentWorksheets,
    classAverage,
    passRate,
    mostMissedQuestion: lowestAccuracy < 100 ? mostMissed : null,
    questionStats,
    students
  };
}

/**
 * Sidebar API: Runs the autograder directly from the sidebar button.
 * @param {string} [selectedAssignmentCode] - Optional short code selected by teacher in Sidebar
 */
function runGradingFromSidebar(selectedAssignmentCode) {
  setupRosterSheet(true);
  const sheet = setupGradebookSheet(true);
  const rosterInfo = getRosterData();

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

  let gradedSubmissionsCount = 0;
  let gradedFilesCount = 0;
  const manifestCache = {};
  let batchDetectedCode = selectedAssignmentCode ? String(selectedAssignmentCode).trim().toUpperCase() : null;

  const getManifestCached = function(code) {
    if (!code) return null;
    const clean = String(code).trim().toUpperCase();
    if (manifestCache[clean] !== undefined) return manifestCache[clean];
    try {
      manifestCache[clean] = fetchWorksheetManifest(clean);
    } catch (e) {
      manifestCache[clean] = null;
    }
    return manifestCache[clean];
  };

  for (const file of filesToGrade) {
    try {
      const pdfBlob = file.getBlob();
      const fileCodeHint = typeof detectAssignmentCodeFromFileName === 'function'
        ? detectAssignmentCodeFromFileName(file.getName())
        : null;

      const knownCode = selectedAssignmentCode || fileCodeHint || batchDetectedCode;
      let manifest = knownCode ? getManifestCached(knownCode) : null;

      // Single Gemini Vision call if manifest is already known; otherwise detect & grade
      let gradeResult = gradeWorksheetWithGemini(pdfBlob, manifest);
      const assignmentCode = String(gradeResult.assignmentCode || knownCode || 'ALG-701').trim().toUpperCase();

      if (!batchDetectedCode && assignmentCode) {
        batchDetectedCode = assignmentCode;
      }

      // If we didn't have the manifest on the first pass, fetch it now and re-grade with official key
      if (!manifest && assignmentCode) {
        manifest = getManifestCached(assignmentCode);
        if (manifest) {
          gradeResult = gradeWorksheetWithGemini(pdfBlob, manifest);
        }
      }

      const submissions = Array.isArray(gradeResult.submissions) ? gradeResult.submissions : [gradeResult];

      for (const sub of submissions) {
        const now = new Date();
        const extractedId = String(sub.studentId || '').replace(/^#/, '').trim();
        const extractedName = String(sub.studentName || '').trim();

        // Tie Student ID & Name to the Student Roster
        const resolved = resolveStudentFromRoster(extractedId, extractedName, rosterInfo);
        const finalStudentId = resolved.studentId || extractedId || '???';
        const fallbackName = (resolved.studentName || extractedName || 'Unlisted in Roster').replace(/"/g, '""');
        const fallbackPeriod = (resolved.classPeriod || '').replace(/"/g, '""');

        // If student wrote both a valid ID and Name on the worksheet and isn't in Student Roster yet, auto-register them!
        if (!resolved.matchedInRoster && finalStudentId !== '???' && extractedName) {
          try {
            addOrUpdateRosterStudent(finalStudentId, extractedName, '', 'Auto-added from worksheet scan');
          } catch (autoErr) {
            console.warn('Auto-roster add skipped:', autoErr);
          }
        }

        const totalScore = parseFloat(sub.totalScore) || 0;
        const totalPossible = parseFloat(sub.totalPossible) || 0;
        const scorePct = totalPossible > 0
          ? Math.round((totalScore / totalPossible) * 100)
          : 0;

        const nextRowNum = sheet.getLastRow() + 1;

        // Live VLOOKUP formulas so editing Student Roster always updates Gradebook names & periods
        const nameFormula = `=IFERROR(VLOOKUP(B${nextRowNum}, 'Student Roster'!$A:$C, 2, FALSE), IFERROR(VLOOKUP(VALUE(B${nextRowNum}), 'Student Roster'!$A:$C, 2, FALSE), IFERROR(VLOOKUP(TO_TEXT(B${nextRowNum}), 'Student Roster'!$A:$C, 2, FALSE), "${fallbackName}")))`;
        const periodFormula = `=IFERROR(VLOOKUP(B${nextRowNum}, 'Student Roster'!$A:$C, 3, FALSE), IFERROR(VLOOKUP(VALUE(B${nextRowNum}), 'Student Roster'!$A:$C, 3, FALSE), IFERROR(VLOOKUP(TO_TEXT(B${nextRowNum}), 'Student Roster'!$A:$C, 3, FALSE), "${fallbackPeriod}")))`;

        const row = [
          Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
          finalStudentId,
          nameFormula,
          periodFormula,
          assignmentCode,
          manifest && manifest.worksheet ? manifest.worksheet.title : 'Scanned Assignment',
          `${scorePct}%`,
          totalScore,
          totalPossible,
          scorePct >= 70 ? 'Passed' : 'Needs Practice'
        ];

        const qList = Array.isArray(sub.questions) ? sub.questions : [];
        for (let i = 0; i < 10; i++) {
          const q = qList[i];
          if (q) {
            row.push(q.pointsEarned !== undefined ? q.pointsEarned : '');
            row.push(q.studentAnswer || '—');
            row.push(q.feedback || '');
          } else {
            row.push('', '', '');
          }
        }

        sheet.appendRow(row);

        const lastRow = sheet.getLastRow();
        sheet.getRange(lastRow, 2).setHorizontalAlignment('center').setFontWeight('bold');
        const scoreCell = sheet.getRange(lastRow, 7); // Column 7 is Score %
        if (scorePct >= 80) {
          scoreCell.setBackground('#dcfce7').setFontColor('#166534').setFontWeight('bold');
        } else if (scorePct >= 60) {
          scoreCell.setBackground('#fef9c3').setFontColor('#854d0e').setFontWeight('bold');
        } else {
          scoreCell.setBackground('#fee2e2').setFontColor('#991b1b').setFontWeight('bold');
        }

        gradedSubmissionsCount++;
      }

      file.moveTo(processedFolder);
      gradedFilesCount++;
    } catch (err) {
      console.error(`Grading error for ${file.getName()}:`, err);
    }
  }

  try {
    updateStudentMonitoringSheet();
  } catch (e) {
    console.error('Monitoring update error:', e);
  }

  return `Graded ${gradedSubmissionsCount} student worksheet(s) from ${gradedFilesCount} PDF file(s)! Roster names, scores, and standards monitoring updated.`;
}

/**
 * Menu fallback function
 */
function gradeScannedWorksheets() {
  showSidebar();
}
