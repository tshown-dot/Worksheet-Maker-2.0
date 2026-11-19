/**
 * ==============================================================================
 * WORKSHEET MAKER 2.0 - GOOGLE SHEETS AUTOGRADER, ROSTER & STUDENT PORTAL
 * ==============================================================================
 */

/**
 * Automatically creates custom menu in Google Sheets when opened
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📐 Math Autograder')
    .addItem('📊 Class & Assignment Data Explorer', 'openInterventionDashboard')
    .addItem('📱 Open Autograder Sidebar', 'showSidebar')
    .addItem('🎓 Preview / Share Student Progress Portal', 'openStudentPortalPreview')
    .addSeparator()
    .addItem('🔍 Filter Gradebook (Class & Date)', 'openGradebookFilterDialog')
    .addItem('🔄 Clear Gradebook Filter (Show All)', 'clearGradebookFilter')
    .addItem('🔑 Update & Lock Student Passwords', 'updateStudentPortalPasswords')
    .addSeparator()
    .addItem('🚀 Grade Scanned Worksheets (from Drive)', 'gradeScannedWorksheets')
    .addItem('👥 Open / Format Student Roster', 'openRosterSheet')
    .addItem('📈 Refresh Student Standards Monitoring', 'updateStudentMonitoringSheet')
    .addItem('📊 Setup / Format All Sheets (Roster, Gradebook & Standards)', 'setupAllSheets')
    .addSeparator()
    .addItem('🔗 Test Connection to Worksheet Maker', 'testSupabaseConnection')
    .addItem('⚙️ Set Gemini API Key', 'setGeminiApiKeyPrompt')
    .addItem('🔐 Web Access Security Setup', 'setupWebAccessSecurity')
    .addItem('♻️ Reset Teacher Link Key', 'resetTeacherWebKey')
    .addItem('🗝️ Set Supabase Secret Key', 'setSupabaseSecretKeyPrompt')
    .addToUi();
}

/**
 * Serves the Student Progress Portal Web App (or Teacher Dashboard / JSON API) when deployed as a Web App
 */
function doGet(e) {
  if (e && e.parameter) {
    if (e.parameter.action === 'studentProgress') {
      const data = getStudentPortalData(e.parameter.studentId || '', e.parameter.password || '');
      return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Everything below is teacher-only and needs the Teacher Web Key (?key=...)
    const teacherActions = ['interventionData', 'reconcileDrive', 'ensureScanFolder', 'organizePodFolders', 'dashboard'];
    const wantsTeacherView = e.parameter.view === 'teacher' || teacherActions.indexOf(e.parameter.action) !== -1;
    if (wantsTeacherView) {
      if (!isValidTeacherKey_(e.parameter.key)) {
        if (e.parameter.view === 'teacher' || e.parameter.action === 'dashboard') {
          return HtmlService.createHtmlOutput(
            '<div style="font-family:sans-serif;max-width:520px;margin:80px auto;text-align:center">' +
            '<h2>Teacher link required</h2>' +
            '<p>This page needs your private teacher link. In the Google Sheet, open ' +
            '<b>Math Autograder ➔ Web Access Security Setup</b> to get it.</p></div>'
          ).setTitle('Teacher link required');
        }
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Not authorized.' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      TRUSTED_SERVER_CALL_ = true;
    }

    if (e.parameter.action === 'interventionData') {
      const data = getInterventionDashboardData(
        e.parameter.period || 'ALL',
        e.parameter.codes ? e.parameter.codes.split(',') : [],
        Number(e.parameter.tier3) || 60,
        Number(e.parameter.tier2) || 80
      );
      return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (e.parameter.action === 'reconcileDrive') {
      const res = handleDriveBridgeReconcile_({});
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (e.parameter.action === 'ensureScanFolder') {
      const res = ensureAutograderScanFolders_();
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (e.parameter.action === 'organizePodFolders') {
      const res = organizePodFoldersInDrive_();
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (e.parameter.view === 'teacher' || e.parameter.action === 'dashboard') {
      // Hand the page its key so its server calls are accepted (see teacherWebCall)
      // Added as its own script tag at the top of <head>, so it is set before any page code runs
      const keyScript = '<script>window.TEACHER_WEB_KEY = ' + JSON.stringify(String(e.parameter.key)) + ';</' + 'script>';
      const rawDashboardHtml = HtmlService.createHtmlOutputFromFile('TeacherDashboard').getContent();
      const dashboardHtml = rawDashboardHtml.indexOf('<head>') !== -1
        ? rawDashboardHtml.replace('<head>', function() { return '<head>' + keyScript; })
        : keyScript + rawDashboardHtml;
      return HtmlService.createHtmlOutput(dashboardHtml)
        .setTitle('Class & Assignment Data Explorer')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }
  }

  return HtmlService.createHtmlOutputFromFile('StudentPortal')
    .setTitle('Math Progress Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Handles zero-auth Google Drive operations directly from Worksheet Maker 2.0
 * (saving PDFs, trashing deleted worksheets, and two-way Drive sync without expiring browser OAuth tokens!)
 */
function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const body = JSON.parse(raw);
    const action = body.action || (e && e.parameter && e.parameter.action) || '';

    // Callers must prove they are the teacher: the Worksheet Maker site sends its
    // signed-in session token; scripts and automations send the Teacher Web Key.
    if (!isValidTeacherKey_(body.key)) {
      requireTeacherSession_(body.authToken);
    }

    let result = { success: false, error: 'Unknown action: ' + action };
    if (action === 'saveWorksheetToDrive') {
      result = handleDriveBridgeSave_(body);
    } else if (action === 'trashWorksheetInDrive') {
      result = handleDriveBridgeTrash_(body);
    } else if (action === 'reconcileDrive') {
      result = handleDriveBridgeReconcile_(body);
    } else if (action === 'generateAndSavePODWeek') {
      result = handleGenerateAndSavePODWeek_(body);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message || String(err)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Gets or creates a Google Drive folder by name under an optional parent Folder
 */
function getOrCreateDriveBridgeFolder_(folderName, parentFolder) {
  const safeName = String(folderName || 'General').trim() || 'General';
  const parent = parentFolder || DriveApp.getRootFolder();
  const iter = parent.getFoldersByName(safeName);
  while (iter.hasNext()) {
    const f = iter.next();
    if (!f.isTrashed()) return f;
  }
  return parent.createFolder(safeName);
}

/**
 * Saves or updates a PDF file inside a target Drive folder from base64 bytes
 */
function upsertDriveBridgePdf_(folder, fileName, base64Data) {
  if (!base64Data) return null;
  const cleanB64 = String(base64Data).replace(/^data:application\/pdf;base64,/, '');
  const bytes = Utilities.base64Decode(cleanB64);
  const blob = Utilities.newBlob(bytes, 'application/pdf', fileName);

  // Trash any existing active file with the exact same name in this folder to avoid duplicates
  const existing = folder.getFilesByName(fileName);
  while (existing.hasNext()) {
    const f = existing.next();
    if (!f.isTrashed()) {
      f.setTrashed(true);
    }
  }

  const created = folder.createFile(blob);
  return {
    id: created.getId(),
    name: created.getName(),
    webViewLink: created.getUrl()
  };
}

/**
 * Saves both Student and Answer Key PDFs into Google Drive / Worksheet Maker / [Folder Name]
 * Automatically routes Accelerated PODs to "Accelerated PODs" and Math 6 PODs to "Math 6 PODs"
 */
function resolveDriveBridgeFolderName_(rawFolderName, baseFilename) {
  const folder = String(rawFolderName || 'General').trim() || 'General';
  const name = String(baseFilename || '').trim();
  const isPodLike =
    folder === 'Daily Warm-Ups (POD)' ||
    folder === 'Math 6 PODs' ||
    folder === 'Accelerated PODs' ||
    /\bpod\b/i.test(name);

  if (isPodLike) {
    if (/(accel|accelerated|adv|advanced|honors)/i.test(name)) {
      return 'Accelerated PODs';
    }
    if (/math[\s_]*6/i.test(name)) {
      return 'Math 6 PODs';
    }
  }
  return folder;
}

function handleDriveBridgeSave_(body) {
  const rootFolder = getOrCreateDriveBridgeFolder_('Worksheet Maker', DriveApp.getRootFolder());
  const baseFilename = String(body.baseFilename || 'Worksheet').trim();
  const resolvedFolder = resolveDriveBridgeFolderName_(body.folderName, baseFilename);
  const subFolder = getOrCreateDriveBridgeFolder_(resolvedFolder, rootFolder);

  const studentRes = upsertDriveBridgePdf_(subFolder, `${baseFilename}_Student.pdf`, body.studentPdfBase64);
  const keyRes = upsertDriveBridgePdf_(subFolder, `${baseFilename}_AnswerKey.pdf`, body.keyPdfBase64);

  return {
    success: true,
    folderName: resolvedFolder,
    folderUrl: subFolder.getUrl(),
    studentFileUrl: studentRes ? studentRes.webViewLink : null,
    keyFileUrl: keyRes ? keyRes.webViewLink : null,
    studentFileId: studentRes ? studentRes.id : null,
    keyFileId: keyRes ? keyRes.id : null
  };
}

/**
 * Organizes existing Google Drive PDFs inside "Worksheet Maker" into
 * "Math 6 PODs" and "Accelerated PODs" folders based on their filename.
 */
function organizePodFoldersInDrive_() {
  const rootFolder = getOrCreateDriveBridgeFolder_('Worksheet Maker', DriveApp.getRootFolder());
  const math6Folder = getOrCreateDriveBridgeFolder_('Math 6 PODs', rootFolder);
  const accelFolder = getOrCreateDriveBridgeFolder_('Accelerated PODs', rootFolder);

  let movedToMath6 = 0;
  let movedToAccel = 0;

  const subIter = rootFolder.getFolders();
  while (subIter.hasNext()) {
    const sub = subIter.next();
    if (sub.isTrashed()) continue;
    const subName = sub.getName();
    if (subName === 'Math 6 PODs' || subName === 'Accelerated PODs') continue;

    const files = sub.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      if (f.isTrashed()) continue;
      const fname = f.getName();
      if (!/pod/i.test(fname) && subName !== 'Daily Warm-Ups (POD)') continue;

      if (/(accel|accelerated|adv|advanced|honors)/i.test(fname)) {
        f.moveTo(accelFolder);
        movedToAccel++;
      } else if (/math[\s_]*6/i.test(fname)) {
        f.moveTo(math6Folder);
        movedToMath6++;
      }
    }
  }

  return {
    success: true,
    movedToMath6,
    movedToAccel,
    math6FolderUrl: math6Folder.getUrl(),
    accelFolderUrl: accelFolder.getUrl()
  };
}

/**
 * Moves a worksheet's Google Drive PDFs to Trash when deleted in Worksheet Maker
 */
function handleDriveBridgeTrash_(body) {
  const ids = [body.driveStudentFileId, body.driveKeyFileId].filter(Boolean);
  for (let i = 0; i < ids.length; i++) {
    try {
      DriveApp.getFileById(ids[i]).setTrashed(true);
    } catch (e) {}
  }

  const shortCode = String(body.shortCode || '').trim();
  if (shortCode) {
    try {
      const files = DriveApp.searchFiles(`title contains '${shortCode.replace(/'/g, "\\'")}_' and trashed = false`);
      while (files.hasNext()) {
        files.next().setTrashed(true);
      }
    } catch (e) {}
  }

  return { success: true };
}

/**
 * Two-way reconciliation: Scans Google Drive for trashed/deleted worksheet PDFs
 * so Supabase stays in sync without needing browser OAuth tokens
 */
function handleDriveBridgeReconcile_(body) {
  const supabaseWorksheets = Array.isArray(body.worksheets) ? body.worksheets : [];
  if (supabaseWorksheets.length === 0) {
    return { success: true, idsToDelete: [], codesDeleted: [] };
  }

  const activeFileIds = new Set();
  const trashedFileIds = new Set();
  const activeCodes = new Set();
  const trashedCodes = new Set();

  // Check all PDFs inside Worksheet Maker folders
  try {
    const rootIter = DriveApp.getRootFolder().getFoldersByName('Worksheet Maker');
    while (rootIter.hasNext()) {
      const rootF = rootIter.next();
      const rootTrashed = rootF.isTrashed();

      // Check files directly in root
      const rFiles = rootF.getFiles();
      while (rFiles.hasNext()) {
        const f = rFiles.next();
        const isTr = rootTrashed || f.isTrashed();
        const m = f.getName().match(/^([A-Za-z0-9-]+?)_/);
        const c = m ? m[1].toUpperCase() : null;
        if (isTr) {
          trashedFileIds.add(f.getId());
          if (c) trashedCodes.add(c);
        } else {
          activeFileIds.add(f.getId());
          if (c) activeCodes.add(c);
        }
      }

      // Check subfolders
      const subIter = rootF.getFolders();
      while (subIter.hasNext()) {
        const subF = subIter.next();
        const subTrashed = rootTrashed || subF.isTrashed();
        const sFiles = subF.getFiles();
        while (sFiles.hasNext()) {
          const f = sFiles.next();
          const isTr = subTrashed || f.isTrashed();
          const m = f.getName().match(/^([A-Za-z0-9-]+?)_/);
          const c = m ? m[1].toUpperCase() : null;
          if (isTr) {
            trashedFileIds.add(f.getId());
            if (c) trashedCodes.add(c);
          } else {
            activeFileIds.add(f.getId());
            if (c) activeCodes.add(c);
          }
        }
      }
    }
  } catch (e) {
    console.warn('Reconcile scan warning:', e);
  }

  const idsToDelete = [];
  const codesDeleted = [];

  for (let i = 0; i < supabaseWorksheets.length; i++) {
    const ws = supabaseWorksheets[i];
    const code = String(ws.short_code || '').toUpperCase();
    const syncedFileId = ws.layout_config && ws.layout_config.drive_student_file_id;

    if (syncedFileId) {
      let fileStillActive = activeFileIds.has(syncedFileId);
      if (!fileStillActive && !trashedFileIds.has(syncedFileId)) {
        try {
          const df = DriveApp.getFileById(syncedFileId);
          if (df && !df.isTrashed()) {
            fileStillActive = true;
          }
        } catch (err) {
          fileStillActive = false;
        }
      }
      if (!fileStillActive) {
        idsToDelete.push(ws.id);
        codesDeleted.push(code);
        continue;
      }
    }

    if (code && trashedCodes.has(code) && !activeCodes.has(code)) {
      idsToDelete.push(ws.id);
      codesDeleted.push(code);
    }
  }

  return {
    success: true,
    idsToDelete,
    codesDeleted
  };
}

/**
 * Opens the Class & Assignment Data Explorer popout dialog inside Google Sheets
 */
function openInterventionDashboard() {
  const html = HtmlService.createHtmlOutputFromFile('TeacherDashboard')
    .setWidth(1240)
    .setHeight(840);
  SpreadsheetApp.getUi().showModalDialog(html, '📊 Class & Assignment Data Explorer');
}

/**
 * Opens a live preview modal of the Student Progress Portal inside Google Sheets
 * so the teacher can test student lookups or share the Web App URL.
 */
function openStudentPortalPreview() {
  const html = HtmlService.createHtmlOutputFromFile('StudentPortal')
    .setWidth(920)
    .setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(html, '🎓 Student Math Progress Portal (Live Preview)');
}

/**
 * Opens the Gradebook Filter modal dialog
 */
function openGradebookFilterDialog() {
  const html = HtmlService.createHtmlOutputFromFile('GradebookFilter')
    .setWidth(520)
    .setHeight(460);
  SpreadsheetApp.getUi().showModalDialog(html, '🔍 Filter Gradebook by Class & Date');
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
  requireTeacher_();
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
 * Splits a full name string ("Maya Lin" or "Lin, Maya") into { firstName, lastName }
 */
function splitFullName(rawFullName) {
  const clean = String(rawFullName || '').trim();
  if (!clean) return { firstName: '', lastName: '' };

  if (clean.includes(',')) {
    const parts = clean.split(',').map(s => s.trim());
    return {
      firstName: parts.slice(1).join(' ') || '',
      lastName: parts[0] || ''
    };
  }

  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]
  };
}

/**
 * Sets up Student Roster, Gradebook, Standards Map, and Student Monitoring sheets
 */
function setupAllSheets() {
  requireTeacher_();
  setupRosterSheet(true);
  setupGradebookSheet(true);
  setupStandardsMapSheet();
  updateStudentMonitoringSheet();
  SpreadsheetApp.getUi().alert(
    'Sheets Formatted ✅',
    'Created and styled "Student Roster" (supporting both 2-digit and 3-digit Student IDs, First Name, & Last Name), "Gradebook", "Student Monitoring", and "Standards Map" sheets.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Creates or formats the "Student Roster" tab with:
 *   Col A: Student ID (supports 2-digit e.g. 12, or 3-digit e.g. 104)
 *   Col B: First Name
 *   Col C: Last Name
 *   Col D: Class / Period
 *   Col E: Portal Password (student-chosen password for Student Portal)
 *   Col F: Notes / Accommodations
 * Preserves existing student rows, auto-migrates 4-column rosters, and adds Portal Password column.
 */
function setupRosterSheet(silent) {
  requireTeacher_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Student Roster');

  if (!sheet) {
    sheet = ss.insertSheet('Student Roster', 0);
  }

  // Check if an older layout exists
  if (sheet.getLastRow() >= 1 && sheet.getLastColumn() >= 3) {
    const row1 = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 5)).getValues()[0];
    const h1 = row1.map(h => String(h || '').trim().toLowerCase());
    
    // Check if 4-column layout (Col B = "Student Name", Col C = "Class / Period")
    if (h1[1] === 'student name' && h1[2] === 'class / period') {
      sheet.insertColumnAfter(2);
      const lastR = sheet.getLastRow();
      if (lastR > 1) {
        const names = sheet.getRange(2, 2, lastR - 1, 1).getValues();
        const splitRows = names.map(r => {
          const full = String(r[0] || '').trim();
          if (full.toLowerCase().includes('(edit me)')) {
            return ['Example', 'Student (Edit Me)'];
          }
          const sp = splitFullName(full);
          return [sp.firstName, sp.lastName];
        });
        sheet.getRange(2, 2, splitRows.length, 2).setValues(splitRows);
      }
    }

    // Check if Portal Password column is missing
    const hasPasswordCol = h1.some(h => h.includes('password') || h.includes('pin') || h.includes('passcode'));
    if (!hasPasswordCol) {
      sheet.insertColumnAfter(4); // Insert after Class / Period
    }
  }

  const headers = ['Student ID', 'First Name', 'Last Name', 'Class / Period', 'Portal Password', 'Notes / Accommodations'];
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
  sheet.setColumnWidth(2, 140);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 140); // Portal Password
  sheet.setColumnWidth(6, 200); // Notes / Accommodations

  // Format Column A (ID) and Column E (Password) as Plain Text @
  sheet.getRange(2, 1, 250, 1).setNumberFormat('@').setHorizontalAlignment('center').setFontWeight('bold');
  sheet.getRange(2, 5, 250, 1).setNumberFormat('@').setHorizontalAlignment('center');

  // If brand new (no rows below header), add starter example rows showing 2-digit & 3-digit support
  if (sheet.getLastRow() <= 1) {
    const starterRows = [
      ['11', 'Example', 'Student 1 (Edit Me)', 'Period 1', 'math11', 'Supports 2-digit (e.g. 11) or 3-digit (e.g. 101) IDs'],
      ['12', 'Example', 'Student 2 (Edit Me)', 'Period 1', 'math12', ''],
      ['13', 'Example', 'Student 3 (Edit Me)', 'Period 1', 'math13', '']
    ];
    sheet.getRange(2, 1, starterRows.length, 6).setValues(starterRows);
  }

  if (!silent) {
    ss.setActiveSheet(sheet);
    SpreadsheetApp.getUi().alert(
      'Student Roster Ready 👥',
      'Add your students\' ID numbers, First Name, Last Name, and student-chosen Portal Passwords in the "Student Roster" tab.\n\nThen click "🔑 Update & Lock Student Passwords" to activate them!',
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
 * Normalizes a 2-digit, 3-digit, or alphanumeric Student ID for reliable matching
 * (strips leading '#', spaces, and leading zeros for numeric IDs so "07" == "7" and "14" == "14" and "104" == "104")
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
  requireTeacher_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Student Roster');
  if (!sheet) {
    sheet = setupRosterSheet(true);
  }

  const byId = {};
  const byNormalizedId = {};
  const byFullName = {};
  const list = [];

  if (sheet.getLastRow() <= 1) {
    return { byId, byNormalizedId, byFullName, list };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h || '').trim().toLowerCase());
  const idCol = headers.indexOf('student id') !== -1 ? headers.indexOf('student id') : 0;
  const firstCol = headers.indexOf('first name');
  const lastCol = headers.indexOf('last name');
  const periodCol = headers.indexOf('class / period');
  const passCol = headers.findIndex(h => h.includes('password') || h.includes('pin') || h.includes('passcode'));
  const notesCol = headers.findIndex(h => h.includes('note') || h.includes('accommodation'));

  let cachedPasswords = {};
  try {
    const rawCache = PropertiesService.getScriptProperties().getProperty('STUDENT_PORTAL_PASSWORDS');
    if (rawCache) cachedPasswords = JSON.parse(rawCache);
  } catch (e) {}

  for (let i = 1; i < data.length; i++) {
    const rawId = String(data[i][idCol] || '').replace(/^#/, '').trim();
    let firstName = '';
    let lastName = '';
    let rawPeriod = '';
    let rawPassword = '';
    let rawNotes = '';

    if (firstCol !== -1 && lastCol !== -1) {
      firstName = String(data[i][firstCol] || '').trim();
      lastName = String(data[i][lastCol] || '').trim();
      rawPeriod = periodCol !== -1 ? String(data[i][periodCol] || '').trim() : '';
      rawPassword = passCol !== -1 ? String(data[i][passCol] || '').trim() : '';
      rawNotes = notesCol !== -1 ? String(data[i][notesCol] || '').trim() : '';

      // If teacher pasted full name into First Name and left Last Name empty, split it automatically
      if (firstName && !lastName && (firstName.includes(' ') || firstName.includes(','))) {
        const sp = splitFullName(firstName);
        firstName = sp.firstName;
        lastName = sp.lastName;
      }
    } else {
      const sp = splitFullName(String(data[i][1] || '').trim());
      firstName = sp.firstName;
      lastName = sp.lastName;
      rawPeriod = String(data[i][2] || '').trim();
      rawNotes = String(data[i][3] || '').trim();
    }

    if (!rawPassword && rawId) {
      const normId = normalizeStudentIdKey(rawId);
      if (cachedPasswords[normId] || cachedPasswords[rawId]) {
        rawPassword = cachedPasswords[normId] || cachedPasswords[rawId];
      }
    }

    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (!rawId && !fullName) continue;

    const isPlaceholder = fullName.toLowerCase().includes('(edit me)');

    const entry = {
      studentId: rawId || `ROW-${i}`,
      firstName,
      lastName,
      studentName: fullName,
      classPeriod: rawPeriod,
      password: rawPassword,
      notes: rawNotes,
      rowIndex: i + 1,
      isPlaceholder
    };

    if (rawId) {
      byId[rawId] = entry;
      byNormalizedId[normalizeStudentIdKey(rawId)] = entry;
    }
    if (fullName && !isPlaceholder) {
      byFullName[fullName.toLowerCase()] = entry;
      if (lastName && firstName) {
        byFullName[`${lastName.toLowerCase()}, ${firstName.toLowerCase()}`] = entry;
      }
    }
    if (!isPlaceholder) {
      list.push(entry);
    }
  }

  return { byId, byNormalizedId, byFullName, list };
}

/**
 * Resolves a student's canonical ID, First Name, Last Name, and Class/Period from the Student Roster
 * using either the scanned 2-digit/3-digit ID # box OR the handwritten Name line.
 */
function resolveStudentFromRoster(rawId, rawName, existingRosterInfo) {
  requireTeacher_();
  const roster = existingRosterInfo || getRosterData();
  const cleanId = String(rawId || '').replace(/^#/, '').trim();
  const normId = normalizeStudentIdKey(cleanId);
  const cleanName = String(rawName || '').trim();
  const splitHandwritten = splitFullName(cleanName);

  // 1. Direct or numeric-normalized Student ID match in Roster (works for 2-digit & 3-digit IDs)
  if (cleanId && cleanId !== '???') {
    const matchById = roster.byId[cleanId] || roster.byNormalizedId[normId];
    if (matchById && !matchById.isPlaceholder) {
      return {
        studentId: matchById.studentId,
        firstName: matchById.firstName || splitHandwritten.firstName,
        lastName: matchById.lastName || splitHandwritten.lastName,
        studentName: matchById.studentName || cleanName || 'Unnamed Student',
        classPeriod: matchById.classPeriod || '',
        matchedInRoster: true
      };
    }
  }

  // 2. Fallback: Match by handwritten Student Name on the worksheet if ID was blank/unmatched
  if (cleanName) {
    const lowerName = cleanName.toLowerCase();
    if (roster.byFullName[lowerName]) {
      const m = roster.byFullName[lowerName];
      return {
        studentId: m.studentId || cleanId || '???',
        firstName: m.firstName,
        lastName: m.lastName,
        studentName: m.studentName,
        classPeriod: m.classPeriod || '',
        matchedInRoster: true
      };
    }

    // Match by unique First Name or First+Last substring
    const partialMatches = roster.list.filter(s => {
      const rFull = s.studentName.toLowerCase();
      const rFirst = s.firstName.toLowerCase();
      const rLast = s.lastName.toLowerCase();
      return rFull === lowerName || rFirst === lowerName || rLast === lowerName || rFull.includes(lowerName);
    });
    if (partialMatches.length === 1) {
      const m = partialMatches[0];
      return {
        studentId: m.studentId || cleanId || '???',
        firstName: m.firstName,
        lastName: m.lastName,
        studentName: m.studentName,
        classPeriod: m.classPeriod || '',
        matchedInRoster: true
      };
    }
  }

  // 3. Not found in roster yet — return whatever was extracted from the worksheet
  return {
    studentId: cleanId || '???',
    firstName: splitHandwritten.firstName,
    lastName: splitHandwritten.lastName,
    studentName: cleanName || '',
    classPeriod: '',
    matchedInRoster: false
  };
}

/**
 * Adds or updates a student in the "Student Roster" tab (supports 2-digit or 3-digit Student IDs, First Name, Last Name, & Passwords)
 */
function addOrUpdateRosterStudent(studentId, firstName, lastName, classPeriod, password, notes) {
  requireTeacher_();
  const cleanId = String(studentId || '').replace(/^#/, '').trim();
  let cleanFirst = String(firstName || '').trim();
  let cleanLast = String(lastName || '').trim();
  const cleanPeriod = String(classPeriod || '').trim();
  let cleanPassword = '';
  let cleanNotes = '';

  // Backward compatibility if called with (id, first, last, period, notes)
  if (notes === undefined && typeof password === 'string' && (password.length > 25 || password.includes(' '))) {
    cleanNotes = password.trim();
  } else {
    cleanPassword = String(password || '').trim();
    cleanNotes = String(notes || '').trim();
  }

  if (cleanFirst && !cleanLast && (cleanFirst.includes(' ') || cleanFirst.includes(','))) {
    const sp = splitFullName(cleanFirst);
    cleanFirst = sp.firstName;
    cleanLast = sp.lastName;
  }

  if (!cleanId || (!cleanFirst && !cleanLast)) {
    throw new Error('Student ID and Name are required.');
  }

  const sheet = setupRosterSheet(true);
  const data = sheet.getDataRange().getValues();
  const normTarget = normalizeStudentIdKey(cleanId);

  let updatedRow = -1;
  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][0] || '').replace(/^#/, '').trim();
    const rowFirst = String(data[i][1] || '').trim();
    const rowLast = String(data[i][2] || '').trim();
    if (
      normalizeStudentIdKey(rowId) === normTarget ||
      rowFirst.toLowerCase().includes('(edit me)') ||
      rowLast.toLowerCase().includes('(edit me)')
    ) {
      updatedRow = i + 1;
      break;
    }
  }

  if (updatedRow !== -1) {
    // Preserve existing password if new password was left empty
    if (!cleanPassword && data[updatedRow - 1][4]) {
      cleanPassword = String(data[updatedRow - 1][4]).trim();
    }
    sheet.getRange(updatedRow, 1, 1, 6).setValues([[cleanId, cleanFirst, cleanLast, cleanPeriod, cleanPassword, cleanNotes]]);
    sheet.getRange(updatedRow, 1).setNumberFormat('@').setHorizontalAlignment('center').setFontWeight('bold');
    sheet.getRange(updatedRow, 5).setNumberFormat('@').setHorizontalAlignment('center');
  } else {
    sheet.appendRow([cleanId, cleanFirst, cleanLast, cleanPeriod, cleanPassword, cleanNotes]);
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1).setNumberFormat('@').setHorizontalAlignment('center').setFontWeight('bold');
    sheet.getRange(lastRow, 5).setNumberFormat('@').setHorizontalAlignment('center');
  }

  try {
    updateStudentMonitoringSheet();
  } catch (e) {
    console.warn('Monitoring refresh warning:', e);
  }

  return getGradebookAnalytics();
}

/**
 * Hardcodes and updates all student-chosen passwords from the "Student Roster" sheet.
 * Evaluates any formulas into static text values, trims whitespace, formats as plain text,
 * and caches them into Script Properties for fast, secure authentication.
 */
function updateStudentPortalPasswords() {
  requireTeacher_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Student Roster');
  if (!sheet) {
    sheet = setupRosterSheet(true);
  }

  // Ensure Portal Password column exists
  setupRosterSheet(true);
  sheet = ss.getSheetByName('Student Roster');

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    try {
      SpreadsheetApp.getUi().alert(
        'Student Roster Empty',
        'No students found in the "Student Roster" sheet. Please add students and their passwords before updating.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {}
    return { success: false, message: 'No students found in roster.' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h || '').trim().toLowerCase());

  const idColIndex = headers.indexOf('student id') !== -1 ? headers.indexOf('student id') : 0;
  const passColIndex = headers.findIndex(h => h.includes('password') || h.includes('pin') || h.includes('passcode'));

  if (passColIndex === -1) {
    throw new Error('Could not find the "Portal Password" column in Student Roster.');
  }

  const passRange = sheet.getRange(2, passColIndex + 1, lastRow - 1, 1);
  const passValues = passRange.getValues();

  let updatedCount = 0;
  let blankCount = 0;
  const cleanedPassValues = [];
  const passwordMap = {};

  for (let i = 0; i < passValues.length; i++) {
    const rowIndex = i + 1;
    const rawId = String(data[rowIndex][idColIndex] || '').replace(/^#/, '').trim();
    const normId = normalizeStudentIdKey(rawId);

    // passValues[i][0] contains evaluated cell value (even if entered as a formula)
    const rawPass = passValues[i][0];
    const cleanPass = String(rawPass === null || rawPass === undefined ? '' : rawPass).trim();

    // Hardcode as plain text
    cleanedPassValues.push([cleanPass]);

    if (normId) {
      if (cleanPass) {
        passwordMap[normId] = cleanPass;
        passwordMap[rawId] = cleanPass;
        updatedCount++;
      } else {
        blankCount++;
      }
    }
  }

  // Write static plain-text values back to the sheet (replaces any formulas with permanent text)
  passRange.setNumberFormat('@');
  passRange.setValues(cleanedPassValues);

  // Cache in Script Properties
  PropertiesService.getScriptProperties().setProperty('STUDENT_PORTAL_PASSWORDS', JSON.stringify(passwordMap));

  const summaryMsg = `Successfully updated and locked passwords for ${updatedCount} student(s) in "Student Roster"! (${blankCount} student(s) have blank passwords).\n\nStudent Portal is now active with their custom student passwords.`;

  try {
    SpreadsheetApp.getUi().alert(
      '🔑 Student Passwords Updated & Hardcoded ✅',
      summaryMsg,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (uiErr) {}

  return {
    success: true,
    updatedCount,
    blankCount,
    total: updatedCount + blankCount,
    message: summaryMsg
  };
}

/**
 * Builds the canonical Gradebook headers (including Student ID, First Name, Last Name, Class / Period, and Q1..Q10)
 */
const GRADEBOOK_MAX_QUESTIONS = 20; // Q1..Q20, three columns each
const GRADEBOOK_FIRST_QUESTION_COL = 12; // 1-based column of "Q1 Score"

function getCanonicalGradebookHeaders() {
  const headers = [
    'Timestamp',
    'Student ID',
    'First Name',
    'Last Name',
    'Class / Period',
    'Assignment Code',
    'Assignment Title',
    'Score %',
    'Points',
    'Total Pts',
    'Status'
  ];
  for (let i = 1; i <= GRADEBOOK_MAX_QUESTIONS; i++) {
    headers.push(`Q${i} Score`, `Q${i} Student Ans`, `Q${i} Feedback`);
  }
  return headers;
}

/**
 * Helper to create a type-safe VLOOKUP formula against 'Student Roster'!$A:$F
 */
function buildRosterVlookupFormula(rowNum, rosterColIndex, fallbackText) {
  const safeFallback = String(fallbackText || '').replace(/"/g, '""');
  return `=IFERROR(VLOOKUP(B${rowNum}, 'Student Roster'!$A:$F, ${rosterColIndex}, FALSE), IFERROR(VLOOKUP(TO_TEXT(B${rowNum}), 'Student Roster'!$A:$F, ${rosterColIndex}, FALSE), IFERROR(VLOOKUP(VALUE(B${rowNum}), 'Student Roster'!$A:$F, ${rosterColIndex}, FALSE), "${safeFallback}")))`;
}

/**
 * Ensures an existing Gradebook sheet has "First Name", "Last Name", and "Class / Period"
 * right after "Student ID" without losing any existing graded rows.
 */
function ensureGradebookColumns(sheet) {
  if (!sheet) return;
  if (sheet.getLastRow() === 0) {
    const headers = getCanonicalGradebookHeaders();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 11)).getValues()[0];
  const lowerHeaders = firstRow.map(h => String(h || '').trim().toLowerCase());

  // Case 1: Very old layout (Col B = Student ID, Col C = Assignment Code) -> insert 3 columns (First Name, Last Name, Class / Period)
  if (lowerHeaders[1] === 'student id' && lowerHeaders[2] === 'assignment code') {
    sheet.insertColumnsAfter(2, 3);
    const lastRow = sheet.getLastRow();
    for (let r = 2; r <= lastRow; r++) {
      sheet.getRange(r, 3).setFormula(buildRosterVlookupFormula(r, 2, ''));
      sheet.getRange(r, 4).setFormula(buildRosterVlookupFormula(r, 3, ''));
      sheet.getRange(r, 5).setFormula(buildRosterVlookupFormula(r, 4, ''));
    }
  }
  // Case 2: Previous layout (Col B = Student ID, Col C = Student Name, Col D = Class / Period) -> insert 1 column after C for Last Name
  else if (lowerHeaders[1] === 'student id' && lowerHeaders[2] === 'student name') {
    sheet.insertColumnAfter(3);
    const lastRow = sheet.getLastRow();
    for (let r = 2; r <= lastRow; r++) {
      sheet.getRange(r, 3).setFormula(buildRosterVlookupFormula(r, 2, ''));
      sheet.getRange(r, 4).setFormula(buildRosterVlookupFormula(r, 3, ''));
      sheet.getRange(r, 5).setFormula(buildRosterVlookupFormula(r, 4, ''));
    }
  }

  const headers = getCanonicalGradebookHeaders();
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1e293b');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);
  headerRange.setHorizontalAlignment('center');
  sheet.setRowHeight(1, 35);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4); // Freeze Timestamp, Student ID, First Name, Last Name

  // Ensure native Google Sheets filter exists on Gradebook
  if (sheet.getLastRow() >= 1 && sheet.getLastColumn() >= 1 && !sheet.getFilter()) {
    sheet.getDataRange().createFilter();
  }
}

/**
 * Creates or formats the "Gradebook" sheet (preserving existing rows)
 */
function setupGradebookSheet(silent) {
  requireTeacher_();
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
      'The "Gradebook" sheet is formatted and linked to "Student Roster" (with Student ID, First Name, Last Name, and Class / Period columns).',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
  return sheet;
}

/**
 * Student Portal API: Returns a specific student's progress, standards mastery, and graded worksheets
 * when they log in with their 2-digit or 3-digit Student ID # and their Student-Chosen Password.
 */
function getStudentPortalData(rawStudentId, rawPassword) {
  const cleanInputId = String(rawStudentId || '').replace(/^#/, '').trim();
  const normInputId = normalizeStudentIdKey(cleanInputId);
  const inputPassClean = String(rawPassword || '').trim();

  if (!normInputId) {
    return { found: false, error: 'Please enter your 2-digit or 3-digit Student ID #.' };
  }
  if (!inputPassClean) {
    return { found: false, error: 'Please enter your student password.' };
  }

  if (isPortalLockedOut_(normInputId)) {
    return {
      found: false,
      error: 'Too many wrong passwords for Student ID #' + cleanInputId + '. Wait 10 minutes and try again, or ask your teacher.'
    };
  }

  // This function checks the student's password itself, so it may read the roster
  TRUSTED_SERVER_CALL_ = true;
  const rosterInfo = getRosterData();
  const rosterMatch = rosterInfo.byId[cleanInputId] || rosterInfo.byNormalizedId[normInputId];

  // Retrieve cached passwords if available
  let cachedPasswords = {};
  try {
    const rawCache = PropertiesService.getScriptProperties().getProperty('STUDENT_PORTAL_PASSWORDS');
    if (rawCache) cachedPasswords = JSON.parse(rawCache);
  } catch (e) {}

  const configuredPass = (rosterMatch && rosterMatch.password) || cachedPasswords[normInputId] || cachedPasswords[cleanInputId] || '';

  // A password must be set in the roster. Names are never accepted as a
  // password: classmates know them. The same message is used for a wrong
  // password and an unknown ID so IDs cannot be probed.
  if (!configuredPass) {
    recordPortalFailure_(normInputId);
    return {
      found: false,
      error: 'No password is set yet for Student ID #' + cleanInputId + ', or the ID is wrong. Please ask your teacher.'
    };
  }
  // Case-insensitive comparison with whitespace trimmed for student convenience
  if (configuredPass.toLowerCase().trim() !== inputPassClean.toLowerCase()) {
    recordPortalFailure_(normInputId);
    return {
      found: false,
      error: 'Incorrect password for Student ID #' + cleanInputId + '. If you forgot your password, please ask your teacher.'
    };
  }
  clearPortalFailures_(normInputId);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Gradebook');

  const submissions = [];
  let totalEarned = 0;
  let totalPossible = 0;
  const standardsMap = {};

  let resolvedFirst = rosterMatch ? rosterMatch.firstName : '';
  let resolvedLast = rosterMatch ? rosterMatch.lastName : '';
  let resolvedPeriod = rosterMatch ? rosterMatch.classPeriod : '';

  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || '').trim().toLowerCase());
    const rows = data.slice(1);

    const tsCol = 0;
    const idCol = headers.indexOf('student id') !== -1 ? headers.indexOf('student id') : 1;
    const firstCol = headers.indexOf('first name');
    const lastCol = headers.indexOf('last name');
    const fullNameCol = headers.indexOf('student name');
    const periodCol = headers.indexOf('class / period');
    const codeCol = headers.indexOf('assignment code') !== -1 ? headers.indexOf('assignment code') : 5;
    const titleCol = headers.indexOf('assignment title') !== -1 ? headers.indexOf('assignment title') : 6;
    const scorePctCol = headers.indexOf('score %') !== -1 ? headers.indexOf('score %') : 7;
    const ptsCol = headers.indexOf('points') !== -1 ? headers.indexOf('points') : 8;
    const totalPtsCol = headers.indexOf('total pts') !== -1 ? headers.indexOf('total pts') : 9;
    const q1ScoreCol = headers.indexOf('q1 score') !== -1 ? headers.indexOf('q1 score') : 11;

    for (const r of rows) {
      const rowId = String(r[idCol] || '').replace(/^#/, '').trim();
      if (normalizeStudentIdKey(rowId) !== normInputId) continue;

      if (!resolvedFirst && firstCol !== -1 && r[firstCol]) resolvedFirst = String(r[firstCol]).trim();
      if (!resolvedLast && lastCol !== -1 && r[lastCol]) resolvedLast = String(r[lastCol]).trim();
      if (!resolvedFirst && fullNameCol !== -1 && r[fullNameCol]) {
        const sp = splitFullName(String(r[fullNameCol]));
        resolvedFirst = sp.firstName;
        resolvedLast = sp.lastName;
      }
      if (!resolvedPeriod && periodCol !== -1 && r[periodCol]) resolvedPeriod = String(r[periodCol]).trim();

      const pts = parseFloat(r[ptsCol]) || 0;
      const poss = parseFloat(r[totalPtsCol]) || 0;
      const rawScoreVal = r[scorePctCol];
      let scorePct = 0;
      if (poss > 0 && !isNaN(pts)) {
        scorePct = Math.round((pts / poss) * 100);
      } else if (typeof rawScoreVal === 'number') {
        scorePct = rawScoreVal <= 1 && rawScoreVal > 0 ? Math.round(rawScoreVal * 100) : Math.round(rawScoreVal);
      } else {
        const parsed = parseFloat(String(rawScoreVal || '0').replace('%', '')) || 0;
        scorePct = parsed <= 1 && parsed > 0 ? Math.round(parsed * 100) : Math.round(parsed);
      }

      totalEarned += pts;
      totalPossible += poss;

      const questions = [];
      for (let qIdx = 0; qIdx < GRADEBOOK_MAX_QUESTIONS; qIdx++) {
        const baseCol = q1ScoreCol + (qIdx * 3);
        if (baseCol + 2 >= r.length) break;
        const cellVal = r[baseCol];
        if (cellVal === '' || cellVal === null || cellVal === undefined) continue;

        const qScore = parseFloat(cellVal) || 0;
        const qAns = String(r[baseCol + 1] || '');
        const qFeedback = String(r[baseCol + 2] || '');

        const stdMatch = qFeedback.match(/([4-8]\.[A-Z]+\.[A-Z0-9\.]+)/i);
        const stdCode = stdMatch ? stdMatch[1].toUpperCase() : null;
        const cleanFeedback = qFeedback.replace(/\[([4-8]\.[A-Z]+\.[A-Z0-9\.]+)\]/gi, function(m, c) {
          const translated = typeof translateStandard === 'function' ? translateStandard(c) : c;
          return `[${translated}]`;
        });

        questions.push({
          orderIndex: qIdx + 1,
          score: qScore,
          studentAnswer: qAns,
          feedback: cleanFeedback
        });
        if (stdCode) {
          if (!standardsMap[stdCode]) {
            standardsMap[stdCode] = { code: stdCode, attempts: 0, correct: 0 };
          }
          standardsMap[stdCode].attempts++;
          if (qScore > 0) standardsMap[stdCode].correct++;
        }
      }

      let tsFormatted = '';
      if (r[tsCol] instanceof Date) {
        tsFormatted = Utilities.formatDate(r[tsCol], Session.getScriptTimeZone(), 'MMM d, yyyy');
      } else {
        tsFormatted = String(r[tsCol] || '').split(' ')[0];
      }

      submissions.push({
        timestamp: tsFormatted,
        assignmentCode: String(r[codeCol] || ''),
        assignmentTitle: String(r[titleCol] || 'Math Worksheet'),
        scorePct,
        points: pts,
        totalPossible: poss,
        questions
      });
    }
  }

  if (!rosterMatch && submissions.length === 0) {
    return {
      found: false,
      error: `No student or graded worksheets found for ID #${cleanInputId}.`
    };
  }

  const standards = Object.values(standardsMap).map(s => ({
    code: s.code,
    name: typeof translateStandard === 'function' ? translateStandard(s.code) : s.code,
    attempts: s.attempts,
    correct: s.correct,
    rate: s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : 0
  })).sort((a, b) => a.rate - b.rate);

  const overallAvg = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
  const fullName = [resolvedFirst, resolvedLast].filter(Boolean).join(' ').trim() || `Student #${cleanInputId}`;

  return {
    found: true,
    studentId: rosterMatch ? rosterMatch.studentId : cleanInputId,
    firstName: resolvedFirst,
    lastName: resolvedLast,
    fullName,
    classPeriod: resolvedPeriod,
    totalSubmissions: submissions.length,
    totalEarned,
    totalPossible,
    overallAvg,
    standards,
    submissions: submissions.reverse() // Most recent first
  };
}

/**
 * Sidebar API: Computes real-time class analytics, roster coverage, and student stats
 */
function getGradebookAnalytics() {
  requireTeacher_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterInfo = getRosterData();
  const recentWorksheets = typeof fetchRecentWorksheetsList === 'function' ? fetchRecentWorksheetsList() : [];
  const sheet = ss.getSheetByName('Gradebook');

  if (!sheet || sheet.getLastRow() <= 1) {
    return {
      totalSubmissions: 0,
      rosterCount: rosterInfo.list.length,
      roster: rosterInfo.list,
      missingStudents: rosterInfo.list.map(s => ({
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        studentName: s.studentName,
        classPeriod: s.classPeriod
      })),
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
  const firstCol = headers.indexOf('first name');
  const lastCol = headers.indexOf('last name');
  const fullNameCol = headers.indexOf('student name');
  const periodCol = headers.indexOf('class / period');
  const codeCol = headers.indexOf('assignment code') !== -1 ? headers.indexOf('assignment code') : 5;
  const scorePctCol = headers.indexOf('score %') !== -1 ? headers.indexOf('score %') : 7;
  const ptsCol = headers.indexOf('points') !== -1 ? headers.indexOf('points') : 8;
  const totalPtsCol = headers.indexOf('total pts') !== -1 ? headers.indexOf('total pts') : 9;
  const q1ScoreCol = headers.indexOf('q1 score') !== -1 ? headers.indexOf('q1 score') : 11;

  let totalScoreSum = 0;
  let passingCount = 0;
  const students = [];
  const submittedNormalizedIds = new Set();

  const qAccumulator = Array.from({ length: GRADEBOOK_MAX_QUESTIONS }, () => ({
    attempts: 0,
    earnedSum: 0,
    possibleSum: 0,
    feedbackSamples: []
  }));

  for (const row of rows) {
    const rawId = String(row[idCol] || '???').trim();
    const rawFirst = firstCol !== -1 ? String(row[firstCol] || '').trim() : '';
    const rawLast = lastCol !== -1 ? String(row[lastCol] || '').trim() : '';
    const rawFull = fullNameCol !== -1
      ? String(row[fullNameCol] || '').trim()
      : [rawFirst, rawLast].filter(Boolean).join(' ');
    const rawPeriod = periodCol !== -1 ? String(row[periodCol] || '').trim() : '';
    const assignmentCode = String(row[codeCol] || '').trim();

    const resolved = resolveStudentFromRoster(rawId, rawFull, rosterInfo);
    const studentId = resolved.studentId || rawId || '???';
    const firstName = resolved.firstName || rawFirst || '';
    const lastName = resolved.lastName || rawLast || '';
    const studentName = resolved.studentName || rawFull || 'Unlisted in Roster';
    const classPeriod = resolved.classPeriod || rawPeriod || '';

    const normId = normalizeStudentIdKey(studentId);
    if (normId) submittedNormalizedIds.add(normId);

    const rawScoreVal = row[scorePctCol];
    let scorePct = 0;
    if (typeof rawScoreVal === 'number') {
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

    for (let qIdx = 0; qIdx < GRADEBOOK_MAX_QUESTIONS; qIdx++) {
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
      firstName,
      lastName,
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

  for (let i = 0; i < GRADEBOOK_MAX_QUESTIONS; i++) {
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
      firstName: r.firstName,
      lastName: r.lastName,
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
 * Returns available classes/periods and date info for Gradebook filtering
 */
function getGradebookFilterOptions() {
  requireTeacher_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const periods = new Set();
  
  // From Gradebook
  const gbSheet = ss.getSheetByName('Gradebook');
  let gbRowCount = 0;
  if (gbSheet && gbSheet.getLastRow() > 1) {
    const data = gbSheet.getDataRange().getValues();
    gbRowCount = data.length - 1;
    const headers = data[0].map(h => String(h || '').trim().toLowerCase());
    const periodCol = headers.indexOf('class / period');
    if (periodCol !== -1) {
      for (let i = 1; i < data.length; i++) {
        const p = String(data[i][periodCol] || '').trim();
        if (p) periods.add(p);
      }
    }
  }

  // From Roster
  const rosterSheet = ss.getSheetByName('Student Roster');
  if (rosterSheet && rosterSheet.getLastRow() > 1) {
    const rData = rosterSheet.getDataRange().getValues();
    const rHeaders = rData[0].map(h => String(h || '').trim().toLowerCase());
    const rPeriodCol = rHeaders.indexOf('class / period');
    if (rPeriodCol !== -1) {
      for (let i = 1; i < rData.length; i++) {
        const p = String(rData[i][rPeriodCol] || '').trim();
        if (p) periods.add(p);
      }
    }
  }

  const sortedPeriods = Array.from(periods).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return {
    periods: sortedPeriods,
    totalRows: gbRowCount
  };
}

/**
 * Applies a filter to the Gradebook sheet by Class/Period and by Date
 *
 * @param {string} targetPeriod - Class/Period (e.g. 'Period 1') or 'ALL'
 * @param {string} datePreset - 'ALL', 'TODAY', 'YESTERDAY', 'WEEK', 'MONTH', or 'CUSTOM'
 * @param {string} customStart - Optional 'YYYY-MM-DD' start date
 * @param {string} customEnd - Optional 'YYYY-MM-DD' end date
 * @returns {Object} Filter results summary
 */
function applyGradebookFilter(targetPeriod, datePreset, customStart, customEnd) {
  requireTeacher_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Gradebook');
  if (!sheet) {
    sheet = setupGradebookSheet(true);
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) {
    return { success: false, message: 'Gradebook is currently empty.' };
  }

  let filter = sheet.getFilter();
  if (!filter) {
    filter = sheet.getRange(1, 1, lastRow, lastCol).createFilter();
  }

  const data = sheet.getDataRange().getValues();
  const displayData = sheet.getDataRange().getDisplayValues();
  const headers = data[0].map(h => String(h || '').trim().toLowerCase());

  const tsColIndex = headers.indexOf('timestamp') !== -1 ? headers.indexOf('timestamp') + 1 : 1;
  const periodColIndex = headers.indexOf('class / period') !== -1 ? headers.indexOf('class / period') + 1 : 5;

  const cleanPeriod = String(targetPeriod || 'ALL').trim();
  const cleanPreset = String(datePreset || 'ALL').trim().toUpperCase();

  // 1. FILTER BY CLASS / PERIOD
  if (cleanPeriod && cleanPeriod.toUpperCase() !== 'ALL') {
    const hiddenPeriodsSet = new Set();
    for (let r = 1; r < data.length; r++) {
      const rowPeriod = String(data[r][periodColIndex - 1] || '').trim();
      const displayPeriod = String(displayData[r][periodColIndex - 1] || '').trim();
      if (rowPeriod.toLowerCase() !== cleanPeriod.toLowerCase()) {
        hiddenPeriodsSet.add(displayPeriod);
        if (rowPeriod) hiddenPeriodsSet.add(rowPeriod);
      }
    }
    const periodCriteria = SpreadsheetApp.newFilterCriteria()
      .setHiddenValues(Array.from(hiddenPeriodsSet))
      .build();
    filter.setColumnFilterCriteria(periodColIndex, periodCriteria);
  } else {
    filter.removeColumnFilterCriteria(periodColIndex);
  }

  // 2. FILTER BY DATE
  if (cleanPreset !== 'ALL') {
    const now = new Date();
    let minDate = new Date(1970, 0, 1);
    let maxDate = new Date(2100, 0, 1);

    if (cleanPreset === 'TODAY') {
      minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      maxDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (cleanPreset === 'YESTERDAY') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      minDate = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0);
      maxDate = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
    } else if (cleanPreset === 'WEEK' || cleanPreset === 'LAST_7_DAYS') {
      minDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      maxDate = now;
    } else if (cleanPreset === 'MONTH' || cleanPreset === 'LAST_30_DAYS') {
      minDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      maxDate = now;
    } else if (cleanPreset === 'CUSTOM' && customStart) {
      minDate = new Date(customStart + 'T00:00:00');
      if (customEnd) {
        maxDate = new Date(customEnd + 'T23:59:59.999');
      }
    }

    const hiddenTimestampsSet = new Set();
    for (let r = 1; r < data.length; r++) {
      const rawTs = data[r][tsColIndex - 1];
      const displayTs = String(displayData[r][tsColIndex - 1] || '').trim();
      let rowDate = null;
      if (rawTs instanceof Date && !isNaN(rawTs.getTime())) {
        rowDate = rawTs;
      } else if (rawTs) {
        const parsed = new Date(rawTs);
        if (!isNaN(parsed.getTime())) rowDate = parsed;
      }

      if (!rowDate || rowDate < minDate || rowDate > maxDate) {
        hiddenTimestampsSet.add(displayTs);
        if (rawTs && typeof rawTs === 'string') hiddenTimestampsSet.add(rawTs);
      }
    }

    const tsCriteria = SpreadsheetApp.newFilterCriteria()
      .setHiddenValues(Array.from(hiddenTimestampsSet))
      .build();
    filter.setColumnFilterCriteria(tsColIndex, tsCriteria);
  } else {
    filter.removeColumnFilterCriteria(tsColIndex);
  }

  ss.setActiveSheet(sheet);
  ss.toast(
    `Gradebook filtered by Class: ${cleanPeriod} | Date: ${cleanPreset}`,
    '🔍 Gradebook Filter Active',
    4
  );

  return {
    success: true,
    period: cleanPeriod,
    datePreset: cleanPreset,
    totalRows: data.length - 1
  };
}

/**
 * Clears all active filter criteria on the Gradebook sheet so all rows are visible
 */
function clearGradebookFilter() {
  requireTeacher_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Gradebook');
  if (!sheet) return { success: false, message: 'Gradebook sheet not found.' };

  const filter = sheet.getFilter();
  if (filter) {
    const lastCol = sheet.getLastColumn();
    for (let c = 1; c <= lastCol; c++) {
      filter.removeColumnFilterCriteria(c);
    }
  }
  ss.setActiveSheet(sheet);
  ss.toast('All Gradebook filters cleared. All rows are now visible.', '🔄 Filter Cleared', 3);
  return { success: true };
}

/**
 * Target Google Drive Folder ID where copier scans are dropped for autograding
 * URL: https://drive.google.com/drive/u/0/folders/15ZdjhTl_CRi_BRFeGa2wMAU3PwvUbi8T
 */
const AUTOGRADER_SCAN_FOLDER_ID = '15ZdjhTl_CRi_BRFeGa2wMAU3PwvUbi8T';
const AUTOGRADER_SCANNED_SUBFOLDER_NAME = 'Scanned';

/**
 * Ensures the target scan folder and its "Scanned" archive subfolder exist and returns both
 */
function getAutograderScanFolders_() {
  let scanFolder = null;
  try {
    scanFolder = DriveApp.getFolderById(AUTOGRADER_SCAN_FOLDER_ID);
  } catch (e) {
    // Fallback by name if needed
    const folders = DriveApp.getFoldersByName('Worksheet Scans');
    scanFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder('Worksheet Scans');
  }

  let scannedFolder = null;
  const subIter = scanFolder.getFoldersByName(AUTOGRADER_SCANNED_SUBFOLDER_NAME);
  while (subIter.hasNext()) {
    const f = subIter.next();
    if (!f.isTrashed()) {
      scannedFolder = f;
      break;
    }
  }
  if (!scannedFolder) {
    scannedFolder = scanFolder.createFolder(AUTOGRADER_SCANNED_SUBFOLDER_NAME);
  }

  return {
    scanFolder,
    scannedFolder
  };
}

/**
 * JSON helper to verify & initialize the scan folder and its "Scanned" subfolder
 */
function ensureAutograderScanFolders_() {
  try {
    const { scanFolder, scannedFolder } = getAutograderScanFolders_();
    return {
      success: true,
      scanFolderId: scanFolder.getId(),
      scanFolderName: scanFolder.getName(),
      scanFolderUrl: scanFolder.getUrl(),
      scannedFolderId: scannedFolder.getId(),
      scannedFolderName: scannedFolder.getName(),
      scannedFolderUrl: scannedFolder.getUrl()
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || String(err)
    };
  }
}

function fixMisnamedGradebookAssignments_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Gradebook');
    if (!sheet) return { success: false, error: 'No Gradebook sheet' };

    // Rows 97-113: Accelerated POD Tue 11/3 (17 students)
    for (let r = 97; r <= 113; r++) {
      sheet.getRange(r, 6).setValue('ACC-1103');
      sheet.getRange(r, 7).setValue('Accelerated POD Tue 11/3');
    }

    // Rows 114-130: Accelerated POD Mon 11/2 (17 students)
    for (let r = 114; r <= 130; r++) {
      sheet.getRange(r, 6).setValue('ALG-701');
      sheet.getRange(r, 7).setValue('Accelerated POD Mon 11/2');
    }

    // Rows 131-152: Math 6 POD Tue 11/3 (22 students)
    for (let r = 131; r <= 152; r++) {
      sheet.getRange(r, 6).setValue('M8539');
      sheet.getRange(r, 7).setValue('Math 6 POD Tue 11/3');
    }

    // Rows 153-175: Math 6 POD Mon 11/2 (23 students)
    for (let r = 153; r <= 175; r++) {
      sheet.getRange(r, 6).setValue('M6287');
      sheet.getRange(r, 7).setValue('Math 6 POD Mon 11/2');
    }

    return {
      success: true,
      updated: {
        'ACC-1103': 'Rows 97-113 (17 rows) -> Accelerated POD Tue 11/3',
        'ALG-701': 'Rows 114-130 (17 rows) -> Accelerated POD Mon 11/2',
        'M8539': 'Rows 131-152 (22 rows) -> Math 6 POD Tue 11/3',
        'M6287': 'Rows 153-175 (23 rows) -> Math 6 POD Mon 11/2'
      }
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

const GRADING_TIME_BUDGET_MS = 4.5 * 60 * 1000; // Apps Script stops a run at 6 minutes
const GRADED_FILE_IDS_PROP = 'GRADED_FILE_IDS';
const GRADED_FILE_IDS_KEEP = 400;

/**
 * IDs of scan files whose rows are already in the Gradebook, so a file that was
 * graded but not moved (for example the run was cut off) is never graded twice.
 */
function getGradedFileIds_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(GRADED_FILE_IDS_PROP);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function rememberGradedFile_(fileId) {
  const list = getGradedFileIds_().filter(id => id !== fileId);
  list.push(fileId);
  PropertiesService.getScriptProperties().setProperty(
    GRADED_FILE_IDS_PROP,
    JSON.stringify(list.slice(-GRADED_FILE_IDS_KEEP))
  );
}

/**
 * Compares a title read from the scan with the title stored for the code.
 * Ignores case, spacing and punctuation; a blank title on either side passes.
 */
function assignmentTitlesAgree_(scannedTitle, storedTitle) {
  const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const a = norm(scannedTitle);
  const b = norm(storedTitle);
  if (!a || !b) return true;
  return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
}

/**
 * Works out which answer key a scan file should be graded against.
 * Order of trust: the teacher's choice in the sidebar, a code in the file name,
 * then the code Gemini reads off the page (which must also match the title).
 * Throws a teacher-readable reason when no single key can be chosen, because a
 * worksheet is never graded without its answer key.
 */
function resolveManifestForScan_(file, pdfBlob, selectedManifest, getManifestCached) {
  if (selectedManifest) return selectedManifest;

  const fileCodeHint = detectAssignmentCodeFromFileName(file.getName());
  const hinted = fileCodeHint ? getManifestCached(fileCodeHint) : null;
  if (hinted) return hinted;

  const found = identifyWorksheetWithGemini_(pdfBlob);
  if (found.length === 0) {
    throw new Error('could not read an assignment code on the page. Choose the assignment in the dropdown and grade again.');
  }

  const matches = [];
  const problems = [];
  found.forEach(w => {
    const manifest = getManifestCached(w.assignmentCode);
    if (!manifest) {
      problems.push(`code "${w.assignmentCode}" is not a saved worksheet`);
    } else if (!assignmentTitlesAgree_(w.assignmentTitle, manifest.worksheet && manifest.worksheet.title)) {
      problems.push(`code "${w.assignmentCode}" belongs to "${manifest.worksheet.title}" but the page title reads "${w.assignmentTitle}"`);
    } else {
      matches.push(manifest);
    }
  });

  if (matches.length === 1 && problems.length === 0) return matches[0];
  if (matches.length > 1) {
    const codes = matches.map(m => m.worksheet.short_code).join(', ');
    throw new Error(`this PDF mixes more than one assignment (${codes}). Scan each assignment as its own PDF.`);
  }
  throw new Error(`${problems.join('; ')}. Choose the assignment in the dropdown and grade again.`);
}

/**
 * Turns one graded submission into a Gradebook row plus the reasons, if any,
 * that a teacher should look at it.
 */
function buildGradebookRow_(sub, rowNum, context) {
  const manifest = context.manifest;
  const manifestCode = String(manifest.worksheet.short_code || '').trim().toUpperCase();
  const reviewReasons = [];

  const extractedId = String(sub.studentId || '').replace(/^#/, '').trim();
  const extractedName = String(sub.studentName || '').trim();
  const resolved = resolveStudentFromRoster(extractedId, extractedName, context.rosterInfo);
  const finalStudentId = resolved.studentId || extractedId || '???';
  const fallbackFirst = resolved.firstName || '';
  const fallbackLast = resolved.lastName || '';

  if (finalStudentId === '???') {
    reviewReasons.push('student ID not readable');
  } else if (!resolved.matchedInRoster) {
    reviewReasons.push(`ID ${finalStudentId} is not in the roster`);
  }

  const scannedCode = String(sub.assignmentCode || '').trim().toUpperCase();
  if (scannedCode && scannedCode !== manifestCode) {
    reviewReasons.push(`page shows code ${scannedCode}`);
  }
  if (Array.isArray(sub.missingQuestions) && sub.missingQuestions.length > 0) {
    reviewReasons.push(`AI skipped Q${sub.missingQuestions.join(', Q')}`);
  }
  if (/low/i.test(String(sub.confidence || ''))) {
    reviewReasons.push('AI was unsure of the handwriting');
  }

  const duplicateKey = normalizeStudentIdKey(finalStudentId) + '|' + manifestCode;
  if (finalStudentId !== '???' && context.existingKeys[duplicateKey]) {
    reviewReasons.push('this student already has a row for this assignment');
  }
  context.existingKeys[duplicateKey] = true;

  const totalScore = parseFloat(sub.totalScore) || 0;
  const totalPossible = parseFloat(sub.totalPossible) || 0;
  const scorePct = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

  const status = reviewReasons.length > 0
    ? 'Needs Review — ' + reviewReasons.join('; ')
    : (scorePct >= 70 ? 'Passed' : 'Needs Practice');

  const row = [
    Utilities.formatDate(context.now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    finalStudentId,
    buildRosterVlookupFormula(rowNum, 2, fallbackFirst),
    buildRosterVlookupFormula(rowNum, 3, fallbackLast),
    buildRosterVlookupFormula(rowNum, 4, resolved.classPeriod || ''),
    manifestCode,
    String(manifest.worksheet.title || sub.assignmentTitle || context.fileNameClean || 'Scanned Assignment').trim(),
    `${scorePct}%`,
    totalScore,
    totalPossible,
    status
  ];

  // Each question goes in the columns for its own number, never by list position
  const questionCells = [];
  for (let i = 0; i < GRADEBOOK_MAX_QUESTIONS * 3; i++) questionCells.push('');
  const asText = v => {
    const text = String(v === undefined || v === null ? '' : v);
    return /^[=+]/.test(text) ? "'" + text : text; // keep "=5" from becoming a formula
  };
  const qList = Array.isArray(sub.questions) ? sub.questions : [];
  qList.forEach((q, listIndex) => {
    const number = parseInt(q.orderIndex, 10);
    const slot = (number >= 1 ? number : listIndex + 1) - 1;
    if (slot >= GRADEBOOK_MAX_QUESTIONS) return;

    let feedback = String(q.feedback || '');
    // Show what scratch work the AI saw, so partial-credit decisions can be checked
    const workShown = String(q.workShown || '').trim();
    if (workShown) feedback = `Work seen: ${workShown.replace(/[.\s]+$/, '')}. ${feedback}`;
    const standard = context.keyStandards[number];
    if (standard && feedback.toUpperCase().indexOf(String(standard).toUpperCase()) === -1) {
      feedback = `${feedback} [${standard}]`.trim();
    }

    questionCells[slot * 3] = q.notGraded ? '' : (q.pointsEarned !== undefined ? q.pointsEarned : '');
    questionCells[slot * 3 + 1] = asText(q.studentAnswer || '—');
    questionCells[slot * 3 + 2] = asText(feedback);
  });

  return {
    values: row.concat(questionCells),
    scorePct: scorePct,
    needsReview: reviewReasons.length > 0,
    autoRosterAdd: (!resolved.matchedInRoster && finalStudentId !== '???' && (fallbackFirst || fallbackLast))
      ? { studentId: finalStudentId, firstName: fallbackFirst, lastName: fallbackLast }
      : null
  };
}

/**
 * Writes all of one file's rows to the Gradebook in a single step, so a file is
 * either fully recorded or not recorded at all.
 */
function writeGradebookRows_(sheet, startRow, builtRows) {
  const count = builtRows.length;
  const width = builtRows[0].values.length;
  const lastNeededRow = startRow + count - 1;
  if (sheet.getMaxRows() < lastNeededRow) {
    sheet.insertRowsAfter(sheet.getMaxRows(), lastNeededRow - sheet.getMaxRows());
  }

  // Text format first, so IDs like "07" and answers like "1/2" are kept as written
  sheet.getRange(startRow, 2, count, 1).setNumberFormat('@');
  const questionFormats = [];
  for (let r = 0; r < count; r++) {
    const formats = [];
    for (let q = 0; q < GRADEBOOK_MAX_QUESTIONS; q++) formats.push('General', '@', '@');
    questionFormats.push(formats);
  }
  sheet.getRange(startRow, GRADEBOOK_FIRST_QUESTION_COL, count, GRADEBOOK_MAX_QUESTIONS * 3).setNumberFormats(questionFormats);

  sheet.getRange(startRow, 1, count, width).setValues(builtRows.map(r => r.values));

  sheet.getRange(startRow, 2, count, 1).setHorizontalAlignment('center').setFontWeight('bold');

  const scoreColors = builtRows.map(r => {
    if (r.scorePct >= 80) return ['#dcfce7', '#166534'];
    if (r.scorePct >= 60) return ['#fef9c3', '#854d0e'];
    return ['#fee2e2', '#991b1b'];
  });
  sheet.getRange(startRow, 8, count, 1)
    .setBackgrounds(scoreColors.map(c => [c[0]]))
    .setFontColors(scoreColors.map(c => [c[1]]))
    .setFontWeight('bold');

  sheet.getRange(startRow, 11, count, 1)
    .setBackgrounds(builtRows.map(r => [r.needsReview ? '#ffedd5' : null]))
    .setFontColors(builtRows.map(r => [r.needsReview ? '#9a3412' : null]))
    .setFontWeights(builtRows.map(r => [r.needsReview ? 'bold' : 'normal']));
}

/**
 * Sidebar API: Runs the autograder directly from the sidebar button.
 * Scans https://drive.google.com/drive/u/0/folders/15ZdjhTl_CRi_BRFeGa2wMAU3PwvUbi8T
 * and moves graded PDFs into the "Scanned" subfolder inside it.
 *
 * A file is graded only against a known answer key. Files that cannot be
 * graded stay in the folder and are named, with the reason, in the result.
 * @param {string} [selectedAssignmentCode] - Optional short code selected by teacher in Sidebar
 */
function runGradingFromSidebar(selectedAssignmentCode) {
  requireTeacher_();

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) {
    throw new Error('Grading is already running. Wait for it to finish, then try again.');
  }

  try {
    const startedAt = Date.now();
    resetGeminiUsage_();
    setupRosterSheet(true);
    const sheet = setupGradebookSheet(true);
    const rosterInfo = getRosterData();

    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Gemini API key is not set. Click '⚙️ Set Gemini Key' at the bottom of the panel.");
    }

    const { scanFolder, scannedFolder } = getAutograderScanFolders_();
    const folderName = scanFolder.getName();

    const pdfFiles = scanFolder.getFilesByType(MimeType.PDF);
    const filesToGrade = [];
    while (pdfFiles.hasNext()) {
      const f = pdfFiles.next();
      if (!f.isTrashed()) {
        filesToGrade.push(f);
      }
    }

    if (filesToGrade.length === 0) {
      throw new Error(`No new scanned PDFs found in "${folderName}". Drop your copier scans into the folder and try again.`);
    }

    const manifestCache = {};
    const getManifestCached = function(code) {
      if (!code) return null;
      const clean = String(code).trim().toUpperCase();
      if (manifestCache[clean] !== undefined) return manifestCache[clean];
      try {
        const manifest = fetchWorksheetManifest(clean);
        const hasKey = manifest && Array.isArray(manifest.questions) && manifest.questions.length > 0;
        manifestCache[clean] = hasKey ? manifest : null;
      } catch (e) {
        manifestCache[clean] = null;
      }
      return manifestCache[clean];
    };

    const cleanSelected = String(selectedAssignmentCode || '').trim();
    const selectedManifest = cleanSelected ? getManifestCached(cleanSelected) : null;
    if (cleanSelected && !selectedManifest) {
      throw new Error(`Assignment "${cleanSelected.toUpperCase()}" has no saved answer key in Worksheet Maker, so nothing was graded.`);
    }

    // Student + assignment pairs already in the Gradebook, to flag repeats
    const existingKeys = {};
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 2, sheet.getLastRow() - 1, 5).getValues().forEach(r => {
        const id = normalizeStudentIdKey(r[0]);
        const code = String(r[4] || '').trim().toUpperCase();
        if (id && code) existingKeys[id + '|' + code] = true;
      });
    }

    const alreadyGraded = getGradedFileIds_();
    let gradedSubmissionsCount = 0;
    let gradedFilesCount = 0;
    let needsReviewCount = 0;
    let alreadyGradedCount = 0;
    let filesLeftForNextRun = 0;
    const failures = [];

    for (let fileIndex = 0; fileIndex < filesToGrade.length; fileIndex++) {
      const file = filesToGrade[fileIndex];

      if (Date.now() - startedAt > GRADING_TIME_BUDGET_MS) {
        filesLeftForNextRun = filesToGrade.length - fileIndex;
        break;
      }

      try {
        if (alreadyGraded.indexOf(file.getId()) !== -1) {
          // Its rows are already in the Gradebook; only the move was missed
          file.moveTo(scannedFolder);
          alreadyGradedCount++;
          continue;
        }

        const pdfBlob = file.getBlob();
        const manifest = resolveManifestForScan_(file, pdfBlob, selectedManifest, getManifestCached);
        const gradeResult = gradeWorksheetWithGemini(pdfBlob, manifest);
        const submissions = Array.isArray(gradeResult.submissions) ? gradeResult.submissions : [];
        if (submissions.length === 0) {
          throw new Error('the AI did not find any student work in this PDF.');
        }

        const keyStandards = {};
        manifest.questions.forEach(q => {
          if (q.order_index != null && q.standard) keyStandards[q.order_index] = String(q.standard).trim();
        });

        const context = {
          manifest: manifest,
          rosterInfo: rosterInfo,
          existingKeys: existingKeys,
          keyStandards: keyStandards,
          now: new Date(),
          fileNameClean: file.getName().replace(/\.pdf$/i, '').trim()
        };

        const startRow = sheet.getLastRow() + 1;
        const builtRows = submissions.map((sub, i) => buildGradebookRow_(sub, startRow + i, context));

        writeGradebookRows_(sheet, startRow, builtRows);
        rememberGradedFile_(file.getId());
        file.moveTo(scannedFolder);

        builtRows.forEach(r => {
          if (r.needsReview) needsReviewCount++;
          if (r.autoRosterAdd) {
            try {
              addOrUpdateRosterStudent(r.autoRosterAdd.studentId, r.autoRosterAdd.firstName, r.autoRosterAdd.lastName, '', 'Auto-added from worksheet scan');
            } catch (autoErr) {
              console.warn('Auto-roster add skipped:', autoErr);
            }
          }
        });

        gradedSubmissionsCount += builtRows.length;
        gradedFilesCount++;
      } catch (err) {
        console.error(`Grading error for ${file.getName()}:`, err);
        const reason = String((err && err.message) || err).replace(/[<>]/g, '').slice(0, 220);
        failures.push(`${file.getName().replace(/[<>]/g, '')}: ${reason}`);
      }
    }

    try {
      updateStudentMonitoringSheet();
    } catch (e) {
      console.error('Monitoring update error:', e);
    }

    const parts = [];
    if (gradedFilesCount > 0) {
      parts.push(`Graded ${gradedSubmissionsCount} student worksheet(s) from ${gradedFilesCount} PDF file(s).`);
    }
    if (needsReviewCount > 0) {
      parts.push(`⚠️ ${needsReviewCount} row(s) are marked "Needs Review" in the Status column.`);
    }
    if (alreadyGradedCount > 0) {
      parts.push(`${alreadyGradedCount} file(s) were already in the Gradebook and were just moved to "Scanned".`);
    }
    if (failures.length > 0) {
      parts.push(`⚠️ ${failures.length} file(s) were NOT graded and are still in "${folderName}": ${failures.join(' | ')}`);
    }
    if (filesLeftForNextRun > 0) {
      parts.push(`⏱️ Stopped to stay inside Google's time limit with ${filesLeftForNextRun} file(s) left. Click Grade again to continue.`);
    }
    const usageLine = describeGeminiUsage_();
    if (usageLine) parts.push(usageLine);
    const message = parts.join(' ');

    // Nothing at all was graded: show it as an error, not a success
    if (gradedFilesCount === 0 && alreadyGradedCount === 0 && failures.length > 0) {
      throw new Error(message);
    }
    return message;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menu fallback function
 */
function gradeScannedWorksheets() {
  showSidebar();
}

/**
 * ==============================================================================
 * TEACHER SMALL GROUPS & INTERVENTION COMMAND CENTER BACKEND API
 * ==============================================================================
 * Aggregates student scores, question performance, and standards gaps across
 * user-selected assignments and class periods, automatically binning students
 * into Tier 3 (Intensive Intervention), Tier 2 (Strategic Support), and Tier 1 (Mastery).
 */
function getInterventionDashboardData(targetPeriod, targetCodes, cutoffTier3, cutoffTier2) {
  requireTeacher_();
  targetPeriod = targetPeriod || 'ALL';
  targetCodes = Array.isArray(targetCodes) ? targetCodes : [];
  cutoffTier3 = Number(cutoffTier3) || 60;
  cutoffTier2 = Number(cutoffTier2) || 80;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterInfo = getRosterData();
  const gradebookSheet = ss.getSheetByName('Gradebook');

  // 1. Gather all periods from Roster and Gradebook
  const periodsSet = new Set();
  rosterInfo.list.forEach(r => {
    if (r.classPeriod) periodsSet.add(r.classPeriod.trim());
  });

  const allRosterFormatted = rosterInfo.list.map(r => ({
    studentId: r.studentId,
    firstName: r.firstName || '',
    lastName: r.lastName || '',
    fullName: r.studentName,
    classPeriod: r.classPeriod || 'No Period'
  }));
  const stdDict = typeof getStandardsMapDictionary === 'function'
    ? getStandardsMapDictionary()
    : (typeof STANDARDS_DICTIONARY !== 'undefined' ? STANDARDS_DICTIONARY : {});

  if (!gradebookSheet || gradebookSheet.getLastRow() <= 1) {
    return {
      periods: Array.from(periodsSet).sort(),
      selectedPeriod: targetPeriod,
      assignments: [],
      selectedCodes: [],
      cutoffTier3,
      cutoffTier2,
      summary: {
        overallAverage: 0,
        totalStudentsGraded: 0,
        rosterCount: rosterInfo.list.length,
        tier3Count: 0,
        tier2Count: 0,
        tier1Count: 0,
        missingCount: rosterInfo.list.length,
        topStrugglingStandard: null
      },
      tiers: { tier3: [], tier2: [], tier1: [] },
      missingStudents: allRosterFormatted,
      roster: allRosterFormatted,
      standardsDictionary: stdDict,
      itemAnalysis: []
    };
  }

  const data = gradebookSheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h || '').trim().toLowerCase());
  const rows = data.slice(1);

  const idCol = headers.indexOf('student id') !== -1 ? headers.indexOf('student id') : 1;
  const firstCol = headers.indexOf('first name');
  const lastCol = headers.indexOf('last name');
  const fullNameCol = headers.indexOf('student name');
  const periodCol = headers.indexOf('class / period');
  const codeCol = headers.indexOf('assignment code') !== -1 ? headers.indexOf('assignment code') : 5;
  const titleCol = headers.indexOf('assignment title') !== -1 ? headers.indexOf('assignment title') : 6;
  const scorePctCol = headers.indexOf('score %') !== -1 ? headers.indexOf('score %') : 7;
  const ptsCol = headers.indexOf('points') !== -1 ? headers.indexOf('points') : 8;
  const totalPtsCol = headers.indexOf('total pts') !== -1 ? headers.indexOf('total pts') : 9;

  // 2. Discover all unique assignments in Gradebook
  const assignmentMap = new Map();
  for (const row of rows) {
    const code = String(row[codeCol] || '').trim().toUpperCase();
    if (!code) continue;
    const title = titleCol !== -1 ? String(row[titleCol] || code).trim() : code;
    const timestamp = row[0] instanceof Date ? row[0] : new Date(row[0] || Date.now());
    const aPtsEarned = parseFloat(row[ptsCol]) || 0;
    const aPtsTotal = parseFloat(row[totalPtsCol]) || 0;
    const aRawScoreVal = row[scorePctCol];
    let scoreVal = 0;
    if (aPtsTotal > 0 && !isNaN(aPtsEarned)) {
      scoreVal = Math.round((aPtsEarned / aPtsTotal) * 1000) / 10;
    } else if (typeof aRawScoreVal === 'number') {
      scoreVal = aRawScoreVal <= 1 && aRawScoreVal > 0 ? Math.round(aRawScoreVal * 1000) / 10 : Math.round(aRawScoreVal * 10) / 10;
    } else {
      const parsed = parseFloat(String(aRawScoreVal || '0').replace('%', '')) || 0;
      scoreVal = parsed <= 1 && parsed > 0 ? Math.round(parsed * 1000) / 10 : Math.round(parsed * 10) / 10;
    }

    if (!assignmentMap.has(code)) {
      assignmentMap.set(code, {
        code,
        title,
        date: Utilities.formatDate(timestamp, ss.getSpreadsheetTimeZone() || 'GMT', 'M/d/yy'),
        rawDate: timestamp.getTime(),
        submissionCount: 0,
        totalScoreSum: 0
      });
    }
    const a = assignmentMap.get(code);
    a.submissionCount++;
    a.totalScoreSum += scoreVal;
  }

  const allAssignments = Array.from(assignmentMap.values())
    .map(a => ({
      code: a.code,
      title: a.title,
      date: a.date,
      submissionCount: a.submissionCount,
      averageScore: a.submissionCount > 0 ? Math.round((a.totalScoreSum / a.submissionCount) * 10) / 10 : 0,
      rawDate: a.rawDate
    }))
    .sort((a, b) => b.rawDate - a.rawDate);

  // If no codes selected, default to the 3 most recent assignments
  let activeCodes = targetCodes.map(c => String(c).trim().toUpperCase()).filter(Boolean);
  if (activeCodes.length === 0 && allAssignments.length > 0) {
    activeCodes = allAssignments.slice(0, 3).map(a => a.code);
  }
  const activeCodesSet = new Set(activeCodes);

  // 3. Aggregate Student Data across Selected Assignments
  const studentMap = new Map();
  const stdMissCount = new Map();
  const itemAnalysisMap = new Map();

  for (const row of rows) {
    const code = String(row[codeCol] || '').trim().toUpperCase();
    if (!code) continue;

    const rawId = String(row[idCol] || '???').trim();
    const rawFirst = firstCol !== -1 ? String(row[firstCol] || '').trim() : '';
    const rawLast = lastCol !== -1 ? String(row[lastCol] || '').trim() : '';
    const rawFull = fullNameCol !== -1
      ? String(row[fullNameCol] || '').trim()
      : [rawFirst, rawLast].filter(Boolean).join(' ');
    const rawPeriod = periodCol !== -1 ? String(row[periodCol] || '').trim() : '';

    const resolved = resolveStudentFromRoster(rawId, rawFull, rosterInfo);
    const studentId = resolved.studentId || rawId || '???';
    const firstName = resolved.firstName || rawFirst || '';
    const lastName = resolved.lastName || rawLast || '';
    const studentName = resolved.studentName || [firstName, lastName].filter(Boolean).join(' ') || rawFull || `Student #${studentId}`;
    const studentPeriod = resolved.classPeriod || rawPeriod || 'No Period';

    // Filter by period if requested
    if (targetPeriod !== 'ALL' && studentPeriod.toLowerCase() !== targetPeriod.toLowerCase()) {
      continue;
    }

    const normKey = normalizeStudentIdKey(studentId);
    if (!studentMap.has(normKey)) {
      studentMap.set(normKey, {
        studentId,
        firstName,
        lastName,
        fullName: studentName,
        classPeriod: studentPeriod,
        submissions: [],
        allSubmissions: [],
        totalPointsEarned: 0,
        totalPointsPossible: 0,
        missedQuestions: [],
        strugglingStandards: {}
      });
    }

    const studentObj = studentMap.get(normKey);
    const ptsEarned = parseFloat(row[ptsCol]) || 0;
    const ptsTotal = parseFloat(row[totalPtsCol]) || 0;
    const rawScoreVal = row[scorePctCol];
    let scoreVal = 0;
    if (ptsTotal > 0 && !isNaN(ptsEarned)) {
      scoreVal = Math.round((ptsEarned / ptsTotal) * 1000) / 10;
    } else if (typeof rawScoreVal === 'number') {
      scoreVal = rawScoreVal <= 1 && rawScoreVal > 0 ? Math.round(rawScoreVal * 1000) / 10 : Math.round(rawScoreVal * 10) / 10;
    } else {
      const parsed = parseFloat(String(rawScoreVal || '0').replace('%', '')) || 0;
      scoreVal = parsed <= 1 && parsed > 0 ? Math.round(parsed * 1000) / 10 : Math.round(parsed * 10) / 10;
    }

    const subQuestions = [];
    const assignmentTitle = titleCol !== -1 ? String(row[titleCol] || code).trim() : code;

    for (let q = 1; q <= GRADEBOOK_MAX_QUESTIONS; q++) {
      const qScoreIndex = headers.indexOf(`q${q} score`);
      if (qScoreIndex === -1) break;
      const qScoreVal = row[qScoreIndex];
      if (qScoreVal === '' || qScoreVal === undefined || qScoreVal === null) continue;

      const qAnsIndex = headers.indexOf(`q${q} student ans`);
      const qFeedbackIndex = headers.indexOf(`q${q} feedback`);

      const qScore = parseFloat(qScoreVal) || 0;
      const qAns = qAnsIndex !== -1 ? String(row[qAnsIndex] || '') : '';
      const qFeedback = qFeedbackIndex !== -1 ? String(row[qFeedbackIndex] || '') : '';

      // Extract standard from feedback e.g. [6.NS.C.6b] or 6.NS.C.6b
      let stdCode = '';
      const stdMatch = qFeedback.match(/\[?([4-8]\.[A-Z]+\.[A-Z]+(?:\.[0-9a-zA-Z]+)?)\]?/i);
      if (stdMatch) stdCode = stdMatch[1];

      if (activeCodesSet.has(code)) {
        const itemKey = `${code}_Q${q}`;
        if (!itemAnalysisMap.has(itemKey)) {
          itemAnalysisMap.set(itemKey, {
            assignmentCode: code,
            assignmentTitle,
            qNum: q,
            standard: stdCode,
            standardDescription: (typeof translateStandard === 'function')
              ? translateStandard(stdCode, stdDict)
              : (stdDict[stdCode] || ''),
            attempts: 0,
            earnedSum: 0,
            correctCount: 0,
            missedStudents: []
          });
        }
        const itemStat = itemAnalysisMap.get(itemKey);
        itemStat.attempts++;
        itemStat.earnedSum += qScore;
        if (qScore > 0) itemStat.correctCount++;

        // If missed or partial credit
        if (qScore === 0 || (ptsTotal > 0 && qScore < (ptsTotal / 10))) {
          itemStat.missedStudents.push({
            studentName,
            studentId,
            classPeriod: studentPeriod,
            studentAns: qAns,
            feedback: qFeedback
          });

          studentObj.missedQuestions.push({
            assignmentTitle,
            assignmentCode: code,
            qNum: q,
            score: qScore,
            studentAns: qAns,
            feedback: qFeedback,
            standard: stdCode
          });

          if (stdCode) {
            studentObj.strugglingStandards[stdCode] = (studentObj.strugglingStandards[stdCode] || 0) + 1;
            stdMissCount.set(stdCode, (stdMissCount.get(stdCode) || 0) + 1);
          }
        }
      }

      subQuestions.push({
        qNum: q,
        score: qScore,
        studentAns: qAns,
        feedback: qFeedback,
        standard: stdCode
      });
    }

    const subTimestamp = row[0] instanceof Date ? row[0] : new Date(row[0] || Date.now());
    const subItem = {
      assignmentCode: code,
      assignmentTitle,
      date: Utilities.formatDate(subTimestamp, ss.getSpreadsheetTimeZone() || 'GMT', 'M/d/yy'),
      rawDate: subTimestamp.getTime(),
      scorePercent: scoreVal,
      pointsEarned: ptsEarned,
      pointsTotal: ptsTotal,
      questions: subQuestions
    };

    studentObj.allSubmissions.push(subItem);

    if (activeCodesSet.has(code)) {
      studentObj.totalPointsEarned += ptsEarned;
      studentObj.totalPointsPossible += ptsTotal;
      studentObj.submissions.push(subItem);
    }
  }

  // 4. Compute Student Averages & Assign to Intervention Tiers
  const tier3Students = [];
  const tier2Students = [];
  const tier1Students = [];

  let overallScoreSum = 0;
  let overallSubmissionCount = 0;

  studentMap.forEach((s) => {
    const avg = s.submissions.length > 0
      ? Math.round(s.submissions.reduce((acc, sub) => acc + sub.scorePercent, 0) / s.submissions.length * 10) / 10
      : 0;
    s.averageScore = avg;

    overallScoreSum += avg;
    overallSubmissionCount++;

    s.primaryGaps = Object.entries(s.strugglingStandards)
      .sort((a, b) => b[1] - a[1])
      .map(([code]) => code);

    if (avg < cutoffTier3) {
      tier3Students.push(s);
    } else if (avg < cutoffTier2) {
      tier2Students.push(s);
    } else {
      tier1Students.push(s);
    }
  });

  tier3Students.sort((a, b) => a.averageScore - b.averageScore);
  tier2Students.sort((a, b) => a.averageScore - b.averageScore);
  tier1Students.sort((a, b) => b.averageScore - a.averageScore);

  // 5. Find missing roster students for this period
  const missingStudents = rosterInfo.list
    .filter(r => {
      const pMatch = targetPeriod === 'ALL' || (r.classPeriod && r.classPeriod.toLowerCase() === targetPeriod.toLowerCase());
      return pMatch && !studentMap.has(normalizeStudentIdKey(r.studentId));
    })
    .map(r => ({
      studentId: r.studentId,
      fullName: r.studentName,
      classPeriod: r.classPeriod || 'No Period'
    }));

  // 6. Top Struggling Standard
  let topStandard = null;
  let maxMisses = 0;
  stdMissCount.forEach((count, code) => {
    if (count > maxMisses) {
      maxMisses = count;
      const desc = (typeof getStandardDescription === 'function')
        ? getStandardDescription(code)
        : (typeof STANDARDS_DICTIONARY !== 'undefined' && STANDARDS_DICTIONARY[code] ? STANDARDS_DICTIONARY[code] : '');
      topStandard = { code, name: desc, missCount: count };
    }
  });

  // 7. Item Analysis List
  const itemAnalysis = Array.from(itemAnalysisMap.values()).map(item => ({
    assignmentCode: item.assignmentCode,
    assignmentTitle: item.assignmentTitle,
    qNum: item.qNum,
    standard: item.standard,
    standardDescription: item.standardDescription,
    attempts: item.attempts,
    correctCount: item.correctCount,
    accuracyPercent: item.attempts > 0 ? Math.round((item.correctCount / item.attempts) * 100) : 0,
    missedStudents: item.missedStudents
  })).sort((a, b) => a.accuracyPercent - b.accuracyPercent);

  const totalGraded = overallSubmissionCount;
  const overallAvg = totalGraded > 0 ? Math.round((overallScoreSum / totalGraded) * 10) / 10 : 0;
  const periodRosterCount = rosterInfo.list.filter(r => targetPeriod === 'ALL' || (r.classPeriod && r.classPeriod.toLowerCase() === targetPeriod.toLowerCase())).length;

  return {
    periods: Array.from(periodsSet).sort(),
    selectedPeriod: targetPeriod,
    assignments: allAssignments.map(a => ({
      ...a,
      isSelected: activeCodesSet.has(a.code)
    })),
    selectedCodes: activeCodes,
    cutoffTier3,
    cutoffTier2,
    summary: {
      overallAverage: overallAvg,
      totalStudentsGraded: totalGraded,
      rosterCount: periodRosterCount,
      tier3Count: tier3Students.length,
      tier2Count: tier2Students.length,
      tier1Count: tier1Students.length,
      missingCount: missingStudents.length,
      topStrugglingStandard: topStandard
    },
    tiers: {
      tier3: tier3Students,
      tier2: tier2Students,
      tier1: tier1Students
    },
    students: Array.from(studentMap.values()).sort((a, b) => b.averageScore - a.averageScore),
    missingStudents,
    roster: allRosterFormatted,
    standardsDictionary: stdDict,
    itemAnalysis
  };
}

/**
 * Safely parses Gemini JSON output, handling markdown fences, trailing commas,
 * and unescaped LaTeX backslashes.
 */
function robustParseGeneratedJson_(rawText) {
  let cleaned = String(rawText || '').trim()
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '');

  const firstArray = cleaned.indexOf('[');
  const firstObj = cleaned.indexOf('{');
  let start = -1;
  if (firstArray !== -1 && firstObj !== -1) start = Math.min(firstArray, firstObj);
  else start = firstArray !== -1 ? firstArray : firstObj;

  const lastArray = cleaned.lastIndexOf(']');
  const lastObj = cleaned.lastIndexOf('}');
  const end = Math.max(lastArray, lastObj);

  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }

  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    cleaned = cleaned.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, '\\\\');
    return JSON.parse(cleaned);
  }
}

/**
 * Calls Gemini with the provided POD prompt, parses the resulting daily worksheets,
 * saves them to Supabase (`worksheets` + `questions`), and returns the created IDs.
 */
function handleGenerateAndSavePODWeek_(body) {
  const promptText = String((body && body.prompt) || '').trim();
  if (!promptText) {
    throw new Error('Missing POD prompt.');
  }

  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error("Gemini API Key is not set in Worksheet Maker script properties.");
  }

  const primaryModel = props.getProperty('GEMINI_MODEL') || (typeof GEMINI_MODEL !== 'undefined' ? GEMINI_MODEL : 'gemini-3.8-flash');
  const fallbackList = (typeof FALLBACK_MODELS !== 'undefined') ? FALLBACK_MODELS : ['gemini-flash-latest', 'gemini-2.5-flash'];
  const modelsToTry = [primaryModel, ...fallbackList.filter(m => m !== primaryModel)];

  const geminiPayload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.35
    }
  };

  const fetchOpts = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(geminiPayload),
    muteHttpExceptions: true
  };

  let response = null;
  let status = 0;
  for (let i = 0; i < modelsToTry.length; i++) {
    const modelName = modelsToTry[i];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    response = UrlFetchApp.fetch(endpoint, fetchOpts);
    status = response.getResponseCode();
    if (status !== 404) break;
  }

  if (status !== 200) {
    throw new Error(`Gemini API Error (${status}): ${response ? response.getContentText() : 'No response'}`);
  }

  const resJson = JSON.parse(response.getContentText());
  const candidate = resJson.candidates && resJson.candidates[0] && resJson.candidates[0].content &&
    resJson.candidates[0].content.parts && resJson.candidates[0].content.parts[0] && resJson.candidates[0].content.parts[0].text;
  if (!candidate) {
    throw new Error('Gemini returned an empty response.');
  }

  const parsed = robustParseGeneratedJson_(candidate);
  const items = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.problems || []);
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Gemini did not return any questions in the expected JSON array format.');
  }

  // Group items by assignmentName in chronological order
  const groupOrder = [];
  const groupMap = {};
  items.forEach(item => {
    const name = String(item.assignmentName || 'Daily POD').trim();
    if (!groupMap[name]) {
      groupMap[name] = [];
      groupOrder.push(name);
    }
    groupMap[name].push(item);
  });

  const course = String((body && body.course) || 'Math 6').trim();
  const folderName = String((body && body.folderName) || (course === 'Accelerated' ? 'Accelerated PODs' : 'Math 6 PODs')).trim();
  const gradeLevel = course === 'Accelerated' ? '7th Grade' : '6th Grade';

  // Writing worksheets needs the Supabase secret key once the database is locked down
  const sbWriteKey = getSupabaseWriteKey_();
  const sbHeaders = {
    'apikey': sbWriteKey,
    'Authorization': `Bearer ${sbWriteKey}`,
    'Content-Type': 'application/json'
  };

  // Best-effort ensure folder exists in Supabase
  try {
    UrlFetchApp.fetch(`${SUPABASE_CONFIG.url}/rest/v1/folders`, {
      method: 'post',
      headers: Object.assign({}, sbHeaders, { 'Prefer': 'resolution=ignore-duplicates' }),
      payload: JSON.stringify({ name: folderName }),
      muteHttpExceptions: true
    });
  } catch (e) {}

  const createdIds = [];
  const createdCodes = [];
  const createdTitles = [];

  groupOrder.forEach(groupName => {
    const groupItems = groupMap[groupName];
    const shortCode = 'M' + Math.floor(1000 + Math.random() * 9000);
    const totalPages = groupItems.length > 6 ? 2 : 1;
    const perPageLimit = totalPages === 2 ? Math.ceil(groupItems.length / 2) : groupItems.length;

    const wsPayload = {
      short_code: shortCode,
      title: groupName,
      subject: 'Mathematics',
      grade_level: gradeLevel,
      folder_name: folderName,
      style_preset: 'pod',
      total_pages: totalPages,
      columns: 2,
      student_id_digits: 3,
      track_standards: true,
      layout_config: {
        border_style: 'solid',
        header_style: 'clean',
        show_dot_grid: false,
        columns: 2,
        spacing: 'balanced',
        show_honor_pledge: false,
        track_standards: true
      }
    };

    const wsResp = UrlFetchApp.fetch(`${SUPABASE_CONFIG.url}/rest/v1/worksheets`, {
      method: 'post',
      headers: Object.assign({}, sbHeaders, { 'Prefer': 'return=representation' }),
      payload: JSON.stringify(wsPayload),
      muteHttpExceptions: true
    });

    const wsStatus = wsResp.getResponseCode();
    if (wsStatus < 200 || wsStatus >= 300) {
      throw new Error(`Supabase worksheet insert failed (${wsStatus}): ${wsResp.getContentText()}`);
    }

    const wsRows = JSON.parse(wsResp.getContentText());
    const wsRow = Array.isArray(wsRows) ? wsRows[0] : wsRows;
    if (!wsRow || !wsRow.id) {
      throw new Error('Supabase did not return created worksheet ID.');
    }

    const qPayload = groupItems.map((item, idx) => {
      const pageNum = totalPages === 2 && idx >= perPageLimit ? 2 : 1;
      let std = item.standard || '';
      if (!std && item.rubric_notes) {
        const m = String(item.rubric_notes).match(/([4-8]\.[A-Z]+\.[A-Z]+(?:\.[0-9a-zA-Z]+)?)/i);
        if (m) std = m[1];
      }
      const qType = item.question_type || 'numeric';
      return {
        worksheet_id: wsRow.id,
        order_index: idx + 1,
        page_number: pageNum,
        prompt: String(item.prompt || item.question || `Problem ${idx + 1}`),
        question_type: qType,
        options: Array.isArray(item.options) ? item.options : [],
        correct_answer: String(item.correct_answer || item.answer || ''),
        acceptable_alternatives: Array.isArray(item.acceptable_alternatives) ? item.acceptable_alternatives : [],
        points: Number(item.points) || (qType === 'multi_step' ? 3 : 2),
        rubric_notes: String(item.rubric_notes || item.explanation || ''),
        standard: std || null,
        bounding_box: {}
      };
    });

    const qResp = UrlFetchApp.fetch(`${SUPABASE_CONFIG.url}/rest/v1/questions`, {
      method: 'post',
      headers: sbHeaders,
      payload: JSON.stringify(qPayload),
      muteHttpExceptions: true
    });

    const qStatus = qResp.getResponseCode();
    if (qStatus < 200 || qStatus >= 300) {
      throw new Error(`Supabase questions insert failed (${qStatus}): ${qResp.getContentText()}`);
    }

    createdIds.push(wsRow.id);
    createdCodes.push(shortCode);
    createdTitles.push(groupName);
  });

  return {
    success: true,
    count: createdIds.length,
    worksheetIds: createdIds,
    shortCodes: createdCodes,
    assignments: createdTitles,
    folderName: folderName
  };
}
