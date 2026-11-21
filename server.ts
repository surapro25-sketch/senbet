import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { db, initDatabase, uploadsDir } from './src/server/db.ts';
import type { DepartmentId, ResourceType, UserRecord, UserRole } from './src/types.ts';

initDatabase();

const app = express();
const PORT = 3000;
const MAX_UPLOAD_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB max

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

// Configure Multer for real file uploads (PDF, Audio, Video)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    cb(null, `${Date.now()}_${safeBase || 'file'}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
});

function handleSingleUpload(fieldName: string, middlewareInstance: multer.Multer = upload) {
  const middleware = middlewareInstance.single(fieldName);
  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err: any) => {
      if (!err) {
        next();
        return;
      }
      tryUnlink((req as any).file?.path);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({
            error: 'የፋይሉ መጠን ከተፈቀደው 250 MB ገደብ በልጧል። እባክዎ አነስተኛ ፋይል ይምረጡ።',
          });
          return;
        }
        res.status(400).json({
          error: `ፋይሉን በመጫን ላይ ስህተት ተከስቷል (${err.code})።`,
        });
        return;
      }
      console.error('Upload middleware error:', err);
      res.status(500).json({
        error: err?.message ? `ፋይሉን መቀበል አልተቻለም፡ ${err.message}` : 'ፋይሉን መቀበል አልተቻለም።',
      });
    });
  };
}

function decodeOriginalName(rawName: string): string {
  if (!rawName) return 'file';
  try {
    // Multer/Busboy defaults header filenames to latin1; recover UTF-8 when high bytes are UTF-8 sequences
    if (/[\u0080-\u00ff]/.test(rawName) && !/[\u0100-\uffff]/.test(rawName)) {
      const decoded = Buffer.from(rawName, 'latin1').toString('utf8');
      if (!decoded.includes('\ufffd')) {
        return path.basename(decoded);
      }
    }
  } catch {
    // fallback below
  }
  return path.basename(rawName);
}

function tryUnlink(filePath?: string | null) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore cleanup error
  }
}

function removeLocalUploadIfPresent(fileUrl?: string | null) {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) return;
  const safeDiskName = path.basename(fileUrl.slice('/uploads/'.length));
  if (!safeDiskName) return;
  const fullPath = path.resolve(uploadsDir, safeDiskName);
  if (fullPath.startsWith(path.resolve(uploadsDir) + path.sep)) {
    tryUnlink(fullPath);
  }
}

function getConfiguredGoogleDriveScriptUrl(): string {
  return (
    process.env.GOOGLE_DRIVE_SCRIPT_URL?.trim() ||
    process.env.VITE_GOOGLE_DRIVE_SCRIPT_URL?.trim() ||
    ''
  );
}

function parseGoogleDriveFileId(resolvedUrl: string): string | null {
  if (!resolvedUrl) return null;
  if (resolvedUrl.startsWith('gdrive:')) {
    const id = resolvedUrl.slice(7).trim();
    return id || null;
  }
  return null;
}

function guessMimeType(fileName: string): string {
  const ext = path.extname(fileName || '').toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.ogg':
      return 'audio/ogg';
    case '.m4a':
    case '.aac':
      return 'audio/mp4';
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    case '.avi':
      return 'video/x-msvideo';
    case '.mkv':
      return 'video/x-matroska';
    default:
      return 'application/octet-stream';
  }
}

async function uploadFileToStorage(
  file: Express.Multer.File,
  originalFileName: string
): Promise<string> {
  const scriptUrl = getConfiguredGoogleDriveScriptUrl();

  // Local disk fallback when GOOGLE_DRIVE_SCRIPT_URL is not configured
  if (!scriptUrl) {
    return `/uploads/${file.filename}`;
  }

  const fileBuf = await fs.promises.readFile(file.path);
  const mimeType = file.mimetype || guessMimeType(originalFileName);
  const response = await fetch(scriptUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      fileName: originalFileName,
      mimeType,
      base64: fileBuf.toString('base64'),
    }),
    redirect: 'follow',
    signal: AbortSignal.timeout(180000),
  });

  const rawText = await response.text().catch(() => '');
  let payload: any = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = null;
  }

  const fileId =
    typeof payload?.fileId === 'string' && payload.fileId.trim()
      ? payload.fileId.trim()
      : typeof payload?.id === 'string' && payload.id.trim()
      ? payload.id.trim()
      : '';

  if (!response.ok || !fileId || payload?.error || payload?.status === 'error') {
    throw new Error(
      payload?.error ||
        payload?.message ||
        `Google Drive upload failed (HTTP ${response.status})`
    );
  }

  tryUnlink(file.path);
  return `gdrive:${fileId}`;
}

function buildContentDisposition(
  dispositionType: 'attachment' | 'inline',
  downloadName: string,
  extFallback = ''
): string {
  const baseName = path.basename(downloadName || 'download');
  const finalName =
    extFallback && !path.extname(baseName) ? `${baseName}${extFallback}` : baseName;
  const asciiFallback =
    finalName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'") ||
    `download${extFallback}`;
  const encodedUtf8 = encodeURIComponent(finalName)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');
  return `${dispositionType}; filename="${asciiFallback}"; filename*=UTF-8''${encodedUtf8}`;
}

function resolveEntityRecord(
  kind: string,
  id: number
): { fileUrl: string; fileName: string } | null {
  if (!Number.isInteger(id) || id <= 0) return null;

  if (kind === 'resource') {
    const row = db
      .prepare('SELECT fileUrl, fileName FROM educational_resources WHERE id = ?')
      .get(id) as { fileUrl: string; fileName: string } | undefined;
    return row && row.fileUrl ? row : null;
  }

  if (kind === 'material') {
    const row = db
      .prepare('SELECT fileUrl, fileName FROM department_materials WHERE id = ?')
      .get(id) as { fileUrl: string; fileName: string } | undefined;
    return row && row.fileUrl ? row : null;
  }

  if (kind === 'report') {
    const row = db
      .prepare('SELECT pdfUrl as fileUrl, pdfName as fileName FROM department_reports WHERE id = ?')
      .get(id) as { fileUrl: string | null; fileName: string | null } | undefined;
    if (row && row.fileUrl) {
      return {
        fileUrl: row.fileUrl,
        fileName: row.fileName || 'report.pdf',
      };
    }
    return null;
  }

  return null;
}

async function fetchGoogleDriveUpstream(
  fileId: string,
  signal?: AbortSignal
): Promise<globalThis.Response> {
  const scriptUrl = getConfiguredGoogleDriveScriptUrl();
  if (scriptUrl) {
    const sep = scriptUrl.includes('?') ? '&' : '?';
    const scriptResp = await fetch(`${scriptUrl}${sep}fileId=${encodeURIComponent(fileId)}`, {
      method: 'GET',
      redirect: 'follow',
      signal: signal || AbortSignal.timeout(180000),
    });
    const ct = (scriptResp.headers.get('content-type') || '').toLowerCase();
    if (scriptResp.ok && !ct.includes('text/html')) {
      return scriptResp;
    }
  }

  // Fallback to direct Google Drive export download URL
  const directUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(fileId)}`;
  const directResp = await fetch(directUrl, {
    method: 'GET',
    redirect: 'follow',
    signal: signal || AbortSignal.timeout(180000),
  });
  const directCt = (directResp.headers.get('content-type') || '').toLowerCase();
  if (!directResp.ok || directCt.includes('text/html')) {
    throw new Error(`Google Drive download failed (HTTP ${directResp.status})`);
  }
  return directResp;
}

async function writeWebStreamToResponse(
  webBody: ReadableStream<Uint8Array>,
  res: Response,
  isAborted: () => boolean
): Promise<void> {
  const nodeStream = Readable.fromWeb(webBody as any);
  try {
    for await (const chunk of nodeStream) {
      if (isAborted() || res.destroyed) {
        nodeStream.destroy();
        return;
      }
      const canContinue = res.write(chunk);
      if (!canContinue) {
        await new Promise<void>((resolve, reject) => {
          const onDrain = () => {
            cleanup();
            resolve();
          };
          const onError = (err: Error) => {
            cleanup();
            reject(err);
          };
          const onClose = () => {
            cleanup();
            resolve();
          };
          const cleanup = () => {
            res.off('drain', onDrain);
            res.off('error', onError);
            res.off('close', onClose);
          };
          res.once('drain', onDrain);
          res.once('error', onError);
          res.once('close', onClose);
        });
      }
    }
  } finally {
    nodeStream.destroy();
  }
}

async function handleProxyFileRequest(
  req: Request,
  res: Response,
  dispositionType: 'attachment' | 'inline'
) {
  const kind = String(req.query.kind || '').trim();
  const idParam = Number(req.query.id);
  const rawFile = String(req.query.file || '').trim();
  const requestedName = String(req.query.name || '').trim();

  let resolvedUrl = '';
  let desiredName = requestedName;

  if (kind && Number.isInteger(idParam) && idParam > 0) {
    const entity = resolveEntityRecord(kind, idParam);
    if (!entity) {
      res.status(404).json({ error: 'ፋይሉ አልተገኘም።' });
      return;
    }
    resolvedUrl = entity.fileUrl;
    desiredName = entity.fileName || requestedName || 'download';
  } else if (rawFile) {
    const safeDiskName = path.basename(rawFile);
    resolvedUrl = `/uploads/${safeDiskName}`;
    desiredName = requestedName || safeDiskName;
  } else {
    res.status(400).json({ error: 'የፋይል መለያ አልተሰጠም።' });
    return;
  }

  const gdriveFileId = parseGoogleDriveFileId(resolvedUrl);
  if (gdriveFileId) {
    let clientAborted = false;
    req.on('close', () => {
      clientAborted = true;
    });

    try {
      const upstream = await fetchGoogleDriveUpstream(gdriveFileId);
      const upstreamCt = (upstream.headers.get('content-type') || '').toLowerCase();

      if (upstreamCt.includes('application/json')) {
        const payload = (await upstream.json().catch(() => null)) as any;
        if (!payload || payload.error || payload.status === 'error') {
          throw new Error(payload?.error || payload?.message || 'Google Drive JSON error');
        }

        const b64 =
          typeof payload.base64 === 'string'
            ? payload.base64
            : typeof payload.data === 'string'
            ? payload.data
            : '';

        if (b64) {
          const cleanB64 = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64;
          const buf = Buffer.from(cleanB64, 'base64');
          const mimeType =
            (typeof payload.mimeType === 'string' && payload.mimeType) ||
            (typeof payload.contentType === 'string' && payload.contentType) ||
            guessMimeType(desiredName);

          res.status(200);
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Length', String(buf.length));
          res.setHeader('Cache-Control', 'private, max-age=3600');
          res.setHeader(
            'Content-Disposition',
            buildContentDisposition(dispositionType, desiredName)
          );
          res.send(buf);
          return;
        }

        const redirectDownloadUrl =
          (typeof payload.downloadUrl === 'string' && payload.downloadUrl) ||
          (typeof payload.url === 'string' && payload.url) ||
          '';
        if (redirectDownloadUrl) {
          const redirectedResp = await fetch(redirectDownloadUrl, {
            method: 'GET',
            redirect: 'follow',
            signal: AbortSignal.timeout(180000),
          });
          if (!redirectedResp.ok || !redirectedResp.body) {
            throw new Error(`Google Drive redirected download failed (${redirectedResp.status})`);
          }
          res.status(200);
          res.setHeader('Content-Type', guessMimeType(desiredName));
          const len = redirectedResp.headers.get('content-length');
          if (len) res.setHeader('Content-Length', len);
          res.setHeader('Cache-Control', 'private, max-age=3600');
          res.setHeader(
            'Content-Disposition',
            buildContentDisposition(dispositionType, desiredName)
          );
          await writeWebStreamToResponse(redirectedResp.body, res, () => clientAborted);
          if (!clientAborted && !res.writableEnded) res.end();
          return;
        }

        throw new Error('Google Drive returned empty file payload');
      }

      if (!upstream.body) {
        throw new Error('Google Drive returned empty stream');
      }

      res.status(200);
      res.setHeader('Content-Type', guessMimeType(desiredName));
      const contentLen = upstream.headers.get('content-length');
      if (contentLen) res.setHeader('Content-Length', contentLen);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader(
        'Content-Disposition',
        buildContentDisposition(dispositionType, desiredName)
      );

      await writeWebStreamToResponse(upstream.body, res, () => clientAborted);
      if (!clientAborted && !res.writableEnded) {
        res.end();
      }
      return;
    } catch (err: any) {
      console.error('Google Drive download stream error:', err?.message || err);
      if (!res.headersSent) {
        res.status(502).json({ error: 'ፋይሉን ከGoogle Drive ማውረድ አልተቻለም።' });
      } else if (!res.writableEnded) {
        res.destroy();
      }
      return;
    }
  }

  if (resolvedUrl.startsWith('/uploads/')) {
    const safeDiskName = path.basename(resolvedUrl.slice('/uploads/'.length));
    const fullPath = path.resolve(uploadsDir, safeDiskName);
    if (
      !fullPath.startsWith(path.resolve(uploadsDir) + path.sep) &&
      fullPath !== path.resolve(uploadsDir, safeDiskName)
    ) {
      res.status(403).json({ error: 'ያልተፈቀደ የፋይል መንገድ።' });
      return;
    }

    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'ፋይሉ አልተገኘም።' });
      return;
    }

    const diskExt = path.extname(safeDiskName);
    res.setHeader(
      'Content-Disposition',
      buildContentDisposition(dispositionType, desiredName || safeDiskName, diskExt)
    );
    res.sendFile(fullPath);
    return;
  }

  res.status(400).json({ error: 'የፋይሉ አድራሻ ትክክል አይደለም።' });
}

app.get('/api/files/download', (req, res) => {
  void handleProxyFileRequest(req, res, 'attachment');
});

app.get('/api/files/preview', (req, res) => {
  void handleProxyFileRequest(req, res, 'inline');
});

interface AuthedRequest extends Request {
  user?: UserRecord;
  token?: string;
}

function getDivisionForGrade(grade: number): string {
  if (grade >= 1 && grade <= 4) return 'wetani';
  if (grade >= 5 && grade <= 6) return 'maekelawi';
  return 'wetat';
}

function calculateGradeByAge(age: number): number {
  if (age <= 10) return 1;
  if (age <= 14) return 3;
  if (age <= 17) return 5;
  return 7;
}

function detectResourceTypeFromMeta(
  originalname: string,
  mimetype: string,
  explicitType?: string
): ResourceType | null {
  const mime = (mimetype || '').toLowerCase();
  const ext = path.extname(originalname || '').toLowerCase();

  if (mime === 'application/pdf' || ext === '.pdf') return 'pdf';
  if (mime.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)) return 'audio';
  if (mime.startsWith('video/') || ['.mp4', '.webm', '.mov', '.mkv', '.avi'].includes(ext)) return 'video';

  if (explicitType === 'pdf' || explicitType === 'audio' || explicitType === 'video') {
    return explicitType;
  }
  return null;
}

function detectResourceType(file: Express.Multer.File, explicitType?: string): ResourceType | null {
  return detectResourceTypeFromMeta(file.originalname, file.mimetype, explicitType);
}

function resolvePreUploadedStorage(
  body: any,
  explicitType?: string
): { fileUrl: string; originalFileName: string; detectedType: ResourceType | null } | null {
  const rawOriginalName = typeof body?.originalFileName === 'string' ? body.originalFileName.trim() : '';
  const rawMimeType = typeof body?.mimeType === 'string' ? body.mimeType.trim() : '';
  if (!rawOriginalName) return null;
  const originalFileName = path.basename(rawOriginalName);
  const detectedType = detectResourceTypeFromMeta(originalFileName, rawMimeType, explicitType);

  const rawDriveId =
    typeof body?.googleDriveFileId === 'string' ? body.googleDriveFileId.trim() : '';
  if (rawDriveId && !/\s/.test(rawDriveId)) {
    return {
      fileUrl: `gdrive:${rawDriveId}`,
      originalFileName,
      detectedType,
    };
  }

  return null;
}

function sanitizeUser(user: UserRecord, includePassword = false): UserRecord {
  if (includePassword) return user;
  const { password: _pwd, ...rest } = user;
  return rest;
}

function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    res.status(401).json({ error: 'እባክዎ መጀመሪያ ወደ ስርዓቱ ይግቡ።' });
    return;
  }

  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.userId
       WHERE s.token = ?`
    )
    .get(token) as UserRecord | undefined;

  if (!row) {
    res.status(401).json({ error: 'የመግቢያ ጊዜዎ አብቅቷል፤ እባክዎ እንደገና ይግቡ።' });
    return;
  }

  req.user = row;
  req.token = token;
  next();
}

// ---------- PUBLIC & AUTH ROUTES ----------

app.get('/api/public/overview', (_req, res) => {
  const studentCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'student'").get() as { c: number }).c;
  const teacherCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'teacher'").get() as { c: number }).c;
  const resourceCount = (db.prepare('SELECT COUNT(*) as c FROM educational_resources').get() as { c: number }).c;
  const memberCount = (
    db.prepare("SELECT COUNT(*) as c FROM users WHERE role IN ('dept_head', 'dept_member')").get() as { c: number }
  ).c;

  res.json({
    stats: {
      studentCount,
      teacherCount,
      resourceCount,
      memberCount,
    },
  });
});

// ---------- DEPARTMENTS ROUTES ----------

app.get('/api/departments', authMiddleware, (_req, res) => {
  const rows = db
    .prepare('SELECT id, label, description, allowsMedia, createdAt FROM departments ORDER BY createdAt ASC, rowid ASC')
    .all() as { id: string; label: string; description: string; allowsMedia: number; createdAt: string }[];

  res.json({
    departments: rows.map((d) => ({
      id: d.id,
      label: d.label,
      description: d.description,
      allowsMedia: Boolean(d.allowsMedia),
      createdAt: d.createdAt,
    })),
  });
});

app.post('/api/departments', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  if (actor.role !== 'head') {
    res.status(403).json({ error: 'አዲስ የስራ ክፍል ለመፍጠር የሀላፊ ፈቃድ ያስፈልጋል።' });
    return;
  }

  const { label, description, allowsMedia } = req.body;
  const cleanLabel = typeof label === 'string' ? label.trim() : '';
  if (!cleanLabel) {
    res.status(400).json({ error: 'እባክዎ የአዲሱን የስራ ክፍል ስም ያስገቡ።' });
    return;
  }

  const existingByLabel = db
    .prepare('SELECT id, label, description, allowsMedia, createdAt FROM departments WHERE LOWER(label) = LOWER(?)')
    .get(cleanLabel) as { id: string; label: string; description: string; allowsMedia: number; createdAt: string } | undefined;

  if (existingByLabel) {
    res.status(200).json({
      department: {
        ...existingByLabel,
        allowsMedia: Boolean(existingByLabel.allowsMedia),
      },
    });
    return;
  }

  const id = `dept_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
  const cleanDesc = typeof description === 'string' ? description.trim() : '';
  const mediaFlag = allowsMedia ? 1 : 0;

  db.prepare(
    `INSERT INTO departments (id, label, description, allowsMedia) VALUES (?, ?, ?, ?)`
  ).run(id, cleanLabel, cleanDesc, mediaFlag);

  const created = db
    .prepare('SELECT id, label, description, allowsMedia, createdAt FROM departments WHERE id = ?')
    .get(id) as { id: string; label: string; description: string; allowsMedia: number; createdAt: string };

  res.status(201).json({
    department: {
      ...created,
      allowsMedia: Boolean(created.allowsMedia),
    },
  });
});

app.get('/api/admin/stats', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  if (actor.role !== 'head') {
    res.status(403).json({ error: 'የአስተዳደር ስታቲስቲክስን ለማየት የሀላፊ ፈቃድ ያስፈልጋል።' });
    return;
  }

  const totalStudents = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'student'").get() as { c: number }).c;
  const totalTeachers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'teacher'").get() as { c: number }).c;
  const totalDeptMembers = (
    db.prepare("SELECT COUNT(*) as c FROM users WHERE role IN ('dept_head', 'dept_member')").get() as { c: number }
  ).c;
  const pendingReports = (
    db.prepare("SELECT COUNT(*) as c FROM department_reports WHERE status = 'pending'").get() as { c: number }
  ).c;
  const totalResources = (db.prepare('SELECT COUNT(*) as c FROM educational_resources').get() as { c: number }).c;

  const gradeRows = db
    .prepare(
      `SELECT assignedGrade as grade, COUNT(*) as count
       FROM users
       WHERE role = 'student' AND assignedGrade IS NOT NULL
       GROUP BY assignedGrade`
    )
    .all() as { grade: number; count: number }[];

  const gradeMap = new Map<number, number>(gradeRows.map((r) => [r.grade, r.count]));
  const studentsPerGrade = Array.from({ length: 12 }, (_, idx) => {
    const grade = idx + 1;
    const division = getDivisionForGrade(grade);
    return {
      grade,
      label: `${grade}ኛ ክፍል`,
      division,
      count: gradeMap.get(grade) || 0,
    };
  });

  const divisionTotals = [
    {
      division: 'wetani',
      label: 'ወጣኒ (1ኛ - 4ኛ)',
      count: studentsPerGrade.filter((g) => g.division === 'wetani').reduce((sum, g) => sum + g.count, 0),
    },
    {
      division: 'maekelawi',
      label: 'ማእከላዊ (5ኛ - 6ኛ)',
      count: studentsPerGrade.filter((g) => g.division === 'maekelawi').reduce((sum, g) => sum + g.count, 0),
    },
    {
      division: 'wetat',
      label: 'ወጣት (7ኛ - 12ኛ)',
      count: studentsPerGrade.filter((g) => g.division === 'wetat').reduce((sum, g) => sum + g.count, 0),
    },
  ];

  const trendRows = db
    .prepare(
      `SELECT
         date,
         SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
         SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
         SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
         SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused,
         COUNT(*) as total
       FROM attendance
       GROUP BY date
       ORDER BY date ASC
       LIMIT 30`
    )
    .all() as {
      date: string;
      present: number;
      absent: number;
      late: number;
      excused: number;
      total: number;
    }[];

  const attendanceTrends = trendRows.map((row) => ({
    ...row,
    rate: row.total > 0 ? Math.round(((row.present + row.late) / row.total) * 100) : 0,
  }));

  const overallAtt = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) as attended
       FROM attendance`
    )
    .get() as { total: number; attended: number | null };

  const attendanceRate =
    overallAtt.total > 0 ? Math.round(((overallAtt.attended || 0) / overallAtt.total) * 100) : 0;

  res.json({
    summary: {
      totalStudents,
      totalTeachers,
      totalDeptMembers,
      attendanceRate,
      pendingReports,
      totalResources,
    },
    studentsPerGrade,
    divisionTotals,
    attendanceTrends,
  });
});

app.post('/api/auth/register-student', (req, res) => {
  try {
    const { fullName, age, educationLevel, username, password, phone } = req.body;

    if (!fullName || typeof fullName !== 'string' || fullName.trim().split(/\s+/).length < 3) {
      res.status(400).json({ error: 'እባክዎ ሙሉ ስምዎን እስከ አያት (3 ስሞች) ያስገቡ።' });
      return;
    }

    const numAge = Number(age);
    if (!Number.isInteger(numAge) || numAge < 5 || numAge > 100) {
      res.status(400).json({ error: 'እድሜ ከ5 ዓመት በላይ ትክክለኛ ቁጥር መሆን አለበት።' });
      return;
    }

    if (!educationLevel || typeof educationLevel !== 'string' || !educationLevel.trim()) {
      res.status(400).json({ error: 'እባክዎ አሁን ያሉበትን የትምህርት ደረጃ ያስገቡ።' });
      return;
    }

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      res.status(400).json({ error: 'የመግቢያ ስም (Username) ቢያንስ 3 ፊደላት መሆን አለበት።' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 4) {
      res.status(400).json({ error: 'የይለፍ ቃል (Password) ቢያንስ 4 ቁምፊ መሆን አለበት።' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
    if (existing) {
      res.status(409).json({ error: 'ይህ የመግቢያ ስም (Username) አስቀድሞ ተይዟል፤ ሌላ ይምረጡ።' });
      return;
    }

    const assignedGrade = calculateGradeByAge(numAge);

    const result = db
      .prepare(
        `INSERT INTO users (username, password, fullName, role, age, educationLevel, assignedGrade, department, phone)
         VALUES (?, ?, ?, 'student', ?, ?, ?, NULL, ?)`
      )
      .run(
        username.trim(),
        password,
        fullName.trim(),
        numAge,
        educationLevel.trim(),
        assignedGrade,
        phone ? String(phone).trim() : null
      );

    const userId = Number(result.lastInsertRowid);
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions (token, userId) VALUES (?, ?)').run(token, userId);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRecord;
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Register student error:', err);
    res.status(500).json({ error: 'ምዝገባውን ማጠናቀቅ አልተቻለም።' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'እባክዎ የመግቢያ ስም እና የይለፍ ቃል ያስገቡ።' });
    return;
  }

  const user = db
    .prepare('SELECT * FROM users WHERE username = ? AND password = ?')
    .get(String(username).trim(), String(password)) as UserRecord | undefined;

  if (!user) {
    res.status(401).json({ error: 'የመግቢያ ስም ወይም የይለፍ ቃል ትክክል አይደለም።' });
    return;
  }

  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, userId) VALUES (?, ?)').run(token, user.id);

  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/logout', authMiddleware, (req: AuthedRequest, res) => {
  if (req.token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
  }
  res.json({ ok: true });
});

app.get('/api/auth/me', authMiddleware, (req: AuthedRequest, res) => {
  res.json({ user: sanitizeUser(req.user!) });
});

// ---------- USER & ACCOUNT MANAGEMENT ROUTES ----------

app.get('/api/users', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;

  if (actor.role === 'head') {
    const users = db.prepare('SELECT * FROM users ORDER BY role, assignedGrade, id DESC').all() as UserRecord[];
    res.json({ users: users.map((u) => sanitizeUser(u, true)) });
    return;
  }

  if (actor.role === 'teacher') {
    if (!actor.assignedGrade) {
      res.json({ users: [] });
      return;
    }
    const students = db
      .prepare("SELECT * FROM users WHERE role = 'student' AND assignedGrade = ? ORDER BY fullName ASC")
      .all(actor.assignedGrade) as UserRecord[];
    res.json({ users: students.map((u) => sanitizeUser(u, false)) });
    return;
  }

  if (actor.role === 'dept_head') {
    if (!actor.department) {
      res.json({ users: [] });
      return;
    }
    const members = db
      .prepare("SELECT * FROM users WHERE department = ? AND role IN ('dept_head', 'dept_member') ORDER BY role, fullName ASC")
      .all(actor.department) as UserRecord[];
    res.json({ users: members.map((u) => sanitizeUser(u, false)) });
    return;
  }

  res.status(403).json({ error: 'ይህን መረጃ ለማየት ፈቃድ የለዎትም።' });
});

app.post('/api/users', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const { username, password, fullName, role, age, educationLevel, assignedGrade, department, subject, phone } = req.body;

  if (!username || !password || !fullName) {
    res.status(400).json({ error: 'ሙሉ ስም፣ የመግቢያ ስም እና የይለፍ ቃል ያስፈልጋሉ።' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(String(username).trim());
  if (existing) {
    res.status(409).json({ error: 'ይህ የመግቢያ ስም (Username) አስቀድሞ አለ።' });
    return;
  }

  if (actor.role === 'head') {
    const validRoles: UserRole[] = ['head', 'teacher', 'student', 'dept_head', 'dept_member'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'ትክክለኛ የስራ ድርሻ (Role) ይምረጡ።' });
      return;
    }

    let finalGrade: number | null = assignedGrade ? Number(assignedGrade) : null;
    if (role === 'student' && !finalGrade && age) {
      finalGrade = calculateGradeByAge(Number(age));
    }

    const finalSubject = role === 'teacher' && subject ? String(subject).trim() : null;

    const result = db
      .prepare(
        `INSERT INTO users (username, password, fullName, role, age, educationLevel, assignedGrade, department, subject, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        String(username).trim(),
        String(password),
        String(fullName).trim(),
        role,
        age ? Number(age) : null,
        educationLevel ? String(educationLevel).trim() : null,
        finalGrade,
        department || null,
        finalSubject,
        phone ? String(phone).trim() : null
      );

    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(result.lastInsertRowid)) as UserRecord;
    res.status(201).json({ user: sanitizeUser(created, true) });
    return;
  }

  if (actor.role === 'dept_head' && actor.department) {
    // Department heads can only add dept_members to their own assigned department
    const result = db
      .prepare(
        `INSERT INTO users (username, password, fullName, role, age, educationLevel, assignedGrade, department, phone)
         VALUES (?, ?, ?, 'dept_member', ?, ?, NULL, ?, ?)`
      )
      .run(
        String(username).trim(),
        String(password),
        String(fullName).trim(),
        age ? Number(age) : null,
        educationLevel ? String(educationLevel).trim() : null,
        actor.department,
        phone ? String(phone).trim() : null
      );

    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(result.lastInsertRowid)) as UserRecord;
    res.status(201).json({ user: sanitizeUser(created, false) });
    return;
  }

  res.status(403).json({ error: 'አዲስ አባል ወይም መምህር ለመመዝገብ ፈቃድ የለዎትም።' });
});

app.patch('/api/users/:id', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const targetId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as UserRecord | undefined;

  if (!existing) {
    res.status(404).json({ error: 'ተጠቃሚው አልተገኘም።' });
    return;
  }

  if (actor.role !== 'head' && actor.id !== targetId) {
    res.status(403).json({ error: 'የሌላ ተጠቃሚ መረጃ ለማስተካከል ፈቃድ የለዎትም።' });
    return;
  }

  const { fullName, username, password, age, educationLevel, assignedGrade, department, subject, role, phone } = req.body;

  if (username && String(username).trim() !== existing.username) {
    const conflict = db
      .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
      .get(String(username).trim(), targetId);
    if (conflict) {
      res.status(409).json({ error: 'ይህ የመግቢያ ስም (Username) በሌላ ሰው ተይዟል።' });
      return;
    }
  }

  if (actor.role === 'head') {
    const targetRole = role !== undefined ? role : existing.role;
    const nextSubject =
      targetRole === 'teacher'
        ? subject !== undefined
          ? subject
            ? String(subject).trim()
            : null
          : existing.subject
        : null;

    db.prepare(
      `UPDATE users SET
        fullName = ?,
        username = ?,
        password = ?,
        age = ?,
        educationLevel = ?,
        assignedGrade = ?,
        department = ?,
        subject = ?,
        role = ?,
        phone = ?
       WHERE id = ?`
    ).run(
      fullName !== undefined ? String(fullName).trim() : existing.fullName,
      username !== undefined ? String(username).trim() : existing.username,
      password !== undefined && String(password).length > 0 ? String(password) : existing.password,
      age !== undefined ? (age === null || age === '' ? null : Number(age)) : existing.age,
      educationLevel !== undefined ? (educationLevel ? String(educationLevel).trim() : null) : existing.educationLevel,
      assignedGrade !== undefined ? (assignedGrade === null || assignedGrade === '' ? null : Number(assignedGrade)) : existing.assignedGrade,
      department !== undefined ? (department || null) : existing.department,
      nextSubject,
      targetRole,
      phone !== undefined ? (phone ? String(phone).trim() : null) : existing.phone,
      targetId
    );
  } else {
    // Non-head editing own profile (name/password/phone/educationLevel only, cannot escalate role/grade)
    db.prepare(
      `UPDATE users SET
        fullName = ?,
        password = ?,
        educationLevel = ?,
        phone = ?
       WHERE id = ?`
    ).run(
      fullName !== undefined ? String(fullName).trim() : existing.fullName,
      password !== undefined && String(password).length > 0 ? String(password) : existing.password,
      educationLevel !== undefined ? (educationLevel ? String(educationLevel).trim() : null) : existing.educationLevel,
      phone !== undefined ? (phone ? String(phone).trim() : null) : existing.phone,
      targetId
    );
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as UserRecord;
  res.json({ user: sanitizeUser(updated, actor.role === 'head') });
});

app.delete('/api/users/:id', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const targetId = Number(req.params.id);

  if (actor.role !== 'head') {
    res.status(403).json({ error: 'መለያ ለመሰረዝ የሀላፊ ፈቃድ ያስፈልጋል።' });
    return;
  }

  if (actor.id === targetId) {
    res.status(400).json({ error: 'የራስዎን ዋና ሀላፊ መለያ መሰረዝ አይችሉም።' });
    return;
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.json({ ok: true });
});

// ---------- STORAGE UPLOAD CONFIG ROUTE (GOOGLE DRIVE DIRECT SINGLE-FILE UPLOAD) ----------

app.get('/api/files/upload-config', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  if (!['head', 'teacher', 'dept_head'].includes(actor.role)) {
    res.json({ enabled: false, scriptUrl: null });
    return;
  }
  const scriptUrl = getConfiguredGoogleDriveScriptUrl();
  res.json({
    enabled: Boolean(scriptUrl),
    scriptUrl: scriptUrl || null,
  });
});

// ---------- EDUCATIONAL RESOURCES ROUTES (PDF, AUDIO, VIDEO) ----------

app.get('/api/resources', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const allRows = db
    .prepare(
      `SELECT r.*, u.fullName as uploaderName, u.role as uploaderRole
       FROM educational_resources r
       JOIN users u ON u.id = r.uploadedBy
       ORDER BY r.createdAt DESC, r.id DESC`
    )
    .all() as any[];

  if (actor.role === 'student' && actor.assignedGrade) {
    const myDiv = getDivisionForGrade(actor.assignedGrade);
    const filtered = allRows
      .filter(
        (r) =>
          (r.targetGrade === null && (r.targetDivision === 'all' || r.targetDivision === myDiv)) ||
          r.targetGrade === actor.assignedGrade
      )
      .map((r) => ({
        ...r,
        fileUrl: `/api/files/download?kind=resource&id=${r.id}`,
      }));
    res.json({ resources: filtered });
    return;
  }

  res.json({ resources: allRows });
});

app.post('/api/resources', authMiddleware, handleSingleUpload('file'), async (req: AuthedRequest, res) => {
  try {
    const actor = req.user!;
    if (!['head', 'teacher', 'dept_head'].includes(actor.role)) {
      tryUnlink(req.file?.path);
      res.status(403).json({ error: 'የትምህርት ግብአት ለመጫን ፈቃድ የለዎትም።' });
      return;
    }

    const { title, description, targetGrade, targetDivision, resourceType } = req.body;
    if (!title || !String(title).trim()) {
      tryUnlink(req.file?.path);
      res.status(400).json({ error: 'እባክዎ የትምህርት ግብአቱን ርዕስ ያስገቡ።' });
      return;
    }

    const preUploaded = !req.file ? resolvePreUploadedStorage(req.body, resourceType) : null;
    if (!req.file && !preUploaded) {
      res.status(400).json({ error: 'እባክዎ ፋይል (PDF፣ Audio ወይም Video) ይምረጡ።' });
      return;
    }

    const detectedType = req.file
      ? detectResourceType(req.file, resourceType)
      : preUploaded!.detectedType;
    if (!detectedType) {
      tryUnlink(req.file?.path);
      res.status(400).json({ error: 'የተፈቀዱት የፋይል አይነቶች PDF፣ Audio እና Video ብቻ ናቸው።' });
      return;
    }

    let finalGrade: number | null = targetGrade ? Number(targetGrade) : null;
    let finalDivision = targetDivision || 'all';

    if (actor.role === 'teacher' && actor.assignedGrade) {
      // Teachers default to their assigned grade unless targeting their division
      if (!finalGrade && finalDivision === 'all') {
        finalGrade = actor.assignedGrade;
      }
    }

    if (finalGrade) {
      finalDivision = getDivisionForGrade(finalGrade);
    }

    const originalFileName = req.file
      ? decodeOriginalName(req.file.originalname)
      : preUploaded!.originalFileName;
    const fileUrl = req.file
      ? await uploadFileToStorage(req.file, originalFileName)
      : preUploaded!.fileUrl;
    const result = db
      .prepare(
        `INSERT INTO educational_resources (title, description, resourceType, fileUrl, fileName, targetGrade, targetDivision, uploadedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        String(title).trim(),
        description ? String(description).trim() : '',
        detectedType,
        fileUrl,
        originalFileName,
        finalGrade,
        finalDivision,
        actor.id
      );

    const created = db
      .prepare(
        `SELECT r.*, u.fullName as uploaderName, u.role as uploaderRole
         FROM educational_resources r
         JOIN users u ON u.id = r.uploadedBy
         WHERE r.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    res.status(201).json({ resource: created });
  } catch (err: any) {
    console.error('Upload resource error:', err);
    tryUnlink(req.file?.path);
    res.status(500).json({
      error: err?.message
        ? `ግብአቱን ማስቀመጥ አልተቻለም፡ ${err.message}`
        : 'ግብአቱን ማስቀመጥ አልተቻለም።',
    });
  }
});

app.delete('/api/resources/:id', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM educational_resources WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'ግብአቱ አልተገኘም።' });
    return;
  }

  if (actor.role !== 'head' && existing.uploadedBy !== actor.id) {
    res.status(403).json({ error: 'ይህን ግብአት ለመሰረዝ ፈቃድ የለዎትም።' });
    return;
  }

  db.prepare('DELETE FROM educational_resources WHERE id = ?').run(id);
  removeLocalUploadIfPresent(existing.fileUrl);
  res.json({ ok: true });
});

// ---------- EXAM RESULTS ROUTES ----------

app.get('/api/exams', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const gradeFilter = req.query.grade ? Number(req.query.grade) : null;

  const baseSql = `
    SELECT e.*, s.fullName as studentName, r.fullName as recordedByName
    FROM exam_results e
    JOIN users s ON s.id = e.studentId
    JOIN users r ON r.id = e.recordedBy
  `;

  if (actor.role === 'head') {
    const rows = gradeFilter
      ? db.prepare(`${baseSql} WHERE e.grade = ? ORDER BY e.grade, s.fullName, e.id DESC`).all(gradeFilter)
      : db.prepare(`${baseSql} ORDER BY e.grade, s.fullName, e.id DESC`).all();
    res.json({ exams: rows });
    return;
  }

  if (actor.role === 'teacher') {
    if (!actor.assignedGrade) {
      res.json({ exams: [] });
      return;
    }
    const rows = db
      .prepare(`${baseSql} WHERE e.grade = ? ORDER BY s.fullName, e.id DESC`)
      .all(actor.assignedGrade);
    res.json({ exams: rows });
    return;
  }

  if (actor.role === 'student') {
    const rows = db
      .prepare(`${baseSql} WHERE e.studentId = ? ORDER BY e.id DESC`)
      .all(actor.id);
    res.json({ exams: rows });
    return;
  }

  res.json({ exams: [] });
});

app.post('/api/exams', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  if (actor.role !== 'head' && actor.role !== 'teacher') {
    res.status(403).json({ error: 'የፈተና ውጤት ለመመዝገብ ፈቃድ የለዎትም።' });
    return;
  }

  const { studentId, subject, examTitle, score, maxScore, term, remarks } = req.body;
  const student = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'student'").get(Number(studentId)) as
    | UserRecord
    | undefined;

  if (!student || !student.assignedGrade) {
    res.status(404).json({ error: 'ተማሪው አልተገኘም።' });
    return;
  }

  if (actor.role === 'teacher' && actor.assignedGrade !== student.assignedGrade) {
    res.status(403).json({ error: 'እርስዎ ከተመደቡበት ክፍል ውጪ ላሉ ተማሪዎች ውጤት ማስገባት አይችሉም።' });
    return;
  }

  const numScore = Number(score);
  const numMax = Number(maxScore || 100);
  if (Number.isNaN(numScore) || numScore < 0 || numScore > numMax) {
    res.status(400).json({ error: `ውጤቱ ከ0 እስከ ${numMax} መካከል መሆን አለበት።` });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO exam_results (studentId, grade, subject, examTitle, score, maxScore, term, remarks, recordedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      student.id,
      student.assignedGrade,
      String(subject || 'አጠቃላይ ትምህርት').trim(),
      String(examTitle || 'ፈተና').trim(),
      numScore,
      numMax,
      String(term || '1ኛ መንፈቅ ዓመት').trim(),
      String(remarks || '').trim(),
      actor.id
    );

  const created = db
    .prepare(
      `SELECT e.*, s.fullName as studentName, r.fullName as recordedByName
       FROM exam_results e
       JOIN users s ON s.id = e.studentId
       JOIN users r ON r.id = e.recordedBy
       WHERE e.id = ?`
    )
    .get(Number(result.lastInsertRowid));

  res.status(201).json({ exam: created });
});

app.patch('/api/exams/:id', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM exam_results WHERE id = ?').get(id) as any;

  if (!existing) {
    res.status(404).json({ error: 'የፈተና ውጤቱ አልተገኘም።' });
    return;
  }

  if (actor.role !== 'head' && !(actor.role === 'teacher' && actor.assignedGrade === existing.grade)) {
    res.status(403).json({ error: 'ይህን ውጤት ለማስተካከል ፈቃድ የለዎትም።' });
    return;
  }

  const { subject, examTitle, score, maxScore, term, remarks } = req.body;
  const numMax = maxScore !== undefined ? Number(maxScore) : existing.maxScore;
  const numScore = score !== undefined ? Number(score) : existing.score;

  if (Number.isNaN(numScore) || numScore < 0 || numScore > numMax) {
    res.status(400).json({ error: `ውጤቱ ከ0 እስከ ${numMax} መካከል መሆን አለበት።` });
    return;
  }

  db.prepare(
    `UPDATE exam_results
     SET subject = ?, examTitle = ?, score = ?, maxScore = ?, term = ?, remarks = ?, updatedAt = datetime('now')
     WHERE id = ?`
  ).run(
    subject !== undefined ? String(subject).trim() : existing.subject,
    examTitle !== undefined ? String(examTitle).trim() : existing.examTitle,
    numScore,
    numMax,
    term !== undefined ? String(term).trim() : existing.term,
    remarks !== undefined ? String(remarks).trim() : existing.remarks,
    id
  );

  const updated = db
    .prepare(
      `SELECT e.*, s.fullName as studentName, r.fullName as recordedByName
       FROM exam_results e
       JOIN users s ON s.id = e.studentId
       JOIN users r ON r.id = e.recordedBy
       WHERE e.id = ?`
    )
    .get(id);

  res.json({ exam: updated });
});

app.delete('/api/exams/:id', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM exam_results WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'የፈተና ውጤቱ አልተገኘም።' });
    return;
  }

  if (actor.role !== 'head' && !(actor.role === 'teacher' && actor.assignedGrade === existing.grade)) {
    res.status(403).json({ error: 'ፈቃድ የለዎትም።' });
    return;
  }

  db.prepare('DELETE FROM exam_results WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ---------- DAILY ATTENDANCE ROUTES ----------

app.get('/api/attendance', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const dateFilter = req.query.date ? String(req.query.date) : null;
  const gradeFilter = req.query.grade ? Number(req.query.grade) : null;

  const baseSql = `
    SELECT a.*, s.fullName as studentName, r.fullName as recordedByName
    FROM attendance a
    JOIN users s ON s.id = a.studentId
    JOIN users r ON r.id = a.recordedBy
  `;

  if (actor.role === 'head') {
    const clauses: string[] = [];
    const params: any[] = [];
    if (gradeFilter) {
      clauses.push('a.grade = ?');
      params.push(gradeFilter);
    }
    if (dateFilter) {
      clauses.push('a.date = ?');
      params.push(dateFilter);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`${baseSql} ${where} ORDER BY a.date DESC, a.grade, s.fullName`).all(...params);
    res.json({ attendance: rows });
    return;
  }

  if (actor.role === 'teacher') {
    if (!actor.assignedGrade) {
      res.json({ attendance: [] });
      return;
    }
    const params: any[] = [actor.assignedGrade];
    let extra = '';
    if (dateFilter) {
      extra = ' AND a.date = ?';
      params.push(dateFilter);
    }
    const rows = db
      .prepare(`${baseSql} WHERE a.grade = ?${extra} ORDER BY a.date DESC, s.fullName`)
      .all(...params);
    res.json({ attendance: rows });
    return;
  }

  if (actor.role === 'student') {
    const rows = db
      .prepare(`${baseSql} WHERE a.studentId = ? ORDER BY a.date DESC`)
      .all(actor.id);
    res.json({ attendance: rows });
    return;
  }

  res.json({ attendance: [] });
});

app.post('/api/attendance/bulk', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  if (actor.role !== 'head' && actor.role !== 'teacher') {
    res.status(403).json({ error: 'አቴንዳንስ ለመመዝገብ ፈቃድ የለዎትም።' });
    return;
  }

  const { date, entries } = req.body as {
    date: string;
    entries: { studentId: number; status: string; note?: string }[];
  };

  if (!date || !Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: 'እባክዎ ቀንና የተማሪዎችን አቴንዳንስ ያስገቡ።' });
    return;
  }

  const upsert = db.prepare(`
    INSERT INTO attendance (studentId, grade, date, status, note, recordedBy)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(studentId, date) DO UPDATE SET
      status = excluded.status,
      note = excluded.note,
      grade = excluded.grade,
      recordedBy = excluded.recordedBy
  `);

  const tx = db.transaction(() => {
    for (const item of entries) {
      const student = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'student'").get(item.studentId) as
        | UserRecord
        | undefined;
      if (!student || !student.assignedGrade) continue;
      if (actor.role === 'teacher' && actor.assignedGrade !== student.assignedGrade) {
        throw new Error('FORBIDDEN_GRADE');
      }
      upsert.run(student.id, student.assignedGrade, date, item.status, item.note || '', actor.id);
    }
  });

  try {
    tx();
    res.json({ ok: true });
  } catch (err: any) {
    if (err?.message === 'FORBIDDEN_GRADE') {
      res.status(403).json({ error: 'ከተመደቡበት ክፍል ውጪ አቴንዳንስ መመዝገብ አይችሉም።' });
      return;
    }
    res.status(500).json({ error: 'አቴንዳንሱን ማስቀመጥ አልተቻለም።' });
  }
});

// ---------- DEPARTMENT REPORTS ROUTES (Dept Head -> Head) ----------

app.get('/api/reports', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const baseSql = `
    SELECT r.*, u.fullName as submitterName
    FROM department_reports r
    JOIN users u ON u.id = r.submittedBy
  `;

  if (actor.role === 'head') {
    const rows = db.prepare(`${baseSql} ORDER BY r.createdAt DESC, r.id DESC`).all();
    res.json({ reports: rows });
    return;
  }

  if (actor.role === 'dept_head' && actor.department) {
    const rows = db
      .prepare(`${baseSql} WHERE r.department = ? ORDER BY r.createdAt DESC, r.id DESC`)
      .all(actor.department);
    res.json({ reports: rows });
    return;
  }

  res.json({ reports: [] });
});

app.post('/api/reports', authMiddleware, handleSingleUpload('pdf'), async (req: AuthedRequest, res) => {
  try {
    const actor = req.user!;
    if (actor.role !== 'dept_head' || !actor.department) {
      tryUnlink(req.file?.path);
      res.status(403).json({ error: 'ሪፖርት ማቅረብ የሚችሉት የክፍል ተመዳቢ ሀላፊዎች ብቻ ናቸው።' });
      return;
    }

    const { title, content } = req.body;
    if (!title || !content) {
      tryUnlink(req.file?.path);
      res.status(400).json({ error: 'እባክዎ የሪፖርቱን ርዕስና የፅሁፍ ዝርዝር ያስገቡ።' });
      return;
    }

    let pdfUrl: string | null = null;
    let pdfName: string | null = null;

    if (req.file) {
      const type = detectResourceType(req.file);
      if (type !== 'pdf') {
        tryUnlink(req.file.path);
        res.status(400).json({ error: 'ለሪፖርት ማያያዣ የተፈቀደው PDF ፋይል ብቻ ነው።' });
        return;
      }
      pdfName = decodeOriginalName(req.file.originalname);
      pdfUrl = await uploadFileToStorage(req.file, pdfName);
    } else {
      const preUploaded = resolvePreUploadedStorage(req.body, 'pdf');
      if (preUploaded) {
        if (preUploaded.detectedType !== 'pdf') {
          res.status(400).json({ error: 'ለሪፖርት ማያያዣ የተፈቀደው PDF ፋይል ብቻ ነው።' });
          return;
        }
        pdfName = preUploaded.originalFileName;
        pdfUrl = preUploaded.fileUrl;
      }
    }

    const result = db
      .prepare(
        `INSERT INTO department_reports (department, submittedBy, title, content, pdfUrl, pdfName)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(actor.department, actor.id, String(title).trim(), String(content).trim(), pdfUrl, pdfName);

    const created = db
      .prepare(
        `SELECT r.*, u.fullName as submitterName
         FROM department_reports r
         JOIN users u ON u.id = r.submittedBy
         WHERE r.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    res.status(201).json({ report: created });
  } catch (err: any) {
    console.error('Upload report error:', err);
    tryUnlink(req.file?.path);
    res.status(500).json({
      error: err?.message
        ? `ሪፖርቱን ማስቀመጥ አልተቻለም፡ ${err.message}`
        : 'ሪፖርቱን ማስቀመጥ አልተቻለም።',
    });
  }
});

app.patch('/api/reports/:id', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  if (actor.role !== 'head') {
    res.status(403).json({ error: 'ፈቃድ የለዎትም።' });
    return;
  }
  const id = Number(req.params.id);
  const status = req.body.status === 'reviewed' ? 'reviewed' : 'pending';
  db.prepare('UPDATE department_reports SET status = ? WHERE id = ?').run(status, id);
  res.json({ ok: true });
});

// ---------- DIRECTIVES ROUTES (Head -> Dept Head, Dept Head -> Dept Members) ----------

app.get('/api/directives', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const baseSql = `
    SELECT d.*, u.fullName as senderName, u.role as senderRole
    FROM directives d
    JOIN users u ON u.id = d.senderId
  `;

  if (actor.role === 'head') {
    const rows = db.prepare(`${baseSql} ORDER BY d.createdAt DESC, d.id DESC`).all();
    res.json({ directives: rows });
    return;
  }

  if (actor.role === 'dept_head' && actor.department) {
    const rows = db
      .prepare(`${baseSql} WHERE d.targetDepartment = ? ORDER BY d.createdAt DESC, d.id DESC`)
      .all(actor.department);
    res.json({ directives: rows });
    return;
  }

  if (actor.role === 'dept_member' && actor.department) {
    const rows = db
      .prepare(
        `${baseSql} WHERE d.targetDepartment = ? AND d.targetScope = 'dept_members' ORDER BY d.createdAt DESC, d.id DESC`
      )
      .all(actor.department);
    res.json({ directives: rows });
    return;
  }

  res.json({ directives: [] });
});

app.post('/api/directives', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const { targetDepartment, title, body } = req.body;

  if (!title || !body) {
    res.status(400).json({ error: 'እባክዎ የትዕዛዙን ርዕስና ዝርዝር መልእክት ያስገቡ።' });
    return;
  }

  if (actor.role === 'head') {
    if (!targetDepartment) {
      res.status(400).json({ error: 'እባክዎ ትዕዛዙ የሚላክለትን ክፍል ይምረጡ።' });
      return;
    }
    const result = db
      .prepare(
        `INSERT INTO directives (senderId, targetDepartment, targetScope, title, body)
         VALUES (?, ?, 'dept_head', ?, ?)`
      )
      .run(actor.id, targetDepartment, String(title).trim(), String(body).trim());

    const created = db
      .prepare(
        `SELECT d.*, u.fullName as senderName, u.role as senderRole
         FROM directives d JOIN users u ON u.id = d.senderId WHERE d.id = ?`
      )
      .get(Number(result.lastInsertRowid));
    res.status(201).json({ directive: created });
    return;
  }

  if (actor.role === 'dept_head' && actor.department) {
    const result = db
      .prepare(
        `INSERT INTO directives (senderId, targetDepartment, targetScope, title, body)
         VALUES (?, ?, 'dept_members', ?, ?)`
      )
      .run(actor.id, actor.department, String(title).trim(), String(body).trim());

    const created = db
      .prepare(
        `SELECT d.*, u.fullName as senderName, u.role as senderRole
         FROM directives d JOIN users u ON u.id = d.senderId WHERE d.id = ?`
      )
      .get(Number(result.lastInsertRowid));
    res.status(201).json({ directive: created });
    return;
  }

  res.status(403).json({ error: 'ትዕዛዝ ለማስተላለፍ ፈቃድ የለዎትም።' });
});

app.patch('/api/directives/:id', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM directives WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'ትዕዛዙ አልተገኘም።' });
    return;
  }

  if (actor.role !== 'head' && actor.department !== existing.targetDepartment) {
    res.status(403).json({ error: 'ፈቃድ የለዎትም።' });
    return;
  }

  db.prepare("UPDATE directives SET status = 'acknowledged' WHERE id = ?").run(id);
  res.json({ ok: true });
});

// ---------- DEPARTMENT MATERIALS ROUTES (PDF only; Choir ONLY allows PDF + Audio + Video) ----------

app.get('/api/dept-materials', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const baseSql = `
    SELECT m.*, u.fullName as uploaderName
    FROM department_materials m
    JOIN users u ON u.id = m.uploadedBy
  `;

  if (actor.role === 'head') {
    const rows = db.prepare(`${baseSql} ORDER BY m.createdAt DESC, m.id DESC`).all();
    res.json({ materials: rows });
    return;
  }

  if ((actor.role === 'dept_head' || actor.role === 'dept_member') && actor.department) {
    const rows = db
      .prepare(`${baseSql} WHERE m.department = ? ORDER BY m.createdAt DESC, m.id DESC`)
      .all(actor.department) as any[];
    const responseRows =
      actor.role === 'dept_member'
        ? rows.map((m) => ({
            ...m,
            fileUrl: `/api/files/download?kind=material&id=${m.id}`,
          }))
        : rows;
    res.json({ materials: responseRows });
    return;
  }

  res.json({ materials: [] });
});

app.post('/api/dept-materials', authMiddleware, handleSingleUpload('file'), async (req: AuthedRequest, res) => {
  try {
    const actor = req.user!;
    if (actor.role !== 'dept_head' || !actor.department) {
      tryUnlink(req.file?.path);
      res.status(403).json({ error: 'ለክፍል አባላት ፋይል መስጠት የሚችሉት የክፍሉ ተመዳቢ ሀላፊዎች ብቻ ናቸው።' });
      return;
    }

    const { title, description, fileType } = req.body;
    const preUploaded = !req.file ? resolvePreUploadedStorage(req.body, fileType) : null;
    if (!title || (!req.file && !preUploaded)) {
      tryUnlink(req.file?.path);
      res.status(400).json({ error: 'እባክዎ ርዕስና ፋይል ያስገቡ።' });
      return;
    }

    const detected = req.file
      ? detectResourceType(req.file, fileType)
      : preUploaded!.detectedType;
    if (!detected) {
      tryUnlink(req.file?.path);
      res.status(400).json({ error: 'የማይታወቅ የፋይል አይነት ነው።' });
      return;
    }

    // Check department media permission (choir or any custom media-enabled department)
    const deptRow = db
      .prepare('SELECT allowsMedia FROM departments WHERE id = ?')
      .get(actor.department) as { allowsMedia: number } | undefined;
    const allowsMedia = deptRow ? Boolean(deptRow.allowsMedia) : actor.department === 'choir';

    if (!allowsMedia && detected !== 'pdf') {
      tryUnlink(req.file?.path);
      res.status(400).json({
        error: 'ለዚህ ክፍል ለአባላት መስጠት የሚፈቀደው የPDF ፋይል ብቻ ነው። (ኦዲዮና ቪዲዮ ለመዝሙር ክፍል ወይም ለተፈቀደለት ክፍል ብቻ ነው)',
      });
      return;
    }

    const originalFileName = req.file
      ? decodeOriginalName(req.file.originalname)
      : preUploaded!.originalFileName;
    const fileUrl = req.file
      ? await uploadFileToStorage(req.file, originalFileName)
      : preUploaded!.fileUrl;
    const result = db
      .prepare(
        `INSERT INTO department_materials (department, title, description, fileType, fileUrl, fileName, uploadedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        actor.department,
        String(title).trim(),
        description ? String(description).trim() : '',
        detected,
        fileUrl,
        originalFileName,
        actor.id
      );

    const created = db
      .prepare(
        `SELECT m.*, u.fullName as uploaderName
         FROM department_materials m
         JOIN users u ON u.id = m.uploadedBy
         WHERE m.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    res.status(201).json({ material: created });
  } catch (err: any) {
    console.error('Upload dept material error:', err);
    tryUnlink(req.file?.path);
    res.status(500).json({
      error: err?.message
        ? `የክፍል ግብአቱን ማስቀመጥ አልተቻለም፡ ${err.message}`
        : 'የክፍል ግብአቱን ማስቀመጥ አልተቻለም።',
    });
  }
});

app.delete('/api/dept-materials/:id', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM department_materials WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'ፋይሉ አልተገኘም።' });
    return;
  }

  if (actor.role !== 'head' && existing.uploadedBy !== actor.id) {
    res.status(403).json({ error: 'ፈቃድ የለዎትም።' });
    return;
  }

  db.prepare('DELETE FROM department_materials WHERE id = ?').run(id);
  removeLocalUploadIfPresent(existing.fileUrl);
  res.json({ ok: true });
});

// ---------- TARGETED MESSAGING ROUTES (Head, Member Admin Head, Member Admin Members) ----------

function canBroadcastMessages(user: UserRecord): boolean {
  if (user.role === 'head') return true;
  if ((user.role === 'dept_head' || user.role === 'dept_member') && user.department === 'member_admin') {
    return true;
  }
  return false;
}

app.get('/api/messages', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const allMsgs = db
    .prepare(
      `SELECT m.*, u.fullName as senderName, u.role as senderRole, u.department as senderDepartment
       FROM targeted_messages m
       JOIN users u ON u.id = m.senderId
       ORDER BY m.createdAt DESC, m.id DESC`
    )
    .all() as any[];

  // Head and Member Admin team see all sent/received targeted messages
  if (canBroadcastMessages(actor)) {
    res.json({ messages: allMsgs });
    return;
  }

  const filtered = allMsgs.filter((m) => {
    if (m.targetType === 'all') return true;
    if (actor.role === 'student' && actor.assignedGrade) {
      if (m.targetType === 'grade' && Number(m.targetValue) === actor.assignedGrade) return true;
      if (m.targetType === 'division' && m.targetValue === getDivisionForGrade(actor.assignedGrade)) return true;
    }
    if (actor.role === 'teacher') {
      if (m.targetType === 'teachers') return true;
      if (actor.assignedGrade) {
        if (m.targetType === 'grade' && Number(m.targetValue) === actor.assignedGrade) return true;
        if (m.targetType === 'division' && m.targetValue === getDivisionForGrade(actor.assignedGrade)) return true;
      }
    }
    if ((actor.role === 'dept_head' || actor.role === 'dept_member') && actor.department) {
      if (m.targetType === 'department' && m.targetValue === actor.department) return true;
    }
    return false;
  });

  res.json({ messages: filtered });
});

app.post('/api/messages', authMiddleware, (req: AuthedRequest, res) => {
  const actor = req.user!;
  if (!canBroadcastMessages(actor)) {
    res.status(403).json({
      error: 'መልእክት ለሁሉም ክፍላት ማስተላለፍ የሚችሉት የሰንበት ትምህርት ቤት ሀላፊ፣ የአባላት አስተዳደር ሀላፊ እና የአባላት አስተዳደር ክፍል አባላት ብቻ ናቸው።',
    });
    return;
  }

  const { targetType, targetValue, title, body } = req.body;
  if (!targetType || !targetValue || !title || !body) {
    res.status(400).json({ error: 'እባክዎ ተቀባይ ክፍል፣ ርዕስ እና መልእክት ያስገቡ።' });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO targeted_messages (senderId, targetType, targetValue, title, body)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(actor.id, String(targetType), String(targetValue), String(title).trim(), String(body).trim());

  const created = db
    .prepare(
      `SELECT m.*, u.fullName as senderName, u.role as senderRole, u.department as senderDepartment
       FROM targeted_messages m
       JOIN users u ON u.id = m.senderId
       WHERE m.id = ?`
    )
    .get(Number(result.lastInsertRowid));

  res.status(201).json({ message: created });
});

// Ensure any unexpected /api error always returns JSON rather than HTML
app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API error:', err);
  if (res.headersSent) return;
  const status = typeof err?.status === 'number' ? err.status : 500;
  res.status(status).json({
    error: err?.message ? `የስርዓት ስህተት፡ ${err.message}` : 'የአገልጋይ ስህተት ተከስቷል።',
  });
});

// ---------- VITE / STATIC SERVING ----------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunday School Portal running on http://0.0.0.0:${PORT}`);
  });
  server.requestTimeout = 0;
  server.headersTimeout = 10 * 60 * 1000;
  server.keepAliveTimeout = 5 * 60 * 1000;
}

startServer();
