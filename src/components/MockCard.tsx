import Link from "next/link";
import { Clock, ListOrdered, ArrowUpRight, Trophy } from "lucide-react";
import { estimatePercentile } from "@/lib/mockPercentile";

export type TopScorer = { displayName: string; score: number; userId: string };

export type MockSummary = {
  id: string;
  name: string;
  questions: number;
  durationMins: number;
  difficulty: "Easy" | "Moderate" | "Hard" | "CAT Level";
  type?: "full" | "sectional";
  section?: string;
  attempted?: {
    score: number;
    total?: number;
    percentile?: number;
    correct?: number;
    wrong?: number;
    attemptedOn: string;
  };
  topScorers?: TopScorer[];
};

const difficultyStyle: Record<MockSummary["difficulty"], string> = {
  Easy: "bg-brand-tint text-brand-darker",
  Moderate: "bg-amber-50 text-amber-700",
  Hard: "bg-red-50 text-red-600",
  "CAT Level": "bg-slate-100 text-slate-700",
};

const medalColors = ["text-yellow-500", "text-slate-400", "text-amber-600"];

export default function MockCard({ mock }: { mock: MockSummary }) {
  const href = `/mock-view/${mock.id}`;
  const isFull = mock.type === "full";

  return (
    <div className="flex flex-col gap-0 rounded-2xl border border-border bg-white transition hover:border-brand hover:shadow-md hover:shadow-brand/[0.06]">
      {/* Main card row */}
      <div className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display text-[15px] font-semibold text-foreground hover:text-brand-darker hover:underline"
            >
              {mock.name}
            </Link>
            <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${difficultyStyle[mock.difficulty]}`}>
              {mock.difficulty}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5"><ListOrdered size={13} /> {mock.questions} questions</span>
            <span className="inline-flex items-center gap-1.5"><Clock size={13} /> {mock.durationMins} min</span>
            {mock.section && <span>{mock.section}</span>}
          </div>

          {mock.attempted && (
            <div className="mt-3 inline-flex items-center rounded-xl border border-brand/20 bg-brand-tint px-3 py-2 text-[13px] font-semibold text-brand-darker">
              Attempted {mock.attempted.attemptedOn} · Score {mock.attempted.score}
              {typeof mock.attempted.total === "number" ? `/${mock.attempted.total * 3}` : ""} ·{" "}
              {typeof mock.attempted.percentile === "number" && mock.attempted.percentile > 0
                ? mock.attempted.percentile.toFixed(2)
                : estimatePercentile(
                    mock.attempted.score,
                    mock.attempted.total || mock.questions,
                    mock.difficulty,
                    mock.type
                  ).toFixed(2)}{" "}
              %ile
            </div>
          )}
        </div>

        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[13.5px] font-semibold text-white transition hover:bg-brand-dark"
        >
          {mock.attempted ? "Mock Analysis" : "Open Mock"} <ArrowUpRight size={14} />
        </Link>
      </div>

      {/* Top 5 Scorers — full mocks only */}
      {isFull && mock.topScorers && mock.topScorers.length > 0 && (
        <div className="border-t border-border px-5 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            <Trophy size={12} className="text-yellow-500" />
            Top Scorers
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {mock.topScorers.map((scorer, index) => (
              <div key={scorer.userId} className="flex items-center gap-1.5 text-[12.5px]">
                <span className={`font-bold ${medalColors[index] ?? "text-muted"}`}>
                  #{index + 1}
                </span>
                <span className="font-medium text-foreground truncate max-w-[120px]">{scorer.displayName}</span>
                <span className="text-muted">·</span>
                <span className="font-semibold text-brand-darker">{scorer.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
