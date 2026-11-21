import React, { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Award,
  Check,
  ClipboardCheck,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Save,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { apiFetch } from '../../utils/api';
import { exportAttendancePdf, exportExamResultsPdf } from '../../utils/pdfExport';
import { ATTENDANCE_LABELS, getGradeLabel, GRADES } from '../../utils/school';
import type { AttendanceRecord, AttendanceStatus, ExamResult, UserRecord } from '../../types';

interface ExamsAttendanceViewProps {
  currentUser: UserRecord;
}

export function ExamsAttendanceView({ currentUser }: ExamsAttendanceViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const [activeSubTab, setActiveSubTab] = useState<'exams' | 'attendance'>('exams');
  const [exams, setExams] = useState<ExamResult[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<UserRecord[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number>(
    currentUser.role === 'teacher' && currentUser.assignedGrade ? currentUser.assignedGrade : 0
  );
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // New exam form
  const [examStudentId, setExamStudentId] = useState('');
  const [subject, setSubject] = useState(currentUser.subject || '');
  const [examTitle, setExamTitle] = useState('');
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [term, setTerm] = useState('1ኛ መንፈቅ ዓመት');
  const [remarks, setRemarks] = useState('');

  // Edit exam inline modal
  const [editingExam, setEditingExam] = useState<ExamResult | null>(null);

  // Daily Attendance state
  const [attDate, setAttDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [draftAttendance, setDraftAttendance] = useState<Record<number, { status: AttendanceStatus; note: string }>>({});
  const [savingAtt, setSavingAtt] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<'exams' | 'attendance' | null>(null);

  const canManage = currentUser.role === 'head' || currentUser.role === 'teacher';

  async function loadAll() {
    setLoading(true);
    try {
      const [examRes, attRes] = await Promise.all([
        apiFetch<{ exams: ExamResult[] }>('/api/exams'),
        apiFetch<{ attendance: AttendanceRecord[] }>('/api/attendance'),
      ]);
      setExams(examRes.exams);
      setAttendance(attRes.attendance);

      if (canManage) {
        const usersRes = await apiFetch<{ users: UserRecord[] }>('/api/users');
        const onlyStudents = usersRes.users.filter((u) => u.role === 'student');
        setStudents(onlyStudents);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Filter students based on selectedGrade (for Head) or teacher's assignedGrade
  const visibleStudents = students.filter((s) => {
    if (currentUser.role === 'teacher') return s.assignedGrade === currentUser.assignedGrade;
    if (selectedGrade > 0) return s.assignedGrade === selectedGrade;
    return true;
  });

  // Initialize draft attendance map whenever visibleStudents, attDate, or attendance list changes
  useEffect(() => {
    const next: Record<number, { status: AttendanceStatus; note: string }> = {};
    for (const s of visibleStudents) {
      const existing = attendance.find((a) => a.studentId === s.id && a.date === attDate);
      next[s.id] = {
        status: existing ? existing.status : 'present',
        note: existing ? existing.note : '',
      };
    }
    setDraftAttendance(next);
  }, [attDate, students, selectedGrade, attendance.length]);

  const visibleExams = exams.filter((e) => {
    if (currentUser.role === 'head' && selectedGrade > 0) return e.grade === selectedGrade;
    return true;
  });

  const visibleAttendanceHistory = attendance.filter((a) => {
    if (currentUser.role === 'head' && selectedGrade > 0) return a.grade === selectedGrade;
    return true;
  });

  const avgScorePct =
    visibleExams.length > 0
      ? Math.round(
          visibleExams.reduce((acc, item) => acc + (item.maxScore > 0 ? (item.score / item.maxScore) * 100 : 0), 0) /
            visibleExams.length
        )
      : 0;

  const attendanceRatePct =
    visibleAttendanceHistory.length > 0
      ? Math.round(
          (visibleAttendanceHistory.filter((a) => a.status === 'present' || a.status === 'late').length /
            visibleAttendanceHistory.length) *
            100
        )
      : 0;

  const kpiCards = [
    ...(canManage
      ? [
          {
            title: 'የክፍሉ ተማሪዎች',
            value: visibleStudents.length,
            sub: currentUser.role === 'teacher' ? getGradeLabel(currentUser.assignedGrade) : 'በተመረጠው ክፍል',
            icon: Users,
            gradient: 'from-amber-400 to-orange-500',
            trendColor: 'text-amber-200',
          },
        ]
      : []),
    {
      title: 'የተመዘገቡ ፈተናዎች',
      value: visibleExams.length,
      sub: 'የፈተና ውጤት መዝገብ',
      icon: FileSpreadsheet,
      gradient: 'from-sky-400 to-indigo-500',
      trendColor: 'text-sky-200',
    },
    {
      title: 'አማካይ የፈተና ውጤት',
      value: `${avgScorePct}%`,
      sub: 'አማካይ አፈጻጸም',
      icon: Award,
      gradient: 'from-emerald-400 to-teal-500',
      trendColor: 'text-emerald-300',
    },
    {
      title: 'የአቴንዳንስ መገኘት',
      value: `${attendanceRatePct}%`,
      sub: `${visibleAttendanceHistory.length} ጠቅላላ መዝገቦች`,
      icon: ClipboardCheck,
      gradient: 'from-rose-400 to-amber-500',
      trendColor: 'text-emerald-300',
    },
  ];

  async function handleAddExam(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await apiFetch<{ exam: ExamResult }>('/api/exams', {
        method: 'POST',
        body: JSON.stringify({
          studentId: Number(examStudentId),
          subject,
          examTitle,
          score: Number(score),
          maxScore: Number(maxScore),
          term,
          remarks,
        }),
      });
      setExams((prev) => [res.exam, ...prev]);
      setScore('');
      setRemarks('');
      setStatusMsg('የፈተና ውጤቱ በተሳካ ሁኔታ ተመዝግቧል።');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleUpdateExam(e: React.FormEvent) {
    e.preventDefault();
    if (!editingExam) return;
    setErrorMsg('');
    try {
      const res = await apiFetch<{ exam: ExamResult }>(`/api/exams/${editingExam.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          subject: editingExam.subject,
          examTitle: editingExam.examTitle,
          score: Number(editingExam.score),
          maxScore: Number(editingExam.maxScore),
          term: editingExam.term,
          remarks: editingExam.remarks,
        }),
      });
      setExams((prev) => prev.map((x) => (x.id === res.exam.id ? res.exam : x)));
      setEditingExam(null);
      setStatusMsg('የፈተና ውጤቱ ተስተካክሏል።');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleDeleteExam(id: number) {
    try {
      await apiFetch(`/api/exams/${id}`, { method: 'DELETE' });
      setExams((prev) => prev.filter((x) => x.id !== id));
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleSaveBulkAttendance() {
    setErrorMsg('');
    setStatusMsg('');
    if (visibleStudents.length === 0) return;

    setSavingAtt(true);
    try {
      const entries = visibleStudents.map((s) => ({
        studentId: s.id,
        status: draftAttendance[s.id]?.status || 'present',
        note: draftAttendance[s.id]?.note || '',
      }));
      await apiFetch('/api/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify({ date: attDate, entries }),
      });
      await loadAll();
      setStatusMsg(`የ${attDate} የእለት አቴንዳንስ ተመዝግቧል።`);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingAtt(false);
    }
  }

  async function handleExportExamsPdf() {
    setErrorMsg('');
    setStatusMsg('');
    setDownloadingPdf('exams');
    try {
      await exportExamResultsPdf(
        visibleExams,
        canManage ? gradeScopeLabel : currentUser.fullName,
        currentUser.fullName
      );
      setStatusMsg('የፈተና ውጤቱ በPDF ተዘጋጅቶ ወርዷል።');
    } catch (err: any) {
      setErrorMsg(err?.message || 'PDF ማውረድ አልተቻለም።');
    } finally {
      setDownloadingPdf(null);
    }
  }

  async function handleExportAttendancePdf() {
    setErrorMsg('');
    setStatusMsg('');
    setDownloadingPdf('attendance');
    try {
      await exportAttendancePdf(
        visibleAttendanceHistory,
        canManage ? gradeScopeLabel : currentUser.fullName,
        canManage ? attDate : '',
        currentUser.fullName
      );
      setStatusMsg('የአቴንዳንስ ሪፖርቱ በPDF ተዘጋጅቶ ወርዷል።');
    } catch (err: any) {
      setErrorMsg(err?.message || 'PDF ማውረድ አልተቻለም።');
    } finally {
      setDownloadingPdf(null);
    }
  }

  const gradeScopeLabel =
    currentUser.role === 'teacher'
      ? `${getGradeLabel(currentUser.assignedGrade)}${currentUser.subject ? ` - ${currentUser.subject}` : ''}`
      : selectedGrade > 0
      ? getGradeLabel(selectedGrade)
      : 'ሁሉም ክፍሎች (1ኛ - 12ኛ)';

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">የፈተና ውጤት እና የእለት አቴንዳንስ</h2>
          <p className="mt-0.5 text-xs text-white/70">
            {currentUser.role === 'student'
              ? `${getGradeLabel(currentUser.assignedGrade)} — የራስዎ የፈተና ውጤቶችና የአቴንዳንስ መዝገብ`
              : currentUser.role === 'teacher'
              ? `የተመደቡበት ክፍል፡ ${getGradeLabel(currentUser.assignedGrade)}`
              : 'የሁሉም ክፍሎች (1ኛ - 12ኛ) የተማሪዎች ውጤትና አቴንዳንስ መቆጣጠሪያ'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {currentUser.role === 'head' && (
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(Number(e.target.value))}
              className="glass-input px-3 py-2 text-xs font-medium"
            >
              <option value={0} className="bg-slate-900 text-white">
                ሁሉም ክፍሎች (1ኛ - 12ኛ)
              </option>
              {GRADES.map((g) => (
                <option key={g} value={g} className="bg-slate-900 text-white">
                  {getGradeLabel(g)}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setActiveSubTab('exams')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeSubTab === 'exams' ? 'bg-white text-zinc-950 shadow-xs' : 'text-white/80 hover:text-white'
              }`}
            >
              የፈተና ውጤት
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('attendance')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeSubTab === 'attendance' ? 'bg-white text-zinc-950 shadow-xs' : 'text-white/80 hover:text-white'
              }`}
            >
              የእለት አቴንዳንስ
            </button>
          </div>
        </div>
      </div>

      {/* Glass Stat Cards Strip (matches Glassy Dashboard V2 for Teacher & Head) */}
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${kpiCards.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: shouldReduceMotion ? 0 : idx * 0.05 }}
              whileHover={shouldReduceMotion ? undefined : { y: -5 }}
              className="glass-card rounded-2xl p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs text-white/70">{card.title}</p>
                  <h3 className="mt-1.5 font-mono text-2xl font-bold text-white tabular-nums">
                    {card.value}
                  </h3>
                  <p className={`mt-1.5 flex items-center gap-1 text-[11px] font-medium ${card.trendColor}`}>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{card.sub}</span>
                  </p>
                </div>
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${card.gradient} text-white shadow-lg`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {statusMsg && (
        <div className="rounded-xl border border-emerald-400/35 bg-emerald-950/60 px-4 py-2.5 text-xs font-medium text-emerald-100 backdrop-blur-md">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-red-400/35 bg-red-950/60 px-4 py-2.5 text-xs font-medium text-red-100 backdrop-blur-md">
          {errorMsg}
        </div>
      )}

      {activeSubTab === 'exams' && (
        <div className="space-y-6">
          {canManage && (
            <form
              onSubmit={handleAddExam}
              className="glass-card rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3">
                <h3 className="text-sm font-bold text-white">አዲስ የፈተና ውጤት መመዝገቢያ</h3>
                <button
                  type="button"
                  disabled={downloadingPdf === 'exams'}
                  onClick={handleExportExamsPdf}
                  className="glass-btn-secondary"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{downloadingPdf === 'exams' ? 'PDF በማዘጋጀት ላይ...' : 'ውጤት እንደ PDF አውርድ'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-white/75">ተማሪ ይምረጡ</label>
                  <select
                    required
                    value={examStudentId}
                    onChange={(e) => setExamStudentId(e.target.value)}
                    className="glass-input mt-1 w-full px-3 py-2 text-xs"
                  >
                    <option value="" className="bg-slate-900 text-white">
                      -- ተማሪ ይምረጡ --
                    </option>
                    {visibleStudents.map((s) => (
                      <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                        {s.fullName} ({getGradeLabel(s.assignedGrade)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/75">የትምህርት አይነት</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="ለምሳሌ፡ ግዕዝ / ታሪክ"
                    className="glass-input mt-1 w-full px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/75">የፈተና ስም</label>
                  <input
                    type="text"
                    required
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="የአጋማሽ / የማጠቃለያ"
                    className="glass-input mt-1 w-full px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/75">ያገኘው ውጤት</label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    required
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder="0 - 100"
                    className="glass-input mt-1 w-full px-3 py-2 font-mono text-xs tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/75">ከጠቅላላ (Max)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                    className="glass-input mt-1 w-full px-3 py-2 font-mono text-xs tabular-nums"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-white/75">መንፈቅ ዓመት</label>
                  <input
                    type="text"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="glass-input mt-1 w-full px-3 py-2 text-xs"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-white/75">አስተያየት</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="በጣም ጥሩ / ማሻሻል አለበት..."
                    className="glass-input mt-1 w-full px-3 py-2 text-xs"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="glass-btn-primary w-full"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>ውጤት መዝግብ</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Exam Results Table */}
          <div className="glass-card overflow-hidden rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 px-5 py-3.5">
              <h3 className="text-sm font-bold text-white">
                የተመዘገቡ የፈተና ውጤቶች ({visibleExams.length})
              </h3>
              {(canManage || visibleExams.length > 0) && (
                <button
                  type="button"
                  disabled={downloadingPdf === 'exams'}
                  onClick={handleExportExamsPdf}
                  className="glass-btn-secondary"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{downloadingPdf === 'exams' ? 'PDF በማዘጋጀት ላይ...' : 'ውጤት እንደ PDF አውርድ'}</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-white/65">በመጫን ላይ...</div>
            ) : visibleExams.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/65">ምንም የፈተና ውጤት አልተመዘገበም።</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/15 bg-white/5 text-white/75">
                    <tr>
                      <th className="px-4 py-3 font-semibold">ተማሪ</th>
                      <th className="px-4 py-3 font-semibold">ክፍል</th>
                      <th className="px-4 py-3 font-semibold">የትምህርት አይነት</th>
                      <th className="px-4 py-3 font-semibold">ፈተና</th>
                      <th className="px-4 py-3 font-semibold text-right">ውጤት</th>
                      <th className="px-4 py-3 font-semibold">አስተያየት</th>
                      {canManage && <th className="px-4 py-3 font-semibold text-right">ድርጊት</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {visibleExams.map((ex) => (
                      <tr key={ex.id} className="hover:bg-white/[0.04]">
                        <td className="px-4 py-3 font-semibold text-white">{ex.studentName}</td>
                        <td className="px-4 py-3 text-white/75">{getGradeLabel(ex.grade)}</td>
                        <td className="px-4 py-3 text-white/90">{ex.subject}</td>
                        <td className="px-4 py-3 text-white/75">{ex.examTitle}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-amber-200 tabular-nums">
                          {ex.score} / {ex.maxScore}
                        </td>
                        <td className="px-4 py-3 text-white/75">{ex.remarks || '—'}</td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingExam(ex)}
                                className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>አስተካክል</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteExam(ex.id)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-400/30 bg-red-500/15 text-red-200 hover:bg-red-500/30"
                                aria-label="ሰርዝ"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'attendance' && (
        <div className="space-y-6">
          {canManage && (
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">የእለት አቴንዳንስ መውሰጃ</h3>
                  <p className="text-xs text-white/65">ቀኑን መርጠው የእያንዳንዱን ተማሪ ሁኔታ ያስቀምጡ</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="date"
                    value={attDate}
                    onChange={(e) => setAttDate(e.target.value)}
                    className="glass-input px-3 py-1.5 font-mono text-xs [color-scheme:dark]"
                  />
                  <button
                    type="button"
                    disabled={savingAtt || visibleStudents.length === 0}
                    onClick={handleSaveBulkAttendance}
                    className="glass-btn-primary"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{savingAtt ? 'በማስቀመጥ ላይ...' : 'አቴንዳንስ አስቀምጥ'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={downloadingPdf === 'attendance'}
                    onClick={handleExportAttendancePdf}
                    className="glass-btn-secondary"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{downloadingPdf === 'attendance' ? 'PDF በማዘጋጀት ላይ...' : 'አቴንዳንስ እንደ PDF አውርድ'}</span>
                  </button>
                </div>
              </div>

              {visibleStudents.length === 0 ? (
                <p className="py-6 text-center text-xs text-white/65">
                  በዚህ ክፍል ውስጥ የተመዘገበ ተማሪ የለም።
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/15 bg-white/5 text-white/75">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">ተማሪ</th>
                        <th className="px-4 py-2.5 font-semibold">ክፍል</th>
                        <th className="px-4 py-2.5 font-semibold">ሁኔታ ({attDate})</th>
                        <th className="px-4 py-2.5 font-semibold">ማስታወሻ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {visibleStudents.map((st) => {
                        const val = draftAttendance[st.id] || { status: 'present', note: '' };
                        return (
                          <tr key={st.id} className="hover:bg-white/[0.04]">
                            <td className="px-4 py-2.5 font-semibold text-white">{st.fullName}</td>
                            <td className="px-4 py-2.5 text-white/75">{getGradeLabel(st.assignedGrade)}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1.5">
                                {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map((statusKey) => (
                                  <button
                                    key={statusKey}
                                    type="button"
                                    onClick={() =>
                                      setDraftAttendance((prev) => ({
                                        ...prev,
                                        [st.id]: { ...val, status: statusKey },
                                      }))
                                    }
                                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                                      val.status === statusKey
                                        ? statusKey === 'present'
                                          ? 'border-emerald-400 bg-emerald-500 text-white'
                                          : statusKey === 'absent'
                                          ? 'border-rose-400 bg-rose-500 text-white'
                                          : 'border-amber-300 bg-amber-500 text-zinc-950 font-semibold'
                                        : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'
                                    }`}
                                  >
                                    {ATTENDANCE_LABELS[statusKey]}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <input
                                type="text"
                                value={val.note}
                                onChange={(e) =>
                                  setDraftAttendance((prev) => ({
                                    ...prev,
                                    [st.id]: { ...val, note: e.target.value },
                                  }))
                                }
                                placeholder="አጭር ማስታወሻ..."
                                className="glass-input w-full px-2.5 py-1 text-xs"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Attendance History Table */}
          <div className="glass-card overflow-hidden rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 px-5 py-3.5">
              <h3 className="text-sm font-bold text-white">
                የተመዘገቡ የአቴንዳንስ ታሪኮች ({visibleAttendanceHistory.length})
              </h3>
              {(canManage || visibleAttendanceHistory.length > 0) && (
                <button
                  type="button"
                  disabled={downloadingPdf === 'attendance'}
                  onClick={handleExportAttendancePdf}
                  className="glass-btn-secondary"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{downloadingPdf === 'attendance' ? 'PDF በማዘጋጀት ላይ...' : 'አቴንዳንስ እንደ PDF አውርድ'}</span>
                </button>
              )}
            </div>

            {visibleAttendanceHistory.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/65">ምንም አቴንዳንስ አልተመዘገበም።</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/15 bg-white/5 text-white/75">
                    <tr>
                      <th className="px-4 py-3 font-semibold">ቀን</th>
                      <th className="px-4 py-3 font-semibold">ተማሪ</th>
                      <th className="px-4 py-3 font-semibold">ክፍል</th>
                      <th className="px-4 py-3 font-semibold">ሁኔታ</th>
                      <th className="px-4 py-3 font-semibold">ማስታወሻ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {visibleAttendanceHistory.map((rec) => (
                      <tr key={rec.id} className="hover:bg-white/[0.04]">
                        <td className="px-4 py-3 font-mono text-white/80 tabular-nums">{rec.date}</td>
                        <td className="px-4 py-3 font-semibold text-white">{rec.studentName}</td>
                        <td className="px-4 py-3 text-white/75">{getGradeLabel(rec.grade)}</td>
                        <td className="px-4 py-3 font-semibold">
                          <span
                            className={
                              rec.status === 'present'
                                ? 'text-emerald-300'
                                : rec.status === 'absent'
                                ? 'text-rose-300'
                                : 'text-amber-300'
                            }
                          >
                            {ATTENDANCE_LABELS[rec.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/70">{rec.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Exam Modal (for Teacher in own grade & Head across all grades) */}
      {editingExam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleUpdateExam}
            className="glass-window w-full max-w-lg rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">የፈተና ውጤት ማስተካከያ</h3>
                <p className="text-xs text-white/70">{editingExam.studentName}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingExam(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-white/80">የትምህርት አይነት</label>
                <input
                  type="text"
                  required
                  value={editingExam.subject}
                  onChange={(e) => setEditingExam({ ...editingExam, subject: e.target.value })}
                  className="glass-input mt-1 w-full px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/80">የፈተና ስም</label>
                <input
                  type="text"
                  required
                  value={editingExam.examTitle}
                  onChange={(e) => setEditingExam({ ...editingExam, examTitle: e.target.value })}
                  className="glass-input mt-1 w-full px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/80">ውጤት</label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  required
                  value={editingExam.score}
                  onChange={(e) => setEditingExam({ ...editingExam, score: Number(e.target.value) })}
                  className="glass-input mt-1 w-full px-3 py-2 font-mono text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/80">ከጠቅላላ</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editingExam.maxScore}
                  onChange={(e) => setEditingExam({ ...editingExam, maxScore: Number(e.target.value) })}
                  className="glass-input mt-1 w-full px-3 py-2 font-mono text-xs tabular-nums"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-white/80">አስተያየት</label>
                <input
                  type="text"
                  value={editingExam.remarks}
                  onChange={(e) => setEditingExam({ ...editingExam, remarks: e.target.value })}
                  className="glass-input mt-1 w-full px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingExam(null)}
                className="glass-btn-secondary"
              >
                ተወው
              </button>
              <button
                type="submit"
                className="glass-btn-primary"
              >
                <Check className="h-3.5 w-3.5" />
                <span>ለውጡን አስቀምጥ</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
