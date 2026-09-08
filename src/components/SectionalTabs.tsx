"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MockCard, { MockSummary } from "./MockCard";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { Loader2 } from "lucide-react";

const sections = ["VARC", "DILR", "QA"] as const;
type Section = (typeof sections)[number];

export default function SectionalTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedSection = searchParams.get("section");
  const active: Section = requestedSection && sections.includes(requestedSection as Section) ? requestedSection as Section : "VARC";
  const [data, setData] = useState<Record<Section, MockSummary[]>>({ VARC: [], DILR: [], QA: [] });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [attempts, setAttempts] = useState<Record<string, MockSummary["attempted"]>>({});

  useEffect(() => onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); if (!nextUser) setAttempts({}); }), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "attempts"), where("userId", "==", user.uid)), (snapshot) => {
      const next: Record<string, MockSummary["attempted"]> = {};
      const firstSubmittedAt: Record<string, number> = {};
      snapshot.docs.forEach((item) => {
        const value = item.data();
        if (value.status !== "submitted" || String(value.type || "").toLowerCase() !== "sectional" || !value.mockId) return;
        const submittedAt = value.submittedAt?.toDate?.() || value.startedAt?.toDate?.();
        const mockId = String(value.mockId);
        const attemptedAt = submittedAt?.getTime() || Number.MAX_SAFE_INTEGER;
        // Some legacy uploads created one document per reattempt. Keep the
        // first completed record so the card and its analysis never drift to
        // a later retake. Current uploads use one document and follow this
        // same rule naturally.
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

  useEffect(() => {
    getDocs(query(collection(db, "mocks"), where("type", "==", "sectional"), where("status", "==", "published")))
      .then((snap) => {
        const next: Record<Section, MockSummary[]> = { VARC: [], DILR: [], QA: [] };
        snap.docs.forEach((d) => {
          const row = { id: d.id, ...d.data() } as MockSummary;
          if (row.section && sections.includes(row.section as Section)) next[row.section as Section].push(row);
        });
        (Object.keys(next) as Section[]).forEach((key) => next[key].sort((a, b) => a.name.localeCompare(b.name)));
        setData(next);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-[28px] font-bold text-foreground">Sectional Mocks</h1>
      <p className="mt-2 text-[14.5px] text-muted">Focused practice for VARC, DILR and QA. Scores update here live after submission; completed mocks reopen in analysis mode.</p>

      <div className="mt-6 flex gap-2 overflow-x-auto rounded-full border border-border bg-surface-muted p-1">
        {sections.map((s) => (
          <button key={s} onClick={() => router.replace(`/sectional?section=${s}`)} className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 text-[13.5px] font-semibold transition ${active === s ? "bg-white text-brand-darker shadow-sm" : "text-muted hover:text-foreground"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand" /></div> : data[active].length ? data[active].map((mock) => <MockCard key={mock.id} mock={{ ...mock, attempted: attempts[mock.id] }} />) : <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">No {active} sectional mocks have been published yet.</div>}
      </div>
    </div>
  );
}
