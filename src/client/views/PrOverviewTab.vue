<template>
  <div class="pr-detail-overview u-flex u-flex-col u-flex-1 u-min-h-0 u-overflow-hidden">
  <div
    class="pr-detail-body-grid u-grid u-gap-4 u-flex-1 u-min-h-0 u-overflow-y-auto u-items-stretch"
  >
    <section class="pr-detail-col-section pr-detail-col-main u-flex u-flex-col u-gap-4 u-min-w-0">
      <div class="pr-detail-description card">
        <h2 class="u-flex-shrink-0">Description</h2>
        <div v-if="pr.body" class="pr-detail-body-text markdown-body" v-html="pr.body_html || pr.body" ></div>
        <p v-else class="pr-detail-empty u-flex-shrink-0">No description provided</p>
      </div>

      <div class="pr-detail-stats card">
        <h2 class="u-flex-shrink-0">Stats</h2>
        <div class="pr-detail-stat-grid u-flex u-flex-wrap u-items-start u-gap-3 u-text-center">
          <div class="pr-detail-stat pr-detail-stat-branch u-flex u-flex-col u-gap-0-5">
            <div
              class="pr-detail-stat-value pr-detail-stat-branch-wrap u-flex u-flex-wrap u-items-center u-gap-1 u-fs-13 u-fw-600 u-font-mono u-leading-1-4"
              :title="branchCompareTitle"
            >
              <span class="pr-detail-branch-piece u-min-w-0 u-text-primary">{{ headBranchText }}</span>
              <span class="pr-detail-branch-arrow u-flex-shrink-0 u-text-tertiary u-fw-500" aria-hidden="true">→</span>
              <span class="pr-detail-branch-piece u-min-w-0 u-text-primary">{{ baseBranchText }}</span>
            </div>
            <span class="pr-detail-stat-label">Branch</span>
          </div>
          <div class="pr-detail-stat u-flex u-flex-col u-gap-0-5">
            <span class="pr-detail-stat-value">{{ pr.changed_files }}</span>
            <span class="pr-detail-stat-label">Files</span>
          </div>
          <div class="pr-detail-stat pr-detail-stat-add u-flex u-flex-col u-gap-0-5">
            <span class="pr-detail-stat-value">+{{ pr.additions }}</span>
            <span class="pr-detail-stat-label">Additions</span>
          </div>
          <div class="pr-detail-stat pr-detail-stat-del u-flex u-flex-col u-gap-0-5">
            <span class="pr-detail-stat-value">&minus;{{ pr.deletions }}</span>
            <span class="pr-detail-stat-label">Deletions</span>
          </div>
        </div>
      </div>

      <div class="pr-detail-labels card">
        <h2 class="u-flex-shrink-0">Labels</h2>
        <div class="pr-detail-labels-list u-flex u-flex-wrap u-gap-1-5 u-mb-3">
          <span
            v-for="label in pr.labels"
            :key="label.id"
            class="pr-detail-label u-inline-flex u-items-center u-gap-1 u-fs-12 u-fw-500 u-whitespace-nowrap"
            :style="labelStyle(label)"
          >
            {{ label.name }}
            <button
              class="pr-detail-label-remove"
              :title="'Remove ' + label.name"
              @click="$emit('remove-label', label.name)"
            >&times;</button>
          </span>
          <span v-if="!pr.labels.length" class="pr-detail-empty u-flex-shrink-0">No labels</span>
        </div>
        <div class="pr-detail-add-label u-relative">
          <div class="pr-detail-add-label-toggle">
            <button type="button" class="pr-detail-compact-btn" @click="toggleLabelDropdown">
              + Add label
            </button>
          </div>
          <div v-if="labelDropdownOpen" class="pr-detail-label-dropdown u-flex u-flex-col u-z-100" >
            <input
              v-model="labelSearch"
              class="pr-detail-label-search"
              placeholder="Filter labels..."
              @keydown.escape="labelDropdownOpen = false"
            />
            <ul class="pr-detail-label-options">
              <li
                v-for="label in filteredRepoLabels"
                :key="label.id"
                class="pr-detail-label-option u-flex u-items-center u-gap-2"
                @click="handleAddLabel(label.name)"
              >
                <span class="pr-detail-label-swatch u-flex-shrink-0" :style="{ background : '#' + label.color }"></span>
                {{ label.name }}
              </li>
              <li v-if="!filteredRepoLabels.length" class="pr-detail-label-option pr-detail-label-option-empty">
                No matching labels
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="pr-detail-col-section pr-detail-col-comments u-flex u-flex-col u-gap-4 u-min-w-0">
      <div class="pr-detail-comments card">
        <h2 class="u-flex-shrink-0">Comments ({{ commentsUnresolvedTotalLabel }})</h2>
        <div
          v-if="commentsLoading"
          class="pr-detail-comments-loading u-flex u-items-center u-gap-2 u-fs-13 u-text-secondary u-flex-shrink-0"
        >
          <span class="async-loader"></span> Loading comments...
        </div>
        <ul
          v-else-if="sortedOverviewComments.length"
          class="pr-detail-comments-list u-flex u-flex-col u-gap-3 u-flex-1 u-min-h-0 u-overflow-y-auto u-m-0 u-p-0"
        >
          <li
            v-for="item in sortedOverviewComments"
            :key="item.key"
            class="pr-detail-comment-block"
            :class="{
              'pr-detail-comment-issue': item.kind === 'issue',
              'pr-detail-comment-review': item.kind !== 'issue',
              'pr-detail-comment-resolved': item.kind !== 'issue' && item.thread.resolved,
            }"
          >
            <template v-if="item.kind === 'issue'">
              <div class="pr-detail-comment-meta">
                <img :src="item.comment.user.avatar_url" class="pr-detail-comment-avatar u-flex-shrink-0" alt="" />
                <span class="pr-detail-comment-author">{{ item.comment.user.login }}</span>
                <span class="pr-detail-comment-time">{{ timeAgo(item.comment.created_at) }}</span>
                <span class="pr-detail-comment-badge">Conversation</span>
              </div>
              <div class="markdown-body pr-detail-comment-body" v-html="markdownConversation(item.comment.body)"></div>
            </template>
            <template v-else>
              <template v-if="item.thread.resolved && !isResolvedThreadExpanded(item.thread.id)">
                <div class="pr-detail-resolved-compact">
                  <button
                    type="button"
                    class="pr-detail-resolved-title-btn u-flex-grow-1 u-min-w-0"
                    title="Show full thread"
                    @click="expandResolvedThread(item.thread.id)"
                  >
                    <span class="pr-detail-resolved-chevron u-flex-shrink-0" aria-hidden="true">▸</span>
                    <span class="pr-detail-resolved-title-text">{{ resolvedThreadBriefTitle(item.thread) }}</span>
                  </button>
                  <div class="pr-detail-resolved-compact-actions u-inline-flex u-items-start u-gap-2 u-flex-shrink-0">
                    <button
                      v-if="item.thread.threadNodeId"
                      type="button"
                      class="pr-detail-compact-btn"
                      :disabled="resolveTogglingThreadId === item.thread.id"
                      title="Mark this review thread as open again"
                      @click="toggleThreadResolved(item.thread)"
                    >
                      <span v-if="resolveTogglingThreadId === item.thread.id" class="async-loader"></span>
                      <template v-else>Unresolve</template>
                    </button>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="pr-detail-review-head">
                  <div v-if="item.thread.threadNodeId || item.thread.resolved" class="pr-detail-comment-card-top" >
                    <span class="pr-detail-comment-card-actions-tr u-inline-flex u-items-center u-gap-2 u-flex-shrink-0">
                      <button
                        v-if="item.thread.resolved"
                        type="button"
                        class="pr-detail-compact-btn pr-detail-collapse-thread-btn"
                        title="Show condensed view"
                        @click="collapseResolvedThread(item.thread.id)"
                      >
                        Less
                      </button>
                      <button
                        v-if="item.thread.threadNodeId"
                        type="button"
                        class="pr-detail-compact-btn"
                        :disabled="resolveTogglingThreadId === item.thread.id"
                        :title="item.thread.resolved ? 'Mark this review thread as open again' : 'Mark this review thread as resolved'"
                        @click="toggleThreadResolved(item.thread)"
                      >
                        <span v-if="resolveTogglingThreadId === item.thread.id" class="async-loader"></span>
                        <template v-else>{{ item.thread.resolved ? 'Unresolve' : 'Resolve' }}</template>
                      </button>
                    </span>
                  </div>
                  <div class="pr-detail-comment-thread-header">
                    <span class="pr-detail-comment-path">{{ item.thread.path }}</span>
                    <template v-if="item.thread.line != null">
                      <span class="pr-detail-comment-sep">&middot;</span>
                      <span class="pr-detail-comment-line">Line {{ item.thread.line }} ({{ item.thread.side }})</span>
                    </template>
                    <span
                      class="pr-detail-comment-thread-status"
                      :class="item.thread.resolved ? 'resolved' : 'open'"
                    >{{ item.thread.resolved ? 'Resolved' : 'Open' }}</span>
                  </div>
                </div>
                <div v-for="c in item.thread.comments" :key="c.id" class="pr-detail-comment-review-reply" >
                  <div class="pr-detail-comment-meta">
                    <img :src="c.user.avatar_url" class="pr-detail-comment-avatar u-flex-shrink-0" alt="" />
                    <span class="pr-detail-comment-author">{{ c.user.login }}</span>
                    <span class="pr-detail-comment-time">{{ timeAgo(c.created_at) }}</span>
                    <span class="pr-detail-comment-badge">Review</span>
                  </div>
                  <div class="markdown-body pr-detail-comment-body" v-html="markdownReview(c.body)"></div>
                </div>
              </template>
            </template>
          </li>
        </ul>
        <p v-else class="pr-detail-empty u-flex-shrink-0">No comments on this pull request yet</p>
      </div>
    </section>

    <section class="pr-detail-col-section pr-detail-col-checks">
      <div class="pr-detail-checks card">
        <h2 class="u-flex-shrink-0">Checks ({{ checksSummaryText }})</h2>
        <div v-if="checksLoading" class="pr-detail-checks-loading u-flex u-items-center u-gap-2 u-fs-13 u-text-secondary u-flex-shrink-0" >
          <span class="async-loader"></span> Loading checks...
        </div>
        <ul v-else-if="checks.length" class="pr-detail-checks-list">
          <li v-for="check in checks" :key="check.name" class="pr-detail-check-item">
            <div class="pr-detail-check-row">
              <span
                class="pr-detail-check-icon u-flex-shrink-0"
                :class="{
                  'check-passed': isCheckPassed(check),
                  'check-failed': isCheckFailed(check),
                  'check-pending': !isCheckPassed(check) && !isCheckFailed(check),
                }"
              >{{ checkIcon(check) }}</span>
              <span class="pr-detail-check-name u-min-w-0 u-flex-grow-1 u-truncate">
                <a v-if="check.url" :href="check.url" target="_blank" rel="noopener">{{ check.name }}</a>
                <span v-else>{{ check.name }}</span>
              </span>
              <span class="pr-detail-check-conclusion u-flex-shrink-0">{{ checkLabel(check) }}</span>
            </div>
            <ul v-if="failureAnnotations(check).length" class="pr-detail-annotations">
              <li v-for="(ann, idx) in failureAnnotations(check)" :key="idx" class="pr-detail-annotation">
                <span class="pr-detail-annotation-location">{{ ann.path }}<template v-if="ann.startLine">:{{ ann.startLine }}</template></span>
                <span v-if="ann.title" class="pr-detail-annotation-title">{{ ann.title }}</span>
                <span class="pr-detail-annotation-message">{{ ann.message }}</span>
              </li>
            </ul>
          </li>
        </ul>
        <p v-else class="pr-detail-empty u-flex-shrink-0">No checks found</p>
      </div>
    </section>
  </div>
  </div>
</template>

<script lang="ts">
import type { CheckAnnotation, CheckRunDetail, IssueComment, RepoLabel, ReviewComment } from '@/lib/githubClient';
import GitHubClient, { stripCommentTypePrefix } from '@/lib/githubClient';
import { renderGithubMarkdown }                 from '@/lib/githubMarkdown';
import { timeAgo }                              from '@/lib/utils';

import { Component, Prop, Vue } from 'vue-facing-decorator';

interface OverviewThread {
	id: number;
	path: string;
	line: number | null;
	side: string;
	comments: ReviewComment[];
	created_at: string;
	resolved: boolean;
	threadNodeId?: string;
}

type OverviewRow =
  | { kind: 'issue'; key: string; sortTime: number; comment: IssueComment }
  | { kind: 'review-thread'; key: string; sortTime: number; thread: OverviewThread };

@Component({ emits : [ 'add-label', 'remove-label', 'comments-updated' ] })
export default class PrOverviewTab extends Vue {

	@Prop({ required : true }) readonly pr!: any;
	@Prop({ required : true }) readonly checks!: CheckRunDetail[];
	@Prop({ required : true }) readonly checksLoading!: boolean;
	@Prop({ required : true }) readonly repoLabels!: RepoLabel[];
	@Prop({ default : () => [] }) readonly reviewComments!: ReviewComment[];
	@Prop({ default : () => [] }) readonly issueComments!: IssueComment[];
	@Prop({ default : false }) readonly commentsLoading!: boolean;

	readonly timeAgo = timeAgo;

	labelDropdownOpen = false;
	labelSearch = '';
	/** Root review comment id while a resolve/unresolve request is in flight */
	resolveTogglingThreadId: number | null = null;

	/** Review thread ids whose resolved threads are shown expanded (default collapsed). */
	resolvedThreadsExpanded: Record<number, true> = {};

	/** Unresolved count / total rows (issue comments + review threads). Issue comments count as unresolved. */
	get commentsUnresolvedTotalLabel(): string {
		if (this.commentsLoading) {
			return '... / ...';
		}
		const issues            = this.issueComments.length;
		const threads           = this.reviewCommentThreads;
		const unresolvedThreads = threads.filter(t => !t.resolved).length;
		const unresolved        = issues + unresolvedThreads;
		const total             = issues + threads.length;
		return `${unresolved} / ${total}`;
	}

	get headBranchText(): string {
		const h = this.pr?.head;
		return h ? String(h.label || h.ref || '—') : '—';
	}

	get baseBranchText(): string {
		const b = this.pr?.base;
		return b ? String(b.ref || '—') : '—';
	}

	get branchCompareTitle(): string {
		return `${this.headBranchText} into ${this.baseBranchText}`;
	}

	get reviewCommentThreads(): OverviewThread[] {
		const list     = this.reviewComments || [];
		const rootMap  = new Map<number, ReviewComment>();
		const replyMap = new Map<number, ReviewComment[]>();
		for (const c of list) {
			if (c.in_reply_to_id) {
				const rid = c.in_reply_to_id;
				const arr = replyMap.get(rid);
				if (arr) {
					arr.push(c);
				}
				else {
					replyMap.set(rid, [ c ]);
				}
			}
			else {
				rootMap.set(c.id, c);
			}
		}
		const threads: OverviewThread[] = [];
		for (const [ rootId, root ] of rootMap) {
			const replies = replyMap.get(rootId) || [];
			const all     = [ root, ...replies ].sort(
				(a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
			);
			const resolved = !all.some(c => c.isResolved === false);
			threads.push({
				id           : rootId,
				path         : root.path,
				line         : root.line,
				side         : root.side,
				comments     : all,
				created_at   : root.created_at,
				resolved,
				threadNodeId : root.threadNodeId,
			});
		}
		return threads;
	}

	get sortedOverviewComments(): OverviewRow[] {
		const rows: OverviewRow[] = [];
		for (const comment of this.issueComments || []) {
			rows.push({
				kind     : 'issue',
				key      : `issue-${comment.id}`,
				sortTime : new Date(comment.created_at).getTime(),
				comment,
			});
		}
		for (const thread of this.reviewCommentThreads) {
			rows.push({
				kind     : 'review-thread',
				key      : `thread-${thread.id}`,
				sortTime : new Date(thread.created_at).getTime(),
				thread,
			});
		}
		rows.sort((a, b) => a.sortTime - b.sortTime);
		return rows;
	}

	isResolvedThreadExpanded(threadId: number): boolean {
		return !!this.resolvedThreadsExpanded[threadId];
	}

	expandResolvedThread(threadId: number) {
		this.resolvedThreadsExpanded = { ...this.resolvedThreadsExpanded, [threadId] : true };
	}

	collapseResolvedThread(threadId: number) {
		const next = { ...this.resolvedThreadsExpanded };
		delete next[threadId];
		this.resolvedThreadsExpanded = next;
	}

	/** One-line summary for collapsed resolved threads (path, line, truncated body). */
	resolvedThreadBriefTitle(thread: OverviewThread): string {
		const first    = thread.comments[0]?.body || '';
		const stripped = stripCommentTypePrefix(first)
			.replace(/```[\s\S]*?```/g, ' ')
			.replace(/`[^`]*`/g, ' ')
			.replace(/\[[^\]]*\]\([^)]*\)/g, '$1')
			.replace(/[#*_~]/g, '')
			.replace(/\s+/g, ' ')
			.trim();
		const preview
			= stripped.length > 64 ? `${stripped.slice(0, 61).trimEnd()}…` : stripped;
		const loc
			= thread.line != null ? ` · line ${thread.line}` : '';
		const file = thread.path.split('/').pop() || thread.path;
		const head = `${file}${loc}`;
		return preview ? `${head} — ${preview}` : head;
	}

	markdownConversation(body: string): string {
		return renderGithubMarkdown(body);
	}

	markdownReview(body: string): string {
		return renderGithubMarkdown(stripCommentTypePrefix(body));
	}

	async toggleThreadResolved(thread: OverviewThread) {
		const nodeId = thread.threadNodeId;
		if (!nodeId || this.resolveTogglingThreadId != null) {
			return;
		}
		this.resolveTogglingThreadId = thread.id;
		try {
			await GitHubClient.setReviewThreadResolved(nodeId, !thread.resolved);
			this.$emit('comments-updated');
		}
		catch (e: any) {
			console.error('Failed to toggle review thread resolved:', e);
		}
		finally {
			this.resolveTogglingThreadId = null;
		}
	}

	get checksSummaryText(): string {
		if (this.checksLoading) {
			return '...';
		}
		if (!this.checks.length) {
			return '0';
		}
		const passed          = this.checks.filter(c => this.isCheckPassed(c)).length;
		const failed          = this.checks.filter(c => this.isCheckFailed(c)).length;
		const pending         = this.checks.length - passed - failed;
		const parts: string[] = [];
		if (passed) {
			parts.push(`${passed} passed`);
		}
		if (failed) {
			parts.push(`${failed} failed`);
		}
		if (pending) {
			parts.push(`${pending} pending`);
		}
		return parts.join(', ');
	}

	get currentLabelNames(): Set<string> {
		return new Set((this.pr?.labels || []).map((l: any) => l.name.toLowerCase()));
	}

	get filteredRepoLabels(): RepoLabel[] {
		const current = this.currentLabelNames;
		const search  = this.labelSearch.toLowerCase();
		return this.repoLabels
			.filter(l => !current.has(l.name.toLowerCase()))
			.filter(l => l.name.toLowerCase().includes(search));
	}

	isCheckPassed(check: CheckRunDetail): boolean {
		const c = check.conclusion;
		return c === 'success' || c === 'neutral' || c === 'skipped';
	}

	isCheckFailed(check: CheckRunDetail): boolean {
		const c = check.conclusion;
		return c === 'failure' || c === 'timed_out' || c === 'cancelled' || c === 'error';
	}

	checkIcon(check: CheckRunDetail): string {
		if (this.isCheckPassed(check)) {
			return '✓';
		}
		if (this.isCheckFailed(check)) {
			return '✗';
		}
		return '●';
	}

	checkLabel(check: CheckRunDetail): string {
		if (check.conclusion) {
			return check.conclusion.replace(/_/g, ' ');
		}
		if (check.status === 'in_progress') {
			return 'in progress';
		}
		if (check.status === 'queued') {
			return 'queued';
		}
		return 'pending';
	}

	failureAnnotations(check: CheckRunDetail): CheckAnnotation[] {
		if (!this.isCheckFailed(check)) {
			return [];
		}
		return check.annotations.filter(a => a.level === 'failure' || a.level === 'warning');
	}

	labelStyle(label: any): Record<string, string> {
		const c = `#${label.color}`;
		return { background : `${c}22`, color : c, borderColor : `${c}44` };
	}

	toggleLabelDropdown() {
		this.labelDropdownOpen = !this.labelDropdownOpen;
		this.labelSearch       = '';
	}

	handleAddLabel(name: string) {
		this.$emit('add-label', name);
		this.labelDropdownOpen = false;
	}

}
</script>

<style>
.pr-detail-body-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.pr-detail-col-comments {
  min-height: 0;
}

.pr-detail-col-comments .pr-detail-comments.card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (max-width: 900px) {
  .pr-detail-body-grid {
    grid-template-columns: 1fr;
  }
}

.pr-detail-overview .pr-detail-stats .pr-detail-stat-grid > .pr-detail-stat-branch {
  flex: 1 1 100%;
  text-align: left;
}

.pr-detail-overview .pr-detail-stats .pr-detail-stat-grid > .pr-detail-stat:not(.pr-detail-stat-branch) {
  flex: 1 1 0;
  min-width: 0;
  text-align: center;
}

.pr-detail-page .card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px 20px;

  h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

html[data-color-scheme="light"] .pr-detail-overview .card > h2 {
  margin: -16px -20px 12px;
  padding: 10px 20px;
  background: #eceef2;
  border-bottom: 1px solid var(--border);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.pr-detail-description .pr-detail-body-text {
  font-family: inherit;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  max-height: 500px;
  overflow-y: auto;
}

.markdown-body {
  word-wrap: break-word;

  p { margin: 0 0 12px; }

  h1, h2, h3, h4, h5, h6 {
    color: var(--text-primary);
    font-weight: 600;
    margin: 16px 0 8px;
    line-height: 1.3;
  }
  h1 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  h2 { font-size: 1.3em; border-bottom: 1px solid var(--border); padding-bottom: 4px; }
  h3 { font-size: 1.15em; }
  h4 { font-size: 1em; }

  a {
    color: var(--accent-blue);
    text-decoration: none;

    &:hover { text-decoration: underline; }
  }

  code {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 0.9em;
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
  }

  pre {
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    padding: 12px 16px;
    overflow-x: auto;
    margin: 0 0 12px;

    code {
      background: none;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }
  }

  blockquote {
    margin: 0 0 12px;
    padding: 4px 16px;
    border-left: 3px solid var(--border);
    color: var(--text-tertiary);
  }

  ul, ol {
    padding-left: 24px;
    margin: 0 0 12px;
  }
  li { margin-bottom: 4px; }

  li input[type="checkbox"] {
    margin-right: 6px;
    vertical-align: middle;
  }

  table {
    border-collapse: collapse;
    margin: 0 0 12px;
    width: 100%;

    th, td {
      border: 1px solid var(--border);
      padding: 6px 12px;
      text-align: left;
      font-size: 13px;
    }
    th {
      background: var(--bg-tertiary);
      font-weight: 600;
      color: var(--text-primary);
    }
  }

  img {
    max-width: 100%;
    border-radius: var(--radius-sm);
  }

  hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 16px 0;
  }
}

.pr-detail-comments-list {
  list-style: none;
}

.pr-detail-comment-block {
  padding: 12px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.pr-detail-comment-resolved {
  border-color: var(--label-green-border);
  box-shadow: 0 0 0 1px var(--label-green-glow);
}

.pr-detail-resolved-compact {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.pr-detail-resolved-title-btn {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.45;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: color var(--transition);

  &:hover {
    color: var(--text-primary);
  }
}

.pr-detail-resolved-chevron {
  color: var(--accent-green);
  font-size: 11px;
  margin-top: 2px;
}

.pr-detail-resolved-title-text {
  word-break: break-word;
}

.pr-detail-comment-issue {
  border-left: 3px solid var(--accent-blue);
}

.pr-detail-comment-meta,
.pr-detail-comment-thread-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.pr-detail-review-head {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.pr-detail-review-head .pr-detail-comment-thread-header {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.pr-detail-comment-card-top {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 6px;
}

.pr-detail-compact-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 2px 10px;
  min-height: 22px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  line-height: 1.25;
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition), color var(--transition);

  &:hover:not(:disabled) {
    border-color: var(--border-hover);
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .async-loader {
    width: 28px;
    height: 5px;
    border-radius: 3px;
  }
}

.pr-detail-comment-thread-header {
  padding-bottom: 8px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.pr-detail-comment-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
}

.pr-detail-comment-author {
  font-weight: 600;
  color: var(--text-primary);
}

.pr-detail-comment-time {
  color: var(--text-tertiary);
  font-size: 12px;
}

.pr-detail-comment-sep {
  color: var(--text-tertiary);
}

.pr-detail-comment-path {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-all;
}

.pr-detail-comment-line {
  font-size: 12px;
  color: var(--text-tertiary);
}

.pr-detail-comment-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

.pr-detail-comment-issue .pr-detail-comment-badge {
  background: var(--chip-blue-bg);
  color: var(--accent-blue);
}

.pr-detail-comment-review .pr-detail-comment-meta .pr-detail-comment-badge {
  background: var(--chip-purple-bg);
  color: var(--accent-purple);
}

.pr-detail-comment-thread-status {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
}

.pr-detail-comment-thread-status.open {
  background: var(--chip-orange-bg);
  color: var(--accent-orange);
}

.pr-detail-comment-thread-status.resolved {
  background: var(--chip-green-bg);
  color: var(--accent-green);
}

.pr-detail-comment-body {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.55;
}

.pr-detail-comment-body :first-child {
  margin-top: 0;
}

.pr-detail-comment-review-reply + .pr-detail-comment-review-reply {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.pr-detail-checks-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pr-detail-check-item {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 8px 10px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.pr-detail-check-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.pr-detail-check-icon {
  width: 20px;
  text-align: center;
  font-weight: 700;

  &.check-passed { color: var(--accent-green); }
  &.check-failed { color: var(--accent-red); }

  &.check-pending {
    color: var(--accent-orange);
    animation: pulse 1.5s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.pr-detail-check-name {
  color: var(--text-primary);

  a {
    color: var(--accent-blue);
    text-decoration: none;

    &:hover { text-decoration: underline; }
  }
}

.pr-detail-check-conclusion {
  color: var(--text-tertiary);
  font-size: 12px;
  text-transform: capitalize;
}

.pr-detail-annotations {
  list-style: none;
  margin-top: 6px;
  padding-left: 30px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.pr-detail-annotation {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 10px;
  background: var(--danger-row-bg);
  border-left: 2px solid var(--accent-red);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: 12px;
}

.pr-detail-annotation-location {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  color: var(--accent-blue);
  font-size: 11px;
}

.pr-detail-annotation-title {
  color: var(--text-primary);
  font-weight: 600;
}

.pr-detail-annotation-message {
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
}

.pr-detail-stat-grid > * {
  flex: 1;
}

.pr-detail-stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.pr-detail-stat-add .pr-detail-stat-value { color: var(--accent-green); }
.pr-detail-stat-del .pr-detail-stat-value { color: var(--accent-red); }

.pr-detail-stat-label {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.pr-detail-stat-branch-wrap {
  word-break: break-all;
}

.pr-detail-label {
  padding: 3px 8px;
  border: 1px solid;
  border-radius: 20px;
}

.pr-detail-label-remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 0 0 2px;
  opacity: 0.6;
  transition: opacity var(--transition);

  &:hover { opacity: 1; }
}

.pr-detail-label-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  max-height: 260px;
}

.pr-detail-label-search {
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;

  &::placeholder { color: var(--text-tertiary); }
}

.pr-detail-label-options {
  list-style: none;
  overflow-y: auto;
  max-height: 200px;
}

.pr-detail-label-option {
  padding: var(--u-2) var(--u-3);
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--transition);

  &:hover { background: var(--bg-tertiary); }
}

.pr-detail-label-option-empty {
  color: var(--text-tertiary);
  cursor: default;

  &:hover { background: transparent; }
}

.pr-detail-label-swatch {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

.pr-detail-empty {
  color: var(--text-tertiary);
  font-size: 13px;
}
</style>
