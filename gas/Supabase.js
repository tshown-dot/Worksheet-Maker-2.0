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
  
  const options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_CONFIG.anonKey,
      'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(endpoint, options);
  const status = response.getResponseCode();
  
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
    const options = {
      method: 'get',
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    if (response.getResponseCode() !== 200) return [];
    const list = JSON.parse(response.getContentText());
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn('Could not fetch recent worksheets list:', e);
    return [];
  }
}
