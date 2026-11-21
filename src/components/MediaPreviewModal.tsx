import { Download, FileText, Headphones, Video, X } from 'lucide-react';
import { getEntityDownloadUrl, getEntityPreviewUrl, getFileDownloadUrl, type FileEntityKind } from '../utils/api';
import type { ResourceType } from '../types';

interface MediaPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  fileType: ResourceType;
  fileUrl: string;
  fileName: string;
  entityKind?: FileEntityKind;
  entityId?: number;
}

export function MediaPreviewModal({
  isOpen,
  onClose,
  title,
  description,
  fileType,
  fileUrl,
  fileName,
  entityKind,
  entityId,
}: MediaPreviewModalProps) {
  if (!isOpen) return null;

  const downloadHref =
    entityKind && entityId
      ? getEntityDownloadUrl(entityKind, entityId, fileUrl, fileName)
      : getFileDownloadUrl(fileUrl, fileName);
  const previewSrc = getEntityPreviewUrl(entityKind, entityId, fileUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="glass-window flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px]">
        <div className="flex items-center justify-between gap-4 border-b border-white/15 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-white/70">
              {fileType === 'pdf' && <FileText className="h-3.5 w-3.5 text-amber-300" />}
              {fileType === 'audio' && <Headphones className="h-3.5 w-3.5 text-amber-300" />}
              {fileType === 'video' && <Video className="h-3.5 w-3.5 text-amber-300" />}
              <span className="font-semibold text-amber-200">{fileType.toUpperCase()}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{fileName}</span>
            </div>
            <h3 className="mt-0.5 truncate text-lg font-semibold text-white">{title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={downloadHref}
              download={fileName}
              className="glass-btn-secondary px-3.5 py-2"
            >
              <Download className="h-3.5 w-3.5" />
              <span>አውርድ</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="ዝጋ"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-950/35 p-6">
          {description && (
            <p className="mb-4 text-sm leading-relaxed text-white/80">{description}</p>
          )}

          {fileType === 'pdf' && (
            <div className="overflow-hidden rounded-2xl border border-white/20 bg-white">
              <iframe
                src={previewSrc}
                title={title}
                className="h-[60vh] w-full"
              />
            </div>
          )}

          {fileType === 'audio' && (
            <div className="glass-card flex flex-col items-center justify-center rounded-2xl px-6 py-12">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-300/30 bg-amber-400/20 text-amber-200">
                <Headphones className="h-7 w-7" />
              </div>
              <p className="mb-4 text-sm font-medium text-white">{fileName}</p>
              <audio controls src={previewSrc} className="w-full max-w-lg" />
            </div>
          )}

          {fileType === 'video' && (
            <div className="overflow-hidden rounded-2xl border border-white/20 bg-zinc-950">
              <video controls src={previewSrc} className="max-h-[60vh] w-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
