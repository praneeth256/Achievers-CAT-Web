export type RankingAttempt = { userId: string; score: number; correct: number; wrong: number };
type Difficulty = "Easy" | "Moderate" | "Hard" | "CAT Level" | string | undefined;

// CAT-style full-mock reference supplied by the team. Sectionals are scaled
// to a 198-mark paper before this curve is applied.
// The negative band is deliberately scored from -10 = 0th percentile to
// 0 = 10th percentile. Positive marks then follow the supplied CAT curve.
const reference = [[-10, 0], [0, 10], [25, 60], [40, 80], [52, 90], [63, 95], [84, 99], [95, 99.5], [113, 99.9]] as const;
const difficultyMultiplier: Record<string, number> = { Easy: 1.12, Moderate: 1.06, "CAT Level": 1, Hard: 0.94 };

function benchmarkPercentile(score: number, total: number, difficulty: Difficulty) {
  // Do not scale negative marks: -10 should mean the same floor in a
  // sectional and a full mock. Difficulty scaling applies to positive marks.
  const scaledScore = score < 0 ? score : score * (198 / Math.max(1, total * 3)) / (difficultyMultiplier[difficulty || "CAT Level"] || 1);
  for (let index = 1; index < reference.length; index += 1) {
    const [upperScore, upperPercentile] = reference[index];
    const [lowerScore, lowerPercentile] = reference[index - 1];
    if (scaledScore <= upperScore) return lowerPercentile + ((scaledScore - lowerScore) / (upperScore - lowerScore)) * (upperPercentile - lowerPercentile);
  }
  return 99.99;
}

export function estimatePercentile(score: number, total: number, difficulty: Difficulty) {
  return Math.max(0, Math.min(99.99, Math.floor(benchmarkPercentile(score, total, difficulty) * 100) / 100));
}

/** Score ranks first, accuracy breaks equal marks, and user ID breaks any final tie. */
export function calculatePercentiles(attempts: RankingAttempt[], total: number, difficulty: Difficulty) {
  const sorted = [...attempts].sort((a, b) => b.score - a.score || (b.correct / Math.max(1, b.correct + b.wrong)) - (a.correct / Math.max(1, a.correct + a.wrong)) || a.userId.localeCompare(b.userId));
  let previous = 100;
  return new Map(sorted.map((attempt) => {
    const base = benchmarkPercentile(attempt.score, total, difficulty);
    const percentile = Math.max(0, Math.min(99.99, Math.floor(Math.min(base, previous - 0.01) * 100) / 100));
    previous = percentile;
    return [attempt.userId, percentile];
  }));
}
