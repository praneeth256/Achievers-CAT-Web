"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDoc, limit, onSnapshot, query } from "firebase/firestore";
import { ArrowRight, BookOpenCheck, Brain, CheckCircle2, Flame, Loader2, Network, Target } from "lucide-react";
import { auth, db } from "@/lib/firebase/client";

type Section = "quant" | "varc" | "dilr";
type AttemptFilter = "all" | "attempted" | "unattempted";
type SortOrder = "newest" | "oldest" | "score-ascending" | "score-descending";
type DailyAttempt = { score?: number; total?: number };
type DailyPackage = { id: string; date?: string; published?: boolean; quant?: { title?: string }[]; varc?: { type?: "RC" | "VA"; title?: string; questions?: unknown[] }; dilr?: { title?: string; questions?: unknown[] } };

const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const formatDate = (date: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(date + "T00:00:00+05:30"));
const formatTableDate = (date: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(date + "T00:00:00+05:30"));
const emptyAttempts = new Map<string, DailyAttempt>();

function sectionsFor(item: DailyPackage) {
  return [
    { key: "quant" as Section, label: "Quant", title: item.quant?.[0]?.title || "Quantitative Aptitude", count: item.quant?.length || 0, icon: Brain },
    { key: "varc" as Section, label: "VARC", title: item.varc?.title || (item.varc?.type === "VA" ? "VA of the Day" : "RC of the Day"), count: item.varc?.questions?.length || 0, icon: BookOpenCheck },
    { key: "dilr" as Section, label: "DILR", title: item.dilr?.title || "DILR Set of the Day", count: item.dilr?.questions?.length || 0, icon: Network },
  ];
}

function targetHref(user: User | null, section: Section, date: string) {
  const path = "/daily/question?section=" + section + "&date=" + date;
  return user ? path : "/login?returnTo=" + encodeURIComponent(path);
}

function TargetSections({ item, user, attempted }: { item: DailyPackage; user: User | null; attempted: Set<string> }) {
  const date = item.date || item.id;
  return <div className="mt-4 grid gap-3 sm:grid-cols-3">{sectionsFor(item).map((section) => {
    const done = user ? attempted.has(date + "_" + section.key) : false;
    const Icon = section.icon;
    return <div key={section.key} className="rounded-xl border border-border bg-white p-4"><div className="flex items-center gap-2.5"><span className="rounded-lg bg-brand-tint p-2 text-brand-darker"><Icon size={17} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{section.title}</p><p className="text-xs text-muted">{section.count} questions · 15 min</p></div></div><Link href={targetHref(user, section.key, date)} className={"mt-4 flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold " + (done ? "border border-brand/20 bg-brand-tint text-brand-darker" : "bg-brand text-white hover:bg-brand-dark")}>{done ? <><CheckCircle2 size={14} /> View result</> : <>{user ? "Attempt test" : "Log in to attempt"} <ArrowRight size={14} /></>}</Link></div>;
  })}</div>;
}

export default function DailyTargetsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [packages, setPackages] = useState<DailyPackage[]>([]);
  const [attempts, setAttempts] = useState<Map<string, DailyAttempt>>(new Map());
  const [loading, setLoading] = useState(true);
  const [attemptFilter, setAttemptFilter] = useState<AttemptFilter>("all");
  const [sectionFilter, setSectionFilter] = useState<Section | "all">("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const today = useMemo(() => todayIST(), []);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => onSnapshot(query(collection(db, "daily_packages"), limit(60)), (snapshot) => {
    const availablePackages = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }) as DailyPackage)
      .filter((item) => item.published !== false)
      .sort((a, b) => (b.date || b.id).localeCompare(a.date || a.id));
    setPackages(availablePackages);
    setLoading(false);
  }, (error) => { console.error("Could not load daily targets:", error); setLoading(false); }), []);
  useEffect(() => {
    if (!user || !packages.length) return;
    let active = true;
    Promise.all(packages.flatMap((item) => sectionsFor(item).map(async (section) => {
      const date = item.date || item.id;
      const snapshot = await getDoc(doc(db, "daily_attempts", date + "_" + section.key + "_" + user.uid));
      return snapshot.exists() ? [date + "_" + section.key, snapshot.data() as DailyAttempt] as const : null;
    }))).then((results) => {
      if (active) setAttempts(new Map(results.filter((value): value is readonly [string, DailyAttempt] => Boolean(value))));
    }).catch((error) => console.error("Could not load daily target results:", error));
    return () => { active = false; };
  }, [packages, user]);

  const todayPackage = packages.find((item) => (item.date || item.id) === today);
  const previousPackages = packages.filter((item) => (item.date || item.id) !== today);
  const visibleAttempts = user ? attempts : emptyAttempts;
  const todayCompleted = todayPackage ? sectionsFor(todayPackage).filter((section) => visibleAttempts.has(today + "_" + section.key)).length : 0;
  const rows = useMemo(() => previousPackages.flatMap((item) => {
    const date = item.date || item.id;
    return sectionsFor(item).map((section) => ({ id: date + "_" + section.key, date, section, attempt: visibleAttempts.get(date + "_" + section.key) }));
  }).filter((row) => (sectionFilter === "all" || row.section.key === sectionFilter) && (attemptFilter === "all" || (attemptFilter === "attempted" ? Boolean(row.attempt) : !row.attempt))).sort((a, b) => {
    if (sortOrder === "oldest") return a.date.localeCompare(b.date);
    if (sortOrder === "score-ascending" || sortOrder === "score-descending") {
      const scoreA = a.attempt ? Number(a.attempt.score || 0) : null;
      const scoreB = b.attempt ? Number(b.attempt.score || 0) : null;
      if (scoreA === null) return 1;
      if (scoreB === null) return -1;
      return sortOrder === "score-ascending" ? scoreA - scoreB : scoreB - scoreA;
    }
    return b.date.localeCompare(a.date);
  }), [attemptFilter, previousPackages, sectionFilter, sortOrder, visibleAttempts]);

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-brand" /></div>;
  return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
    <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Daily Practice</p><h1 className="mt-1 font-display text-[28px] font-bold text-foreground">Daily Targets</h1><p className="mt-2 text-sm text-muted">Complete today&apos;s targets or return to any previous daily test whenever you want.</p>
    <section className="mt-7 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">{todayPackage ? <><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-display text-xl font-bold">Today&apos;s Targets</p><p className="mt-1 text-sm text-muted">{formatDate(today)}</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1.5 text-xs font-bold text-brand-darker"><Flame size={14} className="text-flame" /> {todayCompleted}/3 complete</span></div><div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-brand transition-all" style={{ width: (todayCompleted / 3) * 100 + "%" }} /></div><TargetSections item={todayPackage} user={user} attempted={new Set(visibleAttempts.keys())} /></> : <div className="py-5 text-center"><Target className="mx-auto text-brand" /><p className="mt-3 font-semibold">Today&apos;s targets are being prepared.</p></div>}</section>
    <section className="mt-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Practice archive</p><h2 className="mt-1 font-display text-2xl font-bold">Previous Daily Targets</h2></div><span className="text-sm text-muted">{previousPackages.length} days available</span></div>
      {previousPackages.length ? <><div className="mt-5 flex flex-wrap gap-3"><label className="sr-only" htmlFor="attempt-filter">Filter by attempt</label><select id="attempt-filter" value={attemptFilter} onChange={(event) => setAttemptFilter(event.target.value as AttemptFilter)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-brand"><option value="all">Filter by attempt</option><option value="attempted">Attempted</option><option value="unattempted">Unattempted</option></select><label className="sr-only" htmlFor="section-filter">Filter by subject</label><select id="section-filter" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value as Section | "all")} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-brand"><option value="all">Filter by subject/topic</option><option value="quant">Quant</option><option value="varc">VARC</option><option value="dilr">DILR</option></select><label className="sr-only" htmlFor="sort-order">Sort by</label><select id="sort-order" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-brand"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="score-descending">Score: high to low</option><option value="score-ascending">Score: low to high</option></select><button type="button" onClick={() => { setAttemptFilter("all"); setSectionFilter("all"); setSortOrder("newest"); }} className="rounded-lg border border-brand px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-tint">Reset filters</button></div><div className="mt-5 overflow-x-auto rounded-2xl border border-border"><table className="min-w-[720px] w-full text-left"><thead className="bg-brand text-sm font-bold text-white"><tr><th className="px-5 py-4">Date</th><th className="px-5 py-4">Section</th><th className="px-5 py-4">Daily Target</th><th className="px-5 py-4 text-right">Status</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id} className={index % 2 ? "bg-surface-muted/70" : "bg-white"}><td className="whitespace-nowrap px-5 py-4 text-sm font-medium">{formatTableDate(row.date)}</td><td className="px-5 py-4 text-sm font-semibold">{row.section.label}</td><td className="max-w-xs px-5 py-4 text-sm text-muted">{row.section.title}</td><td className="whitespace-nowrap px-5 py-4 text-right"><div className="inline-flex items-center gap-3">{row.attempt && <span className="rounded-full bg-brand-tint px-3 py-1 text-sm font-bold text-brand-darker">{Number(row.attempt.score || 0)}/{Number(row.attempt.total || 0) * 3}</span>}<Link href={targetHref(user, row.section.key, row.date)} className={row.attempt ? "font-semibold text-brand underline underline-offset-2" : "rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"}>{row.attempt ? "View result" : user ? "Attempt" : "Log in"}</Link></div></td></tr>)}</tbody></table>{rows.length === 0 && <div className="p-10 text-center text-sm text-muted">No daily targets match these filters.</div>}</div></> : <div className="mt-5 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">Previous daily targets will appear here after they are published.</div>}
    </section>
  </div>;
}
