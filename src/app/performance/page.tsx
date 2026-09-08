"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase/client";

type Attempt = { id: string; type?: string; section?: string; status?: string; score?: number; total?: number };
type Group = "Daily Targets" | "VARC Sectionals" | "DILR Sectionals" | "QA Sectionals" | "Full Mocks";

function Summary({ title, attempts }: { title: Group; attempts: Attempt[] }) {
  const scores = attempts.map((attempt) => Number(attempt.score || 0));
  const average = scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1).replace(/\.0$/, "") : "N/A";
  return <section className="rounded-2xl border border-border bg-white p-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-display text-lg font-semibold text-foreground">{title}</h2><p className="mt-1 text-sm text-muted">{attempts.length ? "Submitted attempts only." : "N/A — no submitted attempts yet."}</p></div><div className="grid grid-cols-3 gap-2 text-center"><Metric label="Attempted" value={attempts.length ? String(attempts.length) : "N/A"} /><Metric label="Average" value={average} /><Metric label="Best" value={scores.length ? String(Math.max(...scores)) : "N/A"} /></div></div></section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-20 rounded-xl bg-surface-muted px-3 py-2"><p className="font-display text-base font-bold text-foreground">{value}</p><p className="text-[11px] text-muted">{label}</p></div>;
}

export default function PerformancePage() {
  const [user, setUser] = useState<User | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [dailyAttempts, setDailyAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([getDocs(query(collection(db, "attempts"), where("userId", "==", user.uid))), getDocs(query(collection(db, "daily_attempts"), where("userId", "==", user.uid)))])
      .then(([mockSnapshot, dailySnapshot]) => { setAttempts(mockSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Attempt).filter((attempt) => attempt.status === "submitted")); setDailyAttempts(dailySnapshot.docs.map((item) => ({ id: item.id, ...item.data(), status: "submitted" }) as Attempt)); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-brand" /></div>;
  if (!user) return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-2xl font-bold">Sign in to view your performance</h1><Link href="/login" className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">Continue with Google</Link></div>;

  const typeIs = (type: string) => attempts.filter((attempt) => String(attempt.type || "").toLowerCase() === type);
  const sectional = typeIs("sectional");
  const sectionIs = (section: string) => sectional.filter((attempt) => String(attempt.section || "").toUpperCase() === section);

  return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8"><h1 className="font-display text-[28px] font-bold text-foreground">My Performance</h1><p className="mt-2 text-[14.5px] text-muted">Scores from your submitted tests.</p><div className="mt-8 space-y-4"><Summary title="Daily Targets" attempts={dailyAttempts} /><div className="grid gap-4 lg:grid-cols-3"><Summary title="VARC Sectionals" attempts={sectionIs("VARC")} /><Summary title="DILR Sectionals" attempts={sectionIs("DILR")} /><Summary title="QA Sectionals" attempts={sectionIs("QA")} /></div><Summary title="Full Mocks" attempts={typeIs("full")} /></div></div>;
}
