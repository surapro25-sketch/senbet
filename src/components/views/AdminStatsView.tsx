import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  Users,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '../../utils/api';

interface AdminStatsPayload {
  summary: {
    totalStudents: number;
    totalTeachers: number;
    totalDeptMembers: number;
    attendanceRate: number;
    pendingReports: number;
    totalResources: number;
  };
  studentsPerGrade: {
    grade: number;
    label: string;
    division: 'wetani' | 'maekelawi' | 'wetat';
    count: number;
  }[];
  divisionTotals: {
    division: string;
    label: string;
    count: number;
  }[];
  attendanceTrends: {
    date: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    rate: number;
  }[];
}

const DIVISION_COLORS: Record<'wetani' | 'maekelawi' | 'wetat', string> = {
  wetani: '#FBBF24',
  maekelawi: '#34D399',
  wetat: '#60A5FA',
};

const DIVISION_LABELS_AM: Record<'wetani' | 'maekelawi' | 'wetat', string> = {
  wetani: 'ወጣኒ',
  maekelawi: 'ማእከላዊ',
  wetat: 'ወጣት',
};

export function AdminStatsView() {
  const shouldReduceMotion = useReducedMotion();
  const [data, setData] = useState<AdminStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attendanceMetric, setAttendanceMetric] = useState<'counts' | 'rate'>('counts');

  async function loadStats() {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<AdminStatsPayload>('/api/admin/stats');
      setData(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card h-28 animate-pulse rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="glass-card h-80 animate-pulse rounded-2xl" />
          <div className="glass-card h-80 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-card rounded-2xl border-red-400/40 bg-red-950/60 p-6 text-sm text-red-100">
        {error || 'ስታቲስቲክሱን መጫን አልተቻለም።'}
      </div>
    );
  }

  const { summary, studentsPerGrade, divisionTotals, attendanceTrends } = data;

  const statCards = [
    {
      title: 'ጠቅላላ ተማሪዎች',
      value: summary.totalStudents,
      sub: 'በ12ቱም ክፍሎች',
      icon: Users,
      gradient: 'from-amber-400 to-orange-500',
      trendColor: 'text-emerald-300',
    },
    {
      title: 'አጠቃላይ አቴንዳንስ',
      value: `${summary.attendanceRate}%`,
      sub: 'ተገኝተዋል እና አርፍደው የገቡ',
      icon: ClipboardCheck,
      gradient: 'from-emerald-400 to-teal-500',
      trendColor: 'text-emerald-300',
    },
    {
      title: 'መምህራንና የክፍል አገልጋዮች',
      value: summary.totalTeachers + summary.totalDeptMembers,
      sub: `${summary.totalTeachers} መምህራን · ${summary.totalDeptMembers} አባላት`,
      icon: CheckCircle2,
      gradient: 'from-sky-400 to-indigo-500',
      trendColor: 'text-sky-200',
    },
    {
      title: 'ያልታዩ ሪፖርቶች',
      value: summary.pendingReports,
      sub: `${summary.totalResources} የትምህርት ግብአቶች`,
      icon: BookOpen,
      gradient: 'from-rose-400 to-amber-500',
      trendColor: 'text-amber-200',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">የአስተዳደር አጠቃላይ እይታ</h2>
          <p className="mt-0.5 text-xs text-white/70">
            በየክፍሉ (1ኛ–12ኛ) ያሉ ተማሪዎች ብዛት እና በየቀኑ የተመዘገበ የአቴንዳንስ አዝማሚያ
          </p>
        </div>

        <button
          type="button"
          onClick={loadStats}
          className="glass-btn-secondary"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>መረጃ አድስ</span>
        </button>
      </div>

      {/* 4-Column Glass Stat Cards matching Glassy Dashboard V2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, idx) => {
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Chart 1: Students per Class (1-12) */}
        <section className="glass-card rounded-2xl p-6 xl:col-span-7">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">በየክፍሉ ያሉ ተማሪዎች ብዛት (1ኛ–12ኛ)</h3>
              <p className="mt-0.5 text-xs text-white/65">
                ወጣኒ (1-4) · ማእከላዊ (5-6) · ወጣት (7-12)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/80">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#FBBF24]" />
                ወጣኒ
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#34D399]" />
                ማእከላዊ
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#60A5FA]" />
                ወጣት
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={studentsPerGrade}
                margin={{ top: 8, right: 12, left: -16, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.14)" />
                <XAxis
                  dataKey="grade"
                  tickFormatter={(v) => `${v}ኛ`}
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.78)' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.78)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.08)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as AdminStatsPayload['studentsPerGrade'][0];
                    return (
                      <div className="rounded-xl border border-white/25 bg-slate-950/90 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-xl">
                        <p className="font-bold">
                          {row.label} ({DIVISION_LABELS_AM[row.division]})
                        </p>
                        <p className="mt-0.5 font-mono text-amber-200 tabular-nums">
                          ተማሪዎች፡ {row.count}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={32}>
                  {studentsPerGrade.map((entry) => (
                    <Cell key={`cell-${entry.grade}`} fill={DIVISION_COLORS[entry.division]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Chart 2: Attendance Trends */}
        <section className="glass-card rounded-2xl p-6 xl:col-span-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">የአቴንዳንስ አዝማሚያ</h3>
              <p className="mt-0.5 text-xs text-white/65">በቀን የተመዘገበ የተማሪዎች መገኘት</p>
            </div>

            <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setAttendanceMetric('counts')}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  attendanceMetric === 'counts'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                በቁጥር
              </button>
              <button
                type="button"
                onClick={() => setAttendanceMetric('rate')}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  attendanceMetric === 'rate'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                በመቶኛ (%)
              </button>
            </div>
          </div>

          {attendanceTrends.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-xs text-white/65">
              እስካሁን ምንም አቴንዳንስ አልተመዘገበም።
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {attendanceMetric === 'counts' ? (
                  <AreaChart
                    data={attendanceTrends}
                    margin={{ top: 8, right: 12, left: -16, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.14)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => String(d).slice(5)}
                      tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.78)' }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.78)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as AdminStatsPayload['attendanceTrends'][0];
                        return (
                          <div className="space-y-1 rounded-xl border border-white/25 bg-slate-950/90 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-xl">
                            <p className="font-mono font-bold">{row.date}</p>
                            <p className="text-emerald-300 tabular-nums">ተገኝቷል፡ {row.present}</p>
                            <p className="text-amber-300 tabular-nums">አርፍዷል፡ {row.late}</p>
                            <p className="text-rose-300 tabular-nums">ቀርቷል፡ {row.absent}</p>
                            <p className="text-white/75 tabular-nums">መጠን፡ {row.rate}%</p>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="present"
                      name="ተገኝቷል"
                      stroke="#34D399"
                      fill="#34D399"
                      fillOpacity={0.22}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="late"
                      name="አርፍዷል"
                      stroke="#FBBF24"
                      fill="#FBBF24"
                      fillOpacity={0.16}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="absent"
                      name="ቀርቷል"
                      stroke="#FB7185"
                      fill="#FB7185"
                      fillOpacity={0.14}
                      strokeWidth={2}
                    />
                  </AreaChart>
                ) : (
                  <AreaChart
                    data={attendanceTrends}
                    margin={{ top: 8, right: 12, left: -16, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.14)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => String(d).slice(5)}
                      tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.78)' }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.78)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as AdminStatsPayload['attendanceTrends'][0];
                        return (
                          <div className="rounded-xl border border-white/25 bg-slate-950/90 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-xl">
                            <p className="font-mono font-bold">{row.date}</p>
                            <p className="mt-0.5 font-mono text-emerald-300 tabular-nums">
                              የመገኘት መጠን፡ {row.rate}% ({row.present + row.late}/{row.total})
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      name="የመገኘት መጠን"
                      stroke="#FBBF24"
                      fill="#FBBF24"
                      fillOpacity={0.22}
                      strokeWidth={2}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* Division Summary Table */}
      <div className="glass-card overflow-hidden rounded-2xl">
        <div className="border-b border-white/15 px-5 py-3.5">
          <h3 className="text-sm font-bold text-white">በክፍለ-ደረጃ የተማሪዎች ስርጭት</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/15 bg-white/5 text-white/75">
              <tr>
                <th className="px-4 py-3 font-semibold">ክፍለ-ደረጃ</th>
                <th className="px-4 py-3 font-semibold text-right">የተማሪዎች ብዛት</th>
                <th className="px-4 py-3 font-semibold text-right">ድርሻ (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {divisionTotals.map((d) => {
                const pct =
                  summary.totalStudents > 0
                    ? Math.round((d.count / summary.totalStudents) * 100)
                    : 0;
                return (
                  <tr key={d.division} className="hover:bg-white/[0.04]">
                    <td className="px-4 py-3 font-semibold text-white">{d.label}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-white tabular-nums">
                      {d.count}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-200 tabular-nums">
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
