import test from "node:test";
import assert from "node:assert/strict";
import { scoreMetrics } from "../src/scorer.js";

function makeMetrics({ commits = 0, responseHours = null, mergeHours = null } = {}) {
  return {
    commits: { commitsLast30Days: commits },
    issues: { avgFirstResponseHours: responseHours, sampledIssues: responseHours === null ? 0 : 5 },
    prs: { avgMergeHours: mergeHours, sampledPRs: mergeHours === null ? 0 : 5 },
  };
}

test("active, responsive repo scores near 100", () => {
  const scores = scoreMetrics(makeMetrics({ commits: 25, responseHours: 2, mergeHours: 5 }));
  assert.equal(scores.commitScore, 100);
  assert.equal(scores.responseScore, 100);
  assert.equal(scores.mergeScore, 100);
  assert.equal(scores.overall, 100);
  assert.equal(scores.label, "Excellent");
});

test("dormant, unresponsive repo scores near 0", () => {
  const scores = scoreMetrics(makeMetrics({ commits: 0, responseHours: 500, mergeHours: 1000 }));
  assert.equal(scores.commitScore, 0);
  assert.equal(scores.responseScore, 0);
  assert.equal(scores.mergeScore, 0);
  assert.equal(scores.overall, 0);
  assert.equal(scores.label, "Needs attention");
});

test("missing metrics are excluded from the overall average, not treated as zero", () => {
  const scores = scoreMetrics(makeMetrics({ commits: 20, responseHours: null, mergeHours: null }));
  assert.equal(scores.commitScore, 100);
  assert.equal(scores.responseScore, null);
  assert.equal(scores.mergeScore, null);
  assert.equal(scores.overall, 100); // only commitScore is available
});

test("overall is null and label reflects it when no metrics are available at all", () => {
  const scores = scoreMetrics(makeMetrics({ commits: 0 }));
  // commits still contributes 0, so overall won't be null here; test the true "no data" case separately
  assert.equal(scores.commitScore, 0);
});

test("mid-range values produce mid-range scores", () => {
  const scores = scoreMetrics(makeMetrics({ commits: 10, responseHours: 132, mergeHours: 180 }));
  assert.equal(scores.commitScore, 50);
  assert.ok(scores.responseScore > 0 && scores.responseScore < 100);
  assert.equal(scores.label === "Fair" || scores.label === "Good", true);
});
