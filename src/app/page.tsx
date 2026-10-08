"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Flame,
  CheckCircle2,
  Circle,
  BookOpenText,
  ListChecks,
  FileStack,
  FolderOpen,
  LogIn,
  Target,
  CalendarDays,
  Download,
  ExternalLink,
  FileText,
  LockKeyhole,
  Trophy,
  Loader2,
  X,
  RefreshCw,
  BarChart3,
  BookOpen,
  Play,
  Users,
} from "lucide-react";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase/client";
import { useStudentStreak } from "@/components/StudentStreakProvider";

type Section = "quant" | "varc" | "dilr";

type Attempt = {
  score: number;
  correct: number;
  wrong: number;
  total: number;
};

type LeaderboardEntry = {
  userId: string;
  displayName?: string;
  email?: string;
  score: number;
  correct: number;
  wrong: number;
  total: number;
};

type LeaderboardState = {
  entries: LeaderboardEntry[];
  total: number;
};
type StreakEntry = { userId: string; displayName?: string; email?: string; currentStreak: number };
type DailyRead = { id: string; title: string; url: string; kind?: "pdf" | "link"; publishedFor?: string; createdAt?: { toMillis?: () => number; toDate?: () => Date } };

const todayIST = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

const rankingStyles = {
  quant: { icon: Target, iconWrap: "bg-rose-100 text-rose-500", score: "text-rose-500", scoreBox: "bg-rose-50", border: "border-rose-100" },
  varc: { icon: BookOpenText, iconWrap: "bg-violet-100 text-violet-600", score: "text-violet-600", scoreBox: "bg-violet-50", border: "border-violet-100" },
  dilr: { icon: BarChart3, iconWrap: "bg-emerald-100 text-emerald-600", score: "text-emerald-600", scoreBox: "bg-emerald-50", border: "border-emerald-100" },
};

const sectionInfo: Record<Section, { title: string; shortTitle: string }> = {
  quant: { title: "Quantitative Aptitude", shortTitle: "Quant" },
  varc: { title: "VARC", shortTitle: "VARC" },
  dilr: { title: "DILR", shortTitle: "DILR" },
};

function getDisplayName(entry: Pick<LeaderboardEntry, "displayName" | "email">) {
  if (entry.displayName?.trim()) return entry.displayName.trim();
  if (entry.email?.trim()) return entry.email.split("@")[0];
  return "Student";
}

function formatScore(score: number) { return score > 0 ? `+${score}` : `${score}`; }

function daysUntilCat() {
  const now = new Date();
  const examYear = now.getFullYear();
  const exam = new Date(examYear, 10, 29);
  if (now > exam) exam.setFullYear(examYear + 1);
  return Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / 86_400_000));
}

// Recommended videos mock data — will use learn section videos in a real implementation
const recommendedVideos = [
  { id: "r1", title: "Time and Work | Complete Concept with Examples", subject: "Quant", badge: "badge-quant", duration: "28:14", instructor: "By ACHIEVERS CAT" },
  { id: "r2", title: "RC Strategy for CAT | How to Read and Solve Faster", subject: "VARC", badge: "badge-varc", duration: "32:10", instructor: "By ACHIEVERS CAT" },
  { id: "r3", title: "DILR Set Solving Framework | Smart Approach", subject: "DILR", badge: "badge-dilr", duration: "41:27", instructor: "By ACHIEVERS CAT" },
];

const quickCards = [
  {
    href: "/daily",
    label: "Daily Targets",
    desc: "Question of the Day, RC, DILR Set and more",
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    icon: Target,
  },
  {
    href: "/learn",
    label: "Learn",
    desc: "High-quality video lectures and notes",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    icon: Play,
  },
  {
    href: "/practice",
    label: "Practice",
    desc: "Topic-wise and mixed practice questions",
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
    icon: CheckCircle2,
  },
  {
    href: "/mocks",
    label: "Mocks",
    desc: "Sectional and full length CAT mock tests",
    iconBg: "bg-yellow-50",
    iconColor: "text-yellow-600",
    icon: BarChart3,
  },
];

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [practiceChooserOpen, setPracticeChooserOpen] = useState(false);
  const streak = useStudentStreak();

  const [attempts, setAttempts] = useState<Record<Section, Attempt | null>>({
    quant: null, varc: null, dilr: null,
  });

  const [leaderboards, setLeaderboards] = useState<Record<Section, LeaderboardState>>({
    quant: { entries: [], total: 0 },
    varc: { entries: [], total: 0 },
    dilr: { entries: [], total: 0 },
  });

  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);
  const [streakLeaders, setStreakLeaders] = useState<StreakEntry[]>([]);
  const [dailyReads, setDailyReads] = useState<DailyRead[]>([]);
  const [today, setToday] = useState(todayIST());

  const date = today;
  const catDaysRemaining = useMemo(() => daysUntilCat(), []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayIST()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) { setDailyReads([]); return; }
    let active = true;
    getDocs(query(collection(db, "daily_reads"), where("published", "==", true), where("publishedFor", "==", today), limit(6)))
      .then((snap) => { if (active) setDailyReads(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DailyRead)); })
      .catch((e) => console.error("Daily Reads:", e));
    return () => { active = false; };
  }, [user, today]);

  useEffect(() => {
    if (!user) { setAttempts({ quant: null, varc: null, dilr: null }); return; }
    const unsubs = (["quant", "varc", "dilr"] as Section[]).map((section) => {
      const ref = doc(db, "daily_attempts", `${date}_${section}_${user.uid}`);
      return onSnapshot(ref, (snap) => {
        setAttempts((prev) => ({
          ...prev,
          [section]: snap.exists() ? {
            score: Number(snap.data().score || 0),
            correct: Number(snap.data().correct || 0),
            wrong: Number(snap.data().wrong || 0),
            total: Number(snap.data().total || 0),
          } : null,
        }));
      }, (e) => console.error(`${section} attempt:`, e));
    });
    return () => unsubs.forEach((u) => u());
  }, [user, date]);

  useEffect(() => {
    setLeaderboardLoading(true);
    const unsubs = (["quant", "varc", "dilr"] as Section[]).map((section) => {
      const ref = collection(db, "daily_leaderboards", `${date}_${section}`, "entries");
      return (() => {
        void getDocs(query(ref, orderBy("score", "desc"), limit(5))).then((snap) => {
          const entries: LeaderboardEntry[] = snap.docs.map((d) => ({
            userId: String(d.data().userId || d.id),
            displayName: d.data().displayName || "",
            email: d.data().email || "",
            score: Number(d.data().score || 0),
            correct: Number(d.data().correct || 0),
            wrong: Number(d.data().wrong || 0),
            total: Number(d.data().total || 0),
          }));
          entries.sort((a, b) => b.score !== a.score ? b.score - a.score : b.correct !== a.correct ? b.correct - a.correct : a.wrong !== b.wrong ? a.wrong - b.wrong : getDisplayName(a).localeCompare(getDisplayName(b)));
          setLeaderboards((prev) => ({ ...prev, [section]: { entries, total: Math.max(prev[section].total, entries.length) } }));
          setLeaderboardLoading(false);
        }, (e) => { console.error(section, e); setLeaderboardLoading(false); });
        return () => {};
      })();
    });
    return () => unsubs.forEach((u) => u?.());
  }, [date, leaderboardRefresh]);

  useEffect(() => {
    const unsubs = (["quant", "varc", "dilr"] as Section[]).map((section) => (() => {
      void getDoc(doc(db, "daily_section_stats", `${date}_${section}`)).then(
        (snap) => setLeaderboards((prev) => ({ ...prev, [section]: { ...prev[section], total: Math.max(Number(snap.data()?.count || 0), prev[section].entries.length) } })),
        (e) => console.error(e)
      );
      return () => {};
    })());
    return () => unsubs.forEach((u) => u?.());
  }, [date, leaderboardRefresh]);

  useEffect(() => onSnapshot(query(collection(db, "user_streaks"), orderBy("currentStreak", "desc"), limit(5)), (snap) => {
    const entries = snap.docs.map((d) => ({ userId: String(d.data().userId || d.id), displayName: String(d.data().displayName || ""), email: String(d.data().email || ""), currentStreak: Number(d.data().currentStreak || 0) }));
    entries.sort((a, b) => b.currentStreak - a.currentStreak);
    setStreakLeaders(entries.slice(0, 5));
  }, (e) => console.error(e)), []);

  const completedCount = (["quant", "varc", "dilr"] as Section[]).filter((s) => attempts[s] !== null).length;
  const targetPercentage = Math.round((completedCount / 3) * 100);
  const displayStreakName = (entry: StreakEntry) => entry.displayName?.trim() || entry.email?.split("@")[0] || "Student";
  const rankedStreakLeaders = [...streakLeaders].sort((a, b) => b.currentStreak - a.currentStreak);

  // Format date for display
  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date());

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-brand" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Main 2-column layout ─────────────────────────── */}
      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">

        {/* ── LEFT COLUMN ────────────────────────────────── */}
        <div className="min-w-0">

          {/* Hero Card */}
          <div className="hero-card p-6 sm:p-8 fade-up">
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-brand-darker mb-2">ACHIEVERS CAT</p>
                <h1 className="font-display text-[2.2rem] sm:text-[2.8rem] font-black leading-[1.1] text-foreground">
                  Master CAT
                  <br />
                  <span className="text-brand">with the Right</span>
                  <br />
                  Guidance
                </h1>
                <p className="mt-3 text-[14px] leading-relaxed text-muted max-w-sm">
                  Daily targets, expert content, realistic mocks and complete preparation — all in one place.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/daily" className="glass-btn-primary px-5 py-2.5 text-[14px]">
                    Start Learning <ArrowRight size={15} className="ml-1" />
                  </Link>
                  <Link href="/mocks" className="glass-btn-secondary px-5 py-2.5 text-[14px]">
                    Explore Mocks
                  </Link>
                </div>
                {/* Social proof */}
                <div className="mt-5 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {["🧑‍💻", "👩‍🎓", "🧑‍🎓", "👨‍💻"].map((e, i) => (
                      <div key={i} className="h-7 w-7 rounded-full border-2 border-white bg-brand-tint flex items-center justify-center text-[12px]">{e}</div>
                    ))}
                  </div>
                  <p className="text-[12px] font-medium text-muted">Trusted by <span className="font-bold text-brand-darker">5000+</span> CAT aspirants</p>
                </div>
              </div>

              {/* Hero illustration (decorative) */}
              <div className="hidden sm:flex shrink-0 h-48 w-56 items-center justify-center rounded-2xl bg-white/40 mt-6 sm:mt-0 relative overflow-hidden">
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-6xl mb-2">📈</div>
                  <div className="bg-white/80 rounded-xl px-3 py-2 text-center">
                    <p className="text-[10px] font-bold text-brand-darker">From Practice</p>
                    <p className="text-[10px] font-bold text-brand-darker">to 99.5+%ile</p>
                  </div>
                  <div className="mt-2 text-[11px] text-center font-semibold text-foreground leading-tight">
                    Same Aspirations.<br />Bigger Results.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 fade-up-delay-1">
            {quickCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.href} href={card.href} className="quick-card flex-col items-start p-4">
                  <div className={`quick-icon flex justify-center items-center ${card.iconBg} ${card.iconColor} mb-3`} style={{ width: 44, height: 44, borderRadius: "50%" }}>
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 w-full">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-[13.5px] text-foreground">{card.label}</p>
                      <ArrowRight size={12} className="text-muted shrink-0" />
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-muted leading-snug">{card.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Recommended for You */}
          <div className="mt-6 fade-up-delay-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <h2 className="font-display text-[17px] font-bold text-foreground">Recommended for You</h2>
              </div>
              <Link href="/learn" className="flex items-center gap-1 text-[13px] font-semibold text-brand-darker hover:underline">
                View All <ArrowRight size={13} />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {recommendedVideos.map((v) => (
                <Link key={v.id} href="/learn" className="video-card block group">
                  {/* Thumbnail */}
                  <div className="relative h-36 bg-gradient-to-br from-brand-darker to-brand-dark flex items-center justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                      <Play size={20} className="text-white ml-1" fill="white" />
                    </div>
                    <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">{v.duration}</span>
                    <span className={`absolute top-2 left-2 ${v.badge}`}>{v.subject}</span>
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">{v.title}</p>
                    <p className="mt-1 text-[11.5px] text-muted">{v.instructor}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* WhatsApp Daily Reads */}
          {user && dailyReads.length > 0 && (
            <div className="mt-6 edu-card p-4 fade-up-delay-3">
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-brand-darker shrink-0">
                  <FileText size={18} />
                </span>
                <div>
                  <p className="font-display text-[15px] font-bold">Daily Reads</p>
                  <p className="text-[12px] text-muted">Newspaper PDFs and essays</p>
                </div>
              </div>
              <div className="space-y-2">
                {dailyReads.slice(0, 3).map((read) => (
                  <a key={read.id} href={read.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3 hover:border-brand/30 hover:bg-brand-tint/50 transition">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="rounded-lg bg-brand-tint p-1.5 text-brand-darker shrink-0"><FileText size={13} /></span>
                      <p className="truncate text-[13px] font-semibold">{read.title}</p>
                    </div>
                    <ExternalLink size={13} className="shrink-0 text-brand-darker/60" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* CTA for logged-out */}
          {!user && (
            <div className="mt-6 glass-card-green p-6 sm:p-8 fade-up-delay-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div>
                <p className="font-display text-[20px] font-bold text-foreground">Ready to start your streak?</p>
                <p className="mt-1 text-[13.5px] text-muted max-w-sm">Sign in with Google and attempt today's daily practice for free.</p>
              </div>
              <Link href="/login" className="glass-btn-primary shrink-0 px-6 py-3 text-[14px]">
                Continue with Google <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ───────────────────────────────── */}
        <div className="hidden lg:block space-y-4 mt-0" style={{alignSelf:'start'}}>

          {/* CAT Countdown */}
          <div className="countdown-card">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-brand-darker">
                <CalendarDays size={18} />
              </span>
              <p className="font-display text-[14.5px] font-bold text-foreground">CAT 2026 Countdown</p>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="font-display text-[48px] font-black leading-none text-foreground">{catDaysRemaining}</span>
              <span className="text-[15px] font-semibold text-muted">days left</span>
            </div>
            <p className="text-[12px] text-muted">CAT exam day · 29 Nov 2026</p>
          </div>

          {/* Today's Target */}
          <div className="edu-card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-display text-[14.5px] font-bold text-foreground">Today&apos;s Target</p>
              <span className="text-[12px] text-muted">{dateLabel}</span>
            </div>

            {/* Progress ring */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative h-14 w-14 shrink-0">
                <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(29,185,84,0.12)" strokeWidth="3.5" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="url(#ring-grad-home)" strokeWidth="3.5"
                    strokeDasharray="97.4" strokeDashoffset={97.4 - (97.4 * targetPercentage) / 100}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="ring-grad-home" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#1fd97a" />
                      <stop offset="100%" stopColor="#14a857" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-display text-[13px] font-black text-foreground">
                  {completedCount}/3
                </span>
              </div>
              <p className="text-[12.5px] text-muted leading-snug">
                {completedCount === 3
                  ? "All targets done! Great work today!"
                  : "Complete today's target to keep your streak alive."}
              </p>
            </div>

            {/* Target items */}
            <ul className="space-y-2.5 border-t border-border/50 pt-3">
              {[
                { key: "quant" as Section, label: "Question of the Day" },
                { key: "varc" as Section, label: "RC / VA of the Day" },
                { key: "dilr" as Section, label: "DILR Set of the Day" },
              ].map(({ key, label }) => (
                <li key={key} className="flex items-center justify-between gap-3 text-[13px]">
                  <div className="flex items-center gap-2">
                    {attempts[key] ? (
                      <CheckCircle2 size={15} className="shrink-0 text-brand" />
                    ) : (
                      <Circle size={15} className="shrink-0 text-border" />
                    )}
                    <span className={attempts[key] ? "text-foreground" : "text-muted"}>{label}</span>
                  </div>
                  {attempts[key] && (
                    <span className="text-[12px] font-semibold text-brand-darker">
                      {attempts[key]!.score}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <Link href="/daily" className="glass-btn-primary mt-4 flex w-full items-center justify-center gap-2 py-2.5 text-[13.5px]">
              {completedCount === 3 ? "View Practice" : "Start Today's Target"} <ArrowRight size={14} />
            </Link>
          </div>

          {/* Streak */}
          <div className="edu-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame size={18} className="text-flame" />
                <p className="font-display text-[14.5px] font-bold text-foreground">{streak}-day streak</p>
              </div>
              <Link href="/daily" className="text-[12px] text-brand-darker font-semibold hover:underline flex items-center gap-1">
                View <ArrowRight size={11} />
              </Link>
            </div>
            {streak > 0 ? (
              <div className="rounded-xl bg-brand-tint p-3">
                <p className="text-[12.5px] text-brand-darker font-medium">🔥 Keep it up! You're on a {streak}-day streak.</p>
              </div>
            ) : (
              <p className="text-[12.5px] text-muted">Start today to build your streak!</p>
            )}

            {/* Top streaks */}
            {rankedStreakLeaders.length > 0 && (
              <div className="mt-3 border-t border-border/50 pt-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark mb-2">Top Streaks</p>
                <div className="space-y-1.5">
                  {rankedStreakLeaders.slice(0, 3).map((e, i) => (
                    <div key={e.userId} className="flex items-center justify-between text-[12px]">
                      <span className="truncate text-muted">#{i + 1} {displayStreakName(e)}</span>
                      <span className="font-bold text-brand-darker">{e.currentStreak}d</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── FULL-WIDTH SECTIONS (below 2-column grid) ──────────────── */}
      <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">

        {/* Live Rankings */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-[17px] font-bold text-foreground flex items-center gap-2">
              🏆 Live Rankings
            </h2>
            <button
              type="button"
              onClick={() => setLeaderboardRefresh((v) => v + 1)}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-darker hover:underline"
            >
              <RefreshCw size={13} className={leaderboardLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["quant", "varc", "dilr"] as Section[]).map((section) => {
              const lb = leaderboards[section];
              const style = rankingStyles[section];
              const SectionIcon = style.icon;
              return (
                <div key={section} className="edu-card p-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${style.iconWrap}`}>
                      <SectionIcon size={20} strokeWidth={2.4} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-[14px] text-foreground">Top 5</p>
                      <p className="text-[11.5px] text-muted">{sectionInfo[section].title}</p>
                    </div>
                    <span className={`ml-auto shrink-0 text-[11px] font-semibold ${style.score}`}>{lb.total} attempters</span>
                  </div>
                  {leaderboardLoading ? (
                    <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-brand" /></div>
                  ) : lb.entries.length === 0 ? (
                    <p className="py-4 text-center text-[12.5px] text-muted">No attempts yet today</p>
                  ) : (
                    <div className="space-y-1.5">
                      {lb.entries.map((entry, i) => (
                        <div key={entry.userId} className={`flex items-center gap-3 rounded-xl border ${style.border} px-3 py-2.5`}>
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-600" : "bg-orange-50 text-orange-700"}`}>{i + 1}</div>
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${style.iconWrap}`}>{getDisplayName(entry).slice(0, 1).toUpperCase()}</span>
                          <p className="min-w-0 flex-1 text-[13px] font-semibold text-foreground truncate">{getDisplayName(entry)}</p>
                          <span className={`shrink-0 text-[13px] font-bold ${style.score}`}>{formatScore(entry.score)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Motivation Banner */}
        <div className="mt-6 mb-4 motivation-banner fade-up-delay-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-4xl">🎯</span>
              <div>
                <p className="font-display text-[20px] font-black text-white">Stay consistent. Achieve 99.5+%ile.</p>
                <p className="text-[13px] text-white/80 mt-1">Practice. Analyze. Improve. Repeat.</p>
              </div>
            </div>
            <Link href="/mocks" className="inline-flex items-center gap-2 bg-white text-brand-darker font-bold text-[13.5px] px-5 py-2.5 rounded-full hover:bg-brand-tint transition shrink-0">
              Explore Full Mocks <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Practice chooser modal */}
      {practiceChooserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 px-4 py-6 backdrop-blur-sm" role="presentation" onClick={() => setPracticeChooserOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="practice-chooser-title" className="glass-card-solid w-full max-w-xl p-5 sm:p-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark">Choose your practice</p>
                <h2 id="practice-chooser-title" className="mt-1 font-display text-2xl font-bold text-foreground">What would you like to practise?</h2>
              </div>
              <button type="button" onClick={() => setPracticeChooserOpen(false)} aria-label="Close" className="rounded-full p-2 text-muted hover:bg-brand-tint">
                <X size={19} />
              </button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link href="/practice" onClick={() => setPracticeChooserOpen(false)} className="glass-card p-5 hover:-translate-y-0.5 transition">
                <BookOpenText className="text-brand" size={22} />
                <h3 className="mt-4 font-display text-[16px] font-semibold text-foreground">Practice questions</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">Choose a section and topic to practise chapter-wise questions.</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-dark">Start practice <ArrowRight size={13} /></span>
              </Link>
              <Link href="/practice/pyqs" onClick={() => setPracticeChooserOpen(false)} className="glass-card p-5 hover:-translate-y-0.5 transition">
                <FileText className="text-brand" size={22} />
                <h3 className="mt-4 font-display text-[16px] font-semibold text-foreground">Topic-wise PYQs</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">Solve past-year CAT questions organised by section and topic.</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-dark">View PYQs <ArrowRight size={13} /></span>
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
