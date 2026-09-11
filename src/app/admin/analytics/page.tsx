"use client";

import { collection, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase/client";

type Attempt = { id: string; mockId?: string; testId?: string; userId?: string; uid?: string; score?: number; marks?: number; total?: number; questions?: number; status?: string };
type Mock = { id: string; name?: string; questions?: number };
type Profile = { id: string; name?: string; displayName?: string; email?: string };
const marks = (a: Attempt) => Number(a.score ?? a.marks ?? 0);
const testId = (a: Attempt) => String(a.mockId || a.testId || a.id.replace(/^[^_]+_/, ""));
const studentId = (a: Attempt) => String(a.userId || a.uid || a.id.split("_")[0] || "");
const studentName = (p?: Profile) => p?.name || p?.displayName || p?.email || "Student";

function Analytics() {
  const [mocks, setMocks] = useState<Mock[]>([]); const [attempts, setAttempts] = useState<Attempt[]>([]); const [daily, setDaily] = useState<Attempt[]>([]); const [profiles, setProfiles] = useState<Profile[]>([]); const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { Promise.all([getDocs(collection(db, "mocks")), getDocs(collection(db, "attempts")), getDocs(collection(db, "results")), getDocs(collection(db, "daily_attempts")), getDocs(collection(db, "profiles"))]).then(([m, current, legacy, d, p]) => {
    // /results is the pre-update store. Current documents override it, so
    // older student scores remain visible without duplicate rank rows.
    const unique = new Map<string, Attempt>();
    legacy.docs.map(x => ({ id: x.id, ...x.data() }) as Attempt).filter(x => x.status !== "in_progress").forEach(x => unique.set(`${studentId(x)}_${testId(x)}`, x));
    current.docs.map(x => ({ id: x.id, ...x.data() }) as Attempt).filter(x => x.status === "submitted").forEach(x => unique.set(`${studentId(x)}_${testId(x)}`, x));
    setMocks(m.docs.map(x => ({ id: x.id, ...x.data() }))); setAttempts([...unique.values()]); setDaily(d.docs.map(x => ({ id: x.id, ...x.data() }))); setProfiles(p.docs.map(x => ({ id: x.id, ...x.data() })));
  }).catch(console.error); }, []);
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const rows = mocks.map(mock => { const list = attempts.filter(a => testId(a) === mock.id); const values = list.map(marks); const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; return { mock, list, average, top: values.length ? Math.max(...values) : 0 }; });
  const selectedRow = rows.find(row => row.mock.id === selected);
  return <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8"><p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Admin</p><h1 className="mt-1 flex items-center gap-2 font-display text-[28px] font-bold"><BarChart3 className="text-brand" /> Performance & Analytics</h1><p className="mt-2 text-sm text-muted">Current and earlier saved scores are included. Select a test to view students.</p>
    <section className="mt-8 rounded-2xl border border-border bg-white p-5"><h2 className="font-display text-lg font-semibold">Test performance</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-border text-xs text-muted"><tr><th className="pb-3">Test</th><th className="pb-3">Attempts</th><th className="pb-3">Avg score</th><th className="pb-3">Avg %</th><th className="pb-3">Top score</th></tr></thead><tbody>{rows.map(row => <tr key={row.mock.id} onClick={() => setSelected(row.mock.id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-brand-tint"><td className="py-3 font-semibold">{row.mock.name || "Untitled mock"}</td><td>{row.list.length}</td><td>{row.average.toFixed(1)}</td><td>{row.mock.questions ? (row.average / (row.mock.questions * 3) * 100).toFixed(1) : "0.0"}%</td><td>{row.top}</td></tr>)}{!rows.length && <tr><td colSpan={5} className="py-8 text-center text-muted">No mocks available yet.</td></tr>}</tbody></table></div></section>
    <section className="mt-6 rounded-2xl border border-border bg-white p-5"><h2 className="font-display text-lg font-semibold">Daily target performance</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{["quant", "varc", "dilr"].map(section => { const list = daily.filter(a => (a as Attempt & { section?: string }).section === section); const values = list.map(marks); return <div key={section} className="rounded-xl bg-surface-muted p-4"><p className="font-semibold uppercase">{section}</p><p className="mt-2 text-sm text-muted">{list.length} attempts · Avg {values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : "N/A"}</p><p className="mt-1 text-sm font-bold">Top {values.length ? Math.max(...values) : "N/A"}</p></div>; })}</div></section>
    {selectedRow && <section className="mt-6 rounded-2xl border border-brand/30 bg-white p-5"><h2 className="font-display text-lg font-semibold">{selectedRow.mock.name} — student performance</h2><div className="mt-4 divide-y divide-border">{selectedRow.list.slice().sort((a, b) => marks(b) - marks(a)).map((a, index) => <div key={a.id} className="flex justify-between py-3"><span><b className="mr-3 text-brand-darker">#{index + 1}</b>{studentName(profileMap.get(studentId(a)))}</span><b>{marks(a)}/{Number(a.total || a.questions || selectedRow.mock.questions || 0) * 3}</b></div>)}</div></section>}
  </div>;
}
export default function AdminAnalyticsPage() { return <AdminGuard><Analytics /></AdminGuard>; }
