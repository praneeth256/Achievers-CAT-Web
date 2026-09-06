"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { ChevronDown, Crown, Loader2, Trophy } from "lucide-react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase/client";

type DailySection = "quant" | "varc" | "dilr";
type DailyAttempt = { id: string; date: string; section: DailySection; score: number; total: number; rank: number; attempters: number; varcType?: "RC" | "VA" };
type Attempt = { id?: string; mockId?: string; score?: unknown; total?: unknown; overallScore?: unknown; totalScore?: unknown; mockType?: unknown; testType?: unknown; type?: unknown; status?: unknown };
type MockDetails = { id: string; name?: string; questions?: number };
type TopScorer = { userId: string; name: string; score: number };
type Category = "Daily Targets" | "Sectional Mocks" | "Full Mocks";

const scoreOf = (attempt: Attempt) => Number(attempt.score ?? attempt.overallScore ?? attempt.totalScore ?? 0);
const average = (scores: number[]) => scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1).replace(/\.0$/, "") : "N/A";
const labelForDailyAttempt = (attempt: DailyAttempt) => attempt.section === "quant" ? "QA (Daily Targets)" : attempt.section === "dilr" ? "DILR Set of the Day (Daily Targets)" : `${attempt.varcType === "VA" ? "VA" : "RC"} of the Day (Daily Targets)`;

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-20 rounded-xl bg-surface-muted px-3 py-2"><p className="font-display text-base font-bold text-foreground">{value}</p><p className="text-[11px] text-muted">{label}</p></div>;
}

function CategorySummary({ title, attempts }: { title: Category; attempts: Attempt[] }) {
  const scores = attempts.map(scoreOf);
  return <section className="rounded-2xl border border-border bg-white p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-lg font-semibold text-foreground">{title}</h2><p className="mt-1 text-sm text-muted">Your completed {title.toLowerCase()}.</p></div><div className="grid grid-cols-3 gap-2 text-center"><Metric label="Attempted" value={attempts.length ? String(attempts.length) : "N/A"} /><Metric label="Average" value={average(scores)} /><Metric label="Best" value={scores.length ? String(Math.max(...scores)) : "N/A"} /></div></div></section>;
}

function MockLeaderboard({ attempt, mock, scorers, expanded, loading, onToggle }: { attempt: Attempt; mock?: MockDetails; scorers?: TopScorer[]; expanded: boolean; loading: boolean; onToggle: () => void }) {
  const score = scoreOf(attempt);
  const total = Number(attempt.total || mock?.questions || 0) * 3;
  const highestScore = scorers?.[0]?.score;
  return <article className="rounded-2xl border border-border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-display text-lg font-bold text-foreground">{mock?.name || "Mock test"}</h3><p className="mt-1 text-sm text-muted">Your score: <span className="font-semibold text-brand-darker">{score}{total ? `/${total}` : ""}</span>{highestScore !== undefined ? <> · Highest score: <span className="font-semibold text-brand-darker">{highestScore}{total ? `/${total}` : ""}</span></> : null}</p></div><button type="button" onClick={onToggle} className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-tint px-3.5 py-2 text-sm font-semibold text-brand-darker transition hover:bg-brand/15" aria-expanded={expanded}>{loading ? "Loading scorers…" : "Top 5 scorers"}<ChevronDown size={16} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} /></button></div>{expanded && <div className="mt-4 overflow-hidden rounded-xl border border-brand/15 bg-brand-tint/40"><div className="flex items-center gap-2 border-b border-brand/15 px-4 py-3 text-sm font-semibold text-brand-darker"><Crown size={16} /> Top scorers · highest score first</div>{loading ? <div className="p-5 text-sm text-muted">Loading leaderboard…</div> : scorers?.length ? <ol className="divide-y divide-brand/10">{scorers.map((scorer, index) => <li key={scorer.userId} className="flex items-center justify-between px-4 py-3"><span className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-darker">{index + 1}</span><span className="text-sm font-medium text-foreground">{scorer.name}</span></span><span className="font-display text-sm font-bold text-brand-darker">{scorer.score}{total ? `/${total}` : ""}</span></li>)}</ol> : <div className="p-5 text-sm text-muted">No submitted scores yet.</div>}</div>}</article>;
}

export default function PerformancePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyAttempts, setDailyAttempts] = useState<DailyAttempt[]>([]);
  const [sectionalAttempts, setSectionalAttempts] = useState<Attempt[]>([]);
  const [fullMockAttempts, setFullMockAttempts] = useState<Attempt[]>([]);
  const [mockAttempts, setMockAttempts] = useState<Attempt[]>([]);
  const [mockDetails, setMockDetails] = useState<Record<string, MockDetails>>({});
  const [topScorers, setTopScorers] = useState<Record<string, TopScorer[]>>({});
  const [expandedMock, setExpandedMock] = useState<string | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, (currentUser) => setUser(currentUser)), []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [dailySnapshot, attemptsSnapshot] = await Promise.all([getDocs(query(collection(db, "daily_attempts"), where("userId", "==", user.uid))), getDocs(query(collection(db, "attempts"), where("userId", "==", user.uid)))]);
      const dailyRows = dailySnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })) as (Omit<DailyAttempt, "rank" | "attempters" | "varcType">)[];
      const packageTypes = new Map<string, "RC" | "VA" | undefined>();
      await Promise.all([...new Set(dailyRows.map((attempt) => attempt.date))].map(async (date) => { const packageSnapshot = await getDoc(doc(db, "daily_packages", date)); packageTypes.set(date, packageSnapshot.exists() ? packageSnapshot.data().varc?.type : undefined); }));
      const rankedDailyAttempts = await Promise.all(dailyRows.map(async (attempt) => {
        const leaderboardSnapshot = await getDocs(collection(db, "daily_leaderboards", `${attempt.date}_${attempt.section}`, "entries"));
        const scores = leaderboardSnapshot.docs.map((entry) => Number(entry.data().score || 0));
        return { ...attempt, score: Number(attempt.score || 0), total: Number(attempt.total || 0), rank: scores.filter((score) => score > Number(attempt.score || 0)).length + 1, attempters: scores.length, varcType: packageTypes.get(attempt.date) } as DailyAttempt;
      }));
      const allAttempts = attemptsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as Attempt);
      const typeOf = (attempt: Attempt) => String(attempt.mockType ?? attempt.testType ?? attempt.type ?? "").toLowerCase();
      const completedMocks = allAttempts.filter((attempt) => attempt.status === "submitted" && typeof attempt.mockId === "string");
      const details = await Promise.all(completedMocks.map(async (attempt) => { const mockSnapshot = await getDoc(doc(db, "mocks", String(attempt.mockId))); return mockSnapshot.exists() ? ({ id: mockSnapshot.id, ...mockSnapshot.data() } as MockDetails) : null; }));
      if (!cancelled) { setDailyAttempts(rankedDailyAttempts.sort((a, b) => b.date.localeCompare(a.date))); setSectionalAttempts(allAttempts.filter((attempt) => typeOf(attempt) === "sectional")); setFullMockAttempts(allAttempts.filter((attempt) => ["full", "full-mock", "full_mock"].includes(typeOf(attempt)))); setMockAttempts(completedMocks); setMockDetails(Object.fromEntries(details.filter((mock): mock is MockDetails => Boolean(mock)).map((mock) => [mock.id, mock]))); }
    })().catch((error) => console.error("Could not load performance:", error)).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  async function toggleLeaderboard(mockId: string) {
    if (expandedMock === mockId) { setExpandedMock(null); return; }
    setExpandedMock(mockId);
    if (topScorers[mockId]) return;
    setLoadingLeaderboard(mockId);
    try {
      const rankingSnapshot = await getDocs(query(collection(db, "mock_rankings"), where("mockId", "==", mockId)));
      const rankings = rankingSnapshot.docs.map((snapshot) => snapshot.data()).sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 5);
      const scorers = await Promise.all(rankings.map(async (ranking) => { const profileSnapshot = await getDoc(doc(db, "profiles", String(ranking.userId))); const profile = profileSnapshot.exists() ? profileSnapshot.data() : {}; return { userId: String(ranking.userId), name: String(profile.name || profile.displayName || profile.email || "Student"), score: Number(ranking.score || 0) }; }));
      setTopScorers((current) => ({ ...current, [mockId]: scorers }));
    } catch (error) { console.error("Could not load mock leaderboard:", error); setTopScorers((current) => ({ ...current, [mockId]: [] })); }
    finally { setLoadingLeaderboard(null); }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-brand" /></div>;
  if (!user) return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-2xl font-bold">Sign in to view your performance</h1><Link href="/login" className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">Continue with Google</Link></div>;
  return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8"><h1 className="font-display text-[28px] font-bold text-foreground">My Performance</h1><p className="mt-2 text-[14.5px] text-muted">Scores and ranks from your submitted tests.</p><div className="mt-8 space-y-4"><CategorySummary title="Daily Targets" attempts={dailyAttempts} /><CategorySummary title="Sectional Mocks" attempts={sectionalAttempts} /><CategorySummary title="Full Mocks" attempts={fullMockAttempts} /></div><section className="mt-6 rounded-2xl border border-border bg-white p-5"><div className="flex items-center gap-2"><Trophy size={18} className="text-brand" /><h2 className="font-display text-lg font-semibold text-foreground">Mock Test Leaderboards</h2></div><p className="mt-1 text-sm text-muted">Open a completed mock to see its highest score and top five scorers.</p>{mockAttempts.length === 0 ? <p className="mt-4 text-sm text-muted">N/A — you have not completed a mock yet.</p> : <div className="mt-4 space-y-3">{mockAttempts.map((attempt) => <MockLeaderboard key={String(attempt.mockId)} attempt={attempt} mock={mockDetails[String(attempt.mockId)]} scorers={topScorers[String(attempt.mockId)]} expanded={expandedMock === attempt.mockId} loading={loadingLeaderboard === attempt.mockId} onToggle={() => void toggleLeaderboard(String(attempt.mockId))} />)}</div>}</section><section className="mt-6 rounded-2xl border border-border bg-white p-5"><div className="flex items-center gap-2"><Trophy size={18} className="text-brand" /><h2 className="font-display text-lg font-semibold text-foreground">Daily Target Attempts</h2></div>{dailyAttempts.length === 0 ? <p className="mt-4 text-sm text-muted">N/A — you have not attempted a Daily Target yet.</p> : <div className="mt-4 divide-y divide-border">{dailyAttempts.map((attempt) => <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"><div><p className="font-medium text-foreground">{labelForDailyAttempt(attempt)}</p><p className="mt-1 text-xs text-muted">{attempt.date}</p></div><div className="flex items-center gap-5 text-right"><div><p className="font-semibold text-foreground">{attempt.score}/{attempt.total * 3}</p><p className="text-xs text-muted">Your score</p></div><div><p className="font-semibold text-foreground">{attempt.rank}/{attempt.attempters}</p><p className="text-xs text-muted">Rank</p></div></div></div>)}</div>}</section></div>;
}
