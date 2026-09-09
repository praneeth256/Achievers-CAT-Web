"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { ChevronDown, Loader2, Trophy } from "lucide-react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase/client";

type Attempt = { id: string; mockId?: string; type?: string; section?: string; status?: string; score?: number; total?: number; correct?: number; wrong?: number };
type Ranking = { userId: string; displayName?: string; score?: number; correct?: number; wrong?: number };
type Leader = { userId: string; name: string; score: number; correct: number; wrong: number };
type MockResult = { id: string; name: string; score: number; total: number; leaders: Leader[] };
type Group = "Daily Targets" | "VARC Sectionals" | "DILR Sectionals" | "QA Sectionals" | "Full Mocks";

function Summary({ title, attempts }: { title: Group; attempts: Attempt[] }) {
  const scores = attempts.map((attempt) => Number(attempt.score || 0));
  const average = scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1).replace(/\.0$/, "") : "N/A";
  return <section className="rounded-2xl border border-border bg-white p-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-display text-lg font-semibold text-foreground">{title}</h2><p className="mt-1 text-sm text-muted">{attempts.length ? "Submitted attempts only." : "N/A — no submitted attempts yet."}</p></div><div className="grid grid-cols-3 gap-2 text-center"><Metric label="Attempted" value={attempts.length ? String(attempts.length) : "N/A"} /><Metric label="Average" value={average} /><Metric label="Best" value={scores.length ? String(Math.max(...scores)) : "N/A"} /></div></div></section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-20 rounded-xl bg-surface-muted px-3 py-2"><p className="font-display text-base font-bold text-foreground">{value}</p><p className="text-[11px] text-muted">{label}</p></div>;
}

function MockLeaderboard({ result }: { result: MockResult }) {
  return <article className="rounded-2xl border border-border bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-display text-base font-semibold text-foreground">{result.name}</h3><p className="mt-1 text-sm text-muted">Your score: <span className="font-semibold text-foreground">{result.score}/{result.total}</span></p></div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1.5 text-sm font-bold text-brand-darker"><Trophy size={15} /> Highest score: {result.leaders[0]?.score ?? "N/A"}</span>
    </div>
    <details className="group mt-4">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-tint [&::-webkit-details-marker]:hidden">Top 5 scorers <ChevronDown size={14} className="transition-transform group-open:rotate-180" /></summary>
      <div className="mt-3 overflow-hidden rounded-xl border border-border">
        {result.leaders.length ? result.leaders.map((leader, index) => <div key={leader.userId} className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 text-sm last:border-b-0"><span className="min-w-0 truncate font-medium text-foreground"><span className="mr-3 inline-flex w-5 text-muted">{index + 1}</span>{leader.name}</span><span className="font-bold tabular-nums text-brand-darker">{leader.score}</span></div>) : <p className="px-4 py-3 text-sm text-muted">No scores are available for this mock yet.</p>}
      </div>
    </details>
  </article>;
}

export default function PerformancePage() {
  const [user, setUser] = useState<User | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [dailyAttempts, setDailyAttempts] = useState<Attempt[]>([]);
  const [mockResults, setMockResults] = useState<MockResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); if (!nextUser) setLoading(false); }), []);
  useEffect(() => {
    if (!user) return;
    Promise.all([getDocs(query(collection(db, "attempts"), where("userId", "==", user.uid))), getDocs(query(collection(db, "daily_attempts"), where("userId", "==", user.uid)))])
      .then(async ([mockSnapshot, dailySnapshot]) => {
        const submittedAttempts = mockSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Attempt).filter((attempt) => attempt.status === "submitted");
        // A deleted/draft mock or a temporarily unavailable leaderboard must
        // not hide all of the student's own performance summaries.
        const resultSettlements = await Promise.allSettled(submittedAttempts.map(async (attempt) => {
          const mockId = String(attempt.mockId || attempt.id.replace(`${user.uid}_`, ""));
          const [mockSnapshot, rankingsSnapshot] = await Promise.all([getDoc(doc(db, "mocks", mockId)), getDocs(query(collection(db, "mock_rankings"), where("mockId", "==", mockId), orderBy("score", "desc"), limit(5)))]);
          const leaders = rankingsSnapshot.docs.map((item) => item.data() as Ranking).sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(b.correct || 0) - Number(a.correct || 0) || a.userId.localeCompare(b.userId)).map((ranking) => ({ userId: ranking.userId, name: ranking.displayName || "Student", score: Number(ranking.score || 0), correct: Number(ranking.correct || 0), wrong: Number(ranking.wrong || 0) }));
          return { id: mockId, name: String(mockSnapshot.data()?.name || "Mock test"), score: Number(attempt.score || 0), total: Number(attempt.total || 0) * 3, leaders };
        }));
        setAttempts(submittedAttempts);
        setDailyAttempts(dailySnapshot.docs.map((item) => ({ id: item.id, ...item.data(), status: "submitted" }) as Attempt));
        setMockResults(resultSettlements.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
      })
      .catch((loadError) => { console.error(loadError); setError("Could not load your performance right now. Please try again."); })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-brand" /></div>;
  if (!user) return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-2xl font-bold">Sign in to view your performance</h1><Link href="/login" className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">Continue with Google</Link></div>;

  const typeIs = (type: string) => attempts.filter((attempt) => String(attempt.type || "").toLowerCase() === type);
  const sectional = typeIs("sectional");
  const sectionIs = (section: string) => sectional.filter((attempt) => String(attempt.section || "").toUpperCase() === section);

  return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8"><h1 className="font-display text-[28px] font-bold text-foreground">My Performance</h1><p className="mt-2 text-[14.5px] text-muted">Scores from your submitted tests.</p>{error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>}<div className="mt-8 space-y-4"><Summary title="Daily Targets" attempts={dailyAttempts} /><div className="grid gap-4 lg:grid-cols-3"><Summary title="VARC Sectionals" attempts={sectionIs("VARC")} /><Summary title="DILR Sectionals" attempts={sectionIs("DILR")} /><Summary title="QA Sectionals" attempts={sectionIs("QA")} /></div><Summary title="Full Mocks" attempts={typeIs("full")} /></div><section className="mt-8"><h2 className="font-display text-xl font-semibold text-foreground">Mock test performance</h2><p className="mt-1 text-sm text-muted">See the highest score and top scorers for each mock you have completed.</p><div className="mt-4 space-y-3">{mockResults.length ? mockResults.map((result) => <MockLeaderboard key={result.id} result={result} />) : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">Complete a mock test to see its leaderboard here.</div>}</div></section></div>;
}
