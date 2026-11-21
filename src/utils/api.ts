const TOKEN_KEY = 'senbet_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const rawText = await res.text().catch(() => '');
  let data: any = {};
  let jsonParseFailed = false;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      jsonParseFailed = true;
      data = {};
    }
  }

  if (!res.ok) {
    if (data && typeof data.error === 'string' && data.error.trim()) {
      throw new Error(data.error);
    }
    if (res.status === 413) {
      throw new Error('የፋይሉ መጠን ከተፈቀደው 250 MB ገደብ በልጧል።');
    }
    if (res.status === 502 || res.status === 504) {
      throw new Error('የአገልጋይ ግንኙነት ጊዜው አልፏል ወይም ተቋርጧል። እባክዎ እንደገና ይሞክሩ።');
    }
    throw new Error(`የአገልጋይ ስህተት (HTTP ${res.status}) ተከስቷል።`);
  }

  if (jsonParseFailed && res.status !== 204) {
    throw new Error('የአገልጋዩ ምላሽ በትክክል አልተነበበም። እባክዎ እንደገና ይሞክሩ።');
  }
  return data as T;
}

export function getFileDownloadUrl(fileUrl: string, fileName?: string): string {
  if (!fileUrl) return '#';
  if (fileUrl.startsWith('/uploads/')) {
    const diskFile = fileUrl.slice('/uploads/'.length);
    const desiredName = (fileName && fileName.trim()) || diskFile;
    return `/api/files/download?file=${encodeURIComponent(diskFile)}&name=${encodeURIComponent(desiredName)}`;
  }
  return fileUrl;
}

export type FileEntityKind = 'resource' | 'material' | 'report';

export function getEntityDownloadUrl(
  kind: FileEntityKind,
  id: number,
  fileUrl?: string | null,
  fileName?: string | null
): string {
  if (id > 0) {
    return `/api/files/download?kind=${encodeURIComponent(kind)}&id=${id}`;
  }
  return fileUrl ? getFileDownloadUrl(fileUrl, fileName || undefined) : '#';
}

export function getEntityPreviewUrl(
  kind: FileEntityKind | undefined,
  id: number | undefined,
  fileUrl: string
): string {
  if (kind && id && id > 0) {
    return `/api/files/preview?kind=${encodeURIComponent(kind)}&id=${id}`;
  }
  return fileUrl;
}

export interface GoogleDriveUploadResult {
  googleDriveFileId: string;
  originalFileName: string;
  mimeType: string;
}

function readFileAsBase64(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.min(35, Math.round((event.loaded / event.total) * 35)));
      }
    };
    reader.onerror = () => {
      reject(new Error('ፋይሉን ለማንበብ አልተቻለም።'));
    };
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('ፋይሉን ወደ Base64 መቀየር አልተቻለም።'));
        return;
      }
      onProgress?.(35);
      resolve(result.slice(commaIdx + 1));
    };
    reader.readAsDataURL(file);
  });
}

function uploadFileDirectToGoogleDrive(
  file: File,
  uploadUrl: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('Content-Range', `bytes 0-${file.size - 1}/${file.size}`);
    xhr.timeout = 0;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.min(97, Math.round((event.loaded / event.total) * 97)));
      }
    };
    xhr.onerror = () => reject(new Error('Google Drive ቀጥታ መጫን አልተቻለም። እባክዎ የኔትወርክ ግንኙነትዎን ያረጋግጡ።'));
    xhr.ontimeout = () => reject(new Error('የGoogle Drive መጫን ጊዜው አልፏል።'));
    xhr.onload = () => {
      let parsed: any = null;
      try { parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { parsed = null; }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(parsed?.error?.message || parsed?.error || `Google Drive HTTP ${xhr.status}`));
        return;
      }
      const fileId = typeof parsed?.id === 'string' ? parsed.id.trim() : typeof parsed?.fileId === 'string' ? parsed.fileId.trim() : '';
      if (!fileId) {
        reject(new Error('Google Drive የፋይል መለያ (fileId) አልመለሰም።'));
        return;
      }
      onProgress?.(98);
      resolve(fileId);
    };
    xhr.send(file);
  });
}

export async function uploadFileToGoogleDriveIfConfigured(
  file: File,
  onProgress?: (percent: number) => void
): Promise<GoogleDriveUploadResult | null> {
  onProgress?.(1);
  const mimeType = file.type || 'application/octet-stream';
  let fileId = '';

  // Prefer a resumable session; only fall back to the Worker proxy if session creation fails.
  let uploadUrl = '';
  try {
    const session = await apiFetch<{ uploadUrl?: string }>('/api/files/upload-session', {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, mimeType, fileSize: file.size }),
    });
    uploadUrl = typeof session?.uploadUrl === 'string' ? session.uploadUrl : '';
    if (!uploadUrl) throw new Error('Google Drive upload session URL was not returned.');
  } catch (sessionError) {
    console.warn('Resumable upload session unavailable; using proxy upload fallback.', sessionError);
    const base64 = await readFileAsBase64(file, onProgress);
    const fallback = await apiFetch<{ fileId?: string }>('/api/files/upload', {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, mimeType, base64 }),
    });
    fileId = typeof fallback?.fileId === 'string' ? fallback.fileId.trim() : '';
  }

  if (uploadUrl) {
    fileId = await uploadFileDirectToGoogleDrive(file, uploadUrl, onProgress);
  }
  if (!fileId) throw new Error('Google Drive የፋይል መለያ (fileId) አልመለሰም።');
  onProgress?.(99);
  return { googleDriveFileId: fileId, originalFileName: file.name, mimeType };
}

