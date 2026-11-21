import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { getDepartmentLabel, getGradeLabel, ROLE_LABELS } from '../../utils/school';
import type { UserRecord } from '../../types';

interface ProfileViewProps {
  currentUser: UserRecord;
  onProfileUpdated: (user: UserRecord) => void;
}

export function ProfileView({ currentUser, onProfileUpdated }: ProfileViewProps) {
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [educationLevel, setEducationLevel] = useState(currentUser.educationLevel || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg('');
    setErrorMsg('');
    setSaving(true);
    try {
      const payload: any = { fullName, educationLevel, phone };
      if (password.trim()) payload.password = password.trim();
      const res = await apiFetch<{ user: UserRecord }>(`/api/users/${currentUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      onProfileUpdated(res.user);
      setPassword('');
      setStatusMsg('የግል መገለጫዎ መረጃ በተሳካ ሁኔታ ተቀምጧል።');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">የግል መገለጫ (Profile)</h2>
        <p className="mt-0.5 text-xs text-white/70">
          የመለያ መረጃዎን እና የይለፍ ቃልዎን እዚህ ማየትና ማስተካከል ይችላሉ
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-3">
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div>
            <span className="text-white/60">የስራ ድርሻ / ሚና</span>
            <p className="mt-0.5 font-semibold text-white">{ROLE_LABELS[currentUser.role]}</p>
          </div>
          <div>
            <span className="text-white/60">የመግቢያ ስም (Username)</span>
            <p className="mt-0.5 font-mono font-semibold text-white">{currentUser.username}</p>
          </div>
          {(currentUser.role === 'student' || currentUser.role === 'teacher') && (
            <div>
              <span className="text-white/60">የተመደቡበት ክፍል</span>
              <p className="mt-0.5 font-semibold text-amber-200">
                {getGradeLabel(currentUser.assignedGrade)}
              </p>
            </div>
          )}
          {currentUser.role === 'teacher' && currentUser.subject && (
            <div>
              <span className="text-white/60">የሚያስተምሩት ትምህርት</span>
              <p className="mt-0.5 font-semibold text-emerald-200">
                {currentUser.subject}
              </p>
            </div>
          )}
          {currentUser.department && (
            <div>
              <span className="text-white/60">የስራ ክፍል</span>
              <p className="mt-0.5 font-semibold text-amber-200">
                {getDepartmentLabel(currentUser.department)}
              </p>
            </div>
          )}
        </div>
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

      <form onSubmit={handleSave} className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-white/80">ሙሉ ስም</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="glass-input mt-1 w-full px-3.5 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-white/80">የትምህርት ደረጃ</label>
            <input
              type="text"
              value={educationLevel}
              onChange={(e) => setEducationLevel(e.target.value)}
              className="glass-input mt-1 w-full px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/80">ስልክ ቁጥር</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="glass-input mt-1 w-full px-3.5 py-2 font-mono text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-white/80">
            አዲስ የይለፍ ቃል (መቀየር ካልፈለጉ ባዶ ይተዉት)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            className="glass-input mt-1 w-full px-3.5 py-2 text-sm"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="glass-btn-primary px-5"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{saving ? 'በማስቀመጥ ላይ...' : 'መገለጫ አስቀምጥ'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
