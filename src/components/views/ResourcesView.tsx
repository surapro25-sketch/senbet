import React, { useEffect, useState } from 'react';
import { Download, Eye, FileText, Headphones, Plus, Trash2, Upload, Video } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { apiFetch, getEntityDownloadUrl, uploadFileToGoogleDriveIfConfigured } from '../../utils/api';
import { DIVISIONS, getDivisionLabel, getGradeLabel, GRADES, ROLE_LABELS } from '../../utils/school';
import type { DivisionId, EducationalResource, ResourceType, UserRecord } from '../../types';
import { MediaPreviewModal } from '../MediaPreviewModal';

interface ResourcesViewProps {
  currentUser: UserRecord;
}

export function ResourcesView({ currentUser }: ResourcesViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const [resources, setResources] = useState<EducationalResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | ResourceType>('all');
  const [search, setSearch] = useState('');

  // Upload form
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDivision, setTargetDivision] = useState<'all' | DivisionId>('all');
  const [targetGrade, setTargetGrade] = useState<string>(
    currentUser.role === 'teacher' && currentUser.assignedGrade ? String(currentUser.assignedGrade) : ''
  );
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Preview modal
  const [previewItem, setPreviewItem] = useState<EducationalResource | null>(null);

  const isReceiver = currentUser.role === 'student';
  const canUpload = ['head', 'teacher', 'dept_head'].includes(currentUser.role);

  async function loadResources() {
    setLoading(true);
    try {
      const data = await apiFetch<{ resources: EducationalResource[] }>('/api/resources');
      const validResources = Array.isArray(data?.resources)
        ? data.resources.filter((r): r is EducationalResource => Boolean(r && typeof r.id === 'number'))
        : [];
      setResources(validResources);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResources();
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!file) {
      setError('እባክዎ PDF፣ ኦዲዮ ወይም ቪዲዮ ፋይል ይምረጡ።');
      return;
    }

    setUploading(true);
    setUploadProgress(null);
    try {
      const driveUpload = await uploadFileToGoogleDriveIfConfigured(file, setUploadProgress);
      let res: { resource?: EducationalResource };

      if (driveUpload) {
        res = await apiFetch<{ resource?: EducationalResource }>('/api/resources', {
          method: 'POST',
          body: JSON.stringify({
            title,
            description,
            targetDivision,
            targetGrade: targetGrade || null,
            ...driveUpload,
          }),
        });
        setUploadProgress(100);
      } else {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('targetDivision', targetDivision);
        if (targetGrade) formData.append('targetGrade', targetGrade);
        formData.append('file', file);

        res = await apiFetch<{ resource?: EducationalResource }>('/api/resources', {
          method: 'POST',
          body: formData,
        });
      }

      if (res?.resource && typeof res.resource.id === 'number') {
        setResources((prev) => [
          res.resource!,
          ...prev.filter((r): r is EducationalResource => Boolean(r && typeof r.id === 'number')),
        ]);
      } else {
        await loadResources();
      }
      setTitle('');
      setDescription('');
      setFile(null);
      setShowUpload(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiFetch(`/api/resources/${id}`, { method: 'DELETE' });
      setResources((prev) => prev.filter((r) => r && r.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  }

  const filtered = resources.filter((r) => {
    if (!r || typeof r.id !== 'number') return false;
    if (!isReceiver && typeFilter !== 'all' && r.resourceType !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (r.title || '').toLowerCase().includes(q) ||
        (r.fileName || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (!isReceiver && (r.uploaderName || '').toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">የትምህርት ግብአቶች (PDF፣ ኦዲዮ እና ቪዲዮ)</h2>
          <p className="mt-0.5 text-xs text-white/70">
            {currentUser.role === 'student'
              ? `ለ${getGradeLabel(currentUser.assignedGrade)} እና ለሁሉም ክፍሎች የተለቀቁ የትምህርት መርጃዎች`
              : 'ለተማሪዎች የሚተላለፉ የትምህርት ሰነዶች፣ የድምጽ ትምህርቶችና ቪዲዮዎች'}
          </p>
        </div>

        {canUpload && (
          <button
            type="button"
            onClick={() => setShowUpload((v) => !v)}
            className="glass-btn-primary"
          >
            <Plus className="h-4 w-4" />
            <span>{showUpload ? 'ቅጹን ዝጋ' : 'አዲስ ግብአት ጫን'}</span>
          </button>
        )}
      </div>

      {showUpload && canUpload && (
        <form
          onSubmit={handleUpload}
          className="glass-card rounded-2xl p-6 space-y-4"
        >
          <div className="border-b border-white/15 pb-3">
            <h3 className="text-sm font-bold text-white">አዲስ የትምህርት ግብአት መጫኛ</h3>
            <p className="text-xs text-white/65">PDF፣ Audio (MP3/WAV/M4A) ወይም Video (MP4/WEBM) ፋይል ይምረጡ</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-white/80">የትምህርቱ ርዕስ</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ለምሳሌ፡ የመጽሐፍ ቅዱስ ጥናት ክፍል 2"
                className="glass-input mt-1.5 w-full px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80">ፋይል ይምረጡ (PDF / Audio / Video)</label>
              <input
                type="file"
                required
                accept=".pdf,audio/*,video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="glass-input mt-1.5 block w-full px-3 py-1.5 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1 file:text-xs file:font-semibold file:text-zinc-950"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80">የሚደርስበት ክፍለ-ደረጃ</label>
              <select
                value={targetDivision}
                onChange={(e) => {
                  setTargetDivision(e.target.value as 'all' | DivisionId);
                  setTargetGrade('');
                }}
                className="glass-input mt-1.5 w-full px-3.5 py-2 text-sm"
              >
                <option value="all" className="bg-slate-900 text-white">
                  ሁሉም ክፍሎች (ወጣኒ፣ ማእከላዊ፣ ወጣት)
                </option>
                {DIVISIONS.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                    {d.label} ({d.rangeLabel})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80">የተወሰነ ክፍል (አማራጭ)</label>
              <select
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value)}
                className="glass-input mt-1.5 w-full px-3.5 py-2 text-sm"
              >
                <option value="" className="bg-slate-900 text-white">
                  በክፍለ-ደረጃው ለሁሉም
                </option>
                {GRADES.map((g) => (
                  <option key={g} value={g} className="bg-slate-900 text-white">
                    {getGradeLabel(g)}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-white/80">አጭር ማብራሪያ</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ስለ ትምህርቱ አጭር መግለጫ..."
                className="glass-input mt-1.5 w-full px-3.5 py-2 text-sm"
              />
            </div>
          </div>

          {uploading && uploadProgress !== null && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-white/85">
                <span>ፋይሉን በመጫን ላይ...</span>
                <span className="font-mono font-semibold tabular-nums">{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-amber-300 transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-400/35 bg-red-950/60 px-3.5 py-2 text-xs text-red-100">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="glass-btn-secondary"
            >
              ተወው
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="glass-btn-primary"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>
                {uploading
                  ? uploadProgress !== null
                    ? `በመጫን ላይ (${uploadProgress}%)...`
                    : 'በመጫን ላይ...'
                  : 'ግብአቱን አስቀምጥ'}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Filter Toolbar */}
      <div className="glass-card flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
        {!isReceiver ? (
          <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1">
            {(['all', 'pdf', 'audio', 'video'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  typeFilter === t ? 'bg-white text-zinc-950 shadow-xs' : 'text-white/75 hover:text-white'
                }`}
              >
                {t === 'all' ? 'ሁሉም' : t.toUpperCase()}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs font-medium text-white/75">ለማውረድ የተዘጋጁ ፋይሎች</p>
        )}

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isReceiver ? 'በፋይል ስም ወይም በመግለጫ ፈልግ...' : 'በርዕስ ወይም በመምህር ስም ፈልግ...'}
          className="glass-input w-full max-w-xs px-3.5 py-2 text-xs"
        />
      </div>

      {/* Resource List */}
      {loading ? (
        <div className="glass-card rounded-2xl p-10 text-center text-sm text-white/70">
          የትምህርት ግብአቶችን በመጫን ላይ...
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <p className="text-sm font-medium text-white">ምንም የትምህርት ግብአት አልተገኘም።</p>
          <p className="mt-1 text-xs text-white/65">
            {canUpload ? 'ከላይ "አዲስ ግብአት ጫን" የሚለውን በመጫን PDF፣ Audio ወይም Video ያስገቡ።' : 'መምህራን አዲስ ግብአት ሲለቁ እዚህ ይታያሉ።'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((item) => {
            const downloadHref = getEntityDownloadUrl('resource', item.id, item.fileUrl, item.fileName);
            if (isReceiver) {
              return (
                <motion.div
                  key={item.id}
                  whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                  transition={{ duration: 0.16 }}
                  className="glass-card flex flex-col justify-between gap-4 rounded-2xl p-5"
                >
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white">{item.title}</h3>
                    {item.fileName && (
                      <p className="mt-1 truncate text-xs font-medium text-white/70">{item.fileName}</p>
                    )}
                    {item.description && (
                      <p className="mt-2 text-xs leading-relaxed text-white/80">{item.description}</p>
                    )}
                  </div>

                  <div className="flex justify-end border-t border-white/15 pt-3">
                    <a
                      href={downloadHref}
                      download={item.fileName}
                      className="glass-btn-primary px-4 py-2"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>አውርድ</span>
                    </a>
                  </div>
                </motion.div>
              );
            }

            const canDelete = currentUser.role === 'head' || item.uploadedBy === currentUser.id;
            return (
              <motion.div
                key={item.id}
                whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                transition={{ duration: 0.16 }}
                className="glass-card flex flex-col justify-between rounded-2xl p-5"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-white/70">
                    {item.resourceType === 'pdf' && <FileText className="h-3.5 w-3.5 text-amber-300" />}
                    {item.resourceType === 'audio' && <Headphones className="h-3.5 w-3.5 text-emerald-300" />}
                    {item.resourceType === 'video' && <Video className="h-3.5 w-3.5 text-sky-300" />}
                    <span className="font-semibold text-white">{item.resourceType.toUpperCase()}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {item.targetGrade
                        ? getGradeLabel(item.targetGrade)
                        : getDivisionLabel(item.targetDivision)}
                    </span>
                  </div>

                  <h3 className="mt-2 text-base font-bold text-white">{item.title}</h3>
                  {item.fileName && (
                    <p className="mt-0.5 truncate text-xs text-white/65">{item.fileName}</p>
                  )}
                  {item.description && (
                    <p className="mt-1.5 text-xs leading-relaxed text-white/75">{item.description}</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-3">
                  <div className="text-[11px] text-white/65">
                    <span>{item.uploaderName}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{ROLE_LABELS[item.uploaderRole]}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      className="glass-btn-primary px-3 py-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>{item.resourceType === 'pdf' ? 'ክፈት' : 'አጫውት'}</span>
                    </button>
                    <a
                      href={downloadHref}
                      download={item.fileName}
                      className="glass-btn-secondary px-3 py-1.5"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>አውርድ</span>
                    </a>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/15 text-red-200 hover:bg-red-500/30"
                        aria-label="ሰርዝ"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {previewItem && (
        <MediaPreviewModal
          isOpen={true}
          onClose={() => setPreviewItem(null)}
          title={previewItem.title}
          description={previewItem.description}
          fileType={previewItem.resourceType}
          fileUrl={previewItem.fileUrl}
          fileName={previewItem.fileName}
          entityKind="resource"
          entityId={previewItem.id}
        />
      )}
    </div>
  );
}
