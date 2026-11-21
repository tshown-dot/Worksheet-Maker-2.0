/**
 * Google Drive API v3 & Permanent Apps Script Drive Bridge Client
 *
 * Uses the permanent Google Apps Script Web App Bridge (`GAS_DRIVE_BRIDGE_URL`)
 * as the primary zero-login, never-expiring Drive connector, with optional
 * browser OAuth token fallback.
 */

import { supabase } from '../lib/supabase';

export const GAS_DRIVE_BRIDGE_URL =
  'https://script.google.com/macros/s/AKfycbzJdtuEFvlv50TPVntAHSeK9MwwXR-WwF3SPyO5GMBy-vCmplS3aNDPNYD1Tv-4CHNp/exec';

export const DEFAULT_WORKSHEET_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1zz_WMrQttk70mFJNTkqQ2GcXD5HiZMAq';

interface DriveFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

interface UploadResult {
  id: string;
  name: string;
  webViewLink?: string;
}

/**
 * Helper: Converts a Blob to a raw base64 string (without data:... prefix)
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || '');
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Calls the permanent Apps Script Drive Bridge over CORS-safe POST (Content-Type: text/plain)
 */
async function callGasDriveBridge(payload: Record<string, any>): Promise<any> {
  // The bridge only accepts requests from a signed-in teacher: it checks this
  // session token with Supabase and compares the email to its allow-list.
  const { data } = await supabase.auth.getSession();
  const authToken = data.session?.access_token;
  if (!authToken) {
    throw new Error('Sign in with Google to save to Google Drive.');
  }
  payload = { ...payload, authToken };

  const res = await fetch(GAS_DRIVE_BRIDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Drive Bridge HTTP ${res.status}`);
  }

  const result = await res.json();
  if (!result || result.success === false) {
    throw new Error(result?.error || 'Drive Bridge request failed');
  }
  return result;
}

/**
 * Searches for a folder by name inside a parent folder (or root).
 */
export async function findFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<DriveFolder | null> {
  const parentQuery = parentFolderId
    ? `'${parentFolderId}' in parents`
    : `'root' in parents`;

  const query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and ${parentQuery} and trashed = false`;

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,webViewLink)&pageSize=1`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401) {
    throw new Error('DRIVE_AUTH_EXPIRED');
  }

  if (!res.ok) {
    const errText = await res.text();
    console.warn('Drive findFolder error:', errText);
    return null;
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0];
  }
  return null;
}

/**
 * Creates a folder inside a parent folder (or root).
 */
export async function createFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<DriveFolder> {
  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (res.status === 401) {
    throw new Error('DRIVE_AUTH_EXPIRED');
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create Drive folder: ${errText}`);
  }

  return await res.json();
}

/**
 * Gets or creates a folder, ensuring it exists.
 */
export async function getOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<DriveFolder> {
  const existing = await findFolder(accessToken, folderName, parentFolderId);
  if (existing) return existing;
  return await createFolder(accessToken, folderName, parentFolderId);
}

/**
 * Uploads a file (PDF or other Blob) to Google Drive using multipart upload.
 */
export async function uploadFileToDrive(
  accessToken: string,
  blob: Blob,
  fileName: string,
  parentFolderId: string
): Promise<UploadResult> {
  const query = `name = '${fileName.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (searchRes.status === 401) {
    throw new Error('DRIVE_AUTH_EXPIRED');
  }

  let existingId: string | null = null;
  if (searchRes.ok) {
    const sData = await searchRes.json();
    if (sData.files && sData.files.length > 0) {
      existingId = sData.files[0].id;
    }
  }

  const metadata = {
    name: fileName,
    mimeType: 'application/pdf',
    ...(existingId ? {} : { parents: [parentFolderId] }),
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const fileHeader = `${delimiter}Content-Type: application/pdf\r\n\r\n`;

  const multipartBlob = new Blob(
    [metadataPart, fileHeader, blob, closeDelimiter],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const uploadUrl = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&fields=id,name,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`;

  const uploadRes = await fetch(uploadUrl, {
    method: existingId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBlob,
  });

  if (uploadRes.status === 401) {
    throw new Error('DRIVE_AUTH_EXPIRED');
  }

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Drive file upload failed: ${errText}`);
  }

  return await uploadRes.json();
}

/**
 * Saves the student copy PDF to the teacher's Drive (answer keys stay in the app):
 * Path: Google Drive / Worksheet Maker / [Folder Name] / ...
 *
 * Uses the permanent Apps Script Drive Bridge so it NEVER fails due to expired OAuth tokens!
 */
export async function saveWorksheetToDrive(
  accessToken: string | null | undefined,
  folderName: string,
  studentPdfBlob: Blob,
  baseFilename: string
): Promise<{
  folderUrl?: string;
  studentFileUrl?: string;
  studentFileId?: string;
}> {
  // 1. Try permanent Apps Script Drive Bridge first (no expiring token needed!)
  try {
    const studentPdfBase64 = await blobToBase64(studentPdfBlob);

    const bridgeRes = await callGasDriveBridge({
      action: 'saveWorksheetToDrive',
      folderName: folderName || 'General',
      baseFilename,
      studentPdfBase64,
    });

    return {
      folderUrl: bridgeRes.folderUrl || DEFAULT_WORKSHEET_DRIVE_FOLDER_URL,
      studentFileUrl: bridgeRes.studentFileUrl,
      studentFileId: bridgeRes.studentFileId,
    };
  } catch (bridgeErr) {
    console.warn('Apps Script Drive Bridge fallback to OAuth:', bridgeErr);
    if (!accessToken) {
      throw bridgeErr;
    }
  }

  // 2. Fallback to browser OAuth token if provided
  const rootFolder = await getOrCreateFolder(accessToken!, 'Worksheet Maker');
  const subFolder = await getOrCreateFolder(accessToken!, folderName || 'General', rootFolder.id);

  const studentResult = await uploadFileToDrive(
    accessToken!,
    studentPdfBlob,
    `${baseFilename}_Student.pdf`,
    subFolder.id
  );

  return {
    folderUrl: subFolder.webViewLink,
    studentFileUrl: studentResult.webViewLink,
    studentFileId: studentResult.id,
  };
}

/**
 * Moves a worksheet's Google Drive PDF files to Trash when deleted from the app.
 */
export async function trashWorksheetInDrive(
  accessToken: string | null | undefined,
  shortCode: string,
  driveStudentFileId?: string,
  driveKeyFileId?: string
): Promise<void> {
  // 1. Permanent Apps Script Drive Bridge
  try {
    await callGasDriveBridge({
      action: 'trashWorksheetInDrive',
      shortCode,
      driveStudentFileId,
      driveKeyFileId,
    });
    return;
  } catch (bridgeErr) {
    if (!accessToken) return;
  }

  // 2. Fallback to OAuth
  const fileIdsToTrash = new Set<string>();
  if (driveStudentFileId) fileIdsToTrash.add(driveStudentFileId);
  if (driveKeyFileId) fileIdsToTrash.add(driveKeyFileId);

  if (shortCode) {
    const query = `name contains '${shortCode.replace(/'/g, "\\'")}_' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=files(id,name)&pageSize=20`;
    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401) throw new Error('DRIVE_AUTH_EXPIRED');
    if (res.ok) {
      const data = await res.json();
      for (const f of data.files || []) {
        if (f.id) fileIdsToTrash.add(f.id);
      }
    }
  }

  for (const fileId of fileIdsToTrash) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trashed: true }),
    });
  }
}

/**
 * Two-way reconciliation: Checks Google Drive for worksheets or folders that the teacher
 * deleted/trashed in Google Drive, and returns the Supabase worksheet IDs to delete.
 */
export async function findWorksheetsDeletedInDrive(
  accessToken: string | null | undefined,
  supabaseWorksheets: any[]
): Promise<{ idsToDelete: string[]; codesDeleted: string[] }> {
  if (!supabaseWorksheets || supabaseWorksheets.length === 0) {
    return { idsToDelete: [], codesDeleted: [] };
  }

  // 1. Permanent Apps Script Drive Bridge
  try {
    const slimList = supabaseWorksheets.map((w) => ({
      id: w.id,
      short_code: w.short_code,
      layout_config: w.layout_config || {},
    }));
    const bridgeRes = await callGasDriveBridge({
      action: 'reconcileDrive',
      worksheets: slimList,
    });
    return {
      idsToDelete: bridgeRes.idsToDelete || [],
      codesDeleted: bridgeRes.codesDeleted || [],
    };
  } catch (bridgeErr) {
    console.warn('Bridge reconcile fallback:', bridgeErr);
    if (!accessToken) {
      return { idsToDelete: [], codesDeleted: [] };
    }
  }

  // 2. Fallback to OAuth if token is present
  const folderUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    "mimeType = 'application/vnd.google-apps.folder'"
  )}&fields=files(id,name,trashed,parents)&pageSize=500`;

  const folderRes = await fetch(folderUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (folderRes.status === 401) throw new Error('DRIVE_AUTH_EXPIRED');

  const trashedFolderIds = new Set<string>();
  const allFolders: { id: string; name: string; trashed?: boolean; parents?: string[] }[] = [];
  if (folderRes.ok) {
    const fData = await folderRes.json();
    for (const folder of fData.files || []) {
      allFolders.push(folder);
      if (folder.trashed) {
        trashedFolderIds.add(folder.id);
      }
    }
    let added = true;
    while (added) {
      added = false;
      for (const folder of allFolders) {
        if (!trashedFolderIds.has(folder.id) && folder.parents?.some((p) => trashedFolderIds.has(p))) {
          trashedFolderIds.add(folder.id);
          added = true;
        }
      }
    }
  }

  const filesUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    "name contains '_Student.pdf' or name contains '_AnswerKey.pdf'"
  )}&fields=files(id,name,trashed,parents)&pageSize=1000`;

  const filesRes = await fetch(filesUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (filesRes.status === 401) throw new Error('DRIVE_AUTH_EXPIRED');
  if (!filesRes.ok) {
    return { idsToDelete: [], codesDeleted: [] };
  }

  const filesData = await filesRes.json();
  const driveFiles: { id: string; name: string; trashed?: boolean; parents?: string[] }[] =
    filesData.files || [];

  const activeFileIds = new Set<string>();
  const trashedFileIds = new Set<string>();
  const activeCodes = new Set<string>();
  const trashedCodes = new Set<string>();

  for (const file of driveFiles) {
    const isParentTrashed = file.parents?.some((p) => trashedFolderIds.has(p)) || false;
    const isTrashed = Boolean(file.trashed) || isParentTrashed;

    const codeMatch = file.name.match(/^([A-Za-z0-9-]+?)_/);
    const code = codeMatch ? codeMatch[1].toUpperCase() : null;

    if (isTrashed) {
      trashedFileIds.add(file.id);
      if (code) trashedCodes.add(code);
    } else {
      activeFileIds.add(file.id);
      if (code) activeCodes.add(code);
    }
  }

  const idsToDelete: string[] = [];
  const codesDeleted: string[] = [];

  for (const ws of supabaseWorksheets) {
    const code = String(ws.short_code || '').toUpperCase();
    const syncedFileId = ws.layout_config?.drive_student_file_id;

    if (syncedFileId) {
      if (trashedFileIds.has(syncedFileId) || !activeFileIds.has(syncedFileId)) {
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

  return { idsToDelete, codesDeleted };
}
