/**
 * Google Drive API v3 Client
 * Uses the OAuth provider_token granted during "Sign in with Google"
 * with the 'https://www.googleapis.com/auth/drive.file' scope.
 */

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
  // Check if file already exists with same name in folder
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

  // Combine into a single body
  const multipartBlob = new Blob(
    [
      metadataPart,
      fileHeader,
      blob,
      closeDelimiter
    ],
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
 * Saves both Student and Answer Key PDFs to the teacher's Drive:
 * Path: Google Drive / Worksheet Maker / [Folder Name] / ...
 */
export async function saveWorksheetToDrive(
  accessToken: string,
  folderName: string,
  studentPdfBlob: Blob,
  keyPdfBlob: Blob,
  baseFilename: string
): Promise<{
  folderUrl?: string;
  studentFileUrl?: string;
  keyFileUrl?: string;
  studentFileId?: string;
  keyFileId?: string;
}> {
  // 1. Get or create root "Worksheet Maker" folder
  const rootFolder = await getOrCreateFolder(accessToken, 'Worksheet Maker');

  // 2. Get or create subfolder (e.g. "Daily Warm-Ups (POD)")
  const subFolder = await getOrCreateFolder(accessToken, folderName || 'General', rootFolder.id);

  // 3. Upload Student PDF
  const studentResult = await uploadFileToDrive(
    accessToken,
    studentPdfBlob,
    `${baseFilename}_Student.pdf`,
    subFolder.id
  );

  // 4. Upload Teacher Answer Key PDF
  const keyResult = await uploadFileToDrive(
    accessToken,
    keyPdfBlob,
    `${baseFilename}_AnswerKey.pdf`,
    subFolder.id
  );

  return {
    folderUrl: subFolder.webViewLink,
    studentFileUrl: studentResult.webViewLink,
    keyFileUrl: keyResult.webViewLink,
    studentFileId: studentResult.id,
    keyFileId: keyResult.id,
  };
}

/**
 * Moves a worksheet's Google Drive PDF files to Trash when deleted from the app.
 */
export async function trashWorksheetInDrive(
  accessToken: string,
  shortCode: string,
  driveStudentFileId?: string,
  driveKeyFileId?: string
): Promise<void> {
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
  accessToken: string,
  supabaseWorksheets: any[]
): Promise<{ idsToDelete: string[]; codesDeleted: string[] }> {
  if (!supabaseWorksheets || supabaseWorksheets.length === 0) {
    return { idsToDelete: [], codesDeleted: [] };
  }

  // 1. Fetch all folders created by this app (active and trashed) to detect trashed parent folders
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
    // Propagate trashed status to child folders whose parent is trashed
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

  // 2. Fetch all worksheet PDFs (both active and trashed)
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

    // Case 1: Worksheet has a recorded Drive file ID, and that file is either trashed or permanently gone
    if (syncedFileId) {
      if (trashedFileIds.has(syncedFileId) || !activeFileIds.has(syncedFileId)) {
        idsToDelete.push(ws.id);
        codesDeleted.push(code);
        continue;
      }
    }

    // Case 2: Any worksheet whose PDF (or parent folder) is in Google Drive Trash and has no active copy
    if (code && trashedCodes.has(code) && !activeCodes.has(code)) {
      idsToDelete.push(ws.id);
      codesDeleted.push(code);
    }
  }

  return { idsToDelete, codesDeleted };
}
