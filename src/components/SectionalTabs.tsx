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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Loader2 size={18} className="hidden" />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </span>
            <h1 className="font-display text-[24px] font-bold text-foreground">Sectional Mocks</h1>
          </div>
          <p className="mt-1 text-[13.5px] text-muted ml-12">
            Improve accuracy and speed with section-wise mocks.
          </p>
        </div>

        {/* Top banner */}
        <div className="glass-card-green mb-5 p-4 flex items-center justify-between">
          <p className="text-[13px] font-medium text-brand-darker">
            🎯 Build your streak. Aim for 99.5+%ile.
          </p>
          <span className="text-[12px] text-muted hidden sm:block">Scores auto-save after submission</span>
        </div>

        {/* Section tabs */}
        <div className="mb-5 flex gap-2">
          {sections.map((s) => (
            <button
              key={s}
              onClick={() => router.replace(`/sectional?section=${s}`)}
              className={`rounded-full px-5 py-2 text-[13.5px] font-semibold transition ${
                active === s
                  ? "bg-brand text-white shadow-md shadow-brand/25"
                  : "border border-border bg-white text-muted hover:border-brand hover:text-brand-darker"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Mock list */}
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-brand" size={24} />
            </div>
          ) : data[active].length ? (
            data[active].map((mock) => (
              <MockCard key={mock.id} mock={{ ...mock, attempted: attempts[mock.id] }} />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="text-[14px] font-semibold text-foreground">No {active} sectional mocks yet</p>
              <p className="mt-1 text-[13px] text-muted">Mocks are added regularly — check back soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
