import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  User,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { apiFetch } from '../utils/api';
import {
  getDepartmentLabel,
  getGradeLabel,
  ROLE_LABELS,
  syncDepartmentsRegistry,
} from '../utils/school';
import type { DepartmentRecord, UserRecord } from '../types';
import { AdminStatsView } from './views/AdminStatsView';
import { ResourcesView } from './views/ResourcesView';
import { ExamsAttendanceView } from './views/ExamsAttendanceView';
import { AccountsAdminView } from './views/AccountsAdminView';
import { DepartmentsView } from './views/DepartmentsView';
import { MessagesView } from './views/MessagesView';
import { ProfileView } from './views/ProfileView';

export type WorkspaceTabId =
  | 'stats'
  | 'resources'
  | 'exams'
  | 'accounts'
  | 'departments'
  | 'messages'
  | 'profile';

interface NavItem {
  id: WorkspaceTabId;
  label: string;
  shortLabel: string;
  group: 'main' | 'workspace';
  icon: React.ComponentType<{ className?: string }>;
}

function getNavItems(user: UserRecord): NavItem[] {
  if (user.role === 'head') {
    return [
      { id: 'stats', label: 'ዳሽቦርድ (ስታቲስቲክስ)', shortLabel: 'ዳሽቦርድ', group: 'main', icon: BarChart3 },
      { id: 'accounts', label: 'መለያዎችና የክፍል ምደባ', shortLabel: 'መለያዎች', group: 'main', icon: Users },
      { id: 'exams', label: 'ውጤትና አቴንዳንስ', shortLabel: 'ውጤት', group: 'main', icon: ClipboardCheck },
      { id: 'resources', label: 'የትምህርት ግብአቶች', shortLabel: 'ግብአቶች', group: 'main', icon: BookOpen },
      { id: 'departments', label: 'የስራ ክፍሎች (ሪፖርት/ትዕዛዝ)', shortLabel: 'ክፍሎች', group: 'workspace', icon: Briefcase },
      { id: 'messages', label: 'የክፍላት መልእክቶች', shortLabel: 'መልእክት', group: 'workspace', icon: MessageSquare },
      { id: 'profile', label: 'የግል መገለጫ', shortLabel: 'መገለጫ', group: 'workspace', icon: User },
    ];
  }

  if (user.role === 'teacher') {
    return [
      { id: 'exams', label: 'ውጤትና አቴንዳንስ (PDF)', shortLabel: 'ውጤት', group: 'main', icon: ClipboardCheck },
      { id: 'resources', label: 'የትምህርት ግብአቶች', shortLabel: 'ግብአቶች', group: 'main', icon: BookOpen },
      { id: 'accounts', label: 'የክፍሌ ተማሪዎች', shortLabel: 'ተማሪዎች', group: 'main', icon: Users },
      { id: 'messages', label: 'መልእክቶች', shortLabel: 'መልእክት', group: 'workspace', icon: MessageSquare },
      { id: 'profile', label: 'የግል መገለጫ', shortLabel: 'መገለጫ', group: 'workspace', icon: User },
    ];
  }

  if (user.role === 'student') {
    return [
      { id: 'resources', label: 'የትምህርት ግብአቶች', shortLabel: 'ግብአቶች', group: 'main', icon: BookOpen },
      { id: 'exams', label: 'ውጤቴ እና አቴንዳንስ', shortLabel: 'ውጤት', group: 'main', icon: ClipboardCheck },
      { id: 'messages', label: 'መልእክቶች', shortLabel: 'መልእክት', group: 'workspace', icon: MessageSquare },
      { id: 'profile', label: 'የግል መገለጫ', shortLabel: 'መገለጫ', group: 'workspace', icon: User },
    ];
  }

  if (user.role === 'dept_head') {
    const items: NavItem[] = [
      { id: 'departments', label: 'ሪፖርት፣ ትዕዛዝና ግብአቶች', shortLabel: 'ክፍል', group: 'main', icon: Briefcase },
      { id: 'accounts', label: 'የክፍሌ አባላት', shortLabel: 'አባላት', group: 'main', icon: Users },
      { id: 'messages', label: 'መልእክቶች', shortLabel: 'መልእክት', group: 'workspace', icon: MessageSquare },
    ];
    if (user.department === 'education') {
      items.push({ id: 'resources', label: 'የትምህርት ግብአቶች', shortLabel: 'ግብአቶች', group: 'workspace', icon: BookOpen });
    }
    items.push({ id: 'profile', label: 'የግል መገለጫ', shortLabel: 'መገለጫ', group: 'workspace', icon: User });
    return items;
  }

  // dept_member
  return [
    { id: 'departments', label: 'ትዕዛዞችና ግብአቶች', shortLabel: 'ግብአቶች', group: 'main', icon: Briefcase },
    { id: 'messages', label: 'መልእክቶች', shortLabel: 'መልእክት', group: 'workspace', icon: MessageSquare },
    { id: 'profile', label: 'የግል መገለጫ', shortLabel: 'መገለጫ', group: 'workspace', icon: User },
  ];
}

interface WorkspaceLayoutProps {
  currentUser: UserRecord;
  onUserUpdated: (user: UserRecord) => void;
  onLogout: () => void;
}

export function WorkspaceLayout({
  currentUser,
  onUserUpdated,
  onLogout,
}: WorkspaceLayoutProps) {
  const shouldReduceMotion = useReducedMotion();
  const navItems = getNavItems(currentUser);
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>(navItems[0].id);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSidebarExpanded, setMobileSidebarExpanded] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [hoveredRailId, setHoveredRailId] = useState<WorkspaceTabId | null>(null);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);

  useEffect(() => {
    let active = true;
    async function loadDepartments() {
      try {
        const res = await apiFetch<{ departments: DepartmentRecord[] }>('/api/departments');
        if (!active) return;
        setDepartments(res.departments);
        syncDepartmentsRegistry(res.departments);
      } catch {
        // Fallback to built-in defaults if request fails
      }
    }
    loadDepartments();
    const onDeptUpdated = () => loadDepartments();
    window.addEventListener('senbet:departments-updated', onDeptUpdated);
    return () => {
      active = false;
      window.removeEventListener('senbet:departments-updated', onDeptUpdated);
    };
  }, []);

  const activeNav = navItems.find((n) => n.id === activeTab) || navItems[0];
  const hasMessagesTab = navItems.some((n) => n.id === 'messages');

  const roleScopeText =
    currentUser.role === 'teacher'
      ? `${getGradeLabel(currentUser.assignedGrade)}${currentUser.subject ? ` · ${currentUser.subject}` : ''}`
      : currentUser.role === 'student'
      ? getGradeLabel(currentUser.assignedGrade)
      : currentUser.department
      ? getDepartmentLabel(currentUser.department, departments.length ? departments : undefined)
      : 'ዋና የሰንበት ትምህርት ቤት አስተዳደር';

  const filteredMobileNav = navItems.filter((item) => {
    if (!sidebarSearch.trim()) return true;
    const q = sidebarSearch.toLowerCase();
    return item.label.toLowerCase().includes(q) || item.shortLabel.toLowerCase().includes(q);
  });

  const mainMobileNav = filteredMobileNav.filter((i) => i.group === 'main');
  const workspaceMobileNav = filteredMobileNav.filter((i) => i.group === 'workspace');

  return (
    <div className="relative flex min-h-screen flex-col text-white">
      {/* Full-Bleed Saint Mercurius Background Across All Pages */}
      <img
        src="/assets/aistudio/images__1__1__c9cae615.jpeg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 h-full w-full object-cover object-[center_22%]"
      />

      {/* Mobile Glassy SideBar V5 (Floating Rounded Glass Capsule with Expand/Collapse & Search) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex md:hidden"
          >
            <div
              className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={shouldReduceMotion ? { opacity: 0 } : { x: -290, opacity: 0 }}
              animate={
                shouldReduceMotion
                  ? { opacity: 1, width: mobileSidebarExpanded ? 276 : 70 }
                  : { x: 0, opacity: 1, width: mobileSidebarExpanded ? 276 : 70 }
              }
              exit={shouldReduceMotion ? { opacity: 0 } : { x: -290, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              className={`relative z-10 m-3 flex flex-col border border-white/30 bg-slate-950/65 text-white backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.58),inset_0_1px_1px_rgba(255,255,255,0.35)] ${
                mobileSidebarExpanded ? 'rounded-[28px]' : 'rounded-[36px]'
              }`}
            >
              {/* Floating Circular Collapse / Expand Chevron on Right Edge */}
              <button
                type="button"
                onClick={() => setMobileSidebarExpanded((v) => !v)}
                className="absolute top-6 -right-3 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-white/90 text-zinc-900 shadow-lg backdrop-blur-md transition-transform hover:scale-105"
                aria-label={mobileSidebarExpanded ? 'ጎን ምናሌ ሰብስብ' : 'ጎን ምናሌ ዘርጋ'}
              >
                {mobileSidebarExpanded ? (
                  <ChevronLeft className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>

              {/* div:nth-of-type(1) — Brand Header + Search Input */}
              <div className="flex flex-col gap-3 border-b border-white/15 px-3 pt-4 pb-3.5">
                <div className={`flex items-center ${mobileSidebarExpanded ? 'justify-between gap-2' : 'justify-center'}`}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <img
                      src="/assets/aistudio/file_00000000e4648207aafbe96c93c1fb54_1__bcc161eb.png"
                      alt="ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ"
                      className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-amber-300/75 shadow-md"
                    />
                    {mobileSidebarExpanded && (
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white">
                          ደቂቀ መዊዕ
                        </p>
                        <p className="truncate text-[10px] text-amber-200/90">
                          {ROLE_LABELS[currentUser.role]}
                        </p>
                      </div>
                    )}
                  </div>

                  {mobileSidebarExpanded && (
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                      aria-label="ዝጋ"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {mobileSidebarExpanded ? (
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-white/55" />
                    <input
                      type="search"
                      value={sidebarSearch}
                      onChange={(e) => setSidebarSearch(e.target.value)}
                      placeholder="ገጽ ፈልግ..."
                      className="w-full rounded-xl border border-white/20 bg-white/10 py-1.5 pr-3 pl-8 text-xs text-white placeholder:text-white/55 outline-none transition-colors focus:border-white/45 focus:bg-white/15"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMobileSidebarExpanded(true)}
                    title="ገጽ ፈልግ"
                    aria-label="ገጽ ፈልግ"
                    className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* nav:nth-of-type(1) — Animated Frosted Glass Navigation */}
              <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3">
                {mainMobileNav.length > 0 && (
                  <div className="space-y-1">
                    {mobileSidebarExpanded && (
                      <p className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider text-white/50">
                        ዋና አገልግሎት
                      </p>
                    )}
                    {mainMobileNav.map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <div key={item.id} className="relative flex justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab(item.id);
                              setMobileMenuOpen(false);
                            }}
                            onMouseEnter={() => setHoveredRailId(item.id)}
                            onMouseLeave={() => setHoveredRailId(null)}
                            className={`relative flex items-center transition-colors ${
                              mobileSidebarExpanded
                                ? 'w-full gap-3 rounded-2xl px-3 py-2.5 text-left text-xs font-semibold'
                                : 'h-11 w-11 justify-center rounded-full'
                            } ${active ? 'text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
                            aria-label={item.label}
                          >
                            {active && (
                              <motion.span
                                layoutId={shouldReduceMotion ? undefined : 'mobileGlassySidebarPill'}
                                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                className={`absolute inset-0 border border-white/40 bg-gradient-to-r from-white/30 via-white/20 to-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.22),inset_0_1px_1px_rgba(255,255,255,0.45)] ${
                                  mobileSidebarExpanded ? 'rounded-2xl' : 'rounded-full'
                                }`}
                              />
                            )}
                            <Icon className="relative z-10 h-4 w-4 shrink-0" />
                            {mobileSidebarExpanded && (
                              <span className="relative z-10 truncate">{item.label}</span>
                            )}
                          </button>

                          {!mobileSidebarExpanded && hoveredRailId === item.id && (
                            <span className="pointer-events-none absolute top-1/2 left-full z-40 ml-3 -translate-y-1/2 rounded-xl border border-white/30 bg-slate-950/85 px-3 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur-xl whitespace-nowrap">
                              {item.shortLabel}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {workspaceMobileNav.length > 0 && (
                  <div className="space-y-1 border-t border-white/15 pt-2.5">
                    {mobileSidebarExpanded && (
                      <p className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider text-white/50">
                        ክፍልና መገለጫ
                      </p>
                    )}
                    {workspaceMobileNav.map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <div key={item.id} className="relative flex justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab(item.id);
                              setMobileMenuOpen(false);
                            }}
                            onMouseEnter={() => setHoveredRailId(item.id)}
                            onMouseLeave={() => setHoveredRailId(null)}
                            className={`relative flex items-center transition-colors ${
                              mobileSidebarExpanded
                                ? 'w-full gap-3 rounded-2xl px-3 py-2.5 text-left text-xs font-semibold'
                                : 'h-11 w-11 justify-center rounded-full'
                            } ${active ? 'text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
                            aria-label={item.label}
                          >
                            {active && (
                              <motion.span
                                layoutId={shouldReduceMotion ? undefined : 'mobileGlassySidebarPill'}
                                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                className={`absolute inset-0 border border-white/40 bg-gradient-to-r from-white/30 via-white/20 to-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.22),inset_0_1px_1px_rgba(255,255,255,0.45)] ${
                                  mobileSidebarExpanded ? 'rounded-2xl' : 'rounded-full'
                                }`}
                              />
                            )}
                            <Icon className="relative z-10 h-4 w-4 shrink-0" />
                            {mobileSidebarExpanded && (
                              <span className="relative z-10 truncate">{item.label}</span>
                            )}
                          </button>

                          {!mobileSidebarExpanded && hoveredRailId === item.id && (
                            <span className="pointer-events-none absolute top-1/2 left-full z-40 ml-3 -translate-y-1/2 rounded-xl border border-white/30 bg-slate-950/85 px-3 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur-xl whitespace-nowrap">
                              {item.shortLabel}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {filteredMobileNav.length === 0 && (
                  <p className="px-2 py-4 text-center text-[11px] text-white/60">
                    ምንም ገጽ አልተገኘም
                  </p>
                )}
              </nav>

              {/* div:nth-of-type(2) — Bottom User Profile & Sign Out */}
              <div className="border-t border-white/15 p-3">
                {mobileSidebarExpanded ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.06] p-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-bold text-zinc-950 shadow-sm">
                        {currentUser.fullName.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white">{currentUser.fullName}</p>
                        <p className="truncate text-[10px] text-amber-200">{roleScopeText}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="glass-btn-secondary w-full"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>ውጣ (Sign Out)</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('profile');
                        setMobileMenuOpen(false);
                      }}
                      title={currentUser.fullName}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-bold text-zinc-950 ring-2 ring-white/40"
                    >
                      {currentUser.fullName.slice(0, 1)}
                    </button>
                    <button
                      type="button"
                      onClick={onLogout}
                      title="ውጣ"
                      aria-label="ውጣ"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Glassy Workspace Shell */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1380px] flex-1 flex-col px-3 pt-4 pb-8 md:pb-24 sm:px-6 sm:pt-5">
        {/* Floating Top Glass Header Bar */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="glass-dock inline-flex h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold text-white md:hidden"
              aria-label="ምናሌ ክፈት"
            >
              <Menu className="h-4 w-4 shrink-0" />
              <span className="truncate max-w-[90px]">{activeNav.shortLabel}</span>
            </button>

            <div className="glass-dock flex min-w-0 items-center gap-3 rounded-full py-1.5 pr-4 pl-2">
              <img
                src="/assets/aistudio/file_00000000e4648207aafbe96c93c1fb54_1__bcc161eb.png"
                alt="ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ"
                className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-amber-300/60"
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white sm:text-sm">
                  እንኳን ደህና መጡ፣ {currentUser.fullName}
                </p>
                <p className="truncate text-[11px] text-white/75">
                  {ROLE_LABELS[currentUser.role]} · {roleScopeText}
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {hasMessagesTab && (
              <motion.button
                type="button"
                whileHover={shouldReduceMotion ? undefined : { scale: 1.06 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                onClick={() => setActiveTab('messages')}
                title="መልእክቶች"
                aria-label="መልእክቶች"
                className={`glass-dock inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  activeTab === 'messages' ? 'bg-white text-zinc-950' : 'text-white hover:bg-white/20'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
              </motion.button>
            )}

            <motion.button
              type="button"
              whileHover={shouldReduceMotion ? undefined : { scale: 1.06 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
              onClick={() => setActiveTab('profile')}
              title="የግል መገለጫ"
              aria-label="የግል መገለጫ"
              className={`glass-dock inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                activeTab === 'profile' ? 'bg-white text-zinc-950' : 'text-white hover:bg-white/20'
              }`}
            >
              <User className="h-4 w-4" />
            </motion.button>

            <motion.button
              type="button"
              whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
              onClick={onLogout}
              className="glass-dock inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>ውጣ</span>
            </motion.button>
          </div>
        </header>

        {/* Central Glassmorphic Window with Left Vertical Icon Rail + Animated Tab Stage */}
        <div className="glass-window relative flex flex-1 items-stretch gap-4 rounded-[28px] p-4 sm:gap-6 sm:p-6 md:p-7">
          {/* Top specular edge highlight */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
          />

          {/* Left Vertical Floating Glass Pill Dock (Desktop) */}
          <aside className="hidden md:flex flex-col items-center justify-center shrink-0">
            <nav
              aria-label="ዋና ምናሌ"
              className="glass-dock flex flex-col items-center gap-2 rounded-full p-2"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    title={item.label}
                    aria-label={item.label}
                    className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                      active ? 'text-zinc-950' : 'text-white/75 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="leftDockActivePill"
                        transition={
                          shouldReduceMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 420, damping: 32 }
                        }
                        className="absolute inset-0 rounded-full bg-white shadow-[0_4px_16px_rgba(255,255,255,0.4)]"
                      />
                    )}
                    <Icon className="relative z-10 h-4 w-4" />
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Animated Tab Viewport */}
          <main className="min-w-0 flex-1 flex flex-col">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-amber-200/95 truncate">
                  ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ · {roleScopeText}
                </p>
                <h1 className="mt-0.5 truncate text-lg font-bold tracking-tight text-white sm:text-2xl">
                  {activeNav.label}
                </h1>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={
                  shouldReduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, y: 14, scale: 0.965, filter: 'blur(8px)' }
                }
                animate={
                  shouldReduceMotion
                    ? { opacity: 1 }
                    : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
                }
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: -10, scale: 0.97, filter: 'blur(8px)' }
                }
                transition={{
                  duration: 0.24,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex-1"
              >
                {activeTab === 'stats' && currentUser.role === 'head' && <AdminStatsView />}
                {activeTab === 'resources' && <ResourcesView currentUser={currentUser} />}
                {activeTab === 'exams' && <ExamsAttendanceView currentUser={currentUser} />}
                {activeTab === 'accounts' && (
                  <AccountsAdminView
                    currentUser={currentUser}
                    onProfileUpdated={onUserUpdated}
                  />
                )}
                {activeTab === 'departments' && <DepartmentsView currentUser={currentUser} />}
                {activeTab === 'messages' && <MessagesView currentUser={currentUser} />}
                {activeTab === 'profile' && (
                  <ProfileView
                    currentUser={currentUser}
                    onProfileUpdated={onUserUpdated}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Floating Bottom Horizontal Glass Pill Dock (Desktop) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 hidden justify-center px-4 md:flex">
        <nav
          aria-label="ፈጣን መቀየሪያ"
          className="glass-dock pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1.5"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active ? 'text-zinc-950' : 'text-white/80 hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="bottomDockActivePill"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 420, damping: 32 }
                    }
                    className="absolute inset-0 rounded-full bg-white shadow-md"
                  />
                )}
                <Icon className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
