import React, { useEffect, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import {
  DEFAULT_DEPARTMENTS,
  DIVISIONS,
  formatMessageTarget,
  getGradeLabel,
  GRADES,
  ROLE_LABELS,
  syncDepartmentsRegistry,
} from '../../utils/school';
import type { DepartmentRecord, TargetedMessage, UserRecord } from '../../types';

interface MessagesViewProps {
  currentUser: UserRecord;
}

export function MessagesView({ currentUser }: MessagesViewProps) {
  const [messages, setMessages] = useState<TargetedMessage[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>(DEFAULT_DEPARTMENTS);
  const [loading, setLoading] = useState(true);
  const [targetType, setTargetType] = useState<'all' | 'division' | 'grade' | 'department' | 'teachers'>('division');
  const [targetValue, setTargetValue] = useState('wetani');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Head, Member Admin Head, and Member Admin Members can broadcast targeted messages to any division/department!
  const canBroadcast =
    currentUser.role === 'head' ||
    ((currentUser.role === 'dept_head' || currentUser.role === 'dept_member') &&
      currentUser.department === 'member_admin');

  async function loadMessages() {
    setLoading(true);
    try {
      const [msgRes, deptRes] = await Promise.all([
        apiFetch<{ messages: TargetedMessage[] }>('/api/messages'),
        apiFetch<{ departments: DepartmentRecord[] }>('/api/departments').catch(() => ({
          departments: DEFAULT_DEPARTMENTS,
        })),
      ]);
      setMessages(msgRes.messages);
      setDepartments(deptRes.departments);
      syncDepartmentsRegistry(deptRes.departments);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();
  }, []);

  function handleTargetTypeChange(nextType: typeof targetType) {
    setTargetType(nextType);
    if (nextType === 'all') setTargetValue('all');
    else if (nextType === 'teachers') setTargetValue('teachers');
    else if (nextType === 'division') setTargetValue('wetani');
    else if (nextType === 'grade') setTargetValue('1');
    else if (nextType === 'department') setTargetValue('choir');
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    setSending(true);
    try {
      const res = await apiFetch<{ message: TargetedMessage }>('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ targetType, targetValue, title, body }),
      });
      setMessages((prev) => [res.message, ...prev]);
      setTitle('');
      setBody('');
      setStatusMsg('መልእክቱ ለተመረጠው ክፍል በተሳካ ሁኔታ ተላልፏል።');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">የክፍላት መልእክቶችና ማስታወቂያዎች</h2>
        <p className="mt-0.5 text-xs text-white/70">
          {canBroadcast
            ? 'ለሁሉም ክፍላት (ወጣኒ፣ ማእከላዊ፣ ወጣት፣ 1ኛ-12ኛ ክፍል ወይም 5ቱ የስራ ክፍሎች) ተለይተው መልእክት ያስተላልፉ'
            : 'ወደ እርስዎ ክፍል የተላለፉ መልእክቶችና ማስታወቂያዎች'}
        </p>
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

      {canBroadcast && (
        <form
          onSubmit={handleSend}
          className="glass-card rounded-2xl p-6 space-y-4"
        >
          <div className="border-b border-white/15 pb-3">
            <h3 className="text-sm font-bold text-white">
              ለተለየ ክፍል መልእክት ማስተላለፊያ
            </h3>
            <p className="text-xs text-white/65">
              የሰንበት ትምህርት ቤት ሀላፊ፣ የአባላት አስተዳደር ሀላፊ እና የአባላት አስተዳደር አባላት ለየክፍሉ ተለይተው መልእክት መላክ ይችላሉ
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-white/80">የተቀባይ ክፍል አይነት</label>
              <select
                value={targetType}
                onChange={(e) => handleTargetTypeChange(e.target.value as any)}
                className="glass-input mt-1 w-full px-3 py-2 text-xs"
              >
                <option value="division" className="bg-slate-900 text-white">በክፍለ-ደረጃ (ወጣኒ / ማእከላዊ / ወጣት)</option>
                <option value="grade" className="bg-slate-900 text-white">በተወሰነ የትምህርት ክፍል (1ኛ - 12ኛ)</option>
                <option value="department" className="bg-slate-900 text-white">በስራ ክፍል (ትምህርት፣ መዝሙር፣ ንብረት...)</option>
                <option value="teachers" className="bg-slate-900 text-white">ለሁሉም መምህራን</option>
                <option value="all" className="bg-slate-900 text-white">ለሁሉም የሰንበት ትምህርት ቤት ክፍላት</option>
              </select>
            </div>

            {targetType === 'division' && (
              <div>
                <label className="block text-xs font-semibold text-white/80">ክፍለ-ደረጃ ይምረጡ</label>
                <select
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className="glass-input mt-1 w-full px-3 py-2 text-xs"
                >
                  {DIVISIONS.map((d) => (
                    <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                      {d.label} ({d.rangeLabel})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {targetType === 'grade' && (
              <div>
                <label className="block text-xs font-semibold text-white/80">ክፍል ይምረጡ</label>
                <select
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className="glass-input mt-1 w-full px-3 py-2 text-xs"
                >
                  {GRADES.map((g) => (
                    <option key={g} value={String(g)} className="bg-slate-900 text-white">
                      {getGradeLabel(g)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {targetType === 'department' && (
              <div>
                <label className="block text-xs font-semibold text-white/80">የስራ ክፍል ይምረጡ</label>
                <select
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
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

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-white/80">የመልእክቱ ርዕስ</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="የመልእክቱ ርዕስ..."
                className="glass-input mt-1 w-full px-3 py-2 text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-white/80">መልእክት</label>
              <textarea
                rows={3}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="ለተመረጠው ክፍል የሚተላለፍ መልእክት..."
                className="glass-input mt-1 w-full px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending}
              className="glass-btn-primary"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{sending ? 'በመላክ ላይ...' : 'መልእክቱን ላክ'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Messages Feed */}
      <div className="space-y-3">
        {loading ? (
          <div className="glass-card rounded-2xl p-8 text-center text-xs text-white/65">
            መልእክቶችን በመጫን ላይ...
          </div>
        ) : messages.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center text-xs text-white/65">
            <MessageSquare className="mx-auto mb-2 h-6 w-6 text-white/50" />
            <p>ወደ እርስዎ ክፍል የተላከ መልእክት የለም።</p>
          </div>
        ) : (
          messages.map((msg) => (
            <article key={msg.id} className="glass-card rounded-2xl p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/65">
                <span className="font-semibold text-amber-200">
                  {formatMessageTarget(msg.targetType, msg.targetValue)}
                </span>
                <span aria-hidden="true">·</span>
                <span>ላኪ፡ {msg.senderName} ({ROLE_LABELS[msg.senderRole]})</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{msg.createdAt.slice(0, 10)}</span>
              </div>
              <h3 className="mt-1.5 text-base font-bold text-white">{msg.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/85 whitespace-pre-line">
                {msg.body}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
