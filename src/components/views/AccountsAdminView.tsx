import React, { useEffect, useState } from 'react';
import { Check, Edit3, Eye, EyeOff, FolderPlus, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import {
  DEFAULT_DEPARTMENTS,
  getDepartmentLabel,
  getGradeLabel,
  GRADES,
  ROLE_LABELS,
  syncDepartmentsRegistry,
} from '../../utils/school';
import type { DepartmentId, DepartmentRecord, UserRecord, UserRole } from '../../types';

interface AccountsAdminViewProps {
  currentUser: UserRecord;
  onProfileUpdated?: (user: UserRecord) => void;
}

export function AccountsAdminView({ currentUser, onProfileUpdated }: AccountsAdminViewProps) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>(DEFAULT_DEPARTMENTS);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [search, setSearch] = useState('');
  const [revealedPwdIds, setRevealedPwdIds] = useState<Record<number, boolean>>({});
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Create user modal / inline form
  const [showCreate, setShowCreate] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(
    currentUser.role === 'dept_head' ? 'dept_member' : 'teacher'
  );
  const [newGrade, setNewGrade] = useState<string>('1');
  const [newSubject, setNewSubject] = useState('');
  const [newDept, setNewDept] = useState<DepartmentId>(
    currentUser.department || 'education'
  );
  const [newAge, setNewAge] = useState('');
  const [newEduLevel, setNewEduLevel] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Inline Create New Department (for Head / ባዬ when assigning dept_head / dept_member)
  const [showCreateDeptInForm, setShowCreateDeptInForm] = useState(false);
  const [customDeptLabel, setCustomDeptLabel] = useState('');
  const [customDeptDesc, setCustomDeptDesc] = useState('');
  const [customDeptAllowsMedia, setCustomDeptAllowsMedia] = useState(false);
  const [creatingDept, setCreatingDept] = useState(false);

  // Edit user modal (Head)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [showCreateDeptInEdit, setShowCreateDeptInEdit] = useState(false);
  const [editCustomDeptLabel, setEditCustomDeptLabel] = useState('');
  const [editCustomDeptAllowsMedia, setEditCustomDeptAllowsMedia] = useState(false);

  const isHead = currentUser.role === 'head';
  const isDeptHead = currentUser.role === 'dept_head';
  const canCreate = isHead || isDeptHead;

  async function loadUsersAndDepts() {
    setLoading(true);
    try {
      const [usersRes, deptsRes] = await Promise.all([
        apiFetch<{ users: UserRecord[] }>('/api/users'),
        apiFetch<{ departments: DepartmentRecord[] }>('/api/departments').catch(() => ({
          departments: DEFAULT_DEPARTMENTS,
        })),
      ]);
      setUsers(usersRes.users);
      setDepartments(deptsRes.departments);
      syncDepartmentsRegistry(deptsRes.departments);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsersAndDepts();
  }, []);

  async function handleCreateNewDepartment(targetMode: 'create' | 'edit') {
    const label = targetMode === 'create' ? customDeptLabel.trim() : editCustomDeptLabel.trim();
    const description = targetMode === 'create' ? customDeptDesc.trim() : '';
    const allowsMedia = targetMode === 'create' ? customDeptAllowsMedia : editCustomDeptAllowsMedia;

    if (!label) {
      setErrorMsg('እባክዎ የአዲሱን የስራ ክፍል ስም ያስገቡ።');
      return;
    }

    setErrorMsg('');
    setCreatingDept(true);
    try {
      const res = await apiFetch<{ department: DepartmentRecord }>('/api/departments', {
        method: 'POST',
        body: JSON.stringify({ label, description, allowsMedia }),
      });

      setDepartments((prev) => {
        const exists = prev.some((d) => d.id === res.department.id);
        const next = exists ? prev : [...prev, res.department];
        syncDepartmentsRegistry(next);
        return next;
      });
      window.dispatchEvent(new Event('senbet:departments-updated'));

      if (targetMode === 'create') {
        setNewDept(res.department.id);
        setCustomDeptLabel('');
        setCustomDeptDesc('');
        setCustomDeptAllowsMedia(false);
        setShowCreateDeptInForm(false);
      } else if (editingUser) {
        setEditingUser({ ...editingUser, department: res.department.id });
        setEditCustomDeptLabel('');
        setEditCustomDeptAllowsMedia(false);
        setShowCreateDeptInEdit(false);
      }
      setStatusMsg(`አዲስ የስራ ክፍል «${res.department.label}» ተፈጥሯል እና ተመርጧል።`);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setCreatingDept(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');

    try {
      const payload: any = {
        fullName: newFullName,
        username: newUsername,
        password: newPassword,
        role: isDeptHead ? 'dept_member' : newRole,
        age: newAge ? Number(newAge) : null,
        educationLevel: newEduLevel || null,
        phone: newPhone || null,
      };

      if (isHead) {
        if (newRole === 'teacher' || newRole === 'student') {
          payload.assignedGrade = newGrade ? Number(newGrade) : 1;
        }
        if (newRole === 'teacher') {
          payload.subject = newSubject.trim() || null;
        }
        if (newRole === 'dept_head' || newRole === 'dept_member') {
          payload.department = newDept;
        }
      }

      const res = await apiFetch<{ user: UserRecord }>('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setUsers((prev) => [res.user, ...prev]);
      setNewFullName('');
      setNewUsername('');
      setNewPassword('');
      setNewSubject('');
      setNewAge('');
      setNewEduLevel('');
      setNewPhone('');
      setShowCreate(false);
      setStatusMsg(`መለያው (${res.user.fullName}) በተሳካ ሁኔታ ተፈጥሯል።`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setErrorMsg('');
    setStatusMsg('');

    try {
      const payload: any = {
        fullName: editingUser.fullName,
        username: editingUser.username,
        role: editingUser.role,
        age: editingUser.age,
        educationLevel: editingUser.educationLevel,
        assignedGrade:
          editingUser.role === 'student' || editingUser.role === 'teacher'
            ? editingUser.assignedGrade
            : null,
        subject: editingUser.role === 'teacher' ? editingUser.subject || null : null,
        department:
          editingUser.role === 'dept_head' || editingUser.role === 'dept_member'
            ? editingUser.department
            : null,
        phone: editingUser.phone,
      };
      if (editPassword.trim().length > 0) {
        payload.password = editPassword.trim();
      }

      const res = await apiFetch<{ user: UserRecord }>(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setUsers((prev) => prev.map((u) => (u.id === res.user.id ? res.user : u)));
      if (res.user.id === currentUser.id && onProfileUpdated) {
        onProfileUpdated(res.user);
      }
      setEditingUser(null);
      setEditPassword('');
      setShowCreateDeptInEdit(false);
      setStatusMsg(`የ${res.user.fullName} መለያ መረጃ ተስተካክሏል።`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleDeleteUser(id: number) {
    try {
      await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setStatusMsg('መለያው ተሰርዟል።');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  const filteredUsers = users.filter((u) => {
    if (isHead && roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.subject || '').toLowerCase().includes(q) ||
        (u.educationLevel || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">
            {isHead
              ? 'የሁሉም መለያዎች (Accounts) እና የክፍል ምደባ አስተዳደር'
              : isDeptHead
              ? `የ${getDepartmentLabel(currentUser.department, departments)} አባላት`
              : `የ${getGradeLabel(currentUser.assignedGrade)} ተማሪዎች ዝርዝር`}
          </h2>
          <p className="mt-0.5 text-xs text-white/70">
            {isHead
              ? 'መምህራንን ከሚያስተምሩት ትምህርት ጋር ይመዝግቡ፣ የክፍል ሀላፊዎችንና አዲስ የስራ ክፍሎችን ይፍጠሩ፣ ተማሪዎችንም ያስተዳድሩ'
              : isDeptHead
              ? 'በተመደቡበት ክፍል ውስጥ አዳዲስ አባላትን (Members) ይመዝግቡና ይመልከቱ'
              : 'እርስዎ በተመደቡበት ክፍል የሚገኙ ተማሪዎች ሙሉ መረጃ'}
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="glass-btn-primary"
          >
            <UserPlus className="h-4 w-4" />
            <span>
              {showCreate
                ? 'ቅጹን ዝጋ'
                : isDeptHead
                ? 'አዲስ የክፍል አባል መዝግብ'
                : 'አዲስ መምህር / ተመዳቢ / መለያ መዝግብ'}
            </span>
          </button>
        )}
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

      {showCreate && canCreate && (
        <form
          onSubmit={handleCreateUser}
          className="glass-card rounded-2xl p-6 space-y-4"
        >
          <div className="border-b border-white/15 pb-3">
            <h3 className="text-sm font-bold text-white">
              {isDeptHead
                ? `ለ${getDepartmentLabel(currentUser.department, departments)} አዲስ አባል (Member) መመዝገቢያ`
                : 'አዲስ መለያ መፍጠሪያ (መምህር፣ የክፍል ሀላፊ፣ አባል ወይም ተማሪ)'}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-white/80">ሙሉ ስም</label>
              <input
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="ስም ከነአባትና አያት"
                className="glass-input mt-1 w-full px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80">የመግቢያ ስም (Username)</label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="glass-input mt-1 w-full px-3 py-2 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80">የይለፍ ቃል (Password)</label>
              <input
                type="text"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="glass-input mt-1 w-full px-3 py-2 font-mono text-xs"
              />
            </div>

            {isHead && (
              <div>
                <label className="block text-xs font-semibold text-white/80">የስራ ድርሻ (Role)</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="glass-input mt-1 w-full px-3 py-2 text-xs"
                >
                  <option value="teacher" className="bg-slate-900 text-white">መምህር</option>
                  <option value="dept_head" className="bg-slate-900 text-white">የክፍል ሀላፊ (ተመዳቢ)</option>
                  <option value="dept_member" className="bg-slate-900 text-white">የክፍል አባል</option>
                  <option value="student" className="bg-slate-900 text-white">ተማሪ</option>
                  <option value="head" className="bg-slate-900 text-white">የሰንበት ትምህርት ቤት ሀላፊ</option>
                </select>
              </div>
            )}

            {isHead && (newRole === 'teacher' || newRole === 'student') && (
              <div>
                <label className="block text-xs font-semibold text-white/80">የሚመደብበት ክፍል (1ኛ - 12ኛ)</label>
                <select
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value)}
                  className="glass-input mt-1 w-full px-3 py-2 text-xs"
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g} className="bg-slate-900 text-white">
                      {getGradeLabel(g)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isHead && newRole === 'teacher' && (
              <div>
                <label className="block text-xs font-semibold text-white/80">
                  የሚያስተምሩት ትምህርት (Subject)
                </label>
                <input
                  type="text"
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="ለምሳሌ፡ የግዕዝ ንባብ / ነገረ ሃይማኖት"
                  className="glass-input mt-1 w-full px-3 py-2 text-xs"
                />
              </div>
            )}

            {isHead && (newRole === 'dept_head' || newRole === 'dept_member') && (
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-white/80">የስራ ክፍል</label>
                  <button
                    type="button"
                    onClick={() => setShowCreateDeptInForm((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    <span>{showCreateDeptInForm ? 'ዝጋ' : '+ አዲስ የስራ ክፍል ፍጠር'}</span>
                  </button>
                </div>

                <select
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value as DepartmentId)}
                  className="glass-input mt-1 w-full px-3 py-2 text-xs"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                      {d.label}
                    </option>
                  ))}
                </select>

                {showCreateDeptInForm && (
                  <div className="mt-2.5 rounded-xl border border-amber-300/30 bg-white/[0.06] p-3 space-y-2.5">
                    <p className="text-[11px] font-semibold text-amber-200">
                      አዲስ የስራ ክፍል መፍጠሪያ
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        value={customDeptLabel}
                        onChange={(e) => setCustomDeptLabel(e.target.value)}
                        placeholder="የአዲሱ ክፍል ስም (ለምሳሌ፡ የልማት ክፍል)"
                        className="glass-input w-full px-3 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={customDeptDesc}
                        onChange={(e) => setCustomDeptDesc(e.target.value)}
                        placeholder="አጭር መግለጫ (አማራጭ)"
                        className="glass-input w-full px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2 text-[11px] text-white/80 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customDeptAllowsMedia}
                          onChange={(e) => setCustomDeptAllowsMedia(e.target.checked)}
                          className="h-3.5 w-3.5 rounded accent-amber-400"
                        />
                        <span>ኦዲዮ እና ቪዲዮ መላክ ይፈቀድለት</span>
                      </label>
                      <button
                        type="button"
                        disabled={creatingDept}
                        onClick={() => handleCreateNewDepartment('create')}
                        className="glass-btn-primary px-3 py-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{creatingDept ? 'በመፍጠር ላይ...' : 'ክፍሉን ፍጠር'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-white/80">ስልክ ቁጥር</label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="09..."
                className="glass-input mt-1 w-full px-3 py-2 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80">የትምህርት ደረጃ</label>
              <input
                type="text"
                value={newEduLevel}
                onChange={(e) => setNewEduLevel(e.target.value)}
                placeholder="ዲግሪ / 10ኛ ክፍል..."
                className="glass-input mt-1 w-full px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80">እድሜ (አማራጭ)</label>
              <input
                type="number"
                value={newAge}
                onChange={(e) => setNewAge(e.target.value)}
                className="glass-input mt-1 w-full px-3 py-2 font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="glass-btn-secondary"
            >
              ተወው
            </button>
            <button
              type="submit"
              className="glass-btn-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>መዝግብ</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter & Search Bar */}
      <div className="glass-card flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
        {isHead ? (
          <div className="flex flex-wrap items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1">
            {(
              [
                ['all', 'ሁሉም'],
                ['student', 'ተማሪዎች'],
                ['teacher', 'መምህራን'],
                ['dept_head', 'የክፍል ሀላፊዎች'],
                ['dept_member', 'የክፍል አባላት'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRoleFilter(key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  roleFilter === key ? 'bg-white text-zinc-950 shadow-xs' : 'text-white/75 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs font-semibold text-white/85">
            ጠቅላላ መዝገብ፡ <span className="font-mono text-amber-200 tabular-nums">{filteredUsers.length}</span>
          </div>
        )}

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="በስም፣ በትምህርት ወይም Username ፈልግ..."
          className="glass-input w-full max-w-xs px-3.5 py-2 text-xs"
        />
      </div>

      {/* Users Table */}
      <div className="glass-card overflow-hidden rounded-2xl">
        {loading ? (
          <div className="p-8 text-center text-xs text-white/65">በመጫን ላይ...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-xs text-white/65">ምንም መለያ አልተገኘም።</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/15 bg-white/5 text-white/75">
                <tr>
                  <th className="px-4 py-3 font-semibold">ሙሉ ስም</th>
                  <th className="px-4 py-3 font-semibold">የስራ ድርሻ</th>
                  <th className="px-4 py-3 font-semibold">ክፍል / የስራ ክፍል / ትምህርት</th>
                  <th className="px-4 py-3 font-semibold">እድሜና ትምህርት</th>
                  <th className="px-4 py-3 font-semibold">Username</th>
                  {isHead && <th className="px-4 py-3 font-semibold">Password</th>}
                  {isHead && <th className="px-4 py-3 font-semibold text-right">ድርጊት</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.04]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{u.fullName}</p>
                      {u.phone && <p className="font-mono text-[11px] text-white/60">{u.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-white/80">{ROLE_LABELS[u.role]}</td>
                    <td className="px-4 py-3">
                      <span className="text-amber-200">
                        {u.role === 'student' || u.role === 'teacher'
                          ? getGradeLabel(u.assignedGrade)
                          : u.department
                          ? getDepartmentLabel(u.department, departments)
                          : 'ዋና አስተዳደር'}
                      </span>
                      {u.role === 'teacher' && u.subject && (
                        <p className="mt-0.5 text-[11px] text-emerald-200">
                          ትምህርት፡ {u.subject}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {u.age ? <span className="font-mono tabular-nums">{u.age} ዓመት</span> : '—'}
                      {u.educationLevel ? ` · ${u.educationLevel}` : ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-white/90">{u.username}</td>
                    {isHead && (
                      <td className="px-4 py-3 font-mono text-white/85">
                        <div className="inline-flex items-center gap-1.5">
                          <span>{revealedPwdIds[u.id] ? u.password : '••••••'}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedPwdIds((prev) => ({ ...prev, [u.id]: !prev[u.id] }))
                            }
                            className="text-white/60 hover:text-white"
                            aria-label="የይለፍ ቃል አሳይ"
                          >
                            {revealedPwdIds[u.id] ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    )}
                    {isHead && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser({ ...u });
                              setEditPassword(u.password || '');
                              setShowCreateDeptInEdit(false);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20 whitespace-nowrap shrink-0"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>አስተካክል / መድብ</span>
                          </button>
                          {u.id !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-400/30 bg-red-500/15 text-red-200 hover:bg-red-500/30"
                              aria-label="ሰርዝ"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
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

      {/* Head Account & Grade Reassignment Modal */}
      {editingUser && isHead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveEdit}
            className="glass-window max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">መለያ እና የክፍል ምደባ ማስተካከያ</h3>
                <p className="text-xs text-white/70">
                  ስም፣ የይለፍ ቃል፣ የመምህር ትምህርት፣ የስራ ክፍል ወይም የተማሪ ክፍልን በቀጥታ ይቀይሩ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-white/80">ሙሉ ስም</label>
                <input
                  type="text"
                  required
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="glass-input mt-1 w-full px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80">የመግቢያ ስም (Username)</label>
                <input
                  type="text"
                  required
                  value={editingUser.username}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  className="glass-input mt-1 w-full px-3 py-2 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80">የይለፍ ቃል (Password)</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="አዲስ የይለፍ ቃል"
                  className="glass-input mt-1 w-full px-3 py-2 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80">የስራ ድርሻ (Role)</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                  className="glass-input mt-1 w-full px-3 py-2 text-xs"
                >
                  <option value="student" className="bg-slate-900 text-white">ተማሪ</option>
                  <option value="teacher" className="bg-slate-900 text-white">መምህር</option>
                  <option value="dept_head" className="bg-slate-900 text-white">የክፍል ሀላፊ (ተመዳቢ)</option>
                  <option value="dept_member" className="bg-slate-900 text-white">የክፍል አባል</option>
                  <option value="head" className="bg-slate-900 text-white">የሰንበት ትምህርት ቤት ሀላፊ</option>
                </select>
              </div>

              {(editingUser.role === 'student' || editingUser.role === 'teacher') && (
                <div>
                  <label className="block text-xs font-semibold text-white/80">
                    የተመደበበት ክፍል (1ኛ - 12ኛ)
                  </label>
                  <select
                    value={editingUser.assignedGrade || 1}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, assignedGrade: Number(e.target.value) })
                    }
                    className="glass-input mt-1 w-full px-3 py-2 text-xs"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g} className="bg-slate-900 text-white">
                        {getGradeLabel(g)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editingUser.role === 'teacher' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-white/80">
                    የሚያስተምሩት ትምህርት (Subject)
                  </label>
                  <input
                    type="text"
                    value={editingUser.subject || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, subject: e.target.value })}
                    placeholder="ለምሳሌ፡ የግዕዝ ንባብ / ነገረ ሃይማኖት"
                    className="glass-input mt-1 w-full px-3 py-2 text-xs"
                  />
                </div>
              )}

              {(editingUser.role === 'dept_head' || editingUser.role === 'dept_member') && (
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-white/80">የስራ ክፍል</label>
                    <button
                      type="button"
                      onClick={() => setShowCreateDeptInEdit((v) => !v)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      <span>{showCreateDeptInEdit ? 'ዝጋ' : '+ አዲስ የስራ ክፍል ፍጠር'}</span>
                    </button>
                  </div>
                  <select
                    value={editingUser.department || 'education'}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, department: e.target.value as DepartmentId })
                    }
                    className="glass-input mt-1 w-full px-3 py-2 text-xs"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                        {d.label}
                      </option>
                    ))}
                  </select>

                  {showCreateDeptInEdit && (
                    <div className="mt-2 rounded-xl border border-amber-300/30 bg-white/[0.06] p-3 space-y-2">
                      <input
                        type="text"
                        value={editCustomDeptLabel}
                        onChange={(e) => setEditCustomDeptLabel(e.target.value)}
                        placeholder="የአዲሱ ክፍል ስም..."
                        className="glass-input w-full px-3 py-1.5 text-xs"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 text-[11px] text-white/80 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editCustomDeptAllowsMedia}
                            onChange={(e) => setEditCustomDeptAllowsMedia(e.target.checked)}
                            className="h-3.5 w-3.5 rounded accent-amber-400"
                          />
                          <span>ኦዲዮ እና ቪዲዮ ይፈቀድለት</span>
                        </label>
                        <button
                          type="button"
                          disabled={creatingDept}
                          onClick={() => handleCreateNewDepartment('edit')}
                          className="glass-btn-primary px-3 py-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>{creatingDept ? 'በመፍጠር ላይ...' : 'ክፍሉን ፍጠር'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-white/80">የትምህርት ደረጃ</label>
                <input
                  type="text"
                  value={editingUser.educationLevel || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, educationLevel: e.target.value })}
                  className="glass-input mt-1 w-full px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80">ስልክ ቁጥር</label>
                <input
                  type="text"
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  className="glass-input mt-1 w-full px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
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
