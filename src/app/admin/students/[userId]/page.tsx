"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { ArrowLeft, ClipboardList, Loader2, RotateCcw } from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase/client";

type Attempt = { id: string; mockId?: string; type?: string; section?: string; score?: number; total?: number; status?: string; date?: string; answers?: Record<string, string>; questionId?: string; selectedOption?: string; chapter?: string };
type Profile = { name?: string; displayName?: string; email?: string };
type MockInfo = { name?: string };

const score = (item: Attempt) => Number(item.score || 0);
const defaultMockName = (item: Attempt) => item.type === "full" ? "Full mock" : item.section ? `${item.section} sectional mock` : "Mock";

function Summary({ label, attempts }: { label: string; attempts: Attempt[] }) {
  const values = attempts.map(score);
  return <div className="rounded-2xl border border-border bg-white p-4"><p className="font-semibold">{label}</p><p className="mt-3 text-xl font-bold">{attempts.length ? `${attempts.length} attempted` : "N/A"}</p><p className="mt-1 text-sm text-muted">{values.length ? `Best ${Math.max(...values)} · Avg ${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)}` : "No attempts"}</p></div>;
}

function AnswerList({ label, rows }: { label: string; rows: Attempt[] }) {
  return <section className="mt-6 rounded-2xl border border-border bg-white p-5"><h2 className="flex items-center gap-2 font-display text-lg font-semibold"><ClipboardList size={18} className="text-brand" />{label}</h2><div className="mt-4 divide-y divide-border">{rows.map(row => <div key={row.id} className="py-3 text-sm"><b>{row.chapter || "Question"}</b><p className="mt-1 text-muted">Question {row.questionId || "N/A"} · Answer: {row.selectedOption || "N/A"}</p></div>)}{!rows.length && <p className="py-3 text-sm text-muted">N/A — no answers submitted.</p>}</div></section>;
}

function Progress({ params }: { params: Promise<{ userId: string }> }) {
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mocks, setMocks] = useState<Attempt[]>([]);
  const [mockNames, setMockNames] = useState<Record<string, string>>({});
  const [daily, setDaily] = useState<Attempt[]>([]);
  const [practice, setPractice] = useState<Attempt[]>([]);
  const [pyq, setPyq] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState("");

  useEffect(() => { void params.then(value => setUserId(value.userId)); }, [params]);

  useEffect(() => {
    if (!userId) return;
    void Promise.all([
      getDoc(doc(db, "profiles", userId)),
      getDocs(query(collection(db, "attempts"), where("userId", "==", userId))),
      getDocs(query(collection(db, "daily_attempts"), where("userId", "==", userId))),
      getDocs(query(collection(db, "practice_attempts"), where("userId", "==", userId))),
      getDocs(query(collection(db, "pyq_attempts"), where("userId", "==", userId))),
    ]).then(async ([profileRow, mockRows, dailyRows, practiceRows, pyqRows]) => {
      const submittedMocks = mockRows.docs.map(row => ({ id: row.id, ...row.data() }) as Attempt).filter(row => row.status === "submitted");
      const ids = [...new Set(submittedMocks.map(row => row.mockId).filter((id): id is string => Boolean(id)))];
      const mockDocs = await Promise.all(ids.map(async id => [id, await getDoc(doc(db, "mocks", id))] as const));
      setProfile(profileRow.exists() ? profileRow.data() as Profile : null);
      setMocks(submittedMocks);
      setMockNames(Object.fromEntries(mockDocs.map(([id, row]) => [id, row.exists() ? String((row.data() as MockInfo).name || "Mock") : "Mock"])));
      setDaily(dailyRows.docs.map(row => ({ id: row.id, ...row.data() }) as Attempt));
      setPractice(practiceRows.docs.map(row => ({ id: row.id, ...row.data() }) as Attempt));
      setPyq(pyqRows.docs.map(row => ({ id: row.id, ...row.data() }) as Attempt));
    }).catch(error => { console.error("Could not load student data:", error); setResetMessage("Could not load all student data."); }).finally(() => setLoading(false));
  }, [userId]);

  const sections = useMemo(() => ["VARC", "DILR", "QA"].map(section => mocks.filter(item => item.type === "sectional" && String(item.section || "").toUpperCase() === section)), [mocks]);
  const name = profile?.name || profile?.displayName || profile?.email || "Student";

  async function resetMock(attempt: Attempt) {
    if (!attempt.mockId || resettingId) return;
    const mockName = mockNames[attempt.mockId] || defaultMockName(attempt);
    if (!window.confirm(`Reset ${mockName} for ${name}? This removes only this student's attempt, score, percentile, and ranking. They will be able to take this mock again.`)) return;
    setResettingId(attempt.id);
    setResetMessage("");
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "attempts", attempt.id));
      batch.delete(doc(db, "mock_rankings", `${userId}_${attempt.mockId}`));
      await batch.commit();
      setMocks(current => current.filter(item => item.id !== attempt.id));
      setResetMessage(`${mockName} was reset for ${name}.`);
    } catch (error) {
      console.error("Could not reset mock attempt:", error);
      setResetMessage("Could not reset this mock. Please try again.");
    } finally {
      setResettingId(null);
    }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-brand" /></div>;
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
    <Link href="/admin/students" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-darker"><ArrowLeft size={16} /> Student Data</Link>
    <h1 className="mt-4 font-display text-3xl font-bold">{name}</h1><p className="mt-1 text-sm text-muted">{profile?.email || "No email on profile"}</p>
    <section className="mt-7 grid gap-3 sm:grid-cols-3">{sections.map((items, index) => <Summary key={index} label={["VARC sectional", "DILR sectional", "QA sectional"][index]} attempts={items} />)}</section>
    <section className="mt-6"><Summary label="Daily targets" attempts={daily} /></section>
    <section className="mt-8 rounded-2xl border border-border bg-white p-5">
      <h2 className="font-display text-lg font-semibold">Mock attempts</h2><p className="mt-1 text-sm text-muted">Reset only the selected mock for this student. Their other mock attempts stay unchanged.</p>
      {resetMessage && <p className="mt-3 rounded-xl bg-brand-tint px-3 py-2 text-sm text-brand-darker">{resetMessage}</p>}
      <div className="mt-4 divide-y divide-border">{mocks.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><div className="flex flex-wrap gap-2"><b>{mockNames[item.mockId || ""] || defaultMockName(item)}</b><b className="text-brand-darker">{score(item)}/{Number(item.total || 0) * 3}</b></div><p className="mt-1 text-muted">{Object.keys(item.answers || {}).length} answers recorded</p></div><button type="button" onClick={() => void resetMock(item)} disabled={resettingId !== null} className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 font-semibold text-danger hover:bg-red-50 disabled:opacity-50">{resettingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Reset mock</button></div>)}{!mocks.length && <p className="py-4 text-sm text-muted">No submitted mocks for this student.</p>}</div>
    </section>
    <section className="mt-8 rounded-2xl border border-border bg-white p-5"><h2 className="font-display text-lg font-semibold">Daily target details</h2><div className="mt-4 divide-y divide-border">{daily.map(item => <div key={item.id} className="py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><b>{item.date} · {String(item.section || "").toUpperCase()} daily target</b><b className="text-brand-darker">{score(item)}/{Number(item.total || 0) * 3}</b></div><p className="mt-1 text-muted">{Object.keys(item.answers || {}).length} answers recorded</p></div>)}{!daily.length && <p className="py-4 text-sm text-muted">No daily targets submitted.</p>}</div></section>
    <AnswerList label="Chapter practice answers" rows={practice} /><AnswerList label="Topic-wise PYQ answers" rows={pyq} />
  </div>;
}

export default function StudentProgressPage({ params }: { params: Promise<{ userId: string }> }) {
  return <AdminGuard><Progress params={params} /></AdminGuard>;
}
