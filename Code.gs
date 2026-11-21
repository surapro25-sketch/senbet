/**
 * SENBET Google Drive Web App integration.
 * Set UPLOAD_FOLDER_ID to the ID of the Drive folder used for SENBET uploads.
 *
 * Required Apps Script scopes:
 *   https://www.googleapis.com/auth/drive
 *   https://www.googleapis.com/auth/script.external_request
 */
const UPLOAD_FOLDER_ID = '1aKs4RBZXbibeaVinx-0zMkCXaM8o5zqb';
const EXPIRATION_DAYS = 21;

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String((e && e.parameter && e.parameter.action) || payload.action || '');
    if (action === 'createUploadSession') {
      return jsonOutput(createUploadSession(payload));
    }
    if (payload.action === 'uploadBase64' || payload.base64) {
      return jsonOutput(uploadBase64(payload));
    }
    return jsonOutput({ error: 'Unsupported POST action.' });
  } catch (error) {
    return jsonOutput({ error: String(error && error.message || error) });
  }
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    if (params.action === 'delete') {
      const fileId = String(params.fileId || '').trim();
      if (!fileId) return jsonOutput({ error: 'fileId is required.' });
      trashUploadedFile(fileId);
      return jsonOutput({ ok: true, fileId: fileId });
    }

    // Existing Worker download proxy expects a JSON base64 response for fileId.
    const fileId = String(params.fileId || '').trim();
    if (!fileId) return jsonOutput({ error: 'fileId is required.' });
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    return jsonOutput({
      fileId: fileId,
      fileName: file.getName(),
      mimeType: blob.getContentType() || file.getMimeType(),
      base64: Utilities.base64Encode(blob.getBytes())
    });
  } catch (error) {
    return jsonOutput({ error: String(error && error.message || error) });
  }
}

function createUploadSession(payload) {
  const fileName = safeFileName(payload.fileName);
  const mimeType = String(payload.mimeType || 'application/octet-stream');
  const fileSize = Number(payload.fileSize);
  if (!fileName || !Number.isSafeInteger(fileSize) || fileSize <= 0) {
    throw new Error('Invalid fileName or fileSize.');
  }

  const metadata = {
    name: fileName,
    mimeType: mimeType,
    parents: [getUploadFolderId()]
  };
  const endpoint = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType';
  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    payload: JSON.stringify(metadata),
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(fileSize)
    },
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const headers = response.getHeaders();
  const uploadUrl = headers.Location || headers.location || '';
  if (status < 200 || status >= 300 || !uploadUrl) {
    throw new Error('Drive resumable session request failed (' + status + '): ' + response.getContentText());
  }
  return { uploadUrl: String(uploadUrl) };
}

function uploadBase64(payload) {
  const fileName = safeFileName(payload.fileName);
  const mimeType = String(payload.mimeType || 'application/octet-stream');
  const base64 = String(payload.base64 || '');
  if (!fileName || !base64) throw new Error('fileName and base64 are required.');
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const file = DriveApp.getFolderById(getUploadFolderId()).createFile(blob);
  return { fileId: file.getId(), name: file.getName(), mimeType: file.getMimeType() };
}

function trashUploadedFile(fileId) {
  const file = DriveApp.getFileById(fileId);
  const parents = file.getParents();
  let belongsToUploadFolder = false;
  while (parents.hasNext()) {
    if (parents.next().getId() === getUploadFolderId()) {
      belongsToUploadFolder = true;
      break;
    }
  }
  if (!belongsToUploadFolder) {
    throw new Error('Refusing to trash a file outside the configured SENBET upload folder.');
  }
  file.setTrashed(true);
}

function cleanupExpiredFiles() {
  const cutoff = Date.now() - EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
  const files = DriveApp.getFolderById(getUploadFolderId()).getFiles();
  let trashed = 0;
  while (files.hasNext()) {
    const file = files.next();
    if (file.getDateCreated().getTime() < cutoff) {
      file.setTrashed(true);
      trashed++;
    }
  }
  Logger.log('SENBET cleanup: trashed ' + trashed + ' expired files.');
  return trashed;
}

function createDailyCleanupTrigger() {
  // Avoid installing duplicate daily cleanup triggers.
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'cleanupExpiredFiles') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('cleanupExpiredFiles').timeBased().everyDays(1).create();
}

function getUploadFolderId() {
  if (!UPLOAD_FOLDER_ID || UPLOAD_FOLDER_ID.indexOf('PASTE_') === 0) {
    throw new Error('Set UPLOAD_FOLDER_ID in Code.gs before using SENBET uploads.');
  }
  return UPLOAD_FOLDER_ID;
}

function safeFileName(value) {
  return String(value || 'file').split(/[\\/]/).pop().replace(/[\\r\\n"]/g, '_');
}

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
