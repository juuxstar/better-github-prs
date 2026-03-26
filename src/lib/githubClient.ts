class GitHubAPI {
  private token : string | null = null;
  private user : any      = null;
  private apiBase         = '/api/github';
  private graphqlUrl      = '/api/github/graphql';
  private userNameCache   = new Map<string, string>();
  private botCommentCache = new Map<number, BotCounts>();
  private prStatsCache    = new Map<number, PRStats>();
  private checksCache     = new Map<number, ChecksSummary>();

  setToken(t: string) { this.token = t; }
  getToken() { return this.token; }
  getUser() { return this.user; }

  clear() {
    this.token = null;
    this.user = null;
    this.userNameCache.clear();
    this.clearAsyncCaches();
  }

  clearAsyncCaches() {
    this.botCommentCache.clear();
    this.prStatsCache.clear();
    this.checksCache.clear();
  }

  clearChecksCache() { this.checksCache.clear(); }
  clearChecksCacheFor(prId: number) { this.checksCache.delete(prId); }

  // ─── Core Fetch ───────────────────────────────────────

  private async apiFetch(endpoint: string, options: any = {}): Promise<any> {
    const { headers: extraHeaders, ...restOptions } = options;
    const response = await fetch(`${this.apiBase}${endpoint}`, {
      ...restOptions,
      headers: {
        Authorization: `token ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
        ...extraHeaders,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.clear();
        throw apiError('Session expired. Please sign in again.', { status: 401 });
      }
      if (response.status === 403 || response.status === 429) {
        const remaining = response.headers.get('x-ratelimit-remaining');
        const resetHeader = response.headers.get('x-ratelimit-reset');
        const retryAfter = response.headers.get('retry-after');
        if (remaining === '0' || response.status === 429 || retryAfter) {
          const resetTime = resetHeader
            ? new Date(parseInt(resetHeader) * 1000)
            : retryAfter
              ? new Date(Date.now() + parseInt(retryAfter) * 1000)
              : null;
          throw apiError('GitHub API rate limit exceeded', { status: response.status, rateLimitReset: resetTime });
        }
        const body = await response.json().catch(() => ({} as any));
        if (body.message?.toLowerCase().includes('rate limit')) {
          throw apiError('GitHub API rate limit exceeded', {
            status: response.status,
            rateLimitReset: resetHeader ? new Date(parseInt(resetHeader) * 1000) : null,
          });
        }
      }
      throw apiError(`GitHub API error: ${response.status}`, { status: response.status });
    }

    return response.json();
  }

  private async graphql(query: string, variables: Record<string, any> = {}): Promise<any> {
    const response = await fetch(this.graphqlUrl, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    const resetHeader = response.headers.get('x-ratelimit-reset');
    const retryAfter = response.headers.get('retry-after');

    if (!response.ok) {
      if (response.status === 401) {
        this.clear();
        throw apiError('Session expired. Please sign in again.', { status: 401 });
      }
      if (response.status === 403 || response.status === 429) {
        const remaining = response.headers.get('x-ratelimit-remaining');
        if (remaining === '0' || response.status === 429 || retryAfter) {
          const resetTime = resetHeader
            ? new Date(parseInt(resetHeader) * 1000)
            : retryAfter
              ? new Date(Date.now() + parseInt(retryAfter) * 1000)
              : null;
          throw apiError('GitHub API rate limit exceeded', { status: response.status, rateLimitReset: resetTime });
        }
        const body = await response.json().catch(() => ({} as any));
        if (body.message?.toLowerCase().includes('rate limit')) {
          throw apiError('GitHub API rate limit exceeded', {
            status: response.status,
            rateLimitReset: resetHeader ? new Date(parseInt(resetHeader) * 1000) : null,
          });
        }
      }
      throw apiError(`GitHub GraphQL error: ${response.status}`, { status: response.status });
    }

    const json = await response.json();
    if (json.errors) {
      const firstError = json.errors[0];
      const msg: string = firstError.message;
      if (firstError.type === 'RATE_LIMIT' || msg.toLowerCase().includes('rate limit')) {
        const resetTime = resetHeader
          ? new Date(parseInt(resetHeader) * 1000)
          : retryAfter
            ? new Date(parseInt(retryAfter) * 1000)
            : null;
        throw apiError('GitHub API rate limit exceeded', { rateLimitReset: resetTime });
      }
      throw apiError(msg);
    }
    return json.data;
  }

  // ─── Search with Pagination ───────────────────────────

  private async searchPRs(query: string): Promise<any[]> {
    let allItems: any[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const data = await this.apiFetch(
        `/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=${perPage}&page=${page}`,
      );
      const items = data.items || [];
      allItems = allItems.concat(items);
      if (items.length < perPage || allItems.length >= data.total_count || allItems.length >= 1000) break;
      page++;
    }
    return allItems;
  }

  private async fetchAllPages(endpoint: string): Promise<any[]> {
    let allItems: any[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const sep = endpoint.includes('?') ? '&' : '?';
      const items = await this.apiFetch(`${endpoint}${sep}per_page=${perPage}&page=${page}`);
      allItems = allItems.concat(items);
      if (items.length < perPage) break;
      page++;
    }
    return allItems;
  }

  // ─── Public API ───────────────────────────────────────

  async fetchCurrentUser() {
    this.user = await this.apiFetch('/user');
    return this.user;
  }

  async fetchUserOrgs() {
    return this.fetchAllPages('/user/orgs');
  }

  async fetchAllAccessiblePRs() {
    const orgs = await this.fetchUserOrgs();
    const queries = [`type:pr state:open user:${this.user.login}`];
    for (const org of orgs) queries.push(`type:pr state:open org:${org.login}`);

    const results = await Promise.all(queries.map(q => this.searchPRs(q)));
    const seen = new Set<number>();
    const merged: any[] = [];
    for (const items of results) {
      for (const pr of items) {
        if (!seen.has(pr.id)) { seen.add(pr.id); merged.push(pr); }
      }
    }
    merged.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return merged;
  }

  async fetchRepoPRs(repoFullName: string) {
    const items = await this.searchPRs(`type:pr state:open repo:${repoFullName}`);
    items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return items;
  }

  async fetchBotCommentCounts(prs: any[]) {
    const CURSOR_BOT = /^cursor\b/i;
    const toFetch = prs.filter(pr => !this.botCommentCache.has(pr.id));
    const batches: any[][] = [];
    for (let i = 0; i < toFetch.length; i += 10) batches.push(toFetch.slice(i, i + 10));

    const QUERY = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewThreads(first: 100) {
              nodes { isResolved comments(first: 1) { nodes { author { login } body } } }
            }
          }
        }
      }`;

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map(async (pr) => {
          const [owner, repo] = pr.repository_url.match(/repos\/([^/]+)\/([^/]+)/)!.slice(1);
          try {
            const data = await this.graphql(QUERY, { owner, repo, number: pr.number });
            const threads = data.repository.pullRequest.reviewThreads.nodes || [];
            const counts: BotCounts = { low: 0, medium: 0, high: 0 };
            for (const t of threads) {
              if (t.isResolved || !t.comments.nodes.length) continue;
              const comment = t.comments.nodes[0];
              if (!CURSOR_BOT.test(comment.author?.login || '')) continue;
              const severity = GitHubAPI.parseSeverity(comment.body);
              counts[severity]++;
            }
            return { id: pr.id as number, counts };
          } catch (error: any) {
            if (error.rateLimitReset || error.message?.includes('rate limit')) throw error;
            return { id: pr.id as number, counts: null };
          }
        }),
      );
      for (const { id, counts } of results) {
        if (counts !== null) this.botCommentCache.set(id, counts);
      }
    }
  }

  private static parseSeverity(body: string): keyof BotCounts {
    if (!body) return 'medium';
    const lower = body.toLowerCase();
    if (/\bcritical\b/.test(lower) || /\bhigh\b/.test(lower) || /\berror\b/.test(lower) || /\bbug\b/.test(lower) || /severity:\s*high/i.test(body)) return 'high';
    if (/\bsuggestion\b/.test(lower) || /\bnit\b/.test(lower) || /\bminor\b/.test(lower) || /\blow\b/.test(lower) || /severity:\s*low/i.test(body)) return 'low';
    return 'medium';
  }

  getBotComments(prId: number): BotCounts | null {
    return this.botCommentCache.get(prId) || null;
  }

  async fetchPRStats(prs: any[]) {
    const toFetch = prs.filter(pr => !this.prStatsCache.has(pr.id));
    const batches: any[][] = [];
    for (let i = 0; i < toFetch.length; i += 10) batches.push(toFetch.slice(i, i + 10));

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map(async (pr) => {
          const repo = pr.repository_url.match(/repos\/(.+)/)![1];
          try {
            const data = await this.apiFetch(`/repos/${repo}/pulls/${pr.number}`);
            return { id: pr.id as number, stats: { changedFiles: data.changed_files, additions: data.additions, deletions: data.deletions } as PRStats };
          } catch (error: any) {
            if (error.rateLimitReset || error.message?.includes('rate limit')) throw error;
            return { id: pr.id as number, stats: null };
          }
        }),
      );
      for (const { id, stats } of results) {
        if (stats !== null) this.prStatsCache.set(id, stats);
      }
    }
  }

  getPRStats(prId: number): PRStats | null {
    return this.prStatsCache.get(prId) || null;
  }

  async fetchChecks(prs: any[]) {
    const toFetch = prs.filter(pr => !this.checksCache.has(pr.id));
    const batches: any[][] = [];
    for (let i = 0; i < toFetch.length; i += 10) batches.push(toFetch.slice(i, i + 10));

    const QUERY = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            commits(last: 1) {
              nodes { commit { statusCheckRollup { contexts(first: 100) {
                nodes { ... on CheckRun { conclusion status } ... on StatusContext { state } }
              } } } }
            }
          }
        }
      }`;

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map(async (pr) => {
          const [owner, repo] = pr.repository_url.match(/repos\/([^/]+)\/([^/]+)/)!.slice(1);
          try {
            const data = await this.graphql(QUERY, { owner, repo, number: pr.number });
            const commits = data.repository.pullRequest.commits.nodes;
            if (!commits.length) return { id: pr.id as number, checks: { passed: 0, failed: 0, pending: 0 } };

            const contexts = commits[0].commit.statusCheckRollup?.contexts?.nodes || [];
            let passed = 0, failed = 0, pending = 0;
            for (const ctx of contexts) {
              if (ctx.conclusion) {
                if (['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(ctx.conclusion)) passed++;
                else if (['FAILURE', 'TIMED_OUT', 'CANCELLED'].includes(ctx.conclusion)) failed++;
                else pending++;
              } else if (ctx.state) {
                if (ctx.state === 'SUCCESS') passed++;
                else if (ctx.state === 'FAILURE' || ctx.state === 'ERROR') failed++;
                else pending++;
              } else {
                pending++;
              }
            }
            return { id: pr.id as number, checks: { passed, failed, pending } };
          } catch (error: any) {
            if (error.rateLimitReset || error.message?.includes('rate limit')) throw error;
            return { id: pr.id as number, checks: null };
          }
        }),
      );
      for (const { id, checks } of results) {
        if (checks !== null) this.checksCache.set(id, checks);
      }
    }
  }

  getChecks(prId: number): ChecksSummary | null {
    return this.checksCache.get(prId) || null;
  }

  async fetchUserFirstNames(logins: string[]) {
    const unique = [...new Set(logins)].filter(l => !this.userNameCache.has(l));
    const batches: string[][] = [];
    for (let i = 0; i < unique.length; i += 10) batches.push(unique.slice(i, i + 10));

    for (const batch of batches) {
      const results = await Promise.all(batch.map(login => this.apiFetch(`/users/${login}`).catch(() => null)));
      for (const profile of results) {
        if (profile) {
          const firstName = (profile.name || profile.login).split(/\s+/)[0];
          this.userNameCache.set(profile.login, firstName);
        }
      }
    }
  }

  getFirstName(login: string): string {
    return this.userNameCache.get(login) || login;
  }

  async addLabel(repo: string, issueNumber: number, label: string) {
    return this.apiFetch(`/repos/${repo}/issues/${issueNumber}/labels`, {
      method: 'POST',
      body: JSON.stringify({ labels: [label] }),
    });
  }

  async removeLabel(repo: string, issueNumber: number, label: string) {
    try {
      await this.apiFetch(`/repos/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`, { method: 'DELETE' });
    } catch (e: any) {
      if (!e.message.includes('404')) throw e;
    }
  }

  async fetchRecentBranches(repo: string): Promise<BranchInfo[]> {
    const branches = await this.apiFetch(`/repos/${repo}/branches?per_page=100&sort=updated`);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const withDates = await Promise.all(
      branches.map(async (b: any) => {
        try {
          const commit = await this.apiFetch(`/repos/${repo}/commits/${b.commit.sha}`);
          const message = commit.commit.message.split('\n')[0];
          return { name: b.name, date: new Date(commit.commit.committer.date), message };
        } catch {
          return null;
        }
      }),
    );

    return (withDates.filter((b): b is BranchInfo => b !== null && b.date >= oneHourAgo && b.name !== 'dev' && b.name !== 'main' && b.name !== 'master'))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async fetchBranchesWithoutPRs(repo: string): Promise<BranchInfo[]> {
    const [branches, openPRs] = await Promise.all([
      this.fetchRecentBranches(repo),
      this.apiFetch(`/repos/${repo}/pulls?state=open&per_page=100`),
    ]);
    const prHeads = new Set(openPRs.map((pr: any) => pr.head.ref));
    return branches.filter(b => !prHeads.has(b.name));
  }

  async fetchPRDetail(owner: string, repo: string, number: number): Promise<any> {
    return this.apiFetch(`/repos/${owner}/${repo}/pulls/${number}`, {
      headers: { Accept: 'application/vnd.github.v3.full+json' },
    });
  }

  async fetchPRFiles(owner: string, repo: string, number: number): Promise<PRFile[]> {
    return this.fetchAllPages(`/repos/${owner}/${repo}/pulls/${number}/files`);
  }

  async fetchFileContent(owner: string, repo: string, path: string, ref: string): Promise<string> {
    const data = await this.apiFetch(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`,
    );
    return atob(data.content.replace(/\n/g, ''));
  }

  async fetchDetailedChecks(owner: string, repo: string, number: number): Promise<CheckRunDetail[]> {
    const QUERY = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            commits(last: 1) {
              nodes {
                commit {
                  statusCheckRollup {
                    contexts(first: 100) {
                      nodes {
                        ... on CheckRun {
                          name
                          status
                          conclusion
                          detailsUrl
                          annotations(first: 50) {
                            nodes {
                              path
                              message
                              title
                              annotationLevel
                              location { start { line } end { line } }
                            }
                          }
                        }
                        ... on StatusContext {
                          context
                          state
                          targetUrl
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`;

    const data = await this.graphql(QUERY, { owner, repo, number });
    const commits = data.repository.pullRequest.commits.nodes;
    if (!commits.length) return [];

    const contexts = commits[0].commit.statusCheckRollup?.contexts?.nodes || [];
    return contexts.map((ctx: any) => {
      if (ctx.name !== undefined) {
        const annotations: CheckAnnotation[] = (ctx.annotations?.nodes || []).map((a: any) => ({
          path: a.path,
          message: a.message,
          title: a.title || null,
          level: (a.annotationLevel || '').toLowerCase(),
          startLine: a.location?.start?.line ?? 0,
          endLine: a.location?.end?.line ?? 0,
        }));
        return {
          name: ctx.name,
          status: (ctx.status || '').toLowerCase(),
          conclusion: ctx.conclusion ? ctx.conclusion.toLowerCase() : null,
          url: ctx.detailsUrl || null,
          annotations,
        };
      }
      return {
        name: ctx.context || 'Status check',
        status: 'completed',
        conclusion: ctx.state ? ctx.state.toLowerCase() : null,
        url: ctx.targetUrl || null,
        annotations: [],
      };
    });
  }

  async fetchRepoLabels(owner: string, repo: string): Promise<RepoLabel[]> {
    const labels = await this.fetchAllPages(`/repos/${owner}/${repo}/labels`);
    return labels.map((l: any) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      description: l.description,
    }));
  }

  async fetchPRFilesViewedState(owner: string, repo: string, number: number): Promise<{ viewedFiles: Record<string, string>; prNodeId: string }> {
    const QUERY = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            id
            files(first: 100) {
              nodes {
                path
                viewerViewedState
              }
            }
          }
        }
      }`;

    const data = await this.graphql(QUERY, { owner, repo, number });
    const pr = data.repository.pullRequest;
    const viewedFiles: Record<string, string> = {};
    for (const file of pr.files.nodes) {
      viewedFiles[file.path] = file.viewerViewedState;
    }
    return { viewedFiles, prNodeId: pr.id };
  }

  async markFileAsViewed(pullRequestId: string, path: string): Promise<void> {
    const MUTATION = `
      mutation($pullRequestId: ID!, $path: String!) {
        markFileAsViewed(input: { pullRequestId: $pullRequestId, path: $path }) {
          clientMutationId
        }
      }`;
    await this.graphql(MUTATION, { pullRequestId, path });
  }

  async unmarkFileAsViewed(pullRequestId: string, path: string): Promise<void> {
    const MUTATION = `
      mutation($pullRequestId: ID!, $path: String!) {
        unmarkFileAsViewed(input: { pullRequestId: $pullRequestId, path: $path }) {
          clientMutationId
        }
      }`;
    await this.graphql(MUTATION, { pullRequestId, path });
  }

  async createPR(repo: string, head: string, base: string, title: string, labels: string[] = []) {
    const pr = await this.apiFetch(`/repos/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify({ title, head, base, draft: false }),
    });
    if (labels.length > 0) await this.addLabel(repo, pr.number, labels[0]);
    return pr;
  }

  // ─── Review Comments ───────────────────────────────────

  async fetchPRReviewComments(owner: string, repo: string, number: number): Promise<ReviewComment[]> {
    const raw = await this.fetchAllPages(`/repos/${owner}/${repo}/pulls/${number}/comments`);
    return raw.map((c: any) => ({
      id: c.id,
      node_id: c.node_id,
      path: c.path,
      line: c.line ?? c.original_line ?? null,
      side: c.side || 'RIGHT',
      original_line: c.original_line ?? null,
      body: c.body,
      user: { login: c.user.login, avatar_url: c.user.avatar_url },
      created_at: c.created_at,
      updated_at: c.updated_at,
      in_reply_to_id: c.in_reply_to_id ?? undefined,
      html_url: c.html_url,
    }));
  }

  async submitReview(
    owner: string,
    repo: string,
    number: number,
    commitId: string,
    pending: PendingComment[],
    event = 'COMMENT',
  ): Promise<any> {
    const comments = pending.map(c => ({
      path: c.path,
      line: c.line,
      side: c.side,
      body: formatCommentBody(c.body, c.commentType),
    }));
    return this.apiFetch(`/repos/${owner}/${repo}/pulls/${number}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ commit_id: commitId, event, comments }),
    });
  }

  async replyToReviewComment(owner: string, repo: string, number: number, commentId: number, body: string): Promise<ReviewComment> {
    const c = await this.apiFetch(`/repos/${owner}/${repo}/pulls/${number}/comments/${commentId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    return {
      id: c.id,
      node_id: c.node_id,
      path: c.path,
      line: c.line ?? c.original_line ?? null,
      side: c.side || 'RIGHT',
      original_line: c.original_line ?? null,
      body: c.body,
      user: { login: c.user.login, avatar_url: c.user.avatar_url },
      created_at: c.created_at,
      updated_at: c.updated_at,
      in_reply_to_id: c.in_reply_to_id ?? undefined,
      html_url: c.html_url,
    };
  }

  async applySuggestion(commentNodeId: string, commitMessage?: string): Promise<void> {
    const MUTATION = `
      mutation($suggestionId: ID!, $message: String!) {
        applySuggestedChanges(input: { suggestionIds: [$suggestionId], message: $message }) {
          clientMutationId
        }
      }`;
    await this.graphql(MUTATION, {
      suggestionId: commentNodeId,
      message: commitMessage || 'Apply suggestion from review',
    });
  }
}

export const GitHubClient = new GitHubAPI();
export default GitHubClient;

function apiError(msg: string, extra?: Partial<ApiError>): ApiError {
  const err = new Error(msg) as ApiError;
  if (extra) Object.assign(err, extra);
  return err;
}

export interface ApiError extends Error {
  status?: number
  rateLimitReset?: Date | null
}

export interface BotCounts {
  low: number
  medium: number
  high: number
}

export interface PRStats {
  changedFiles: number
  additions: number
  deletions: number
}

export interface ChecksSummary {
  passed: number
  failed: number
  pending: number
}

export interface BranchInfo {
  name: string
  date: Date
  message: string
}

export interface CheckAnnotation {
  path: string;
  message: string;
  title: string | null;
  level: string;
  startLine: number;
  endLine: number;
}

export interface CheckRunDetail {
  name: string;
  status: 'completed' | 'in_progress' | 'queued' | string;
  conclusion: string | null;
  url: string | null;
  annotations: CheckAnnotation[];
}

export interface RepoLabel {
  id: number
  name: string
  color: string
  description: string | null
}

export interface PRFile {
  sha: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export type CommentType = 'suggestion' | 'change-required' | 'question';

export interface ReviewComment {
  id: number;
  node_id: string;
  path: string;
  line: number | null;
  side: 'LEFT' | 'RIGHT';
  original_line: number | null;
  body: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  in_reply_to_id?: number;
  html_url: string;
}

export interface PendingComment {
  id: string;
  path: string;
  line: number;
  side: 'LEFT' | 'RIGHT';
  body: string;
  commentType: CommentType;
  lineContent: string;
}

const COMMENT_TYPE_PREFIXES: Record<CommentType, string> = {
  'suggestion': '\u{1F4A1} **Suggestion:**',
  'change-required': '\u{26A0}\u{FE0F} **Change Required:**',
  'question': '\u{2753} **Question:**',
};

export function formatCommentBody(body: string, commentType: CommentType): string {
  const prefix = COMMENT_TYPE_PREFIXES[commentType];
  return `${prefix} ${body}\n<!-- review-type:${commentType} -->`;
}

export function parseCommentType(body: string): CommentType {
  const metaMatch = body.match(/<!-- review-type:(suggestion|change-required|question) -->/);
  if (metaMatch) return metaMatch[1] as CommentType;
  if (body.startsWith('\u{1F4A1}')) return 'suggestion';
  if (body.startsWith('\u{26A0}')) return 'change-required';
  if (body.startsWith('\u{2753}')) return 'question';
  return 'suggestion';
}

export function stripCommentTypePrefix(body: string): string {
  return body
    .replace(/^(?:\u{1F4A1}|\u{26A0}\u{FE0F}|\u{2753})\s*\*\*(?:Suggestion|Change Required|Question):\*\*\s*/u, '')
    .replace(/\n?<!-- review-type:(?:suggestion|change-required|question) -->/, '')
    .trim();
}

type SuggestionSegment = { type: 'text'; content: string } | { type: 'suggestion'; code: string };

export function parseSuggestionBlocks(body: string): SuggestionSegment[] {
  const segments: SuggestionSegment[] = [];
  const regex = /```suggestion\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: body.slice(lastIndex, match.index).trim() });
    }
    segments.push({ type: 'suggestion', code: match[1].replace(/\n$/, '') });
    lastIndex = match.index + match[0].length;
  }
  const trailing = body.slice(lastIndex).trim();
  if (trailing) segments.push({ type: 'text', content: trailing });
  return segments;
}
