<template>
  <div class="pr-item" :data-pr-id="pr.id" draggable="true" @dragstart="onDragStart" @click="onRowClick">
    <div class="pr-number-col">
      <span class="pr-number">#{{ pr.number }}</span>
      <span class="pr-author">{{ authorName }}</span>
    </div>
    <div class="pr-content">
      <div class="pr-title-row">
        <span class="pr-title" @click="onTitleClick">{{ pr.title }}</span>
        <span v-if="pr.draft" class="badge-draft">Draft</span>
      </div>
      <div v-if="visibleLabels.length" class="pr-labels">
        <span
          v-for="label in visibleLabels"
          :key="label.id || label.name"
          class="pr-label"
          :style="labelStyle(label)"
        >{{ label.name }}</span>
      </div>
      <div class="pr-meta">
        <template v-if="showRepo">
          <span class="pr-repo">{{ repo }}</span>
          <span class="pr-meta-sep">&middot;</span>
        </template>
        <span>opened {{ timeAgo(pr.created_at) }}</span>
        <span class="pr-meta-sep">&middot;</span>
        <span>updated {{ timeAgo(pr.updated_at) }}</span>
        <template v-if="pr.comments > 0">
          <span class="pr-meta-sep">&middot;</span>
          <span class="pr-comments">
            <span v-html="$icon('comment', 12)"></span> {{ pr.comments }}
          </span>
        </template>
      </div>
      <div v-if="hasAsyncData" class="pr-status-row">
        <span
          v-if="checks"
          class="pr-checks"
          :title="checks.passed + ' passed, ' + checks.failed + ' failed' + (checks.pending ? ', ' + checks.pending + ' pending' : '')"
        >
          <span v-for="n in checks.passed" :key="'p'+n" class="check-sq check-sq-passed"></span>
          <span v-for="n in checks.failed" :key="'f'+n" class="check-sq check-sq-failed"></span>
          <span v-for="n in checks.pending" :key="'k'+n" class="check-sq check-sq-pending"></span>
        </span>
        <span
          v-if="botTotal > 0"
          class="pr-bot-comments"
          :title="'Cursor bot: ' + botComments!.high + ' high, ' + botComments!.medium + ' medium, ' + botComments!.low + ' low'"
        >
          <span v-for="n in botComments!.high" :key="'bh'+n" v-html="botIcon('high')"></span>
          <span v-for="n in botComments!.medium" :key="'bm'+n" v-html="botIcon('medium')"></span>
          <span v-for="n in botComments!.low" :key="'bl'+n" v-html="botIcon('low')"></span>
        </span>
        <span v-if="hasConflicts" class="conflict-badge" title="Has conflicts">Conflicts</span>
      </div>
      <div v-else class="pr-status-row">
        <span class="async-loader"></span>
      </div>
    </div>
    <div v-if="stats" class="pr-stats-col">
      <div v-if="sizeDots" class="size-dots" :title="'Size: ' + sizeDots + '/5'">
        <span v-for="n in sizeDots" :key="n" :class="['size-dot', 'size-dot-' + sizeDots]"></span>
      </div>
      <span class="pr-stat pr-stat-files" title="Files changed">{{ stats.changedFiles }} files</span>
      <span class="pr-stat pr-additions" title="Lines added">+{{ stats.additions }}</span>
      <span class="pr-stat pr-deletions" title="Lines deleted">&minus;{{ stats.deletions }}</span>
    </div>
    <div v-else class="pr-stats-col">
      <div v-if="sizeDots" class="size-dots" :title="'Size: ' + sizeDots + '/5'">
        <span v-for="n in sizeDots" :key="n" :class="['size-dot', 'size-dot-' + sizeDots]"></span>
      </div>
      <span class="async-loader"></span>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-facing-decorator';
import GitHubClient from '@/lib/githubClient';
import type { BotCounts, PRStats, ChecksSummary } from '@/lib/githubClient';
import { iconSvg } from '@/lib/icons';
import { timeAgo } from '@/lib/utils';

const SIZE_LABELS: Record<string, number> = {
  'size/x-small': 1, 'size/small': 2, 'size/medium': 3, 'size/large': 4, 'size/x-large': 5,
};

/** Individual PR card displaying title, labels, metadata, checks, stats, and size indicator. */
@Component
export default class PrItem extends Vue {
  @Prop() pr!: any;
  @Prop({ default: () => new Set<string>() }) hiddenLabels!: Set<string>;
  @Prop() showRepo!: boolean;
  @Prop() asyncVersion!: number;

  readonly timeAgo = timeAgo;

  get prUrl(): string {
    return (this.pr.pull_request?.html_url) || this.pr.html_url;
  }

  get filesUrl(): string {
    return this.prUrl + '/files';
  }

  get authorName(): string {
    return GitHubClient.getFirstName(this.pr.user.login);
  }

  get repo(): string {
    const m = this.pr.repository_url.match(/repos\/([^/]+\/[^/]+)/);
    return m ? m[1] : '';
  }

  get detailUrl(): string {
    const m = this.pr.repository_url.match(/repos\/([^/]+)\/([^/]+)/);
    if (!m) return '';
    return `/pull-request/${m[1]}/${m[2]}/${this.pr.number}`;
  }

  get sizeDots(): number {
    const labels = this.pr.labels;
    if (!labels) return 0;
    for (const label of labels) {
      const dots = SIZE_LABELS[label.name.toLowerCase()];
      if (dots) return dots;
    }
    return 0;
  }

  get hasConflicts(): boolean {
    return this.pr.labels?.some((l: any) => l.name.toLowerCase() === 'has conflicts') ?? false;
  }

  get visibleLabels(): any[] {
    const labels = this.pr.labels;
    if (!labels || labels.length === 0) return [];
    return labels
      .filter((l: any) => !(l.name.toLowerCase() in SIZE_LABELS))
      .filter((l: any) => l.name.toLowerCase() !== 'has conflicts')
      .filter((l: any) => !this.hiddenLabels.has(l.name.toLowerCase()))
      .slice(0, 3);
  }

  get botComments(): BotCounts | null {
    void this.asyncVersion;
    return GitHubClient.getBotComments(this.pr.id);
  }

  get botTotal(): number {
    const bc = this.botComments;
    return bc ? bc.low + bc.medium + bc.high : 0;
  }

  get stats(): PRStats | null {
    void this.asyncVersion;
    return GitHubClient.getPRStats(this.pr.id);
  }

  get checks(): ChecksSummary | null {
    void this.asyncVersion;
    return GitHubClient.getChecks(this.pr.id);
  }

  get hasAsyncData(): boolean {
    return this.checks !== null || this.botTotal > 0;
  }

  labelStyle(label: any): Record<string, string> {
    const c = '#' + label.color;
    return { background: c + '22', color: c, borderColor: c + '44' };
  }

  botIcon(severity: string): string {
    return iconSvg('botFace', 14, 14, `class="bot-icon bot-icon-${severity}"`);
  }

  onRowClick() {
    if (this.detailUrl) window.open(this.detailUrl, '_blank');
  }

  onTitleClick(e: Event) {
    e.stopPropagation();
    window.open(this.filesUrl, '_blank');
  }

  onDragStart(e: DragEvent) {
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', String(this.pr.id));
  }
}
</script>

<style>
.pr-item {
  display: flex;
  gap: 14px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
  transition: background var(--transition);
  cursor: pointer;
  border-radius: var(--radius-sm);

  &:hover {
    background: var(--bg-secondary);
    margin: 0 -12px;
    padding: 16px 12px;
  }

  &:last-child {
    border-bottom: none;
  }

  &[draggable="true"] {
    cursor: grab;
  }

  &.dragging {
    opacity: 0.4;
    cursor: grabbing;
  }
}

.pr-icon {
  flex-shrink: 0;
  margin-top: 3px;

  &-open { color: var(--accent-green); }
  &-draft { color: var(--text-tertiary); }
}

.pr-content {
  flex: 1;
  min-width: 0;
}

.pr-title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}

.pr-number-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  gap: 4px;
  padding-top: 2px;
}

.pr-number {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-tertiary);
  line-height: 1.4;
  white-space: nowrap;
}

.pr-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  cursor: pointer;
  position: relative;
  z-index: 2;

  &:hover {
    color: var(--accent-blue);
    text-decoration: underline;
  }
}

.pr-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.pr-label {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid transparent;
  line-height: 1.6;
}

.pr-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-tertiary);
  flex-wrap: wrap;
}

.pr-meta-sep {
  color: var(--border);
}

.pr-author {
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 11px;
  white-space: nowrap;
}

.pr-repo {
  color: var(--text-secondary);
  font-weight: 500;
}

.pr-reviews {
  display: flex;
  align-items: center;
  gap: 4px;
}

.review-approved { color: var(--accent-green); }
.review-changes { color: var(--accent-red); }
.review-pending { color: var(--accent-orange); }

.pr-comments {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pr-bot-comments {
  display: flex;
  align-items: center;
  gap: 3px;
}

.bot-icon {
  flex-shrink: 0;

  &-high { color: var(--accent-red, #f85149); }
  &-medium { color: var(--accent-orange, #d29922); }
  &-low { color: var(--text-tertiary); }
}

.pr-status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.pr-checks {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.check-sq {
  width: 8px;
  height: 8px;
  border-radius: 1px;

  &-passed { background: var(--accent-green); }
  &-failed { background: var(--accent-red, #f85149); }

  &-pending {
    background: var(--accent-orange, #d29922);
    animation: pulse-check 1.5s ease-in-out infinite;
  }
}

@keyframes pulse-check {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.pr-stats-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
  font-size: 12px;
  font-family: monospace;
  padding-top: 2px;
}

.pr-stat {
  white-space: nowrap;

  &-files { color: var(--text-tertiary); }
}

.pr-additions {
  color: var(--accent-green);
  font-size: 12px;
}

.pr-deletions {
  color: var(--accent-red);
  font-size: 12px;
}

.badge-draft {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
}

.size-dots {
  display: flex;
  gap: 3px;
}

.size-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.size-dot-1 { background: #3fb950; }
.size-dot-2 { background: #7cc832; }
.size-dot-3 { background: #d29922; }
.size-dot-4 { background: #e67b35; }
.size-dot-5 { background: #f85149; }

.conflict-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-red);
  background: rgba(248, 81, 73, 0.12);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}
</style>
