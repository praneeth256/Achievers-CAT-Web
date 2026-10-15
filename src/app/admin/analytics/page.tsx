"use client";

import { collection, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase/client";
import { estimatePercentile } from "@/lib/mockPercentile";

type Attempt = {
  id: string;
  mockId?: string;
  testId?: string;
  userId?: string;
  uid?: string;
  score?: number;
  marks?: number;
  total?: number;
  questions?: number;
  status?: string;
  correct?: number;
  wrong?: number;
  percentile?: number;
};
type Ranking = {
  id: string;
  mockId?: string;
  userId?: string;
  score?: number;
  correct?: number;
  wrong?: number;
  displayName?: string;
};
type Mock = { id: string; name?: string; questions?: number; difficulty?: string; type?: string };
type Profile = { id: string; name?: string; displayName?: string; email?: string };

// Canonical score: prefer mock_rankings (always computed from answers) over
// attempts (can contain a scraped DOM value of 1 for older mocks).
function bestScore(attempt: Attempt, rankingMap: Map<string, Ranking>): number {
  const uid = String(attempt.userId || attempt.uid || attempt.id.split("_")[0] || "");
  const mid = String(attempt.mockId || attempt.testId || attempt.id.replace(/^[^_]+_/, ""));
  const ranking = rankingMap.get(`${uid}_${mid}`);
  // If the ranking score is strictly higher than the attempt score, it was
  // repaired (or correctly calculated) — use it.  Otherwise fall back to
  // whichever source has the higher value.
  const rScore = Number(ranking?.score ?? -Infinity);
  const aScore = Number(attempt.score ?? attempt.marks ?? 0);
  return Math.max(rScore, aScore);
}

function bestCorrectWrong(
  attempt: Attempt,
  rankingMap: Map<string, Ranking>
): { correct: number; wrong: number } {
  const uid = String(attempt.userId || attempt.uid || attempt.id.split("_")[0] || "");
  const mid = String(attempt.mockId || attempt.testId || attempt.id.replace(/^[^_]+_/, ""));
  const ranking = rankingMap.get(`${uid}_${mid}`);
  const rScore = Number(ranking?.score ?? -Infinity);
  const aScore = Number(attempt.score ?? attempt.marks ?? 0);
  if (rScore > aScore && ranking) {
    return { correct: Number(ranking.correct ?? 0), wrong: Number(ranking.wrong ?? 0) };
  }
  return { correct: Number(attempt.correct ?? 0), wrong: Number(attempt.wrong ?? 0) };
}

const testId = (a: Attempt) =>
  String(a.mockId || a.testId || a.id.replace(/^[^_]+_/, ""));
const studentId = (a: Attempt) =>
  String(a.userId || a.uid || a.id.split("_")[0] || "");
const studentName = (p?: Profile) =>
  p?.name || p?.displayName || p?.email || "Student";

function Analytics() {
  const [mocks, setMocks] = useState<Mock[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [daily, setDaily] = useState<Attempt[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "mocks")),
      getDocs(collection(db, "attempts")),
      getDocs(collection(db, "results")),        // legacy store
      getDocs(collection(db, "mock_rankings")),   // ← authoritative repaired scores
      getDocs(collection(db, "daily_attempts")),
      getDocs(collection(db, "profiles")),
    ]).then(([m, current, legacy, rank, d, p]) => {
      // /results is the pre-update store; current attempts override it.
      const unique = new Map<string, Attempt>();
      legacy.docs
        .map((x) => ({ id: x.id, ...x.data() }) as Attempt)
        .filter((x) => x.status !== "in_progress")
        .forEach((x) => unique.set(`${studentId(x)}_${testId(x)}`, x));
      current.docs
        .map((x) => ({ id: x.id, ...x.data() }) as Attempt)
        .filter((x) => x.status === "submitted")
        .forEach((x) => unique.set(`${studentId(x)}_${testId(x)}`, x));

      setMocks(m.docs.map((x) => ({ id: x.id, ...x.data() }) as Mock));
      setAttempts([...unique.values()]);
      setRankings(rank.docs.map((x) => ({ id: x.id, ...x.data() }) as Ranking));
      setDaily(d.docs.map((x) => ({ id: x.id, ...x.data() }) as Attempt));
      setProfiles(p.docs.map((x) => ({ id: x.id, ...x.data() }) as Profile));
    }).catch(console.error);
  }, []);

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  // Build a lookup: `${userId}_${mockId}` → ranking document
  const rankingMap = useMemo(
    () => new Map(rankings.map((r) => [`${r.userId}_${r.mockId}`, r])),
    [rankings]
  );

  const rows = mocks.map((mock) => {
    const list = attempts.filter((a) => testId(a) === mock.id);
    const values = list.map((a) => bestScore(a, rankingMap));
    const average = values.length
      ? values.reduce((s, v) => s + v, 0) / values.length
      : 0;
    return { mock, list, average, top: values.length ? Math.max(...values) : 0 };
  });

  const selectedRow = rows.find((row) => row.mock.id === selected);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Admin</p>
      <h1 className="mt-1 flex items-center gap-2 font-display text-[28px] font-bold">
        <BarChart3 className="text-brand" /> Performance &amp; Analytics
      </h1>
      <p className="mt-2 text-sm text-muted">
        Scores are sourced from <code>mock_rankings</code> (computed from answers) and
        cross-checked with <code>attempts</code>. The higher of the two is shown.
      </p>

      {/* ── Test performance table ── */}
      <section className="mt-8 rounded-2xl border border-border bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Test performance</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="pb-3">Test</th>
                <th className="pb-3">Attempts</th>
                <th className="pb-3">Avg score</th>
                <th className="pb-3">Avg %</th>
                <th className="pb-3">Top score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.mock.id}
                  onClick={() => setSelected(row.mock.id)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-brand-tint"
                >
                  <td className="py-3 font-semibold">{row.mock.name || "Untitled mock"}</td>
                  <td>{row.list.length}</td>
                  <td>{row.average.toFixed(1)}</td>
                  <td>
                    {row.mock.questions
                      ? ((row.average / (row.mock.questions * 3)) * 100).toFixed(1)
                      : "0.0"}%
                  </td>
                  <td>{row.top}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    No mocks available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Daily target performance ── */}
      <section className="mt-6 rounded-2xl border border-border bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Daily target performance</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {["quant", "varc", "dilr"].map((section) => {
            const list = daily.filter(
              (a) => (a as Attempt & { section?: string }).section === section
            );
            const values = list.map((a) => Number(a.score ?? a.marks ?? 0));
            return (
              <div key={section} className="rounded-xl bg-surface-muted p-4">
                <p className="font-semibold uppercase">{section}</p>
                <p className="mt-2 text-sm text-muted">
                  {list.length} attempts · Avg{" "}
                  {values.length
                    ? (values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)
                    : "N/A"}
                </p>
                <p className="mt-1 text-sm font-bold">
                  Top {values.length ? Math.max(...values) : "N/A"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Per-mock student list ── */}
      {selectedRow && (
        <section className="mt-6 rounded-2xl border border-brand/30 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">
            {selectedRow.mock.name} — student scores
          </h2>
          <p className="mt-1 text-xs text-muted">
            Score = best of <code>mock_rankings</code> (answer-computed) and{" "}
            <code>attempts</code>. Percentile is recalculated from the corrected score.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th className="pb-2 pr-4">Rank</th>
                  <th className="pb-2 pr-4">Student</th>
                  <th className="pb-2 pr-4">Score / Max</th>
                  <th className="pb-2 pr-4">Correct / Wrong</th>
                  <th className="pb-2">Percentile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {selectedRow.list
                  .slice()
                  .sort(
                    (a, b) =>
                      bestScore(b, rankingMap) - bestScore(a, rankingMap)
                  )
                  .map((a, index) => {
                    const score = bestScore(a, rankingMap);
                    const total = Number(
                      a.total || a.questions || selectedRow.mock.questions || 0
                    );
                    const maxMarks = total * 3;
                    const { correct, wrong } = bestCorrectWrong(a, rankingMap);
                    const pct = estimatePercentile(
                      score,
                      total,
                      selectedRow.mock.difficulty,
                      selectedRow.mock.type
                    );
                    // Flag attempts that look suspicious (score ≤ 1 and
                    // correct ≤ 1) so the admin knows they may need repair.
                    const suspicious = score <= 1 && correct <= 1 && total > 0;
                    return (
                      <tr
                        key={a.id}
                        className={suspicious ? "bg-red-50" : ""}
                      >
                        <td className="py-3 pr-4 font-bold text-brand-darker">
                          #{index + 1}
                        </td>
                        <td className="py-3 pr-4 font-medium">
                          {studentName(profileMap.get(studentId(a)))}
                          {suspicious && (
                            <span
                              title="Score looks incorrect — student may need to reopen this mock for analysis to trigger repair"
                              className="ml-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600"
                            >
                              needs repair
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 font-bold tabular-nums">
                          {score}
                          <span className="font-normal text-muted">/{maxMarks}</span>
                        </td>
                        <td className="py-3 pr-4 tabular-nums text-muted">
                          <span className="text-emerald-600 font-semibold">{correct}✓</span>
                          {" / "}
                          <span className="text-red-500 font-semibold">{wrong}✗</span>
                        </td>
                        <td className="py-3 tabular-nums">
                          <span className="inline-flex rounded-full bg-brand-tint px-2.5 py-0.5 text-[12px] font-bold text-brand-darker">
                            {pct.toFixed(2)}%ile
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {selectedRow.list.some((a) => bestScore(a, rankingMap) <= 1) && (
            <p className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[12.5px] text-amber-800">
              ⚠️ <strong>Highlighted rows</strong> show students whose score is ≤ 1 — this
              indicates the score was incorrectly captured from the DOM. Ask these students
              to open the mock again (analysis mode) to trigger automatic repair. Their
              correct score will then appear here.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <AdminGuard>
      <Analytics />
    </AdminGuard>
  );
}
