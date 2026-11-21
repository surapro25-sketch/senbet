import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  AtSign,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Hash,
  Lock,
  Phone,
  User,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { apiFetch, setStoredToken } from '../utils/api';
import {
  calculateGradeByAge,
  getDivisionByGrade,
  getDivisionLabel,
  getGradeLabel,
  validateFullNameToGrandfather,
} from '../utils/school';
import type { UserRecord } from '../types';

interface PublicPortalProps {
  onAuthenticated: (user: UserRecord) => void;
}

export function PublicPortal({ onAuthenticated }: PublicPortalProps) {
  const shouldReduceMotion = useReducedMotion();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [morphPhase, setMorphPhase] = useState<'idle' | 'closing' | 'opening'>('idle');
  const [spinStep, setSpinStep] = useState(0);
  const morphTimersRef = useRef<number[]>([]);

  // Registration form state
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('12');
  const [educationLevel, setEducationLevel] = useState('');
  const [phone, setPhone] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const parsedAge = Number(age);
  const isValidAge = Number.isInteger(parsedAge) && parsedAge >= 5 && parsedAge <= 100;
  const previewGrade = isValidAge ? calculateGradeByAge(parsedAge) : null;
  const previewDivision = previewGrade ? getDivisionLabel(getDivisionByGrade(previewGrade)) : null;

  function clearMorphTimers() {
    morphTimersRef.current.forEach((id) => window.clearTimeout(id));
    morphTimersRef.current = [];
  }

  useEffect(() => {
    return () => clearMorphTimers();
  }, []);

  useEffect(() => {
    if (!showAuthModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAuthModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAuthModal]);

  function openAuthModal(initialTab: 'login' | 'register' = 'login') {
    clearMorphTimers();
    setMorphPhase('idle');
    setAuthTab(initialTab);
    setLoginError('');
    setRegError('');
    setShowAuthModal(true);
  }

  function triggerModeSwitch(nextTab: 'login' | 'register') {
    if (nextTab === authTab || morphPhase !== 'idle') return;
    setLoginError('');
    setRegError('');

    if (shouldReduceMotion) {
      setAuthTab(nextTab);
      return;
    }

    clearMorphTimers();
    setMorphPhase('closing');
    setSpinStep((prev) => prev + 1);

    const swapTimer = window.setTimeout(() => {
      setAuthTab(nextTab);
      setMorphPhase('opening');
    }, 260);

    const settleTimer = window.setTimeout(() => {
      setMorphPhase('idle');
    }, 580);

    morphTimersRef.current = [swapTimer, settleTimer];
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError('');

    if (!validateFullNameToGrandfather(fullName)) {
      setRegError('እባክዎ ሙሉ ስምዎን እስከ አያት (ቢያንስ 3 ስሞች) ያስገቡ።');
      return;
    }

    if (!isValidAge) {
      setRegError('እድሜ ከ5 ዓመት ጀምሮ ትክክለኛ ቁጥር መሆን አለበት።');
      return;
    }

    setRegLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: UserRecord }>('/api/auth/register-student', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          age: parsedAge,
          educationLevel,
          phone,
          username: regUsername,
          password: regPassword,
        }),
      });
      setStoredToken(res.token);
      onAuthenticated(res.user);
    } catch (err: any) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  }

  async function performLogin(usernameVal: string, passwordVal: string) {
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: UserRecord }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: usernameVal, password: passwordVal }),
      });
      setStoredToken(res.token);
      onAuthenticated(res.user);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    performLogin(loginUsername, loginPassword);
  }

  return (
    <div className="relative flex min-h-screen flex-col text-white">
      {/* Full-bleed background across the entire public page */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <img
          src="/assets/aistudio/images__1__1__c9cae615.jpeg"
          alt=""
          className="h-full w-full object-cover object-[center_22%]"
        />
      </div>

      {/* Zone 1, 2, 3 Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-white/20 bg-slate-950/45 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="flex min-w-0 items-center gap-3 text-base font-bold tracking-tight text-white sm:text-lg"
          >
            <img
              src="/assets/aistudio/file_00000000e4648207aafbe96c93c1fb54_1__bcc161eb.png"
              alt="ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ"
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-amber-300/60"
            />
            <span className="truncate drop-shadow-sm">
              ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ
            </span>
          </a>
          <motion.button
            type="button"
            onClick={() => openAuthModal('login')}
            whileHover={shouldReduceMotion ? undefined : { y: -1, scale: 1.02 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-amber-400/40 shadow-[0_8px_22px_-6px_rgba(24,24,27,0.55),0_2px_10px_-2px_rgba(217,119,6,0.3)] transition-shadow duration-200 hover:ring-amber-300/75 hover:shadow-[0_12px_28px_-6px_rgba(24,24,27,0.65),0_4px_14px_-2px_rgba(245,158,11,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 whitespace-nowrap shrink-0"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/70 to-transparent"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-full w-2/3 -skew-x-12 bg-gradient-to-r from-transparent via-amber-200/20 to-transparent transition-transform duration-500 ease-out group-hover:translate-x-[300%]"
            />
            <span className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/30 transition-colors group-hover:bg-amber-400/25 group-hover:text-amber-200">
              <Lock className="h-3.5 w-3.5" />
            </span>
            <span className="relative tracking-tight">Login or Register</span>
            <ArrowRight className="relative h-4 w-4 text-amber-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-amber-200" />
          </motion.button>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="top"
        className="relative z-10 flex w-full flex-1 flex-col justify-center overflow-hidden px-6 py-16"
      >
        <div className="relative z-10 mx-auto w-full max-w-4xl rounded-3xl border border-white/25 bg-slate-950/45 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-9">
          <p className="text-xs font-medium tracking-wide text-amber-200">
            የሰንበት ትምህርት ቤት የትምህርትና አስተዳደር ስርዓት
          </p>
          <h1 className="mt-3 flex items-center gap-4 text-3xl font-bold leading-tight text-white sm:gap-5 sm:text-4xl lg:text-[2.75rem] [text-wrap:balance]">
            <img
              src="/assets/aistudio/file_00000000e4648207aafbe96c93c1fb54_1__bcc161eb.png"
              alt="ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ"
              className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-amber-300/70 shadow-md sm:h-16 sm:w-16"
            />
            <span>ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-100">
            አዲስ ተማሪዎች በእድሜያቸው መሰረት ወደ ወጣኒ፣ ማእከላዊ እና ወጣት ክፍሎች በራስ-ሰር የሚመደቡበት፣
            የተመዘገቡ ተማሪዎች PDF፣ ኦዲዮ እና ቪዲዮ ትምህርቶችን የሚያገኙበት፣ መምህራን ውጤትና አቴንዳንስ
            መዝግበው በPDF የሚያወርዱበት ዘመናዊ መድረክ።
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/20 bg-slate-950/45 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-white/80">
          <span>ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ</span>
          <span>ወጣኒ (1-4) · ማእከላዊ (5-6) · ወጣት (7-12)</span>
        </div>
      </footer>

      {/* Animated Dark Glassmorphic Login & Registration Stage */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            key="auth-stage"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAuthModal(false);
            }}
            className="fixed inset-0 z-50 flex overflow-y-auto p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Login or Register"
          >
            {/* Full-Color Saint Mercurius Background Image */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
              <img
                src="/assets/aistudio/images__1__1__c9cae615.jpeg"
                alt=""
                className="h-full w-full object-cover object-[center_22%]"
              />
            </div>

            {/* Close Stage Button */}
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="fixed top-5 right-5 z-20 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-slate-900/45 text-white backdrop-blur-md transition-colors hover:bg-slate-900/70"
              aria-label="ዝጋ"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Centered Stage with Rotating Geometric Wireframe & Diamond Aperture Morph */}
            <div className="relative m-auto flex w-full max-w-[460px] items-center justify-center py-8">
              {/* Outer Geometric Wireframe Diamonds */}
              <motion.div
                aria-hidden="true"
                animate={{
                  rotate: spinStep * 90 + (morphPhase === 'closing' ? 45 : 12),
                  scale: morphPhase === 'closing' ? 0.88 : 1,
                }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-none absolute h-[380px] w-[380px] rounded-[36px] border border-white/20 sm:h-[440px] sm:w-[440px]"
              />
              <motion.div
                aria-hidden="true"
                animate={{
                  rotate: -spinStep * 90 + (morphPhase === 'closing' ? -45 : -8),
                  scale: morphPhase === 'closing' ? 0.82 : 1.03,
                }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-none absolute h-[350px] w-[350px] rounded-[32px] border border-white/15 sm:h-[410px] sm:w-[410px]"
              />

              {/* Mid-Transition Rotating Diamond Glass Shield (visible at transition midpoint) */}
              <motion.div
                aria-hidden="true"
                initial={false}
                animate={
                  morphPhase === 'closing'
                    ? { opacity: 1, scale: 1, rotate: 45 }
                    : { opacity: 0, scale: 0.72, rotate: morphPhase === 'opening' ? 90 : 0 }
                }
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-none absolute z-20 flex h-56 w-56 items-center justify-center rounded-[28px] border border-white/20 bg-zinc-900/80 shadow-[0_24px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
              >
                <div className="flex h-16 w-16 -rotate-45 items-center justify-center rounded-2xl border border-yellow-400/35 bg-white/10 shadow-inner">
                  <img
                    src="/assets/aistudio/file_00000000e4648207aafbe96c93c1fb54_1__bcc161eb.png"
                    alt=""
                    className="h-11 w-11 rounded-full object-cover"
                  />
                </div>
              </motion.div>

              {/* Main Glassmorphic Form Card */}
              <motion.div
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.94, y: 12 }}
                animate={
                  morphPhase === 'closing'
                    ? { opacity: 0, scale: 0.74, rotate: 24 }
                    : morphPhase === 'opening'
                    ? { opacity: 1, scale: 1, rotate: 0 }
                    : { opacity: 1, scale: 1, rotate: 0, y: 0 }
                }
                transition={{
                  duration: morphPhase === 'idle' ? 0.32 : 0.28,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={`relative z-10 w-full overflow-hidden rounded-2xl border border-white/15 bg-zinc-900/70 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:p-8 ${
                  morphPhase === 'closing' ? 'pointer-events-none' : ''
                }`}
              >
                {/* Top Hairline Specular Edge */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
                />

                {authTab === 'login' ? (
                  <div>
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
                        Welcome <span className="text-yellow-400">Back</span>
                      </h2>
                      <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                        ወደ ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ መድረክ ይግቡ
                      </p>
                    </div>

                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-300">
                          የመግቢያ ስም (Username)
                        </label>
                        <div className="relative mt-1.5">
                          <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                          <input
                            type="text"
                            required
                            value={loginUsername}
                            onChange={(e) => setLoginUsername(e.target.value)}
                            placeholder="admin / teacher1 / abebe..."
                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pr-3.5 pl-10 font-mono text-sm text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-yellow-400/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-yellow-400/20"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-300">
                          የይለፍ ቃል (Password)
                        </label>
                        <div className="relative mt-1.5">
                          <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                          <input
                            type={showPwd ? 'text' : 'password'}
                            required
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pr-10 pl-10 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-yellow-400/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-yellow-400/20"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPwd((v) => !v)}
                            className="absolute inset-y-0 right-3 flex items-center text-zinc-400 transition-colors hover:text-white"
                            aria-label="የይለፍ ቃል አሳይ"
                          >
                            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {loginError && (
                        <div className="rounded-xl border border-red-500/30 bg-red-950/60 px-3.5 py-2.5 text-xs font-medium text-red-200">
                          {loginError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loginLoading}
                        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-300 px-4 py-3 text-sm font-bold text-zinc-950 shadow-[0_8px_24px_rgba(250,204,21,0.22)] transition-all hover:brightness-105 disabled:opacity-60"
                      >
                        <span>{loginLoading ? 'በመግባት ላይ...' : 'Sign In · ግባ'}</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </form>

                    <div className="mt-6 flex items-center gap-3 text-[11px] text-zinc-500">
                      <div className="h-px flex-1 bg-white/10" />
                      <span>ወይም</span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>

                    <p className="mt-4 text-center text-xs text-zinc-400">
                      አዲስ ተማሪ ነዎት?{' '}
                      <button
                        type="button"
                        onClick={() => triggerModeSwitch('register')}
                        className="font-semibold text-yellow-400 transition-colors hover:text-yellow-300"
                      >
                        Sign up (ይመዝገቡ)
                      </button>
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="mb-5">
                      <h2 className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
                        Create <span className="text-yellow-400">Account</span>
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                        አዲስ ተማሪዎች ምዝገባ — በእድሜዎ መጠን ወዲያውኑ ወደ ክፍል ይመደባሉ
                      </p>
                    </div>

                    {previewGrade && (
                      <div className="mb-4 flex items-center gap-2 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.07] px-3.5 py-2 text-xs text-zinc-200">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-yellow-400" />
                        <span className="font-semibold text-white">
                          ራስ-ሰር ምደባ፡ {getGradeLabel(previewGrade)}
                        </span>
                        <span className="text-zinc-400 tabular-nums">
                          · እድሜ {parsedAge} ({previewDivision})
                        </span>
                      </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-3.5">
                      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-zinc-300">
                            ሙሉ ስም እስከ አያት
                          </label>
                          <div className="relative mt-1.5">
                            <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <input
                              type="text"
                              required
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder="ለምሳሌ፡ አበበ ከበደ ተሰማ"
                              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pr-3.5 pl-10 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-yellow-400/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-yellow-400/20"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-300">እድሜ</label>
                          <div className="relative mt-1.5">
                            <Hash className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <input
                              type="number"
                              min={5}
                              max={100}
                              required
                              value={age}
                              onChange={(e) => setAge(e.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pr-3.5 pl-10 font-mono text-sm text-white tabular-nums outline-none transition-colors focus:border-yellow-400/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-yellow-400/20"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-300">
                            የትምህርት ደረጃ
                          </label>
                          <div className="relative mt-1.5">
                            <GraduationCap className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <input
                              type="text"
                              required
                              value={educationLevel}
                              onChange={(e) => setEducationLevel(e.target.value)}
                              placeholder="8ኛ ክፍል / ዲግሪ"
                              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pr-3.5 pl-10 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-yellow-400/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-yellow-400/20"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-300">
                            የመግቢያ ስም
                          </label>
                          <div className="relative mt-1.5">
                            <AtSign className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <input
                              type="text"
                              required
                              minLength={3}
                              value={regUsername}
                              onChange={(e) => setRegUsername(e.target.value)}
                              placeholder="abebe_k"
                              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pr-3.5 pl-10 font-mono text-sm text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-yellow-400/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-yellow-400/20"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-300">
                            የይለፍ ቃል
                          </label>
                          <div className="relative mt-1.5">
                            <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <input
                              type={showRegPwd ? 'text' : 'password'}
                              required
                              minLength={4}
                              value={regPassword}
                              onChange={(e) => setRegPassword(e.target.value)}
                              placeholder="ቢያንስ 4 ቁምፊ"
                              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pr-9 pl-10 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-yellow-400/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-yellow-400/20"
                            />
                            <button
                              type="button"
                              onClick={() => setShowRegPwd((v) => !v)}
                              className="absolute inset-y-0 right-2.5 flex items-center text-zinc-400 transition-colors hover:text-white"
                              aria-label="የይለፍ ቃል አሳይ"
                            >
                              {showRegPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-zinc-300">
                            ስልክ ቁጥር (አማራጭ)
                          </label>
                          <div className="relative mt-1.5">
                            <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <input
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="09..."
                              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pr-3.5 pl-10 font-mono text-sm text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-yellow-400/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-yellow-400/20"
                            />
                          </div>
                        </div>
                      </div>

                      {regError && (
                        <div className="rounded-xl border border-red-500/30 bg-red-950/60 px-3.5 py-2.5 text-xs font-medium text-red-200">
                          {regError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={regLoading}
                        className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-300 px-4 py-3 text-sm font-bold text-zinc-950 shadow-[0_8px_24px_rgba(250,204,21,0.22)] transition-all hover:brightness-105 disabled:opacity-60"
                      >
                        <span>{regLoading ? 'በመመዝገብ ላይ...' : 'Create Account · ምዝገባውን አጠናቅቅ'}</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </form>

                    <div className="mt-5 flex items-center gap-3 text-[11px] text-zinc-500">
                      <div className="h-px flex-1 bg-white/10" />
                      <span>ወይም</span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>

                    <p className="mt-3.5 text-center text-xs text-zinc-400">
                      መለያ አለዎት?{' '}
                      <button
                        type="button"
                        onClick={() => triggerModeSwitch('login')}
                        className="font-semibold text-yellow-400 transition-colors hover:text-yellow-300"
                      >
                        Sign in (ግባ)
                      </button>
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
