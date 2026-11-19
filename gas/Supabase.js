/**
 * ==============================================================================
 * WORKSHEET MAKER 2.0 - SUPABASE INTEGRATION HELPER
 * ==============================================================================
 */

const SUPABASE_CONFIG = {
  url: 'https://dgmkobsqhlfokquolkqf.supabase.co',
  anonKey: 'sb_publishable_KtjE2Vm9pkp9DRTKzzprcg_kyP4LMMK'
};

/**
 * Fetches the complete worksheet manifest (answer key, questions, rubric)
 * directly from your Supabase database using the assignment short code.
 * @param {string} shortCode - e.g. "ALG-701" or "M1024"
 * @returns {Object} The worksheet and questions manifest
 */
function fetchWorksheetManifest(shortCode) {
  if (!shortCode) throw new Error("No assignment short code provided.");
  
  const cleanCode = String(shortCode).trim().toUpperCase();
  const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/rpc/get_worksheet_manifest?lookup_code=${encodeURIComponent(cleanCode)}`;
  
  const response = UrlFetchApp.fetch(endpoint, buildSupabaseServerRequest_());
  const status = response.getResponseCode();

  if (status === 401 || status === 403 || /permission denied/i.test(response.getContentText())) {
    throw new Error("Answer keys are locked in the database and this script has no Supabase secret key. In the Google Sheet, run 'Math Autograder ➔ 🗝️ Set Supabase Secret Key'.");
  }
  if (status !== 200) {
    throw new Error(`Failed to fetch from Supabase (Status ${status}): ${response.getContentText()}`);
  }
  
  const data = JSON.parse(response.getContentText());
  if (!data || !data.worksheet) {
    throw new Error(`Assignment "${cleanCode}" was not found in your Worksheet Maker database.`);
  }
  
  return data;
}

/**
 * Fetches recent saved worksheets from Supabase so the teacher can optionally
 * pick the active assignment in the Autograder Sidebar (saving an extra AI call).
 * @returns {Array<Object>} List of recent worksheets
 */
function fetchRecentWorksheetsList() {
  try {
    const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/worksheets?select=short_code,title,grade_level,folder_name,updated_at&order=updated_at.desc&limit=25`;
    const response = UrlFetchApp.fetch(endpoint, buildSupabaseServerRequest_());
    if (response.getResponseCode() !== 200) return [];
    const list = JSON.parse(response.getContentText());
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn('Could not fetch recent worksheets list:', e);
    return [];
  }
}

/**
 * Key the script uses for Supabase: the secret key stored in Script Properties,
 * which can read answer keys and write worksheets once the database is locked
 * down, or else the public key, which only works while it is not.
 */
function getSupabaseServerKey_() {
  return PropertiesService.getScriptProperties().getProperty('SUPABASE_SECRET_KEY') || SUPABASE_CONFIG.anonKey;
}

// Kept for the 1-click POD generator, which writes worksheets
function getSupabaseWriteKey_() {
  return getSupabaseServerKey_();
}

function buildSupabaseServerRequest_() {
  const key = getSupabaseServerKey_();
  return {
    method: 'get',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
}

/**
 * Fetches several answer-key manifests at once.
 * @param {string[]} codes - assignment short codes
 * @returns {Object} code -> manifest, or null when the code has no worksheet or could not be read
 */
function fetchWorksheetManifestsBatch_(codes) {
  const clean = codes.map(c => String(c || '').trim().toUpperCase()).filter(Boolean);
  const result = {};
  if (clean.length === 0) return result;
  const base = buildSupabaseServerRequest_();
  const responses = UrlFetchApp.fetchAll(clean.map(code => Object.assign({
    url: `${SUPABASE_CONFIG.url}/rest/v1/rpc/get_worksheet_manifest?lookup_code=${encodeURIComponent(code)}`
  }, base)));
  responses.forEach((response, i) => {
    let manifest = null;
    try {
      if (response.getResponseCode() === 200) {
        const data = JSON.parse(response.getContentText());
        if (data && data.worksheet) manifest = data;
      }
    } catch (e) {}
    result[clean[i]] = manifest;
  });
  return result;
}

/**
 * Menu action: stores the Supabase secret key in Script Properties (never in code).
 */
function setSupabaseSecretKeyPrompt() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const hasKey = !!props.getProperty('SUPABASE_SECRET_KEY');

  const response = ui.prompt(
    'Supabase Secret Key',
    'Paste your Supabase secret key (Supabase Dashboard ➔ Project Settings ➔ API Keys ➔ Secret keys).\n' +
      'It lets 1-click POD generation save worksheets after the database is locked down.\n\n' +
      (hasKey ? '(A key is already saved. Leave blank to keep it.)' : '(No key saved yet.)'),
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;

  const newKey = response.getResponseText().trim();
  if (newKey) {
    props.setProperty('SUPABASE_SECRET_KEY', newKey);
    ui.alert('Saved ✅', 'Supabase secret key stored securely in Script Properties.', ui.ButtonSet.OK);
  } else {
    ui.alert('Notice', 'Key was not changed.', ui.ButtonSet.OK);
  }
}
