# github-repo-health

A CLI tool that scores any public GitHub repository's health based on three signals:

- **Commit frequency** — how active the repo has been in the last 30 days
- **Issue response time** — how quickly maintainers respond to new issues
- **PR merge time** — how quickly pull requests get merged

It pulls live data straight from the GitHub REST API and prints a 0–100 health score with a breakdown per metric.

```
  facebook/react
  231000 stars  ·  1024 open issues  ·  last push 2026-07-20

┌──────────────────────────┬────────────────────────────────┬──────────┐
│ Metric                   │ Value                          │ Score    │
├──────────────────────────┼────────────────────────────────┼──────────┤
│ Commit frequency         │ 18 commits in last 30 days     │ 90       │
│ Issue response time      │ 1.2 days avg (12 issues sampled)│ 78       │
│ PR merge time             │ 3.4 days avg (20 PRs sampled)  │ 65       │
└──────────────────────────┴────────────────────────────────┴──────────┘

  Overall health: 78/100  Good
```

## Why this project

Most portfolio projects are CRUD apps. This one is a small dev tool that talks to a real, well-documented external API, processes and aggregates time-series-ish data, and turns it into an opinionated score — good practice for API integration, rate-limit handling, and data modeling.

## Setup

```bash
git clone https://github.com/<your-username>/github-repo-health.git
cd github-repo-health
npm install
```

Optional: create a `.env` (see `.env.example`) with a GitHub personal access token to raise the API rate limit from 60 to 5,000 requests/hour. No token is required for casual use.

## Usage

```bash
node src/index.js facebook/react
node src/index.js vercel/next.js --json   # raw JSON output, useful for piping elsewhere
```

Or link it globally as a CLI:

```bash
npm link
repo-health torvalds/linux
```

## How scoring works

Each metric is mapped onto a 0–100 scale between a "good" and "bad" threshold, then averaged (metrics with no available data are excluded from the average rather than counted as zero):

| Metric | 100 (great) | 0 (poor) |
|---|---|---|
| Commits in last 30 days | 20+ | 0 |
| Avg. time to first issue response | ≤ 24 hrs | ≥ 240 hrs (10 days) |
| Avg. time to PR merge | ≤ 24 hrs | ≥ 336 hrs (14 days) |

These thresholds are deliberately simple and tunable — see `src/scorer.js`. Real-world calibration (e.g. against a sample of popular repos) would be a good next step.

**Sampling note:** issue response time and PR merge time are computed over the most recent ~15–20 items, not the full history, to keep API usage reasonable for unauthenticated requests.

## Project structure

```
src/
  githubClient.js   # thin GitHub REST API wrapper (auth, pagination, error handling)
  metrics.js        # fetches + aggregates raw stats (commits, issues, PRs)
  scorer.js         # pure functions: raw metrics -> 0-100 scores
  index.js          # CLI entry point (commander) + formatted table output
test/
  scorer.test.js    # unit tests for scoring logic (no network calls)
```

`scorer.js` is intentionally pure and side-effect free so it's fully unit-testable without hitting the network — the tests in `test/scorer.test.js` cover it directly.

## Running tests

```bash
npm test
```

## Ideas for extending this

- Add a `--compare owner/repo1 owner/repo2` flag to score multiple repos side by side
- Serve the report as a small web dashboard (Express + Chart.js) instead of just a CLI table
- Add a "contributor diversity" metric (bus-factor: % of commits from the top contributor)
- Cache API responses locally to avoid re-fetching on repeated runs
- Publish to npm so it's installable via `npx github-repo-health owner/repo`

## License

MIT
