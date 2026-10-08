"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, onSnapshot, orderBy, query, where, limit } from "firebase/firestore";
import MockCard, { MockSummary, TopScorer } from "@/components/MockCard";
import { auth, db } from "@/lib/firebase/client";
import { BarChart3, Clock, Loader2, Trophy } from "lucide-react";

export default function FullMocksPage() {
  const [mocks, setMocks] = useState<MockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [attempts, setAttempts] = useState<Record<string, MockSummary["attempted"]>>({});
  const [topScorers, setTopScorers] = useState<Record<string, TopScorer[]>>({});

  useEffect(() => onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); if (!nextUser) setAttempts({}); }), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "attempts"), where("userId", "==", user.uid)), (snapshot) => {
      const next: Record<string, MockSummary["attempted"]> = {};
      const firstSubmittedAt: Record<string, number> = {};
      snapshot.docs.forEach((item) => {
        const value = item.data();
        if (value.status !== "submitted" || String(value.type || "").toLowerCase() !== "full" || !value.mockId) return;
        const submittedAt = value.submittedAt?.toDate?.();
        const mockId = String(value.mockId);
        const attemptedAt = submittedAt?.getTime() || Number.MAX_SAFE_INTEGER;
        if (firstSubmittedAt[mockId] !== undefined && firstSubmittedAt[mockId] <= attemptedAt) return;
        firstSubmittedAt[mockId] = attemptedAt;
        next[mockId] = {
          score: Number(value.score || 0),
          total: Number(value.total || 0),
          correct: Number(value.correct || 0),
          wrong: Number(value.wrong || 0),
          percentile: typeof value.percentile === "number" ? value.percentile : undefined,
          fullMock: value.fullMock === true,
          attemptedOn: submittedAt ? submittedAt.toLocaleDateString() : "just now",
        };
      });
      setAttempts(next);
    });
  }, [user]);

  useEffect(() => {
    getDocs(query(collection(db, "mocks"), where("type", "==", "full"), where("status", "==", "published")))
      .then(async (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MockSummary));
        const mockNum = (name: string) => { const m = name.match(/(\d+)\s*$/); return m ? parseInt(m[1], 10) : 0; };
        rows.sort((a, b) => mockNum(a.name) - mockNum(b.name));
        setMocks(rows);
        const scorerMap: Record<string, TopScorer[]> = {};
        await Promise.all(rows.map(async (mock) => {
          const rankSnap = await getDocs(query(collection(db, "mock_rankings"), where("mockId", "==", mock.id), orderBy("score", "desc"), limit(5)));
          scorerMap[mock.id] = rankSnap.docs.map((d) => ({ userId: String(d.data().userId || d.id), displayName: String(d.data().displayName || "Student"), score: Number(d.data().score || 0) }));
        }));
        setTopScorers(scorerMap);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-brand-darker">
              <BarChart3 size={18} />
            </span>
            <h1 className="font-display text-[24px] font-bold text-foreground">Full Mocks</h1>
          </div>
          <p className="mt-1 text-[13.5px] text-muted ml-12">
            Improve accuracy and speed with full-length CAT mocks.
          </p>
        </div>

        {/* Stats banner */}
        <div className="glass-card-green mb-6 flex items-center gap-6 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-[13.5px]">
            <Trophy size={16} className="text-brand-darker" />
            <span className="font-semibold text-foreground">Complete a mock and see your percentile instantly</span>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-1 text-[12px] text-muted">
            <Clock size={13} />
            120 mins · VARC · DILR · QA
          </div>
        </div>

        {/* Mock list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-brand" size={24} />
          </div>
        ) : mocks.length ? (
          <div className="flex flex-col gap-4">
            {mocks.map((mock) => (
              <MockCard
                key={mock.id}
                mock={{ ...mock, attempted: attempts[mock.id], topScorers: topScorers[mock.id] }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <BarChart3 size={32} className="mx-auto mb-3 text-muted" />
            <p className="text-[14px] font-semibold text-foreground">No full mocks published yet</p>
            <p className="mt-1 text-[13px] text-muted">Check back soon — mocks are added regularly.</p>
          </div>
        )}
      </div>
    </div>
  );
}
