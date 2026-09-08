"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import MockCard, { MockSummary } from "@/components/MockCard";
import { auth, db } from "@/lib/firebase/client";
import { Loader2 } from "lucide-react";

export default function FullMocksPage() {
  const [mocks, setMocks] = useState<MockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [attempts, setAttempts] = useState<Record<string, MockSummary["attempted"]>>({});

  useEffect(() => onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); if (!nextUser) setAttempts({}); }), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "attempts"), where("userId", "==", user.uid)), (snapshot) => {
      const next: Record<string, MockSummary["attempted"]> = {};
      snapshot.docs.forEach((item) => {
        const value = item.data();
        if (value.status !== "submitted" || String(value.type || "").toLowerCase() !== "full" || !value.mockId) return;
        const submittedAt = value.submittedAt?.toDate?.();
        next[String(value.mockId)] = { score: Number(value.score || 0), total: Number(value.total || 0), correct: Number(value.correct || 0), wrong: Number(value.wrong || 0), percentile: typeof value.percentile === "number" ? value.percentile : undefined, attemptedOn: submittedAt ? submittedAt.toLocaleDateString() : "just now" };
      });
      setAttempts(next);
    });
  }, [user]);

  useEffect(() => {
    getDocs(query(collection(db, "mocks"), where("type", "==", "full"), where("status", "==", "published")))
      .then((snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MockSummary));
        rows.sort((a, b) => a.name.localeCompare(b.name));
        setMocks(rows);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-[28px] font-bold text-foreground">Full Mocks</h1>
      <p className="mt-2 text-[14.5px] text-muted">Click any mock name or Open Mock — it opens the uploaded HTML mock in a new tab.</p>
      <div className="mt-6 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand" /></div>
        ) : mocks.length ? mocks.map((mock) => <MockCard key={mock.id} mock={{ ...mock, attempted: attempts[mock.id] }} />) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">No full mocks have been published yet.</div>
        )}
      </div>
    </div>
  );
}
