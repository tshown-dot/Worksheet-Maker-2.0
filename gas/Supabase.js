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
  
  const cleanCode = shortCode.trim().toUpperCase();
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
    throw new Error(`Assignment "${cleanCode}" was not found in your Supabase database.`);
  }
  
  return data;
}
