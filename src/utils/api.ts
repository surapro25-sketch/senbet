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

async function getGoogleDriveScriptUrl(): Promise<string> {
  const envUrl = (import.meta as any).env?.VITE_GOOGLE_DRIVE_SCRIPT_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }
  try {
    const cfg = await apiFetch<{ enabled?: boolean; scriptUrl?: string | null }>(
      '/api/files/upload-config'
    );
    if (cfg?.enabled && typeof cfg.scriptUrl === 'string' && cfg.scriptUrl.trim()) {
      return cfg.scriptUrl.trim();
    }
  } catch {
    // Fall back to server/local upload if config lookup is unavailable
  }
  return '';
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

function postTextJsonWithProgress(
  url: string,
  payloadJson: string,
  onProgress?: (percent: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    // text/plain avoids CORS preflight against Google Apps Script Web Apps
    xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const uploadRatio = event.loaded / event.total;
        onProgress?.(Math.min(95, 35 + Math.round(uploadRatio * 60)));
      }
    };

    xhr.onerror = () => {
      reject(new Error('ወደ Google Drive መጫን አልተቻለም (የኔትወርክ ግንኙነት ስህተት)።'));
    };

    xhr.ontimeout = () => {
      reject(new Error('የGoogle Drive መጫን ጊዜው አልፏል። እባክዎ እንደገና ይሞክሩ።'));
    };

    xhr.onload = () => {
      const raw = xhr.responseText || '';
      let parsed: any = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        const msg = parsed?.error || parsed?.message || `HTTP ${xhr.status}`;
        reject(new Error(`ወደ Google Drive መጫን አልተቻለም (${msg})።`));
        return;
      }

      if (!parsed) {
        reject(new Error('ከGoogle Drive ትክክለኛ የJSON ምላሽ አልተገኘም።'));
        return;
      }

      if (parsed.error || parsed.status === 'error') {
        reject(new Error(String(parsed.error || parsed.message || 'Google Drive ስህተት መልሷል።')));
        return;
      }

      resolve(parsed);
    };

    xhr.send(payloadJson);
  });
}

export async function uploadFileToGoogleDriveIfConfigured(
  file: File,
  onProgress?: (percent: number) => void
): Promise<GoogleDriveUploadResult | null> {
  const scriptUrl = await getGoogleDriveScriptUrl();
  if (!scriptUrl) {
    return null;
  }

  onProgress?.(1);
  const mimeType = file.type || 'application/octet-stream';
  const base64 = await readFileAsBase64(file, onProgress);
  const body = JSON.stringify({
    fileName: file.name,
    mimeType,
    base64,
  });

  const data = await postTextJsonWithProgress(scriptUrl, body, onProgress);
  const fileId =
    typeof data?.fileId === 'string' && data.fileId.trim()
      ? data.fileId.trim()
      : typeof data?.id === 'string' && data.id.trim()
      ? data.id.trim()
      : '';

  if (!fileId) {
    throw new Error('Google Drive የፋይል መለያ (fileId) አልመለሰም።');
  }

  onProgress?.(98);
  return {
    googleDriveFileId: fileId,
    originalFileName: file.name,
    mimeType,
  };
}

