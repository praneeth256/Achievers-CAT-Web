"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Clock, Sparkles, Trophy, X } from "lucide-react";
import { auth, db } from "@/lib/firebase/client";

type ScheduledMock = {
  mockId: string;
  name?: string;
  type?: "full" | "sectional";
  section?: string;
  questions?: number;
  durationMins?: number;
  status?: string;
};

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function DailyMockPopup() {
  const [mock, setMock] = useState<ScheduledMock | null>(null);

  useEffect(() => {
    const date = todayInIndia();
    const dismissedKey = `achievers-daily-mock-dismissed:${date}`;
    if (sessionStorage.getItem(dismissedKey)) return;

    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || !active) return;
      try {
        const announcement = await getDoc(doc(db, "daily_mock_announcements", date));
        if (!announcement.exists() || !active) return;
        const mockId = String(announcement.data().mockId || "");
        if (!mockId) return;

        const mockSnapshot = await getDoc(doc(db, "mocks", mockId));
        if (!mockSnapshot.exists() || mockSnapshot.data().status !== "published" || !active) return;
        setMock({ mockId, ...mockSnapshot.data() } as ScheduledMock);
      } catch (error) {
        console.error("Could not load today's mock announcement:", error);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (!mock) return null;

  const dismiss = () => {
    sessionStorage.setItem(`achievers-daily-mock-dismissed:${todayInIndia()}`, "true");
    setMock(null);
  };

  const label = mock.type === "sectional" ? `${mock.section || "Sectional"} mock` : "Competitive full mock";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="todays-mock-title">
      <section className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-950/30">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-dark via-brand to-cyan-400" />
        <button type="button" onClick={dismiss} aria-label="Close today's mock popup" className="absolute right-4 top-4 rounded-full p-1.5 text-muted transition hover:bg-slate-100 hover:text-foreground">
          <X size={20} />
        </button>
        <div className="p-6 pt-8 sm:p-8 sm:pt-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-tint text-brand-darker">
            <Trophy size={24} />
          </div>
          <p className="mt-5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-darker"><Sparkles size={13} /> Today&apos;s competitive mock</p>
          <h2 id="todays-mock-title" className="mt-2 font-display text-2xl font-bold leading-tight text-foreground">Today&apos;s Mock is Live</h2>
          <p className="mt-3 font-display text-[19px] font-semibold leading-snug text-brand-darker">{mock.name || "Competitive mock"}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">Challenge yourself, see where you stand, and build your CAT exam rhythm.</p>

          <div className="mt-5 flex flex-wrap gap-2 text-[12px] font-semibold text-muted">
            <span className="rounded-full bg-surface-muted px-3 py-1.5">{label}</span>
            {mock.questions ? <span className="rounded-full bg-surface-muted px-3 py-1.5">{mock.questions} questions</span> : null}
            {mock.durationMins ? <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1.5"><Clock size={13} /> {mock.durationMins} min</span> : null}
          </div>

          <Link href={`/mock-view/${mock.mockId}`} target="_blank" rel="noopener noreferrer" onClick={dismiss} className="mt-7 flex w-full items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark">
            Start Today&apos;s Mock
          </Link>
          <button type="button" onClick={dismiss} className="mt-3 w-full rounded-xl border border-border px-5 py-3 text-sm font-semibold text-brand-darker transition hover:bg-brand-tint">
            I&apos;ll attempt it later
          </button>
        </div>
      </section>
    </div>
  );
}
