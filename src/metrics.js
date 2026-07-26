const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

/** Commits pushed in the last 30 days. */
export async function commitFrequency(client, owner, repo) {
  const since = new Date(Date.now() - 30 * MS_PER_DAY).toISOString();
  const commits = await client.getRecentCommits(owner, repo, { since, perPage: 100 });
  return {
    commitsLast30Days: commits.length,
  };
}

/**
 * Average hours between an issue being opened and receiving its first
 * comment, sampled over the most recent `sampleSize` issues that have
 * at least one comment. Pull requests are excluded (GitHub's issues
 * endpoint returns both).
 */
export async function issueResponseTime(client, owner, repo, { sampleSize = 15 } = {}) {
  const issues = (await client.getRecentIssues(owner, repo, { perPage: 30 }))
    .filter((i) => !i.pull_request)
    .slice(0, sampleSize);

  const waitsHours = [];
  for (const issue of issues) {
    if (issue.comments === 0) continue; // no response yet, skip rather than penalize as "instant"
    const firstComment = await client.getFirstComment(owner, repo, issue.number);
    if (!firstComment) continue;
    const created = new Date(issue.created_at).getTime();
    const responded = new Date(firstComment.created_at).getTime();
    waitsHours.push((responded - created) / MS_PER_HOUR);
  }

  const avg = waitsHours.length
    ? waitsHours.reduce((a, b) => a + b, 0) / waitsHours.length
    : null;

  return {
    avgFirstResponseHours: avg,
    sampledIssues: waitsHours.length,
    respondedIssuesConsidered: issues.length,
  };
}

/**
 * Average hours between PR creation and merge, over the most recent
 * merged PRs.
 */
export async function prMergeTime(client, owner, repo, { sampleSize = 20 } = {}) {
  const pulls = await client.getRecentPulls(owner, repo, { perPage: 30, state: "closed" });
  const merged = pulls.filter((p) => p.merged_at).slice(0, sampleSize);

  const mergeHours = merged.map(
    (p) => (new Date(p.merged_at).getTime() - new Date(p.created_at).getTime()) / MS_PER_HOUR
  );

  const avg = mergeHours.length
    ? mergeHours.reduce((a, b) => a + b, 0) / mergeHours.length
    : null;

  return {
    avgMergeHours: avg,
    sampledPRs: mergeHours.length,
    closedPRsConsidered: pulls.length,
  };
}

export async function collectMetrics(client, owner, repo) {
  const repoInfo = await client.getRepo(owner, repo);
  const [commits, issues, prs] = await Promise.all([
    commitFrequency(client, owner, repo),
    issueResponseTime(client, owner, repo),
    prMergeTime(client, owner, repo),
  ]);

  return {
    repo: {
      fullName: repoInfo.full_name,
      stars: repoInfo.stargazers_count,
      openIssues: repoInfo.open_issues_count,
      defaultBranch: repoInfo.default_branch,
      pushedAt: repoInfo.pushed_at,
    },
    commits,
    issues,
    prs,
  };
}
