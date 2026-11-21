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

export async function uploadFileToGoogleDriveIfConfigured(
  file: File,
  onProgress?: (percent: number) => void
): Promise<GoogleDriveUploadResult | null> {
  onProgress?.(1);
  const mimeType = file.type || 'application/octet-stream';
  const base64 = await readFileAsBase64(file, onProgress);
  const data = await apiFetch<{ fileId?: string }>('/api/files/upload', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      mimeType,
      base64,
    }),
  });
  const fileId = typeof data?.fileId === 'string' ? data.fileId.trim() : '';
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

