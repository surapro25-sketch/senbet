import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, uploadFileToStorage } from '../../utils/api';
import type { UserRecord } from '../../types';
import { Banknote, Download, FileText, Pencil, Plus, Printer, Search, Trash2, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';

type FinanceType = 'income' | 'expense';
type FinanceCategory = 'monthly_contribution' | 'donation' | 'event_income' | 'materials' | 'other';
interface FinanceTransaction {
  id: string;
  type: FinanceType;
  category: FinanceCategory;
  amount: number;
  description: string;
  partyName: string;
  memberId: number | null;
  transactionDate: string;
  recordedBy: string;
  receiptFileName: string | null;
}
interface Contribution {
  memberId: number;
  memberName: string;
  role: string;
  grade: number | null;
  status: 'paid' | 'unpaid';
  amount: number;
  transactionId: string | null;
  paidAt: string | null;
}
interface FinanceData {
  transactions: FinanceTransaction[];
  contributions: Contribution[];
  summary: { totalIncome: number; totalExpenses: number; balance: number };
  month: string;
  canWrite: boolean;
}
const CATEGORY_LABELS: Record<FinanceCategory, string> = {
  monthly_contribution: 'ወርሃዊ መዋጮ / Monthly Contribution',
  donation: 'ስጦታ / Donation',
  event_income: 'የበዓል ገቢ / Event Income',
  materials: 'የትምህርት ቁሳቁስ / Materials',
  other: 'ሌላ / Other',
};
const money = (value: number) => new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 2 }).format(value || 0);
const today = () => new Date().toISOString().slice(0, 10);

export function FinanceView({ currentUser }: { currentUser: UserRecord }) {
  const canWrite = currentUser.role === 'accountant';
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptStatus, setReceiptStatus] = useState('');
  const [contributionAmounts, setContributionAmounts] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ month });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (typeFilter) params.set('type', typeFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      const result = await apiFetch<FinanceData>(`/api/finance?${params.toString()}`);
      setData(result);
      setContributionAmounts(Object.fromEntries(result.contributions.map((item) => [item.memberId, item.amount ? String(item.amount) : ''])));
    } catch (err: any) {
      setError(err.message || 'የሂሳብ መረጃን ማምጣት አልተቻለም።');
    } finally {
      setLoading(false);
    }
  }, [month, from, to, typeFilter, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  const visibleTransactions = useMemo(() => (data?.transactions || []).filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [item.description, item.partyName, item.id, CATEGORY_LABELS[item.category]].some((v) => String(v || '').toLowerCase().includes(q));
  }), [data, search]);

  function resetForm() {
    setEditing(null); setReceipt(null); setReceiptStatus(''); setFormOpen(false);
  }

  async function saveTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setError(''); setNotice('');
    try {
      let receiptUploadId: string | undefined;
      if (receipt) {
        setReceiptStatus('ደረሰኙን በመጫን ላይ...');
        const stored = await uploadFileToStorage(receipt, (percent) => setReceiptStatus(`ደረሰኙን በመጫን ላይ... ${percent}%`));
        receiptUploadId = stored.uploadId;
      }
      const payload: any = {
        type: String(form.get('type')) as FinanceType,
        category: String(form.get('category')) as FinanceCategory,
        amount: Number(form.get('amount')),
        description: String(form.get('description') || ''),
        partyName: String(form.get('partyName') || ''),
        memberId: String(form.get('memberId') || '') || null,
        transactionDate: String(form.get('transactionDate') || today()),
      };
      if (receiptUploadId) payload.receiptUploadId = receiptUploadId;
      const path = editing ? `/api/finance/transactions/${editing.id}` : '/api/finance/transactions';
      await apiFetch(path, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setNotice(editing ? 'የሂሳብ መዝገቡ ተስተካክሏል።' : 'አዲስ የሂሳብ መዝገብ ተመዝግቧል።');
      resetForm(); await load();
    } catch (err: any) {
      setError(err.message || 'መዝገቡን ማስቀመጥ አልተቻለም።');
    } finally { setSaving(false); setReceiptStatus(''); }
  }

  async function deleteTransaction(item: FinanceTransaction) {
    if (!canWrite || !window.confirm('ይህን የሂሳብ መዝገብ መሰረዝ ይፈልጋሉ?')) return;
    try {
      await apiFetch(`/api/finance/transactions/${item.id}`, { method: 'DELETE' });
      setNotice('የሂሳብ መዝገቡ ተሰርዟል።'); await load();
    } catch (err: any) { setError(err.message); }
  }

  async function setContribution(item: Contribution, status: 'paid' | 'unpaid') {
    if (!canWrite) return;
    const amount = Number(contributionAmounts[item.memberId] || item.amount || 0);
    if (status === 'paid' && (!Number.isFinite(amount) || amount <= 0)) {
      setError(`የ${item.memberName} መዋጮ መጠን ያስገቡ።`); return;
    }
    try {
      await apiFetch('/api/finance/contributions', { method: 'POST', body: JSON.stringify({ memberId: item.memberId, month, status, amount }) });
      setNotice(status === 'paid' ? `${item.memberName} መዋጮ ተመዝግቧል።` : `${item.memberName} መዋጮ ወደ ያልተከፈለ ተመልሷል።`);
      await load();
    } catch (err: any) { setError(err.message); }
  }

  function downloadCsv() {
    const rows = [['Date','Type','Category','Amount ETB','Payer / Payee','Member ID','Description']];
    visibleTransactions.forEach((item) => rows.push([item.transactionDate,item.type,CATEGORY_LABELS[item.category],String(item.amount),item.partyName,String(item.memberId || ''),item.description || '']));
    const csv = '\uFEFF' + rows.map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `senbet-finance-${month}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">ሂሳብ · Finance Management</h2>
          <p className="mt-1 text-xs text-white/65">{canWrite ? 'የገቢና ወጪ መዝገቦችን ያስተዳድሩ' : 'የፋይናንስ ማጠቃለያና ሪፖርቶች (Read only)'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadCsv} type="button" className="glass-btn-secondary"><Download className="h-4 w-4" /> CSV አውርድ</button>
          <button onClick={() => window.print()} type="button" className="glass-btn-secondary"><Printer className="h-4 w-4" /> ሪፖርት አትም</button>
          {canWrite && <button onClick={() => { setEditing(null); setFormOpen(true); }} type="button" className="glass-btn-primary"><Plus className="h-4 w-4" /> አዲስ መዝግብ</button>}
        </div>
      </div>

      {notice && <div className="rounded-xl border border-emerald-400/30 bg-emerald-950/50 p-3 text-xs text-emerald-100">{notice}</div>}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-950/50 p-3 text-xs text-red-100">{error}</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-4"><div className="flex items-center justify-between"><span className="text-xs text-white/65">ጠቅላላ ገቢ</span><TrendingUp className="h-5 w-5 text-emerald-300" /></div><p className="mt-2 text-xl font-bold text-emerald-200 tabular-nums">{money(data?.summary.totalIncome || 0)}</p></div>
        <div className="glass-card rounded-2xl p-4"><div className="flex items-center justify-between"><span className="text-xs text-white/65">ጠቅላላ ወጪ</span><TrendingDown className="h-5 w-5 text-rose-300" /></div><p className="mt-2 text-xl font-bold text-rose-200 tabular-nums">{money(data?.summary.totalExpenses || 0)}</p></div>
        <div className="glass-card rounded-2xl p-4"><div className="flex items-center justify-between"><span className="text-xs text-white/65">ቀሪ ሂሳብ</span><Wallet className="h-5 w-5 text-amber-300" /></div><p className="mt-2 text-xl font-bold text-amber-200 tabular-nums">{money(data?.summary.balance || 0)}</p></div>
      </div>

      {formOpen && canWrite && (
        <form onSubmit={saveTransaction} className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between"><h3 className="font-bold text-white">{editing ? 'የሂሳብ መዝገብ አስተካክል' : 'አዲስ ገቢ / ወጪ መዝግብ'}</h3><button type="button" onClick={resetForm} className="rounded-full p-2 hover:bg-white/10"><X className="h-4 w-4" /></button></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-white/75">ዓይነት<select name="type" defaultValue={editing?.type || 'income'} className="glass-input mt-1 w-full px-3 py-2"><option value="income">ገቢ / Income</option><option value="expense">ወጪ / Expense</option></select></label>
            <label className="text-xs text-white/75">ምድብ<select name="category" defaultValue={editing?.category || 'monthly_contribution'} className="glass-input mt-1 w-full px-3 py-2">{Object.entries(CATEGORY_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="text-xs text-white/75">መጠን (ብር / ETB)<input name="amount" type="number" min="0.01" step="0.01" required defaultValue={editing?.amount || ''} className="glass-input mt-1 w-full px-3 py-2" /></label>
            <label className="text-xs text-white/75">ቀን<input name="transactionDate" type="date" required defaultValue={editing?.transactionDate || today()} className="glass-input mt-1 w-full px-3 py-2" /></label>
            <label className="text-xs text-white/75">ከፋይ / ተከፋይ ስም<input name="partyName" defaultValue={editing?.partyName || ''} className="glass-input mt-1 w-full px-3 py-2" placeholder="ስም" /></label>
            <label className="text-xs text-white/75">የአባል ID (አማራጭ)<input name="memberId" type="number" min="1" defaultValue={editing?.memberId || ''} className="glass-input mt-1 w-full px-3 py-2" /></label>
            <label className="text-xs text-white/75 sm:col-span-2">መግለጫ<textarea name="description" rows={2} defaultValue={editing?.description || ''} className="glass-input mt-1 w-full px-3 py-2" /></label>
            <label className="text-xs text-white/75">ደረሰኝ (PDF / Image)<input type="file" accept=".pdf,image/*" onChange={(e) => setReceipt(e.target.files?.[0] || null)} className="mt-2 block w-full text-xs text-white/75" /><span className="mt-1 block text-[10px] text-white/45">አማራጭ · ከነባሩ Telegram / Google Drive ማከማቻ ይጫናል</span></label>
          </div>
          {receiptStatus && <p className="text-xs text-amber-200">{receiptStatus}</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={resetForm} className="glass-btn-secondary">ይቅር</button><button disabled={saving} type="submit" className="glass-btn-primary">{saving ? 'በማስቀመጥ ላይ...' : 'አስቀምጥ'}</button></div>
        </form>
      )}

      <section className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-white">የአባላት ወርሃዊ መዋጮ መከታተያ</h3><p className="text-[11px] text-white/55">የተከፈለ መዋጮ በራስ-ሰር ወደ ገቢ መዝገብ ይጨመራል።</p></div><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="glass-input px-3 py-2 text-xs" /></div>
        {loading ? <p className="py-4 text-center text-xs text-white/60">በመጫን ላይ...</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-white/60"><tr><th className="px-2 py-2">አባል</th><th className="px-2 py-2">ክፍል</th><th className="px-2 py-2">መዋጮ (ብር)</th><th className="px-2 py-2">ሁኔታ</th><th className="px-2 py-2">ድርጊት</th></tr></thead><tbody className="divide-y divide-white/10">{(data?.contributions || []).map((item) => <tr key={item.memberId}><td className="px-2 py-2 text-white">{item.memberName}</td><td className="px-2 py-2 text-white/60">{item.grade ? `${item.grade}ኛ` : item.role === 'dept_member' ? 'የክፍል አባል' : '—'}</td><td className="px-2 py-2">{canWrite ? <input type="number" min="0" step="0.01" value={contributionAmounts[item.memberId] ?? ''} onChange={(e) => setContributionAmounts((prev) => ({ ...prev, [item.memberId]: e.target.value }))} className="glass-input w-28 px-2 py-1" /> : money(item.amount)}</td><td className="px-2 py-2"><span className={item.status === 'paid' ? 'text-emerald-300' : 'text-amber-200'}>{item.status === 'paid' ? 'ተከፍሏል' : 'አልተከፈለም'}</span></td><td className="px-2 py-2">{canWrite && <button onClick={() => setContribution(item,item.status === 'paid' ? 'unpaid' : 'paid')} type="button" className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] text-white hover:bg-white/20">{item.status === 'paid' ? 'ያልተከፈለ አድርግ' : 'ተከፍሏል ምልክት አድርግ'}</button>}</td></tr>)}</tbody></table>{!data?.contributions.length && <p className="py-5 text-center text-xs text-white/55">የተመዘገቡ ተማሪዎች / አባላት አልተገኙም።</p>}</div>
        )}
      </section>

      <section className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-white/65">ከቀን<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="glass-input mt-1 block px-2 py-1.5" /></label>
          <label className="text-[11px] text-white/65">እስከ ቀን<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="glass-input mt-1 block px-2 py-1.5" /></label>
          <label className="text-[11px] text-white/65">ዓይነት<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="glass-input mt-1 block px-2 py-1.5"><option value="">ሁሉም</option><option value="income">ገቢ</option><option value="expense">ወጪ</option></select></label>
          <label className="text-[11px] text-white/65">ምድብ<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="glass-input mt-1 block px-2 py-1.5"><option value="">ሁሉም</option>{Object.entries(CATEGORY_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="relative min-w-[180px] flex-1 text-[11px] text-white/65"><Search className="absolute top-7 left-2 h-3.5 w-3.5 text-white/45" /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ፈልግ..." className="glass-input mt-1 w-full py-1.5 pr-2 pl-7" /></label>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-white/60"><tr><th className="px-2 py-2">ቀን</th><th className="px-2 py-2">ዓይነት</th><th className="px-2 py-2">ምድብ</th><th className="px-2 py-2">መግለጫ</th><th className="px-2 py-2">ከፋይ / ተከፋይ</th><th className="px-2 py-2 text-right">መጠን</th><th className="px-2 py-2">ደረሰኝ</th>{canWrite && <th className="px-2 py-2">ድርጊት</th>}</tr></thead><tbody className="divide-y divide-white/10">{visibleTransactions.map((item) => <tr key={item.id}><td className="px-2 py-2 text-white/75 whitespace-nowrap">{item.transactionDate}</td><td className={item.type === 'income' ? 'px-2 py-2 text-emerald-300' : 'px-2 py-2 text-rose-300'}>{item.type === 'income' ? 'ገቢ' : 'ወጪ'}</td><td className="px-2 py-2 text-white/75">{CATEGORY_LABELS[item.category]}</td><td className="px-2 py-2 text-white">{item.description}</td><td className="px-2 py-2 text-white/75">{item.partyName}</td><td className="px-2 py-2 text-right font-semibold text-white tabular-nums">{money(item.amount)}</td><td className="px-2 py-2">{item.receiptFileName ? <a className="text-amber-200 underline" href={`/api/files/download?kind=finance&id=${item.id}`} target="_blank" rel="noreferrer">{item.receiptFileName}</a> : '—'}</td>{canWrite && <td className="px-2 py-2"><div className="flex gap-1"><button onClick={() => { setEditing(item); setFormOpen(true); }} type="button" title="Edit" className="rounded p-1.5 hover:bg-white/10"><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => deleteTransaction(item)} type="button" title="Delete" className="rounded p-1.5 text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button></div></td>}</tr>)}</tbody></table>{!loading && visibleTransactions.length === 0 && <p className="py-6 text-center text-xs text-white/55">የሂሳብ መዝገብ አልተገኘም።</p>}</div>
      </section>
      <p className="text-[10px] text-white/40">የመዝገብ መጠን: {visibleTransactions.length} · ሁሉም መጠኖች በETB / ብር ናቸው።</p>
    </div>
  );
}
