import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, Eye, FileText, Headphones, Send, Trash2, Upload, Video } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { apiFetch, getEntityDownloadUrl, uploadFileToGoogleDriveIfConfigured, type FileEntityKind } from '../../utils/api';
import { DEFAULT_DEPARTMENTS, doesDepartmentAllowMedia, getDepartmentLabel, syncDepartmentsRegistry } from '../../utils/school';
import type {
  DepartmentId,
  DepartmentMaterial,
  DepartmentRecord,
  DepartmentReport,
  Directive,
  UserRecord,
} from '../../types';
import { MediaPreviewModal } from '../MediaPreviewModal';

interface DepartmentsViewProps {
  currentUser: UserRecord;
}

export function DepartmentsView({ currentUser }: DepartmentsViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const [subTab, setSubTab] = useState<'directives' | 'materials' | 'reports'>(
    currentUser.role === 'dept_member' ? 'directives' : 'reports'
  );
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [materials, setMaterials] = useState<DepartmentMaterial[]>([]);
  const [reports, setReports] = useState<DepartmentReport[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>(DEFAULT_DEPARTMENTS);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Directive composer (Head -> Dept Head, Dept Head -> Dept Members)
  const [dirTargetDept, setDirTargetDept] = useState<DepartmentId>('education');
  const [dirTitle, setDirTitle] = useState('');
  const [dirBody, setDirBody] = useState('');

  // Material upload (Dept Head -> Dept Members: PDF only except Choir!)
  const [matTitle, setMatTitle] = useState('');
  const [matDesc, setMatDesc] = useState('');
  const [matFile, setMatFile] = useState<File | null>(null);
  const [uploadingMat, setUploadingMat] = useState(false);
  const [matUploadProgress, setMatUploadProgress] = useState<number | null>(null);

  // Report submit (Dept Head -> Head: text + PDF)
  const [repTitle, setRepTitle] = useState('');
  const [repContent, setRepContent] = useState('');
  const [repPdf, setRepPdf] = useState<File | null>(null);
  const [submittingRep, setSubmittingRep] = useState(false);
  const [repUploadProgress, setRepUploadProgress] = useState<number | null>(null);

  // Preview modal
  const [previewItem, setPreviewItem] = useState<{
    title: string;
    description?: string;
    fileType: 'pdf' | 'audio' | 'video';
    fileUrl: string;
    fileName: string;
    entityKind: FileEntityKind;
    entityId: number;
  } | null>(null);

  const isHead = currentUser.role === 'head';
  const isDeptHead = currentUser.role === 'dept_head';
  const isReceiver = currentUser.role === 'dept_member';
  const isChoirHead = isDeptHead && doesDepartmentAllowMedia(currentUser.department);

  async function loadAll() {
    setLoading(true);
    try {
      const [dirRes, matRes, repRes, deptRes] = await Promise.all([
        apiFetch<{ directives: Directive[] }>('/api/directives'),
        apiFetch<{ materials: DepartmentMaterial[] }>('/api/dept-materials'),
        currentUser.role === 'dept_member'
          ? Promise.resolve({ reports: [] })
          : apiFetch<{ reports: DepartmentReport[] }>('/api/reports'),
        apiFetch<{ departments: DepartmentRecord[] }>('/api/departments').catch(() => ({
          departments: DEFAULT_DEPARTMENTS,
        })),
      ]);
      setDirectives(
        Array.isArray(dirRes?.directives)
          ? dirRes.directives.filter((d): d is Directive => Boolean(d && typeof d.id === 'number'))
          : []
      );
      setMaterials(
        Array.isArray(matRes?.materials)
          ? matRes.materials.filter((m): m is DepartmentMaterial => Boolean(m && typeof m.id === 'number'))
          : []
      );
      setReports(
        Array.isArray(repRes?.reports)
          ? repRes.reports.filter((r): r is DepartmentReport => Boolean(r && typeof r.id === 'number'))
          : []
      );
      setDepartments(deptRes.departments);
      syncDepartmentsRegistry(deptRes.departments);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSendDirective(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await apiFetch<{ directive?: Directive }>('/api/directives', {
        method: 'POST',
        body: JSON.stringify({
          targetDepartment: isHead ? dirTargetDept : currentUser.department,
          title: dirTitle,
          body: dirBody,
        }),
      });
      if (res?.directive && typeof res.directive.id === 'number') {
        setDirectives((prev) => [
          res.directive!,
          ...prev.filter((d): d is Directive => Boolean(d && typeof d.id === 'number')),
        ]);
      } else {
        await loadAll();
      }
      setDirTitle('');
      setDirBody('');
      setStatusMsg('ትዕዛዙ በተሳካ ሁኔታ ተልኳል።');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleAckDirective(id: number) {
    try {
      await apiFetch(`/api/directives/${id}`, { method: 'PATCH' });
      setDirectives((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'acknowledged' } : d))
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleUploadMaterial(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    if (!matFile) {
      setErrorMsg('እባክዎ ፋይል ይምረጡ።');
      return;
    }

    setUploadingMat(true);
    setMatUploadProgress(null);
    try {
      const driveUpload = await uploadFileToGoogleDriveIfConfigured(matFile, setMatUploadProgress);
      let res: { material?: DepartmentMaterial };

      if (driveUpload) {
        res = await apiFetch<{ material?: DepartmentMaterial }>('/api/dept-materials', {
          method: 'POST',
          body: JSON.stringify({
            title: matTitle,
            description: matDesc,
            ...driveUpload,
          }),
        });
        setMatUploadProgress(100);
      } else {
        const fd = new FormData();
        fd.append('title', matTitle);
        fd.append('description', matDesc);
        fd.append('file', matFile);

        res = await apiFetch<{ material?: DepartmentMaterial }>('/api/dept-materials', {
          method: 'POST',
          body: fd,
        });
      }

      if (res?.material && typeof res.material.id === 'number') {
        setMaterials((prev) => [
          res.material!,
          ...prev.filter((m): m is DepartmentMaterial => Boolean(m && typeof m.id === 'number')),
        ]);
      } else {
        await loadAll();
      }
      setMatTitle('');
      setMatDesc('');
      setMatFile(null);
      setStatusMsg('ፋይሉ ለክፍሉ አባላት ተልኳል።');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setUploadingMat(false);
      setMatUploadProgress(null);
    }
  }

  async function handleDeleteMaterial(id: number) {
    try {
      await apiFetch(`/api/dept-materials/${id}`, { method: 'DELETE' });
      setMaterials((prev) => prev.filter((m) => m && m.id !== id));
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');

    setSubmittingRep(true);
    setRepUploadProgress(null);
    try {
      const driveUpload = repPdf
        ? await uploadFileToGoogleDriveIfConfigured(repPdf, setRepUploadProgress)
        : null;
      let res: { report?: DepartmentReport };

      if (driveUpload) {
        res = await apiFetch<{ report?: DepartmentReport }>('/api/reports', {
          method: 'POST',
          body: JSON.stringify({
            title: repTitle,
            content: repContent,
            ...driveUpload,
          }),
        });
        setRepUploadProgress(100);
      } else {
        const fd = new FormData();
        fd.append('title', repTitle);
        fd.append('content', repContent);
        if (repPdf) fd.append('pdf', repPdf);

        res = await apiFetch<{ report?: DepartmentReport }>('/api/reports', {
          method: 'POST',
          body: fd,
        });
      }

      if (res?.report && typeof res.report.id === 'number') {
        setReports((prev) => [
          res.report!,
          ...prev.filter((r): r is DepartmentReport => Boolean(r && typeof r.id === 'number')),
        ]);
      } else {
        await loadAll();
      }
      setRepTitle('');
      setRepContent('');
      setRepPdf(null);
      setStatusMsg('ሪፖርቱ ለሰንበት ትምህርት ቤቱ ሀላፊ ተልኳል።');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingRep(false);
      setRepUploadProgress(null);
    }
  }

  async function handleMarkReportReviewed(id: number) {
    try {
      await apiFetch(`/api/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'reviewed' }),
      });
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'reviewed' } : r))
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  const subTabs: Array<{ id: 'reports' | 'directives' | 'materials'; label: string }> = [
    ...(currentUser.role !== 'dept_member'
      ? [{ id: 'reports' as const, label: 'ሪፖርቶች (ፅሁፍ እና PDF)' }]
      : []),
    { id: 'directives', label: 'ትዕዛዞች' },
    { id: 'materials', label: 'የክፍል ግብአቶች' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white drop-shadow-sm">
            {isHead
              ? 'የስራ ክፍላት አስተዳደር (ትዕዛዝ፣ ሪፖርት እና ግብአቶች)'
              : `${getDepartmentLabel(currentUser.department)} — የስራ እንቅስቃሴ`}
          </h2>
          <p className="mt-0.5 text-sm text-white/75">
            {isHead
              ? 'ለክፍል ተመዳቢዎች ትዕዛዝ ያስተላልፉ እንዲሁም የቀረቡ የፅሁፍና የPDF ሪፖርቶችን ይመልከቱ'
              : isDeptHead
              ? isChoirHead
                ? 'ለሀላፊው ሪፖርት ያቅርቡ፣ ትዕዛዝ ይቀበሉ፣ ለአባላት ትዕዛዝና PDF / ኦዲዮ / ቪዲዮ ይስጡ'
                : 'ለሀላፊው ሪፖርት ያቅርቡ፣ ትዕዛዝ ይቀበሉ፣ ለአባላት ትዕዛዝና የPDF ፋይሎችን ይስጡ'
              : 'ከክፍልዎ ሀላፊ የተላለፉ ትዕዛዞችንና የስራ ግብአቶችን ይመልከቱ'}
          </p>
        </div>

        <div className="glass-dock flex items-center gap-1 rounded-2xl p-1.5">
          {subTabs.map((tab) => {
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`relative rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active ? 'text-zinc-950' : 'text-white/75 hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={shouldReduceMotion ? undefined : 'deptSubTabPill'}
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-xl bg-white shadow-sm"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-2.5 text-xs font-medium text-emerald-100 backdrop-blur-md">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-2xl border border-red-300/30 bg-red-500/20 px-4 py-2.5 text-xs font-medium text-red-100 backdrop-blur-md">
          {errorMsg}
        </div>
      )}

      {/* SUBTAB 1: REPORTS (Dept Head -> Head) */}
      {subTab === 'reports' && currentUser.role !== 'dept_member' && (
        <div className="space-y-6">
          {isDeptHead && (
            <form
              onSubmit={handleSubmitReport}
              className="glass-card rounded-2xl p-6 space-y-4"
            >
              <div className="border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-white">
                  ለሰንበት ትምህርት ቤቱ ሀላፊ ሪፖርት ማቅረቢያ
                </h3>
                <p className="mt-0.5 text-xs text-white/65">
                  ሪፖርትዎን በፅሁፍ ያቅርቡ እና ካለ የPDF ፋይል አያይዘው ይላኩ
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-white/80">የሪፖርቱ ርዕስ</label>
                  <input
                    type="text"
                    required
                    value={repTitle}
                    onChange={(e) => setRepTitle(e.target.value)}
                    placeholder="ለምሳሌ፡ የወርሃዊ አገልግሎት ሪፖርት"
                    className="glass-input mt-1 w-full px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/80">
                    የPDF ፋይል ማያያዣ (አማራጭ)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => setRepPdf(e.target.files?.[0] || null)}
                    className="glass-input mt-1 block w-full px-3 py-1.5 text-xs text-white/85 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1 file:text-xs file:font-semibold file:text-zinc-950"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-white/80">የሪፖርቱ ዝርዝር (በፅሁፍ)</label>
                  <textarea
                    rows={3}
                    required
                    value={repContent}
                    onChange={(e) => setRepContent(e.target.value)}
                    placeholder="የክፍሉን የስራ ክንውንና ዝርዝር ሁኔታ እዚህ ይጻፉ..."
                    className="glass-input mt-1 w-full px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {submittingRep && repUploadProgress !== null && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/85">
                    <span>የPDF ፋይሉን በመጫን ላይ...</span>
                    <span className="font-mono font-semibold tabular-nums">{repUploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-amber-300 transition-all duration-200"
                      style={{ width: `${repUploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingRep}
                  className="glass-btn-primary"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>
                    {submittingRep
                      ? repUploadProgress !== null
                        ? `በመላክ ላይ (${repUploadProgress}%)...`
                        : 'በመላክ ላይ...'
                      : 'ሪፖርት ለሀላፊው ላክ'}
                  </span>
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {loading ? (
              <div className="glass-card rounded-2xl p-8 text-center text-xs text-white/65">
                በመጫን ላይ...
              </div>
            ) : reports.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center text-xs text-white/65">
                ምንም የቀረበ ሪፖርት የለም።
              </div>
            ) : (
              reports.map((rep) => (
                <div key={rep.id} className="glass-card rounded-2xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/65">
                        <span className="font-semibold text-amber-200">
                          {getDepartmentLabel(rep.department)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>አቅራቢ፡ {rep.submitterName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{rep.createdAt.slice(0, 10)}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            rep.status === 'reviewed'
                              ? 'font-semibold text-emerald-300'
                              : 'font-semibold text-amber-300'
                          }
                        >
                          {rep.status === 'reviewed' ? 'ታይቷል' : 'አዲስ (በመጠባበቅ ላይ)'}
                        </span>
                      </div>
                      <h4 className="mt-1.5 text-base font-bold text-white">{rep.title}</h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {rep.pdfUrl && rep.pdfName && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewItem({
                                title: rep.title,
                                description: rep.content,
                                fileType: 'pdf',
                                fileUrl: rep.pdfUrl!,
                                fileName: rep.pdfName!,
                                entityKind: 'report',
                                entityId: rep.id,
                              })
                            }
                            className="glass-btn-secondary px-3 py-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>PDF ክፈት</span>
                          </button>
                          <a
                            href={getEntityDownloadUrl('report', rep.id, rep.pdfUrl, rep.pdfName)}
                            download={rep.pdfName}
                            className="glass-btn-secondary px-3 py-1.5"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>አውርድ</span>
                          </a>
                        </>
                      )}
                      {isHead && rep.status !== 'reviewed' && (
                        <button
                          type="button"
                          onClick={() => handleMarkReportReviewed(rep.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/40 bg-emerald-500/25 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/35 whitespace-nowrap shrink-0"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>ታይቷል በል</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-white/85 whitespace-pre-line">
                    {rep.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: DIRECTIVES */}
      {subTab === 'directives' && (
        <div className="space-y-6">
          {(isHead || isDeptHead) && (
            <form
              onSubmit={handleSendDirective}
              className="glass-card rounded-2xl p-6 space-y-4"
            >
              <div className="border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-white">
                  {isHead
                    ? 'ለክፍል ሀላፊዎች (ተመዳቢዎች) ትዕዛዝ ማስተላለፊያ'
                    : `ለ${getDepartmentLabel(currentUser.department)} አባላት ትዕዛዝ ማስተላለፊያ`}
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {isHead && (
                  <div>
                    <label className="block text-xs font-semibold text-white/80">የሚላክለት ክፍል</label>
                    <select
                      value={dirTargetDept}
                      onChange={(e) => setDirTargetDept(e.target.value as DepartmentId)}
                      className="glass-input mt-1 w-full px-3 py-2 text-xs"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={isHead ? '' : 'sm:col-span-2'}>
                  <label className="block text-xs font-semibold text-white/80">የትዕዛዙ ርዕስ</label>
                  <input
                    type="text"
                    required
                    value={dirTitle}
                    onChange={(e) => setDirTitle(e.target.value)}
                    placeholder="የትዕዛዝ ርዕስ..."
                    className="glass-input mt-1 w-full px-3 py-2 text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-white/80">የትዕዛዝ ዝርዝር</label>
                  <textarea
                    rows={3}
                    required
                    value={dirBody}
                    onChange={(e) => setDirBody(e.target.value)}
                    placeholder="ለክፍሉ የሚተላለፈውን ትዕዛዝ እዚህ ይጻፉ..."
                    className="glass-input mt-1 w-full px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="glass-btn-primary"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>ትዕዛዝ አስተላልፍ</span>
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {loading ? (
              <div className="glass-card rounded-2xl p-8 text-center text-xs text-white/65">
                በመጫን ላይ...
              </div>
            ) : directives.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center text-xs text-white/65">
                ምንም የተላለፈ ትዕዛዝ የለም።
              </div>
            ) : (
              directives.map((dir) => (
                <div key={dir.id} className="glass-card rounded-2xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/65">
                        <span className="font-semibold text-amber-200">
                          {getDepartmentLabel(dir.targetDepartment)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {dir.targetScope === 'dept_head' ? 'ለክፍል ሀላፊ' : 'ለክፍል አባላት'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>ላኪ፡ {dir.senderName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{dir.createdAt.slice(0, 10)}</span>
                      </div>
                      <h4 className="mt-1.5 text-base font-bold text-white">{dir.title}</h4>
                    </div>

                    {dir.status === 'acknowledged' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>ተቀብያለሁ</span>
                      </span>
                    ) : (
                      ((isDeptHead && dir.targetScope === 'dept_head') ||
                        (currentUser.role === 'dept_member' && dir.targetScope === 'dept_members')) && (
                        <button
                          type="button"
                          onClick={() => handleAckDirective(dir.id)}
                          className="glass-btn-secondary px-3 py-1.5"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                          <span>ትዕዛዙን ተቀብያለሁ</span>
                        </button>
                      )
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-white/85 whitespace-pre-line">
                    {dir.body}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: DEPARTMENT MATERIALS (PDF only, except Choir = PDF + Audio + Video) */}
      {subTab === 'materials' && (
        <div className="space-y-6">
          {isDeptHead && (
            <form
              onSubmit={handleUploadMaterial}
              className="glass-card rounded-2xl p-6 space-y-4"
            >
              <div className="border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-white">
                  ለ{getDepartmentLabel(currentUser.department)} አባላት ግብአት መስጫ
                </h3>
                <p className="mt-0.5 text-xs text-white/65">
                  {isChoirHead
                    ? 'መዝሙር ክፍል ብቻ፡ PDF፣ ኦዲዮ (Audio) እና ቪዲዮ (Video) ፋይሎችን ለአባላት መስጠት ይችላሉ።'
                    : 'ለዚህ ክፍል አባላት መስጠት የሚፈቀደው የPDF ፋይል ብቻ ነው።'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-white/80">የፋይሉ ርዕስ</label>
                  <input
                    type="text"
                    required
                    value={matTitle}
                    onChange={(e) => setMatTitle(e.target.value)}
                    placeholder="ርዕስ ያስገቡ..."
                    className="glass-input mt-1 w-full px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/80">
                    {isChoirHead ? 'ፋይል ይምረጡ (PDF / Audio / Video)' : 'የPDF ፋይል ይምረጡ (PDF ብቻ)'}
                  </label>
                  <input
                    type="file"
                    required
                    accept={isChoirHead ? '.pdf,audio/*,video/*' : '.pdf,application/pdf'}
                    onChange={(e) => setMatFile(e.target.files?.[0] || null)}
                    className="glass-input mt-1 block w-full px-3 py-1.5 text-xs text-white/85 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1 file:text-xs file:font-semibold file:text-zinc-950"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-white/80">መግለጫ</label>
                  <input
                    type="text"
                    value={matDesc}
                    onChange={(e) => setMatDesc(e.target.value)}
                    placeholder="ስለ ፋይሉ አጭር ማብራሪያ..."
                    className="glass-input mt-1 w-full px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {uploadingMat && matUploadProgress !== null && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/85">
                    <span>ፋይሉን በመጫን ላይ...</span>
                    <span className="font-mono font-semibold tabular-nums">{matUploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-amber-300 transition-all duration-200"
                      style={{ width: `${matUploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploadingMat}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-zinc-950 shadow-sm transition-colors hover:bg-amber-300 disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>
                    {uploadingMat
                      ? matUploadProgress !== null
                        ? `በመጫን ላይ (${matUploadProgress}%)...`
                        : 'በመጫን ላይ...'
                      : 'ለአባላት ስጥ'}
                  </span>
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {loading ? (
              <div className="glass-card md:col-span-2 rounded-2xl p-8 text-center text-xs text-white/65">
                በመጫን ላይ...
              </div>
            ) : materials.length === 0 ? (
              <div className="glass-card md:col-span-2 rounded-2xl p-8 text-center text-xs text-white/65">
                ምንም የተላከ የክፍል ግብአት የለም።
              </div>
            ) : (
              materials.map((m) => {
                const downloadHref = getEntityDownloadUrl('material', m.id, m.fileUrl, m.fileName);
                if (isReceiver) {
                  return (
                    <motion.div
                      key={m.id}
                      whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="glass-card flex flex-col justify-between gap-4 rounded-2xl p-5 transition-colors hover:border-white/35 hover:bg-slate-950/50"
                    >
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-white">{m.title}</h4>
                        {m.fileName && (
                          <p className="mt-1 truncate text-xs font-medium text-white/70">{m.fileName}</p>
                        )}
                        {m.description && (
                          <p className="mt-2 text-xs leading-relaxed text-white/80">{m.description}</p>
                        )}
                      </div>

                      <div className="flex justify-end border-t border-white/15 pt-3">
                        <a
                          href={downloadHref}
                          download={m.fileName}
                          className="glass-btn-primary px-4 py-2"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>አውርድ</span>
                        </a>
                      </div>
                    </motion.div>
                  );
                }

                const canDelete = isHead || m.uploadedBy === currentUser.id;
                return (
                  <motion.div
                    key={m.id}
                    whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="glass-card flex flex-col justify-between rounded-2xl p-5 transition-colors hover:border-white/35 hover:bg-slate-950/50"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs text-white/65">
                        {m.fileType === 'pdf' && <FileText className="h-3.5 w-3.5 text-amber-300" />}
                        {m.fileType === 'audio' && <Headphones className="h-3.5 w-3.5 text-amber-300" />}
                        {m.fileType === 'video' && <Video className="h-3.5 w-3.5 text-amber-300" />}
                        <span className="font-semibold text-amber-200">{m.fileType.toUpperCase()}</span>
                        <span aria-hidden="true">·</span>
                        <span>{getDepartmentLabel(m.department)}</span>
                      </div>
                      <h4 className="mt-2 text-base font-bold text-white">{m.title}</h4>
                      {m.fileName && (
                        <p className="mt-0.5 truncate text-xs text-white/65">{m.fileName}</p>
                      )}
                      {m.description && (
                        <p className="mt-1.5 text-xs text-white/75">{m.description}</p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-3">
                      <span className="text-[11px] text-white/60">ላኪ፡ {m.uploaderName}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewItem({
                              title: m.title,
                              description: m.description,
                              fileType: m.fileType,
                              fileUrl: m.fileUrl,
                              fileName: m.fileName,
                              entityKind: 'material',
                              entityId: m.id,
                            })
                          }
                          className="glass-btn-primary px-3 py-1.5"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>{m.fileType === 'pdf' ? 'ክፈት' : 'አጫውት'}</span>
                        </button>
                        <a
                          href={downloadHref}
                          download={m.fileName}
                          className="glass-btn-secondary px-3 py-1.5"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>አውርድ</span>
                        </a>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMaterial(m.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-300/25 bg-red-500/15 text-red-200 transition-colors hover:bg-red-500/30"
                            aria-label="ሰርዝ"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}

      {previewItem && (
        <MediaPreviewModal
          isOpen={true}
          onClose={() => setPreviewItem(null)}
          title={previewItem.title}
          description={previewItem.description}
          fileType={previewItem.fileType}
          fileUrl={previewItem.fileUrl}
          fileName={previewItem.fileName}
          entityKind={previewItem.entityKind}
          entityId={previewItem.entityId}
        />
      )}
    </div>
  );
}
