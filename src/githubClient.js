const API_BASE = "https://api.github.com";

/**
 * Thin wrapper around the GitHub REST API.
 * Uses an optional token (GITHUB_TOKEN env var) to raise the rate limit
 * from 60 req/hr (unauthenticated) to 5000 req/hr.
 */
export class GitHubClient {
  constructor(token = process.env.GITHUB_TOKEN) {
    this.token = token;
    this.headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "github-repo-health-cli",
    };
    if (token) {
      this.headers.Authorization = `Bearer ${token}`;
    }
  }

  async _get(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: this.headers });

    if (res.status === 404) {
      throw new Error(
        `Repository not found (404). Check the owner/repo name and that it's public.`
      );
    }
    if (res.status === 403) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      throw new Error(
        `GitHub API rate limit hit (remaining: ${remaining}). ` +
          `Set a GITHUB_TOKEN env var to raise the limit from 60 to 5000 req/hr.`
      );
    }
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  async getRepo(owner, repo) {
    return this._get(`/repos/${owner}/${repo}`);
  }

  /** Recent commits on the default branch, newest first. */
  async getRecentCommits(owner, repo, { perPage = 100, since } = {}) {
    const params = new URLSearchParams({ per_page: String(perPage) });
    if (since) params.set("since", since);
    return this._get(`/repos/${owner}/${repo}/commits?${params}`);
  }

  /**
   * Issues (state=all includes open+closed). Note: GitHub's issues endpoint
   * also returns pull requests, so callers should filter out items that
   * have a `pull_request` key when they only want true issues.
   */
  async getRecentIssues(owner, repo, { perPage = 30 } = {}) {
    const params = new URLSearchParams({
      state: "all",
      sort: "created",
      direction: "desc",
      per_page: String(perPage),
    });
    return this._get(`/repos/${owner}/${repo}/issues?${params}`);
  }

  async getFirstComment(owner, repo, issueNumber) {
    const comments = await this._get(
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=1&sort=created&direction=asc`
    );
    return comments[0] ?? null;
  }

  async getRecentPulls(owner, repo, { perPage = 30, state = "closed" } = {}) {
    const params = new URLSearchParams({
      state,
      sort: "created",
      direction: "desc",
      per_page: String(perPage),
    });
    return this._get(`/repos/${owner}/${repo}/pulls?${params}`);
  }
}
