<template>
  <div class="pr-detail-page">
    <div v-if="loading" class="pr-detail-loading">
      <div class="spinner"></div>
      <p>Loading pull request...</p>
    </div>

    <div v-else-if="error" class="pr-detail-error">
      <p>{{ error }}</p>
      <button class="btn btn-secondary" @click="loadAll">Retry</button>
    </div>

    <template v-else-if="pr">
      <header class="pr-detail-header">
        <div class="pr-detail-header-left">
          <a href="/" class="pr-detail-back" title="Back to dashboard">&larr;</a>
          <span :class="stateBadgeClass">#{{ pr.number }}</span>
          <h1 class="pr-detail-title">{{ pr.title }}</h1>
          <span class="pr-detail-author">
            <img v-if="pr.user.avatar_url" :src="pr.user.avatar_url" class="pr-detail-avatar" />
            {{ authorDisplayName }}
          </span>
        </div>
        <div class="pr-detail-header-center">
          <div class="pr-detail-tabs">
            <button
              :class="['pr-detail-tab', { active: activeTab === 'overview' }]"
              @click="switchTab('overview')"
            >
              Overview
            </button>
            <button
              :class="['pr-detail-tab', { active: activeTab === 'files' }]"
              @click="switchTab('files')"
            >
              Files ({{ pr.changed_files }})
            </button>
          </div>
          <span v-if="files.length" :class="reviewProgressClass">
            <span class="pr-detail-review-bar-track">
              <span class="pr-detail-review-bar-fill" :style="{ width: reviewPct + '%' }"></span>
            </span>
            <span class="pr-detail-review-pct">{{ reviewPct }}%</span>
          </span>
        </div>
        <div class="pr-detail-header-right">
          <select class="pr-detail-tab-size" :value="tabSize" @change="tabSize = +($event.target as HTMLSelectElement).value">
            <option :value="2">2 spaces</option>
            <option :value="4">4 spaces</option>
            <option :value="8">8 spaces</option>
          </select>
          <a :href="pr.html_url" target="_blank" rel="noopener" class="pr-detail-github-link">GitHub &rarr;</a>
        </div>
      </header>

      <pr-overview-tab
        v-if="activeTab === 'overview'"
        :pr="pr"
        :checks="checks"
        :checks-loading="checksLoading"
        :repo-labels="repoLabels"
        @add-label="addLabel"
        @remove-label="removeLabel"
      />
      <pr-files-tab
        v-else-if="activeTab === 'files'"
        :files="files"
        :files-loading="filesLoading"
        :owner="owner"
        :repo="repo"
        :base-ref="pr.base.sha"
        :head-ref="pr.head.sha"
        :initial-file-index="initialFileIndex"
        :pr-title="pr.title"
        :pr-number="pr.number"
        :pr-author-login="pr.user.login"
        :tab-size="tabSize"
        :viewed-files="viewedFiles"
        :pr-node-id="prNodeId"
        @update:file-index="onFileIndexChange"
        @update:viewed="onViewedChange"
      />
    </template>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-facing-decorator';
import GitHubClient from '@/lib/githubClient';
import type { CheckRunDetail, RepoLabel, PRFile } from '@/lib/githubClient';
import { getStoredToken } from '@/services/auth';
import { timeAgo } from '@/lib/utils';

@Component({ emits: ['update:fileIndex'] })
export default class PrDetailView extends Vue {
  @Prop() owner!: string;
  @Prop() repo!: string;
  @Prop() number!: string;
  @Prop() tab!: string;

  pr: any = null;
  checks: CheckRunDetail[] = [];
  repoLabels: RepoLabel[] = [];
  files: PRFile[] = [];
  loading = true;
  checksLoading = true;
  filesLoading = false;
  error = '';
  activeTab: 'overview' | 'files' = 'overview';
  tabSize = parseInt(localStorage.getItem('diffTabSize') || '4', 10);
  viewedFiles: Record<string, string> = {};
  prNodeId = '';

  @Watch('tabSize')
  onTabSizeChanged(val: number) {
    localStorage.setItem('diffTabSize', String(val));
  }

  readonly timeAgo = timeAgo;

  private _checksTimer: ReturnType<typeof setInterval> | null = null;
  private _originalTitle = '';

  get prNumber(): number {
    return parseInt(this.number, 10);
  }

  get stateBadgeClass(): string {
    if (!this.pr) return 'pr-detail-badge';
    if (this.pr.draft) return 'pr-detail-badge pr-detail-badge-draft';
    if (this.pr.state === 'closed') return 'pr-detail-badge pr-detail-badge-closed';
    return 'pr-detail-badge pr-detail-badge-open';
  }

  get authorDisplayName(): string {
    if (!this.pr) return '';
    return GitHubClient.getFirstName(this.pr.user.login);
  }

  get initialFileIndex(): number {
    const q = this.$route.query.file;
    const idx = typeof q === 'string' ? parseInt(q, 10) : NaN;
    return isNaN(idx) ? 0 : idx;
  }

  get reviewedCount(): number {
    return Object.values(this.viewedFiles).filter(s => s === 'VIEWED').length;
  }

  get reviewPct(): number {
    const total = this.files.length;
    if (!total) return 0;
    return Math.round((this.reviewedCount / total) * 100);
  }

  get reviewProgressClass(): string {
    const pct = this.reviewPct;
    if (pct >= 100) return 'pr-detail-review-progress complete';
    if (pct >= 50) return 'pr-detail-review-progress partial';
    return 'pr-detail-review-progress low';
  }

  mounted() {
    this._originalTitle = document.title;
    if (this.tab === 'files') {
      this.activeTab = 'files';
    }
    const token = getStoredToken();
    if (token) GitHubClient.setToken(token);
    this.loadAll();
  }

  beforeUnmount() {
    this.stopChecksPolling();
    document.title = this._originalTitle;
  }

  async loadAll() {
    this.loading = true;
    this.error = '';
    try {
      this.pr = await GitHubClient.fetchPRDetail(this.owner, this.repo, this.prNumber);
      document.title = `#${this.pr.number} ${this.pr.title}`;
      this.loading = false;
      GitHubClient.fetchUserFirstNames([this.pr.user.login]);
      this.loadChecks();
      this.loadRepoLabels();
      if (this.activeTab === 'files') this.loadFiles();
    } catch (e: any) {
      this.error = e.message || 'Failed to load PR';
      this.loading = false;
    }
  }

  async loadChecks() {
    this.checksLoading = true;
    try {
      this.checks = await GitHubClient.fetchDetailedChecks(this.owner, this.repo, this.prNumber);
      const hasPending = this.checks.some(c => {
        const con = c.conclusion;
        const passed = con === 'success' || con === 'neutral' || con === 'skipped';
        const failed = con === 'failure' || con === 'timed_out' || con === 'cancelled' || con === 'error';
        return !passed && !failed;
      });
      if (hasPending) this.startChecksPolling();
    } catch {
      this.checks = [];
    } finally {
      this.checksLoading = false;
    }
  }

  async loadRepoLabels() {
    try {
      this.repoLabels = await GitHubClient.fetchRepoLabels(this.owner, this.repo);
    } catch {
      this.repoLabels = [];
    }
  }

  async loadFiles() {
    if (this.files.length || this.filesLoading) return;
    this.filesLoading = true;
    try {
      this.files = await GitHubClient.fetchPRFiles(this.owner, this.repo, this.prNumber);
      this.loadViewedState();
    } catch {
      this.files = [];
    } finally {
      this.filesLoading = false;
    }
  }

  async loadViewedState() {
    try {
      const result = await GitHubClient.fetchPRFilesViewedState(this.owner, this.repo, this.prNumber);
      this.viewedFiles = result.viewedFiles;
      this.prNodeId = result.prNodeId;
    } catch {
      this.viewedFiles = {};
    }
  }

  switchTab(tab: 'overview' | 'files') {
    this.activeTab = tab;
    const base = `/pull-request/${this.owner}/${this.repo}/${this.number}/${tab}`;
    this.$router.replace({ path: base });
    if (tab === 'files') this.loadFiles();
  }

  onFileIndexChange(index: number) {
    this.$router.replace({
      path: `/pull-request/${this.owner}/${this.repo}/${this.number}/files`,
      query: { file: String(index) },
    });
  }

  onViewedChange(payload: { filename: string; state: string }) {
    this.viewedFiles = { ...this.viewedFiles, [payload.filename]: payload.state };
  }

  startChecksPolling() {
    this.stopChecksPolling();
    this._checksTimer = setInterval(async () => {
      try {
        this.checks = await GitHubClient.fetchDetailedChecks(this.owner, this.repo, this.prNumber);
        const hasPending = this.checks.some(c => {
          const con = c.conclusion;
          const passed = con === 'success' || con === 'neutral' || con === 'skipped';
          const failed = con === 'failure' || con === 'timed_out' || con === 'cancelled' || con === 'error';
          return !passed && !failed;
        });
        if (!hasPending) this.stopChecksPolling();
      } catch {
        this.stopChecksPolling();
      }
    }, 10000);
  }

  stopChecksPolling() {
    if (this._checksTimer) {
      clearInterval(this._checksTimer);
      this._checksTimer = null;
    }
  }

  async addLabel(name: string) {
    const fullRepo = `${this.owner}/${this.repo}`;
    try {
      await GitHubClient.addLabel(fullRepo, this.prNumber, name);
      const matched = this.repoLabels.find(l => l.name === name);
      if (matched) {
        this.pr.labels.push({ id: matched.id, name: matched.name, color: matched.color });
      }
    } catch (e: any) {
      console.error('Failed to add label:', e);
    }
  }

  async removeLabel(name: string) {
    const fullRepo = `${this.owner}/${this.repo}`;
    try {
      await GitHubClient.removeLabel(fullRepo, this.prNumber, name);
      this.pr.labels = this.pr.labels.filter((l: any) => l.name !== name);
    } catch (e: any) {
      console.error('Failed to remove label:', e);
    }
  }
}
</script>

<style>
.pr-detail-page {
  max-width: 100%;
  margin: 0 auto;
  padding: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.pr-detail-loading,
.pr-detail-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 80px 0;
  color: var(--text-secondary);
}

.pr-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
  gap: 16px;
}

.pr-detail-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.pr-detail-header-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.pr-detail-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: flex-end;
}

.pr-detail-back {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 18px;
  line-height: 1;
  transition: color var(--transition);
  flex-shrink: 0;

  &:hover { color: var(--text-primary); }
}

.pr-detail-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.pr-detail-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
}

.pr-detail-badge-open {
  background: var(--accent-green-bg);
  color: var(--accent-green);
}

.pr-detail-badge-closed {
  background: rgba(248, 81, 73, 0.1);
  color: var(--accent-red);
}

.pr-detail-badge-draft {
  background: rgba(139, 148, 158, 0.15);
  color: var(--text-secondary);
}

.pr-detail-author {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  white-space: nowrap;
  flex-shrink: 0;
}

.pr-detail-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.pr-detail-github-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
  white-space: nowrap;
  transition: color var(--transition);

  &:hover { color: var(--text-primary); }
}

.pr-detail-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  padding: 2px;
  border: 1px solid var(--border);
}

.pr-detail-tab {
  padding: 4px 12px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
  white-space: nowrap;

  &:hover { color: var(--text-secondary); }

  &.active {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }
}

.pr-detail-review-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
  white-space: nowrap;
}

.pr-detail-review-bar-track {
  width: 60px;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-tertiary);
  overflow: hidden;
}

.pr-detail-review-bar-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease, background 0.3s ease;
}

.pr-detail-review-pct {
  font-size: 13px;
  font-weight: 700;
  min-width: 32px;
}

.pr-detail-review-progress.low {
  .pr-detail-review-bar-fill { background: var(--text-tertiary); }
  .pr-detail-review-pct { color: var(--text-secondary); }
}

.pr-detail-review-progress.partial {
  .pr-detail-review-bar-fill { background: var(--accent-orange); }
  .pr-detail-review-pct { color: var(--accent-orange); }
}

.pr-detail-review-progress.complete {
  .pr-detail-review-bar-fill { background: var(--accent-green); }
  .pr-detail-review-pct { color: var(--accent-green); }
}

.pr-detail-tab-size {
  padding: 4px 24px 4px 8px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='%238b949e'%3E%3Cpath d='M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  transition: all var(--transition);

  &:hover {
    border-color: var(--border-hover);
    color: var(--text-primary);
  }

  &:focus {
    outline: none;
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 1px var(--accent-blue);
  }
}
</style>
