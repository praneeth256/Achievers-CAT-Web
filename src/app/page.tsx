"use client";

import Link from "next/link";
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

const features = [
  {
    href: "/daily",
    icon: Target,
    title: "Daily Practice",
    desc: "Quantitative Aptitude, RC / VA, and DILR daily practice with live scores.",
  },
  {
    href: "/sectional",
    icon: ListChecks,
    title: "Sectional Mocks",
    desc: "Focused VARC, DILR and QA sectionals to sharpen individual areas.",
  },
  {
    href: "/mocks",
    icon: FileStack,
    title: "Full Mocks",
    desc: "Complete CAT-pattern mocks with a real exam-style interface and timer.",
  },
  {
    href: "/materials",
    icon: FolderOpen,
    title: "Materials",
    desc: "Notes and PDFs by section, ready to download and revise from.",
  },
];

const steps = [
  {
    n: "01",
    icon: LogIn,
    title: "Continue with Google",
    desc: "Sign in with your Gmail account — no separate password to remember.",
  },
  {
    n: "02",
    icon: BookOpenText,
    title: "Practice daily, attempt mocks",
    desc: "Work through daily targets, sectional mocks, or a full CAT-pattern mock.",
  },
  {
    n: "03",
    icon: Download,
    title: "Track your score",
    desc: "See section-wise accuracy after every attempt and download your scorecard.",
  },
];

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
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

const sectionInfo: Record<
  Section,
  {
    title: string;
    shortTitle: string;
  }
> = {
  quant: {
    title: "Quantitative Aptitude",
    shortTitle: "Quant",
  },
  varc: {
    title: "VARC",
    shortTitle: "VARC",
  },
  dilr: {
    title: "DILR",
    shortTitle: "DILR",
  },
};

function getDisplayName(entry: Pick<LeaderboardEntry, "displayName" | "email">) {
  if (entry.displayName?.trim()) {
    return entry.displayName.trim();
  }

  if (entry.email?.trim()) {
    return entry.email.split("@")[0];
  }

  return "Student";
}

function formatScore(score: number) {
  return score > 0 ? `+${score}` : `${score}`;
}

function daysUntilCat() {
  const now = new Date();
  const examYear = now.getFullYear();
  const exam = new Date(examYear, 10, 29);
  if (now > exam) exam.setFullYear(examYear + 1);
  return Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / 86_400_000));
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [practiceChooserOpen, setPracticeChooserOpen] = useState(false);
  const streak = useStudentStreak();

  const [attempts, setAttempts] = useState<
    Record<Section, Attempt | null>
  >({
    quant: null,
    varc: null,
    dilr: null,
  });

  const [leaderboards, setLeaderboards] = useState<
    Record<Section, LeaderboardState>
  >({
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
  const catProgress = useMemo(() => Math.min(100, Math.max(0, Math.round(((365 - catDaysRemaining) / 365) * 100))), [catDaysRemaining]);

  /*
   * --------------------------------------------------
   * AUTH
   * --------------------------------------------------
   */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayIST()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) { setDailyReads([]); return; }
    let active = true;
    // A current-date equality query replaces the former unbounded listener
    // over every published read. The page only displays today's six reads.
    getDocs(query(collection(db, "daily_reads"), where("published", "==", true), where("publishedFor", "==", today), limit(6)))
      .then((snapshot) => { if (active) setDailyReads(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as DailyRead)); })
      .catch((error) => console.error("Could not load Daily Reads:", error));
    return () => { active = false; };
  }, [user, today]);

  /*
   * --------------------------------------------------
   * LIVE DAILY ATTEMPTS FOR CURRENT USER
   * --------------------------------------------------
   */

  useEffect(() => {
    if (!user) {
      setAttempts({
        quant: null,
        varc: null,
        dilr: null,
      });

      return;
    }

    const unsubscribers = (["quant", "varc", "dilr"] as Section[]).map(
      (section) => {
        const ref = doc(
          db,
          "daily_attempts",
          `${date}_${section}_${user.uid}`
        );

        return onSnapshot(
          ref,
          (snap) => {
            setAttempts((previous) => ({
              ...previous,
              [section]: snap.exists()
                ? {
                    score: Number(snap.data().score || 0),
                    correct: Number(snap.data().correct || 0),
                    wrong: Number(snap.data().wrong || 0),
                    total: Number(snap.data().total || 0),
                  }
                : null,
            }));
          },
          (error) => {
            console.error(
              `Could not listen to ${section} daily attempt:`,
              error
            );
          }
        );
      }
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user, date]);

  /*
   * --------------------------------------------------
   * LIVE LEADERBOARDS
   *
   * IMPORTANT:
   *
   * The collection path is:
   *
   * daily_leaderboards
   *   └── 2026-08-27_quant
   *       └── entries
   *
   * NOT:
   *
   * daily_leaderboards/2026-08-27/quant/entries
   *
   * This fixes the Firestore "odd number of segments" error.
   * --------------------------------------------------
   */

  useEffect(() => {
    setLeaderboardLoading(true);

    const unsubscribers = (["quant", "varc", "dilr"] as Section[]).map(
      (section) => {
        const entriesRef = collection(
          db,
          "daily_leaderboards",
          `${date}_${section}`,
          "entries"
        );

        return (() => { void getDocs(
          query(entriesRef, orderBy("score", "desc"), limit(5)),
        ).then((snapshot) => {
            const allEntries: LeaderboardEntry[] = snapshot.docs.map(
              (entryDoc) => {
                const data = entryDoc.data();

                return {
                  userId: String(data.userId || entryDoc.id),
                  displayName: data.displayName || "",
                  email: data.email || "",
                  score: Number(data.score || 0),
                  correct: Number(data.correct || 0),
                  wrong: Number(data.wrong || 0),
                  total: Number(data.total || 0),
                };
              }
            );

            allEntries.sort((a, b) => {
              if (b.score !== a.score) {
                return b.score - a.score;
              }

              if (b.correct !== a.correct) {
                return b.correct - a.correct;
              }

              if (a.wrong !== b.wrong) {
                return a.wrong - b.wrong;
              }

              return getDisplayName(a).localeCompare(
                getDisplayName(b)
              );
            });

            setLeaderboards((previous) => ({
              ...previous,
              [section]: {
                entries: allEntries,
                // The leaderboard query intentionally returns only five rows.
                // Keep the real attempt count from daily_section_stats below.
                total: Math.max(previous[section].total, allEntries.length),
              },
            }));

            setLeaderboardLoading(false);
          }, (error) => {
            console.error(
              `Could not listen to ${section} leaderboard:`,
              error
            );

            setLeaderboardLoading(false);
          }); return () => {}; })();
      }
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [date, leaderboardRefresh]);

  // The leaderboard itself is capped at five reads. These three tiny counter
  // documents provide the true denominator without loading every entry.
  useEffect(() => {
    const unsubscribers = (["quant", "varc", "dilr"] as Section[]).map((section) => (() => { void getDoc(
      doc(db, "daily_section_stats", `${date}_${section}`),
    ).then(
      (snapshot) => setLeaderboards((previous) => ({
        ...previous,
        [section]: {
          ...previous[section],
          total: Math.max(Number(snapshot.data()?.count || 0), previous[section].entries.length),
        },
      })),
      (error) => console.error(`Could not load ${section} attempt count:`, error)
    ); return () => {}; })());
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [date, leaderboardRefresh]);

  useEffect(() => onSnapshot(query(collection(db, "user_streaks"), orderBy("currentStreak", "desc"), limit(5)), (snapshot) => {
    const entries = snapshot.docs.map((item) => ({ userId: String(item.data().userId || item.id), displayName: String(item.data().displayName || ""), email: String(item.data().email || ""), currentStreak: Number(item.data().currentStreak || 0) }));
    entries.sort((a, b) => b.currentStreak - a.currentStreak || getDisplayName(a).localeCompare(getDisplayName(b)));
    setStreakLeaders(entries.slice(0, 5));
  }, (error) => console.error("Could not load streak leaderboard:", error)), []);

  /*
   * --------------------------------------------------
   * TARGET
   * --------------------------------------------------
   */

  const completedCount = (["quant", "varc", "dilr"] as Section[]).filter(
    (section) => attempts[section] !== null
  ).length;

  const targetPercentage = Math.round((completedCount / 3) * 100);
  const displayStreakName = (entry: StreakEntry) => entry.displayName?.trim() || entry.email?.split("@")[0] || "Student";
  const rankedStreakLeaders = [...streakLeaders].sort((a, b) => b.currentStreak - a.currentStreak || displayStreakName(a).localeCompare(displayStreakName(b)));

  /*
   * --------------------------------------------------
   * LOADING
   * --------------------------------------------------
   */

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="relative overflow-x-hidden">

      {/* ── Decorative blobs ─────────────────────────────── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="blob-float absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-brand/10 blur-[100px]" />
        <div className="blob-float-delayed absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-brand/8 blur-[90px]" />
        <div className="blob-float absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-emerald-200/20 blur-[80px]" />
      </div>

      {/* ── WhatsApp announcement glass pill ─────────────── */}
      <div className="flex justify-center px-4 pb-2 pt-2">
        <div className="glass-pill-announce flex w-full max-w-3xl items-center gap-2.5 overflow-hidden rounded-full px-4 py-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-white">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a13 13 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </span>
          <p className="min-w-0 flex-1 overflow-hidden">
            <span className="announcement-scroll inline-block whitespace-nowrap text-[12.5px] font-medium text-brand-darker">
              ACHIEVERS CAT is everything you need for CAT — join the WhatsApp group:{" "}
              <a href="https://chat.whatsapp.com/JrJ0LM4eeuYL48bijRpoqB" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                https://chat.whatsapp.com/JrJ0LM4eeuYL48bijRpoqB
              </a>
            </span>
          </p>
          <ArrowRight size={14} className="shrink-0 text-brand-darker/60" />
        </div>
      </div>

      {/* ── CAT 2026 Countdown glass card ─────────────────── */}
      <div className="px-4 pb-4 sm:px-6 lg:px-8">
        <div className="glass-card mx-auto max-w-3xl p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-lg shadow-brand/30">
              <CalendarDays size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div>
                  <p className="font-display text-[15px] font-bold text-foreground">CAT 2026 Countdown</p>
                  <p className="text-[12px] text-muted">CAT exam day · 29 November — make today&apos;s practice count.</p>
                </div>
                <div className="glass-card-solid flex items-baseline gap-1.5 rounded-2xl px-4 py-2">
                  <span className="font-display text-[28px] font-black leading-none text-foreground">{catDaysRemaining}</span>
                  <span className="text-[13px] font-semibold text-muted">days left</span>
                </div>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-brand/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-400 shadow-sm shadow-brand/30 transition-all duration-700"
                  style={{ width: `${catProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-4 sm:px-6 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-10 lg:px-8">

        {/* LEFT: heading + CTA + mini feature cards */}
        <div className="fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-tint px-3 py-1.5 text-[12.5px] font-medium text-brand-darker">
            <Flame size={13} className="text-flame" />
            Built for CAT 2026 aspirants
          </div>

          <h1 className="mt-5 font-display text-[2.6rem] font-black leading-[1.06] tracking-tight text-foreground sm:text-[3.4rem]">
            Prepare smarter.
            <br />
            Practice{" "}
            <span className="bg-gradient-to-r from-brand to-brand-dark bg-clip-text text-transparent">
              consistently.
            </span>
          </h1>

          <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-muted">
            Daily questions, sectional and full CAT-pattern mocks, and study
            material — with your streak, scores and scorecards tracked in one
            place.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setPracticeChooserOpen(true)}
              className="glass-btn-primary inline-flex items-center gap-2 px-5 py-3 text-[14.5px]"
            >
              Start Practising
              <ArrowRight size={16} />
            </button>

            <Link
              href="/mocks"
              className="glass-btn-secondary inline-flex items-center gap-2 px-5 py-3 text-[14.5px]"
            >
              Attempt a Mock
            </Link>
          </div>

          {/* Mini feature pills */}
          <div className="mt-10 grid grid-cols-3 gap-3 sm:max-w-sm">
            {[
              { icon: Target, title: "Practice daily", sub: "Build consistency" },
              { icon: BarChart3, title: "Track progress", sub: "See your growth" },
              { icon: Trophy, title: "Achieve your best", sub: "Be CAT ready" },
            ].map((f) => (
              <div key={f.title} className="glass-card flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-tint text-brand-dark">
                  <f.icon size={15} />
                </div>
                <p className="text-[11px] font-semibold leading-tight text-foreground">{f.title}</p>
                <p className="text-[10.5px] leading-tight text-muted">{f.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Today's Target glass card */}
        <div className="fade-up-delay-2 relative mt-10 lg:mt-0">
          <div className="glass-card-solid p-5 sm:p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="font-display text-[15px] font-bold text-foreground">Today&apos;s Target</p>
              <Link href="/daily" className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 text-[12px] font-semibold text-brand-darker hover:bg-brand/15">
                <Flame size={12} className="text-flame" />
                {streak}-day streak
                <ArrowRight size={11} />
              </Link>
            </div>

            {/* Progress ring */}
            <div className="mt-4 flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(25,200,107,0.12)" strokeWidth="3.5" />
                  <circle
                    cx="18" cy="18" r="15.5" fill="none"
                    stroke="url(#ring-grad)"
                    strokeWidth="3.5"
                    strokeDasharray="97.4"
                    strokeDashoffset={97.4 - (97.4 * targetPercentage) / 100}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#1fd97a" />
                      <stop offset="100%" stopColor="#14a857" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-display text-[13px] font-black text-foreground">
                  {completedCount}/3
                </span>
              </div>
              <p className="text-[13.5px] leading-snug text-muted">
                {completedCount === 3
                  ? "You completed all three sections today. Great work!"
                  : "Complete today\u2019s target to keep your streak alive."}
              </p>
            </div>

            {/* Target items */}
            <ul className="mt-5 space-y-2.5 border-t border-brand/10 pt-4">
              {[
                { key: "quant" as Section, label: "Question of the Day" },
                { key: "varc" as Section, label: "RC / VA of the Day" },
                { key: "dilr" as Section, label: "DILR Set of the Day" },
              ].map(({ key, label }) => (
                <li key={key} className={`flex items-center justify-between gap-3 text-[13.5px] ${attempts[key] ? "text-foreground" : "text-muted"}`}>
                  <div className="flex items-center gap-2.5">
                    {attempts[key] ? (
                      <CheckCircle2 size={16} className="shrink-0 text-brand" />
                    ) : (
                      <Circle size={16} className="shrink-0 text-border" />
                    )}
                    <span>{label}</span>
                  </div>
                  {attempts[key] && (
                    <span className="font-semibold text-brand-darker">
                      {attempts[key]!.score}/{attempts[key]!.total * 3}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Link
              href="/daily"
              className="glass-btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3 text-[14px]"
            >
              {completedCount === 3 ? "View Today\u2019s Practice" : "Complete Today\u2019s Target"}
              <ArrowRight size={15} />
            </Link>

            {/* Top 5 Streaks */}
            <div className="mt-4 border-t border-brand/10 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark">Top 5 Streaks</p>
                <Flame size={13} className="text-flame" />
              </div>
              {rankedStreakLeaders.length ? (
                <div className="mt-2.5 space-y-1.5">
                  {rankedStreakLeaders.map((entry, index) => (
                    <div key={entry.userId} className="flex items-center justify-between text-[12.5px]">
                      <span className="truncate text-muted">#{index + 1} {displayStreakName(entry)}</span>
                      <span className="font-bold text-brand-darker">{entry.currentStreak} days</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-muted">Start today to lead the streak board.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Daily Reads ─────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="glass-card mx-auto max-w-2xl p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-brand-darker">
              <FileText size={18} />
            </span>
            <div>
              <p className="font-display text-[16px] font-bold">Daily Reads</p>
              <p className="text-[12px] text-muted">Newspaper PDFs and essays</p>
            </div>
          </div>
          {!user ? (
            <Link href="/login?returnTo=%2F" className="mt-5 flex items-center justify-between rounded-2xl border border-brand/15 bg-brand-tint/50 p-4 transition hover:bg-brand/10">
              <div>
                <p className="font-semibold text-brand-darker">Log in to access Daily Reads</p>
                <p className="mt-1 text-[12px] text-muted">Curated reading for CAT preparation.</p>
              </div>
              <LockKeyhole size={18} className="shrink-0 text-brand-darker" />
            </Link>
          ) : dailyReads.length ? (
            <div className="mt-5 space-y-2.5">
              {dailyReads.map((read) => (
                <a key={read.id} href={read.url} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-3 rounded-2xl border border-border/60 p-3 transition hover:border-brand/30 hover:bg-brand-tint/50">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-xl bg-brand-tint p-2 text-brand-darker">
                      <FileText size={15} />
                    </span>
                    <p className="truncate text-[13.5px] font-semibold">{read.title}</p>
                  </div>
                  <ExternalLink size={14} className="shrink-0 text-brand-darker/70" />
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-brand-tint/40 p-4 text-[13px] text-muted">Today&apos;s reading will be published shortly.</p>
          )}
        </div>
      </section>

      {/* ── Live Leaderboards ────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark">Live Rankings</p>
            <h2 className="mt-1 font-display text-[24px] font-bold text-foreground">Today&apos;s Top Performers</h2>
            <p className="mt-1 text-[13px] text-muted">Rankings refresh when the page opens. Refresh for the latest.</p>
          </div>
          <button
            type="button"
            onClick={() => setLeaderboardRefresh((v) => v + 1)}
            disabled={leaderboardLoading}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-tint px-3 py-2 text-[12px] font-semibold text-brand-darker disabled:opacity-50 hover:bg-brand/10"
          >
            <RefreshCw size={13} className={leaderboardLoading ? "animate-spin" : ""} />
            Refresh rankings
          </button>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {(["quant", "varc", "dilr"] as Section[]).map((section) => {
            const leaderboard = leaderboards[section];
            return (
              <div key={section} className="glass-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Trophy size={17} className="text-brand-dark" />
                      <h3 className="font-display text-[15px] font-bold">Top 5 / {leaderboard.total} attempters</h3>
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted">{sectionInfo[section].title}</p>
                  </div>
                  <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[10.5px] font-bold text-brand-darker">Top scores</span>
                </div>

                {leaderboardLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 size={20} className="animate-spin text-brand" />
                  </div>
                ) : leaderboard.entries.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-[13px] font-semibold text-foreground">No attempts yet</p>
                    <p className="mt-1 text-[11.5px] text-muted">Be the first to attempt this section.</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {leaderboard.entries.map((entry, index) => (
                      <div key={entry.userId} className="flex items-center gap-3 rounded-xl border border-border/60 bg-white/50 px-3 py-2.5">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold ${index === 0 ? "bg-brand text-white shadow-sm shadow-brand/30" : "bg-brand-tint text-brand-darker"}`}>
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-semibold text-foreground">{getDisplayName(entry)}</p>
                          <p className="text-[11px] text-muted">{entry.correct} correct · {entry.wrong} wrong</p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-[13px] font-bold text-brand-darker">{formatScore(entry.score)}</p>
                          <p className="text-[10px] text-muted">marks</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Feature Grid ─────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="font-display text-[24px] font-bold text-foreground">Everything you need, in one place</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="glass-card group p-5 transition-transform hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/[0.08]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-tint to-brand/10 text-brand-dark">
                <f.icon size={19} />
              </div>
              <p className="mt-4 font-display text-[15px] font-semibold text-foreground">{f.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{f.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-dark opacity-0 transition group-hover:opacity-100">
                Explore <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="font-display text-[24px] font-bold text-foreground">How it works</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="glass-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-md shadow-brand/25">
                  <s.icon size={18} />
                </div>
                <span className="font-display text-[13px] font-semibold text-border">{s.n}</span>
              </div>
              <p className="mt-4 font-display text-[15px] font-semibold text-foreground">{s.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA (logged-out only) ────────────────────────── */}
      <section className={`mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 ${user ? "hidden" : ""}`}>
        <div className="glass-card-green flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center sm:p-10">
          <div>
            <p className="font-display text-[22px] font-bold text-foreground">Ready to start your streak?</p>
            <p className="mt-1.5 max-w-md text-[14px] text-muted">Sign in with Google and attempt today&apos;s daily practice.</p>
          </div>
          <Link
            href="/login"
            className="glass-btn-primary inline-flex shrink-0 items-center gap-2 px-6 py-3 text-[14.5px]"
          >
            Continue with Google
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── Practice chooser modal ───────────────────────── */}
      {practiceChooserOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 px-4 py-6 backdrop-blur-sm"
          role="presentation"
          onClick={() => setPracticeChooserOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="practice-chooser-title"
            className="glass-card-solid w-full max-w-xl p-5 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-brand-dark">Choose your practice</p>
                <h2 id="practice-chooser-title" className="mt-1 font-display text-2xl font-bold text-foreground">What would you like to practise?</h2>
              </div>
              <button type="button" onClick={() => setPracticeChooserOpen(false)} aria-label="Close practice choices" className="rounded-full p-2 text-muted transition hover:bg-brand-tint hover:text-foreground">
                <X size={19} />
              </button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link href="/practice" onClick={() => setPracticeChooserOpen(false)} className="glass-card group p-5 transition hover:-translate-y-0.5">
                <BookOpenText className="text-brand" size={22} />
                <h3 className="mt-4 font-display text-[16px] font-semibold text-foreground">Practice questions</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">Choose a section and topic to practise chapter-wise questions.</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-dark">Start practice <ArrowRight size={13} /></span>
              </Link>
              <Link href="/practice/pyqs" onClick={() => setPracticeChooserOpen(false)} className="glass-card group p-5 transition hover:-translate-y-0.5">
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
