/**
 * Linearly maps a value to a 0-100 score, where `goodAt` (or below) scores
 * 100 and `badAt` (or above) scores 0. Works for "lower is better" metrics
 * like response time, and "higher is better" metrics by swapping goodAt/badAt.
 */
function linearScore(value, goodAt, badAt) {
  if (value === null || value === undefined) return null;
  const clamped = Math.min(Math.max(value, Math.min(goodAt, badAt)), Math.max(goodAt, badAt));
  const t = (clamped - badAt) / (goodAt - badAt);
  const score = Math.round(t * 100);
  return score === 0 ? 0 : score; // normalize -0 to 0
}

export function scoreMetrics(metrics) {
  const commitScore = linearScore(metrics.commits.commitsLast30Days, 20, 0);

  const responseScore = linearScore(metrics.issues.avgFirstResponseHours, 24, 240);

  const mergeScore = linearScore(metrics.prs.avgMergeHours, 24, 336);

  const available = [commitScore, responseScore, mergeScore].filter((s) => s !== null);
  const overall = available.length
    ? Math.round(available.reduce((a, b) => a + b, 0) / available.length)
    : null;

  return {
    commitScore,
    responseScore,
    mergeScore,
    overall,
    label: overallLabel(overall),
  };
}

function overallLabel(score) {
  if (score === null) return "Not enough data";
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs attention";
}
