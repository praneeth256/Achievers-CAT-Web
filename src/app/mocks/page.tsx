"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, onSnapshot, orderBy, query, where, limit } from "firebase/firestore";
import MockCard, { MockSummary, TopScorer } from "@/components/MockCard";
import { auth, db } from "@/lib/firebase/client";
import { Loader2 } from "lucide-react";

export default function FullMocksPage() {
  const [mocks, setMocks] = useState<MockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [attempts, setAttempts] = useState<Record<string, MockSummary["attempted"]>>({});
  const [topScorers, setTopScorers] = useState<Record<string, TopScorer[]>>({});

  useEffect(() => onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); if (!nextUser) setAttempts({}); }), []);

  // Listen for submitted full-mock attempts for this user.
  // Keep only the FIRST submitted record per mock (earliest submittedAt) so
  // a re-visit that records a zero never overwrites the real score.
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
        // Keep the first (earliest) completed attempt per mock
        if (firstSubmittedAt[mockId] !== undefined && firstSubmittedAt[mockId] <= attemptedAt) return;
        firstSubmittedAt[mockId] = attemptedAt;
        next[mockId] = {
          score: Number(value.score || 0),
          total: Number(value.total || 0),
          correct: Number(value.correct || 0),
          wrong: Number(value.wrong || 0),
          percentile: typeof value.percentile === "number" ? value.percentile : undefined,
          attemptedOn: submittedAt ? submittedAt.toLocaleDateString() : "just now",
        };
      });
      setAttempts(next);
    });
  }, [user]);

  // Fetch published full mocks
  useEffect(() => {
    getDocs(query(collection(db, "mocks"), where("type", "==", "full"), where("status", "==", "published")))
      .then(async (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MockSummary));
        rows.sort((a, b) => a.name.localeCompare(b.name));
        setMocks(rows);

        // Fetch top-5 scorers for each mock from mock_rankings
        const scorerMap: Record<string, TopScorer[]> = {};
        await Promise.all(
          rows.map(async (mock) => {
            const rankSnap = await getDocs(
              query(
                collection(db, "mock_rankings"),
                where("mockId", "==", mock.id),
                orderBy("score", "desc"),
                limit(5)
              )
            );
            scorerMap[mock.id] = rankSnap.docs.map((d) => {
              const data = d.data();
              return {
                userId: String(data.userId || d.id),
                displayName: String(data.displayName || "Student"),
                score: Number(data.score || 0),
              };
            });
          })
        );
        setTopScorers(scorerMap);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-[28px] font-bold text-foreground">Full Mocks</h1>
      <p className="mt-2 text-[14.5px] text-muted">Click any mock name or Open Mock — it opens the uploaded HTML mock in a new tab. Completed mocks reopen in analysis mode.</p>
      <div className="mt-6 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand" /></div>
        ) : mocks.length ? mocks.map((mock) => (
          <MockCard
            key={mock.id}
            mock={{
              ...mock,
              attempted: attempts[mock.id],
              topScorers: topScorers[mock.id],
            }}
          />
        )) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">No full mocks have been published yet.</div>
        )}
      </div>
    </div>
  );
}
