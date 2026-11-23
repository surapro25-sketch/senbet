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
      throw new Error('የፋይል መጠኑ ከመጫኛ ገደቡ በልጧል። እስከ 250 MB ድረስ ይጫኑ።');
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

export interface StoredFileUploadResult {
  uploadId: string;
  originalFileName: string;
  mimeType: string;
}

const SINGLE_UPLOAD_LIMIT = 15_000_000;
const MAX_UPLOAD_LIMIT = 250_000_000;

function uploadFormDataWithProgress(
  url: string,
  form: FormData,
  onProgress: (loaded: number, total: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    const token = getStoredToken();
    if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded, event.total);
      }
    };
    xhr.onerror = () => reject(new Error('የኔትወርክ ግንኙነት ተቋርጧል። እባክዎ እንደገና ይሞክሩ።'));
    xhr.ontimeout = () => reject(new Error('የፋይል መጫኛ ጊዜው አልፏል።'));
    xhr.onload = () => {
      let data: any = null;
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { data = null; }
      if (xhr.status < 200 || xhr.status >= 300) {
        if (typeof data?.error === 'string' && data.error.trim()) {
          reject(new Error(data.error));
        } else if (xhr.status === 413) {
          reject(new Error('የመጫኛ ጥያቄው ከመጠን ገደቡ በልጧል። እስከ 250 MB ድረስ በ15 MB ቁራጮች ይጫኑ።'));
        } else if (xhr.status === 502 || xhr.status === 504) {
          reject(new Error('የማከማቻ አገልግሎት ጊዜው አልፏል ወይም ምላሽ አልሰጠም። እባክዎ እንደገና ይሞክሩ።'));
        } else {
          reject(new Error('የአገልጋይ ስህተት (HTTP ' + xhr.status + ') ተከስቷል።'));
        }
        return;
      }
      if (!data || typeof data !== 'object') {
        reject(new Error('የአገልጋዩ ምላሽ JSON አይደለም። እባክዎ እንደገና ይሞክሩ።'));
        return;
      }
      resolve(data);
    };
    xhr.send(form);
  });
}

export async function uploadFileToStorage(
  file: File,
  onProgress?: (percent: number) => void
): Promise<StoredFileUploadResult> {
  if (!file || file.size <= 0) {
    throw new Error('እባክዎ ባዶ ያልሆነ ፋይል ይምረጡ።');
  }
  if (file.size > MAX_UPLOAD_LIMIT) {
    throw new Error('የፋይሉ መጠን ከ250 MB መብለጥ የለበትም።');
  }

  const uploadId = crypto.randomUUID();
  const mimeType = file.type || 'application/octet-stream';
  const totalChunks = Math.ceil(file.size / SINGLE_UPLOAD_LIMIT);
  onProgress?.(0);

  if (totalChunks === 1) {
    const form = new FormData();
    form.append('uploadId', uploadId);
    form.append('chunkIndex', '0');
    form.append('totalChunks', '1');
    form.append('fileSize', String(file.size));
    form.append('originalName', file.name);
    form.append('mimeType', mimeType);
    form.append('file', file, file.name);

    await uploadFormDataWithProgress('/api/files/upload', form, (loaded, total) => {
      onProgress?.(Math.min(95, Math.round((loaded / total) * 95)));
    });
    onProgress?.(100);
  } else {
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * SINGLE_UPLOAD_LIMIT;
      const end = Math.min(start + SINGLE_UPLOAD_LIMIT, file.size);
      const chunk = file.slice(start, end, mimeType);
      const form = new FormData();
      form.append('uploadId', uploadId);
      form.append('chunkIndex', String(chunkIndex));
      form.append('totalChunks', String(totalChunks));
      form.append('fileSize', String(file.size));
      form.append('originalName', file.name);
      form.append('mimeType', mimeType);
      form.append('file', chunk, file.name);

      await uploadFormDataWithProgress('/api/files/upload-chunk', form, (loaded, total) => {
        onProgress?.(Math.min(95, Math.round(((start + (loaded / total) * chunk.size) / file.size) * 95)));
      });
      onProgress?.(Math.min(95, Math.round((end / file.size) * 95)));
    }

    await apiFetch('/api/files/finalize', {
      method: 'POST',
      body: JSON.stringify({ uploadId }),
    });
    onProgress?.(100);
  }

  return { uploadId, originalFileName: file.name, mimeType };
}
