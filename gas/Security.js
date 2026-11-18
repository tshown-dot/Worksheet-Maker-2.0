/**
 * ==============================================================================
 * WORKSHEET MAKER 2.0 - ACCESS CONTROL
 * ==============================================================================
 * The web app is public (students need the portal), and any page it serves can
 * call every public server function through google.script.run. So each function
 * that reads or changes class data calls requireTeacher_() first.
 *
 * A call counts as the teacher's when it comes from:
 *  - the Google Sheet itself (menu, sidebar, dialogs), or
 *  - a web request carrying the Teacher Web Key, or
 *  - the Worksheet Maker site, signed in as an allowed teacher email.
 */

// Set to true only by server entry points that have already checked the caller.
var TRUSTED_SERVER_CALL_ = false;

const TEACHER_WEB_KEY_PROP = 'TEACHER_WEB_KEY';
const TEACHER_EMAILS_PROP = 'TEACHER_EMAILS';

/**
 * True when the code is running inside the spreadsheet's own UI (menu, sidebar
 * or dialog). Web app requests have no spreadsheet UI, so getUi() throws there.
 */
function isTeacherContext_() {
  if (TRUSTED_SERVER_CALL_) return true;
  try {
    SpreadsheetApp.getUi();
    return true;
  } catch (e) {
    return false;
  }
}

function requireTeacher_() {
  if (!isTeacherContext_()) {
    throw new Error('Not authorized. Open this tool from the Math Autograder menu in the Google Sheet.');
  }
}

/**
 * Checks a key sent with a web request against the stored Teacher Web Key.
 */
function isValidTeacherKey_(key) {
  const stored = PropertiesService.getScriptProperties().getProperty(TEACHER_WEB_KEY_PROP);
  const given = String(key || '');
  if (!stored || given.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < stored.length; i++) {
    diff |= stored.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Lets the teacher dashboard, when opened as a web page with the Teacher Web
 * Key, call the two server functions it needs.
 */
function teacherWebCall(key, functionName, args) {
  if (!isValidTeacherKey_(key)) {
    throw new Error('Not authorized. This teacher link is missing a valid key.');
  }
  TRUSTED_SERVER_CALL_ = true;
  const list = Array.isArray(args) ? args : [];
  if (functionName === 'getInterventionDashboardData') {
    return getInterventionDashboardData.apply(null, list);
  }
  if (functionName === 'runGradingFromSidebar') {
    return runGradingFromSidebar.apply(null, list);
  }
  throw new Error('Unknown teacher action: ' + functionName);
}

/**
 * Confirms a Drive-bridge request comes from the Worksheet Maker site signed in
 * as an allowed teacher: asks Supabase who owns the session token and compares
 * the email with the TEACHER_EMAILS list.
 * @returns {string} the verified teacher email
 */
function requireTeacherSession_(accessToken) {
  const token = String(accessToken || '').trim();
  if (!token) {
    throw new Error('Sign in to Worksheet Maker to use the Drive bridge.');
  }

  const allowed = String(PropertiesService.getScriptProperties().getProperty(TEACHER_EMAILS_PROP) || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) {
    throw new Error("Drive bridge is locked: no teacher emails are set. In the Google Sheet, run 'Math Autograder ➔ Web Access Security Setup'.");
  }

  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  const cacheKey = 'teacher_session_' + Utilities.base64EncodeWebSafe(digest);
  const cache = CacheService.getScriptCache();
  let email = cache.get(cacheKey);

  if (!email) {
    const response = UrlFetchApp.fetch(`${SUPABASE_CONFIG.url}/auth/v1/user`, {
      method: 'get',
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${token}`
      },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('Your Worksheet Maker sign-in has expired. Sign in again to use the Drive bridge.');
    }
    email = String(JSON.parse(response.getContentText()).email || '').trim().toLowerCase();
    if (email) cache.put(cacheKey, email, 300);
  }

  if (!email || allowed.indexOf(email) === -1) {
    throw new Error(`The account ${email || '(unknown)'} is not on this autograder's teacher list.`);
  }
  return email;
}

/**
 * Menu action: sets which teacher emails may use the Drive bridge and creates
 * the Teacher Web Key for opening the dashboard as a web page.
 */
function setupWebAccessSecurity() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  const currentEmails = props.getProperty(TEACHER_EMAILS_PROP) || '';
  const response = ui.prompt(
    'Web Access Security Setup',
    'Enter the Google account email(s) you sign in to Worksheet Maker with.\n' +
      'Separate more than one with commas. Only these accounts can save to or sync with your Drive.\n\n' +
      `Current: ${currentEmails || '(none set)'}`,
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;

  const entered = response.getResponseText().trim();
  if (entered) {
    const cleaned = entered.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).join(',');
    props.setProperty(TEACHER_EMAILS_PROP, cleaned);
  }

  let key = props.getProperty(TEACHER_WEB_KEY_PROP);
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty(TEACHER_WEB_KEY_PROP, key);
  }

  ui.alert(
    'Web access secured ✅',
    `Teacher emails: ${props.getProperty(TEACHER_EMAILS_PROP) || '(none set)'}\n\n` +
      'To open the teacher dashboard as a web page, add this to the end of your web app URL:\n\n' +
      `?view=teacher&key=${key}\n\n` +
      'Keep that link private. Anyone who has it can see class data.',
    ui.ButtonSet.OK
  );
}

/**
 * Menu action: replaces the Teacher Web Key, so any old teacher link stops working.
 */
function resetTeacherWebKey() {
  const ui = SpreadsheetApp.getUi();
  const key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty(TEACHER_WEB_KEY_PROP, key);
  ui.alert(
    'New teacher link key created ✅',
    `Old teacher links no longer work. New ending for your web app URL:\n\n?view=teacher&key=${key}`,
    ui.ButtonSet.OK
  );
}

/**
 * Student portal brute-force protection: after 5 wrong passwords for one
 * Student ID, that ID is locked for 10 minutes.
 */
const PORTAL_MAX_FAILED_ATTEMPTS = 5;
const PORTAL_LOCKOUT_SECONDS = 600;

function isPortalLockedOut_(normalizedId) {
  const count = Number(CacheService.getScriptCache().get('portal_fail_' + normalizedId)) || 0;
  return count >= PORTAL_MAX_FAILED_ATTEMPTS;
}

function recordPortalFailure_(normalizedId) {
  const cache = CacheService.getScriptCache();
  const key = 'portal_fail_' + normalizedId;
  const count = (Number(cache.get(key)) || 0) + 1;
  cache.put(key, String(count), PORTAL_LOCKOUT_SECONDS);
}

function clearPortalFailures_(normalizedId) {
  CacheService.getScriptCache().remove('portal_fail_' + normalizedId);
}
