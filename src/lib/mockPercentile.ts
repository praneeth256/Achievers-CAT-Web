export type RankingAttempt = { userId: string; score: number; correct: number; wrong: number };
type Difficulty = "Easy" | "Moderate" | "Hard" | "CAT Level" | string | undefined;

// ── Full-mock percentile curve (team-supplied, raw CAT marks → percentile) ──
// Points: score → percentile
//   0    →  3.00
//  60    → 90.00   (90%ile band: 60–65)
//  65    → 95.00   (95%ile band: 65–70)
//  70    → 98.00   (98%ile band: 70–85)
//  85    → 99.00   (99%ile band: 85–90)
//  90    → 99.50   (99.5%ile band: 90–100)
// 105    → 99.90   (99.9%ile band: 105–115)
// 115+   → 99.99   (ceiling)
// Negative marks: linear from -22 (floor) → 0 → 3
const FULL_MOCK_REF = [
  [-22, 0], [0, 3], [60, 90], [65, 95], [70, 98], [85, 99], [90, 99.5], [105, 99.9], [115, 99.99],
] as const;

// ── Sectional / generic curve (scaled to 198-mark equivalent) ─────────────
const SECTIONAL_REF = [[-10, 0], [0, 10], [25, 60], [40, 80], [52, 90], [63, 95], [84, 99], [95, 99.5], [113, 99.9]] as const;
const difficultyMultiplier: Record<string, number> = { Easy: 1.12, Moderate: 1.06, "CAT Level": 1, Hard: 0.94 };

function interpolate(ref: Readonly<Readonly<[number, number]>[]>, x: number): number {
  if (x <= ref[0][0]) return ref[0][1];
  for (let i = 1; i < ref.length; i++) {
    const [hi, hiP] = ref[i];
    const [lo, loP] = ref[i - 1];
    if (x <= hi) return loP + ((x - lo) / (hi - lo)) * (hiP - loP);
  }
  return ref[ref.length - 1][1];
}

function fullMockPercentile(score: number): number {
  return interpolate(FULL_MOCK_REF as unknown as Readonly<Readonly<[number, number]>[]>, score);
}

function sectionalPercentile(score: number, total: number, difficulty: Difficulty): number {
  const scaled = score < 0
    ? score
    : score * (198 / Math.max(1, total * 3)) / (difficultyMultiplier[difficulty || "CAT Level"] || 1);
  return interpolate(SECTIONAL_REF as unknown as Readonly<Readonly<[number, number]>[]>, scaled);
}

export function estimatePercentile(score: number, total: number, difficulty: Difficulty, mockType?: "full" | "sectional" | string) {
  const raw = mockType === "full"
    ? fullMockPercentile(score)
    : sectionalPercentile(score, total, difficulty);
  return Math.max(0, Math.min(99.99, Math.floor(raw * 100) / 100));
}

/** Score ranks first, accuracy breaks equal marks, and user ID breaks any final tie. */
export function calculatePercentiles(attempts: RankingAttempt[], total: number, difficulty: Difficulty, mockType?: "full" | "sectional" | string) {
  const sorted = [...attempts].sort((a, b) =>
    b.score - a.score ||
    (b.correct / Math.max(1, b.correct + b.wrong)) - (a.correct / Math.max(1, a.correct + a.wrong)) ||
    a.userId.localeCompare(b.userId)
  );
  let previous = 100;
  return new Map(sorted.map((attempt) => {
    const base = mockType === "full"
      ? fullMockPercentile(attempt.score)
      : sectionalPercentile(attempt.score, total, difficulty);
    const percentile = Math.max(0, Math.min(99.99, Math.floor(Math.min(base, previous - 0.01) * 100) / 100));
    previous = percentile;
    return [attempt.userId, percentile];
  }));
}

