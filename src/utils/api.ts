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
const CHUNK_THRESHOLD = 10_000_000;
const FILE_LIMITS = { pdf: 100_000_000, audio: 50_000_000, video: 200_000_000, other: 50_000_000 } as const;
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi']);
const OTHER_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'odt', 'ods', 'odp', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

export function validateUploadFile(file: File): string | null {
  const extension = file.name.toLowerCase().split('.').pop() || '';
  const kind = extension === 'pdf' || file.type === 'application/pdf' ? 'pdf'
    : AUDIO_EXTENSIONS.has(extension) || file.type.startsWith('audio/') ? 'audio'
    : VIDEO_EXTENSIONS.has(extension) || file.type.startsWith('video/') ? 'video'
    : OTHER_EXTENSIONS.has(extension) || file.type.startsWith('image/') || file.type.startsWith('text/') ? 'other'
    : null;
  if (!kind) return 'Unsupported file type. Choose PDF, supported audio/video, or a common document/image file.';
  const limit = FILE_LIMITS[kind];
  if (file.size > limit) {
    const mb = limit / 1_000_000;
    return `${kind === 'pdf' ? 'PDF' : kind === 'audio' ? 'Audio' : kind === 'video' ? 'Video' : 'Document/image'} files must be ${mb} MB or smaller.`;
  }
  return null;
}

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
  onProgress?: (percent: number, loadedBytes?: number, totalBytes?: number, status?: string) => void
): Promise<StoredFileUploadResult> {
  if (!file || file.size <= 0) {
    throw new Error('እባክዎ ባዶ ያልሆነ ፋይል ይምረጡ።');
  }
  const validationError = validateUploadFile(file);
  if (validationError) throw new Error(validationError);

  const uploadId = crypto.randomUUID();
  const mimeType = file.type || 'application/octet-stream';
  const totalChunks = file.size > CHUNK_THRESHOLD ? Math.ceil(file.size / SINGLE_UPLOAD_LIMIT) : 1;
  onProgress?.(0, 0, file.size, 'Preparing upload');

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
      onProgress?.(Math.min(95, Math.round((loaded / total) * 95)), loaded, file.size, 'Uploading');
    });
    onProgress?.(100, file.size, file.size, 'Upload complete');
  } else {
    let completedBytes = 0;\n    let nextChunk = 0;\n    const workers = Array.from({ length: Math.min(3, totalChunks) }, async () => {\n      while (true) {\n        const chunkIndex = nextChunk++;\n        if (chunkIndex >= totalChunks) return;
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

      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await uploadFormDataWithProgress('/api/files/upload-chunk', form, (loaded) => {
            onProgress?.(Math.min(95, Math.round(((completedBytes + loaded) / file.size) * 95)), completedBytes + loaded, file.size, `Uploading part ${chunkIndex + 1}/${totalChunks}`);
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        }
      }
      if (lastError) throw lastError;
      completedBytes += chunk.size;
      onProgress?.(Math.min(95, Math.round((completedBytes / file.size) * 95)), completedBytes, file.size, `Uploaded part ${chunkIndex + 1}/${totalChunks}`);
      }
    });
    await Promise.all(workers);

    await apiFetch('/api/files/finalize', {
      method: 'POST',
      body: JSON.stringify({ uploadId }),
    });
    onProgress?.(100, file.size, file.size, 'Upload complete');
  }

  return { uploadId, originalFileName: file.name, mimeType };
}
