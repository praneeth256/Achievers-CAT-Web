"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { ArrowLeft, ClipboardList, Loader2, Pencil, RotateCcw, X } from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase/client";
import { calculatePercentiles } from "@/lib/mockPercentile";

type Attempt = {
  id: string; mockId?: string; type?: string; section?: string;
  score?: number; total?: number; correct?: number; wrong?: number;
  percentile?: number; status?: string; date?: string;
  answers?: Record<string, string>; questionId?: string; selectedOption?: string; chapter?: string;
};
type Profile = { name?: string; displayName?: string; email?: string };
type MockMeta = { name?: string; type?: string; section?: string; questions?: number; difficulty?: string };
type RankingDoc = { userId: string; displayName?: string; score: number; correct: number; wrong: number; mockId: string; fullMock?: boolean };

const getScore = (item: Attempt) => Number(item.score || 0);
const defaultMockName = (item: Attempt) => item.type === "full" ? "Full mock" : item.section ? `${item.section} sectional mock` : "Mock";

function Summary({ label, attempts }: { label: string; attempts: Attempt[] }) {
  const values = attempts.map(getScore);
  return <div className="rounded-2xl border border-border bg-white p-4"><p className="font-semibold">{label}</p><p className="mt-3 text-xl font-bold">{attempts.length ? `${attempts.length} attempted` : "N/A"}</p><p className="mt-1 text-sm text-muted">{values.length ? `Best ${Math.max(...values)} · Avg ${(values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1)}` : "No attempts"}</p></div>;
}

function AnswerList({ label, rows }: { label: string; rows: Attempt[] }) {
  return <section className="mt-6 rounded-2xl border border-border bg-white p-5"><h2 className="flex items-center gap-2 font-display text-lg font-semibold"><ClipboardList size={18} className="text-brand" />{label}</h2><div className="mt-4 divide-y divide-border">{rows.map(row => <div key={row.id} className="py-3 text-sm"><b>{row.chapter || "Question"}</b><p className="mt-1 text-muted">Question {row.questionId || "N/A"} · Answer: {row.selectedOption || "N/A"}</p></div>)}{!rows.length && <p className="py-3 text-sm text-muted">N/A — no answers submitted.</p>}</div></section>;
}

// ── Inline score-edit form ────────────────────────────────────────────────────
function EditScoreForm({
  attempt, mockName, mockMeta, userId, onCancel, onSaved,
}: {
  attempt: Attempt; mockName: string; mockMeta: MockMeta | null;
  userId: string; onCancel: () => void; onSaved: (updated: Attempt) => void;
}) {
  const total = Number(mockMeta?.questions || attempt.total || 0);
  const [correct, setCorrect] = useState(Number(attempt.correct ?? Math.round(Math.max(0, getScore(attempt)) / 3)));
  const [wrong, setWrong] = useState(Number(attempt.wrong ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const newScore = correct * 3 - wrong;

  async function save() {
    if (correct < 0 || wrong < 0) { setError("Correct and wrong counts cannot be negative."); return; }
    if (total > 0 && correct + wrong > total) { setError(`Correct + wrong (${correct + wrong}) cannot exceed total questions (${total}).`); return; }
    if (!attempt.mockId) { setError("No mockId on this attempt — cannot save."); return; }
    setSaving(true); setError("");
    try {
      const mockId = attempt.mockId;
      // 1. Update this student's ranking
      await setDoc(doc(db, "mock_rankings", `${userId}_${mockId}`), { score: newScore, correct, wrong, updatedAt: serverTimestamp() }, { merge: true });
      // 2. Fetch ALL rankings for this mock
      const rankSnap = await getDocs(query(collection(db, "mock_rankings"), where("mockId", "==", mockId)));
      const allRankings = rankSnap.docs.map(d => d.data() as RankingDoc);
      // 3. Recalculate everyone's percentile
      const percentileMap = calculatePercentiles(
        allRankings.map(r => ({ userId: r.userId, score: Number(r.score || 0), correct: Number(r.correct || 0), wrong: Number(r.wrong || 0) })),
        total, mockMeta?.difficulty, mockMeta?.type ?? attempt.type,
      );
      // 4. Batch-update every participant's attempt with their new percentile
      const batch = writeBatch(db);
      for (const r of allRankings) {
        batch.set(doc(db, "attempts", `${r.userId}_${mockId}`), { score: Number(r.score), correct: Number(r.correct), wrong: Number(r.wrong), percentile: percentileMap.get(r.userId) ?? 0 }, { merge: true });
      }
      // Ensure this student's corrected score is written
      const myPercentile = percentileMap.get(userId) ?? 0;
      batch.set(doc(db, "attempts", `${userId}_${mockId}`), { score: newScore, correct, wrong, percentile: myPercentile }, { merge: true });
      await batch.commit();
      onSaved({ ...attempt, score: newScore, correct, wrong, percentile: myPercentile });
    } catch (err) {
      console.error("Could not update score:", err);
      setError(err instanceof Error ? err.message : "Could not save score. Please try again.");
    } finally { setSaving(false); }
  }

  return (
    <div className="mt-2 rounded-2xl border border-brand/30 bg-brand-tint-2 p-4">
      <p className="text-[13px] font-semibold text-brand-darker">Edit score — {mockName}</p>
      <p className="mt-0.5 text-[12px] text-muted">Score = correct × 3 − wrong. Percentiles for all students on this mock will be recalculated automatically.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Correct</span>
          <input id="edit-score-correct" type="number" min={0} max={total || undefined} value={correct}
            onChange={e => setCorrect(Math.max(0, Number(e.target.value)))}
            className="w-24 rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-brand" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Wrong</span>
          <input id="edit-score-wrong" type="number" min={0} max={total || undefined} value={wrong}
            onChange={e => setWrong(Math.max(0, Number(e.target.value)))}
            className="w-24 rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-brand" />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">New score</span>
          <span className={`inline-flex h-[38px] items-center rounded-xl px-3 text-sm font-bold ${newScore >= 0 ? "bg-white text-brand-darker" : "bg-red-50 text-danger"}`}>
            {newScore} / {total * 3}
          </span>
        </div>
        <div className="flex gap-2">
          <button id="edit-score-save-btn" type="button" onClick={() => void save()} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? "Saving…" : "Save score"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-[13px] font-semibold text-muted hover:text-foreground disabled:opacity-50">
            <X size={13} /> Cancel
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────
function Progress({ params }: { params: Promise<{ userId: string }> }) {
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mocks, setMocks] = useState<Attempt[]>([]);
  const [mockNames, setMockNames] = useState<Record<string, string>>({});
  const [mockMetaMap, setMockMetaMap] = useState<Record<string, MockMeta>>({});
  const [daily, setDaily] = useState<Attempt[]>([]);
  const [practice, setPractice] = useState<Attempt[]>([]);
  const [pyq, setPyq] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

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
      setMockNames(Object.fromEntries(mockDocs.map(([id, row]) => [id, row.exists() ? String((row.data() as MockMeta).name || "Mock") : "Mock"])));
      setMockMetaMap(Object.fromEntries(mockDocs.map(([id, row]) => [id, row.exists() ? (row.data() as MockMeta) : {}])));
      setDaily(dailyRows.docs.map(row => ({ id: row.id, ...row.data() }) as Attempt));
      setPractice(practiceRows.docs.map(row => ({ id: row.id, ...row.data() }) as Attempt));
      setPyq(pyqRows.docs.map(row => ({ id: row.id, ...row.data() }) as Attempt));
    }).catch(error => { console.error("Could not load student data:", error); setStatusMessage("Could not load all student data."); }).finally(() => setLoading(false));
  }, [userId]);

  const sections = useMemo(() => ["VARC", "DILR", "QA"].map(section => mocks.filter(item => item.type === "sectional" && String(item.section || "").toUpperCase() === section)), [mocks]);
  const name = profile?.name || profile?.displayName || profile?.email || "Student";

  async function resetMock(attempt: Attempt) {
    if (!attempt.mockId || resettingId) return;
    const mockName = mockNames[attempt.mockId] || defaultMockName(attempt);
    if (!window.confirm(`Reset ${mockName} for ${name}? This removes only this student's attempt, score, percentile, and ranking. They will be able to take this mock again.`)) return;
    setResettingId(attempt.id); setStatusMessage("");
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "attempts", attempt.id));
      batch.delete(doc(db, "mock_rankings", `${userId}_${attempt.mockId}`));
      await batch.commit();
      setMocks(current => current.filter(item => item.id !== attempt.id));
      setStatusMessage(`${mockName} was reset for ${name}.`);
    } catch (error) {
      console.error("Could not reset mock attempt:", error);
      setStatusMessage("Could not reset this mock. Please try again.");
    } finally { setResettingId(null); }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-brand" /></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/admin/students" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-darker"><ArrowLeft size={16} /> Student Data</Link>
      <h1 className="mt-4 font-display text-3xl font-bold">{name}</h1>
      <p className="mt-1 text-sm text-muted">{profile?.email || "No email on profile"}</p>

      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        {sections.map((items, index) => <Summary key={index} label={["VARC sectional", "DILR sectional", "QA sectional"][index]} attempts={items} />)}
      </section>
      <section className="mt-6"><Summary label="Daily targets" attempts={daily} /></section>

      {/* ── Mock attempts ── */}
      <section className="mt-8 rounded-2xl border border-border bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Mock attempts</h2>
        <p className="mt-1 text-sm text-muted">
          Edit a student&apos;s score manually (glitch fix) or reset the entire attempt.
          Editing a score automatically recalculates percentiles for <em>all</em> students on that mock.
        </p>
        {statusMessage && <p className="mt-3 rounded-xl bg-brand-tint px-3 py-2 text-sm text-brand-darker">{statusMessage}</p>}
        <div className="mt-4 divide-y divide-border">
          {mocks.map(item => (
            <div key={item.id} className="py-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{mockNames[item.mockId || ""] || defaultMockName(item)}</b>
                    <b className="text-brand-darker">{getScore(item)}/{Number(item.total || 0) * 3}</b>
                    {item.percentile !== undefined && (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-muted">
                        {item.percentile.toFixed(2)}%ile
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-muted">
                    {Object.keys(item.answers || {}).length} answers recorded
                    {item.correct !== undefined ? ` · ${item.correct} correct · ${item.wrong ?? 0} wrong` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    id={`edit-score-btn-${item.id}`}
                    type="button"
                    onClick={() => { setEditingId(editingId === item.id ? null : item.id); setStatusMessage(""); }}
                    disabled={resettingId !== null}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 px-3 py-1.5 font-semibold text-brand-darker hover:bg-brand-tint disabled:opacity-50"
                  >
                    <Pencil size={13} /> Edit score
                  </button>
                  <button
                    type="button"
                    onClick={() => void resetMock(item)}
                    disabled={resettingId !== null}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 font-semibold text-danger hover:bg-red-50 disabled:opacity-50"
                  >
                    {resettingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Reset mock
                  </button>
                </div>
              </div>
              {editingId === item.id && (
                <EditScoreForm
                  attempt={item}
                  mockName={mockNames[item.mockId || ""] || defaultMockName(item)}
                  mockMeta={item.mockId ? (mockMetaMap[item.mockId] ?? null) : null}
                  userId={userId}
                  onCancel={() => setEditingId(null)}
                  onSaved={(updated) => {
                    setMocks(current => current.map(m => m.id === updated.id ? updated : m));
                    setEditingId(null);
                    setStatusMessage(`Score updated for ${mockNames[item.mockId || ""] || defaultMockName(item)}. Percentiles recalculated for all students.`);
                  }}
                />
              )}
            </div>
          ))}
          {!mocks.length && <p className="py-4 text-sm text-muted">No submitted mocks for this student.</p>}
        </div>
      </section>

      {/* ── Daily targets ── */}
      <section className="mt-8 rounded-2xl border border-border bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Daily target details</h2>
        <div className="mt-4 divide-y divide-border">
          {daily.map(item => (
            <div key={item.id} className="py-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <b>{item.date} · {String(item.section || "").toUpperCase()} daily target</b>
                <b className="text-brand-darker">{getScore(item)}/{Number(item.total || 0) * 3}</b>
              </div>
              <p className="mt-1 text-muted">{Object.keys(item.answers || {}).length} answers recorded</p>
            </div>
          ))}
          {!daily.length && <p className="py-4 text-sm text-muted">No daily targets submitted.</p>}
        </div>
      </section>

      <AnswerList label="Chapter practice answers" rows={practice} />
      <AnswerList label="Topic-wise PYQ answers" rows={pyq} />
    </div>
  );
}

export default function StudentProgressPage({ params }: { params: Promise<{ userId: string }> }) {
  return <AdminGuard><Progress params={params} /></AdminGuard>;
}
