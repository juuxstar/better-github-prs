<template>
  <div class="pr-detail-body-grid">
    <section class="pr-detail-col pr-detail-col-left">
      <div v-if="pr.body" class="pr-detail-description card">
        <h2>Description</h2>
        <div class="pr-detail-body-text markdown-body" v-html="pr.body_html || pr.body"></div>
      </div>
    </section>

    <section class="pr-detail-col pr-detail-col-center">
      <div class="pr-detail-checks card">
        <h2>Checks ({{ checksSummaryText }})</h2>
        <div v-if="checksLoading" class="pr-detail-checks-loading">
          <span class="async-loader"></span> Loading checks...
        </div>
        <ul v-else-if="checks.length" class="pr-detail-checks-list">
          <li v-for="check in checks" :key="check.name" class="pr-detail-check-item">
            <div class="pr-detail-check-row">
              <span :class="checkIconClass(check)" class="pr-detail-check-icon">{{ checkIcon(check) }}</span>
              <span class="pr-detail-check-name">
                <a v-if="check.url" :href="check.url" target="_blank" rel="noopener">{{ check.name }}</a>
                <span v-else>{{ check.name }}</span>
              </span>
              <span class="pr-detail-check-conclusion">{{ checkLabel(check) }}</span>
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
        <p v-else class="pr-detail-empty">No checks found</p>
      </div>
    </section>

    <aside class="pr-detail-col pr-detail-col-right">
      <div class="pr-detail-stats card">
        <h2>Stats</h2>
        <div class="pr-detail-stat-grid">
          <div class="pr-detail-stat">
            <span class="pr-detail-stat-value">{{ pr.changed_files }}</span>
            <span class="pr-detail-stat-label">Files</span>
          </div>
          <div class="pr-detail-stat pr-detail-stat-add">
            <span class="pr-detail-stat-value">+{{ pr.additions }}</span>
            <span class="pr-detail-stat-label">Additions</span>
          </div>
          <div class="pr-detail-stat pr-detail-stat-del">
            <span class="pr-detail-stat-value">&minus;{{ pr.deletions }}</span>
            <span class="pr-detail-stat-label">Deletions</span>
          </div>
        </div>
      </div>

      <div class="pr-detail-labels card">
        <h2>Labels</h2>
        <div class="pr-detail-labels-list">
          <span
            v-for="label in pr.labels"
            :key="label.id"
            class="pr-detail-label"
            :style="labelStyle(label)"
          >
            {{ label.name }}
            <button
              class="pr-detail-label-remove"
              :title="'Remove ' + label.name"
              @click="$emit('remove-label', label.name)"
            >&times;</button>
          </span>
          <span v-if="!pr.labels.length" class="pr-detail-empty">No labels</span>
        </div>
        <div class="pr-detail-add-label">
          <div class="pr-detail-add-label-toggle">
            <button class="btn btn-secondary btn-sm" @click="toggleLabelDropdown">
              + Add label
            </button>
          </div>
          <div v-if="labelDropdownOpen" class="pr-detail-label-dropdown">
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
                class="pr-detail-label-option"
                @click="handleAddLabel(label.name)"
              >
                <span class="pr-detail-label-swatch" :style="{ background: '#' + label.color }"></span>
                {{ label.name }}
              </li>
              <li v-if="!filteredRepoLabels.length" class="pr-detail-label-option pr-detail-label-option-empty">
                No matching labels
              </li>
            </ul>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-facing-decorator';
import type { CheckAnnotation, CheckRunDetail, RepoLabel } from '@/lib/githubClient';

@Component({ emits: ['add-label', 'remove-label'] })
export default class PrOverviewTab extends Vue {
  @Prop() pr!: any;
  @Prop() checks!: CheckRunDetail[];
  @Prop() checksLoading!: boolean;
  @Prop() repoLabels!: RepoLabel[];

  labelDropdownOpen = false;
  labelSearch = '';

  get checksSummaryText(): string {
    if (this.checksLoading) return '...';
    if (!this.checks.length) return '0';
    const passed = this.checks.filter(c => this.isCheckPassed(c)).length;
    const failed = this.checks.filter(c => this.isCheckFailed(c)).length;
    const pending = this.checks.length - passed - failed;
    const parts: string[] = [];
    if (passed) parts.push(`${passed} passed`);
    if (failed) parts.push(`${failed} failed`);
    if (pending) parts.push(`${pending} pending`);
    return parts.join(', ');
  }

  get currentLabelNames(): Set<string> {
    return new Set((this.pr?.labels || []).map((l: any) => l.name.toLowerCase()));
  }

  get filteredRepoLabels(): RepoLabel[] {
    const current = this.currentLabelNames;
    const search = this.labelSearch.toLowerCase();
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
    if (this.isCheckPassed(check)) return '✓';
    if (this.isCheckFailed(check)) return '✗';
    return '●';
  }

  checkIconClass(check: CheckRunDetail): string {
    if (this.isCheckPassed(check)) return 'check-passed';
    if (this.isCheckFailed(check)) return 'check-failed';
    return 'check-pending';
  }

  checkLabel(check: CheckRunDetail): string {
    if (check.conclusion) return check.conclusion.replace(/_/g, ' ');
    if (check.status === 'in_progress') return 'in progress';
    if (check.status === 'queued') return 'queued';
    return 'pending';
  }

  failureAnnotations(check: CheckRunDetail): CheckAnnotation[] {
    if (!this.isCheckFailed(check)) return [];
    return check.annotations.filter(a => a.level === 'failure' || a.level === 'warning');
  }

  labelStyle(label: any): Record<string, string> {
    const c = '#' + label.color;
    return { background: c + '22', color: c, borderColor: c + '44' };
  }

  toggleLabelDropdown() {
    this.labelDropdownOpen = !this.labelDropdownOpen;
    this.labelSearch = '';
  }

  handleAddLabel(name: string) {
    this.$emit('add-label', name);
    this.labelDropdownOpen = false;
  }
}
</script>

<style>
.pr-detail-body-grid {
  display: flex;
  gap: 24px;
  align-items: flex-start;

  @media (max-width: 1024px) {
    flex-wrap: wrap;
  }
}

.pr-detail-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.pr-detail-col-left {
  flex: 1;
}

.pr-detail-col-center {
  flex: 1;
}

.pr-detail-col-right {
  width: 300px;
  flex-shrink: 0;
}

@media (max-width: 1024px) {
  .pr-detail-col-left,
  .pr-detail-col-center {
    flex: 1 1 calc(50% - 12px);
  }

  .pr-detail-col-right {
    width: 100%;
  }
}

@media (max-width: 700px) {
  .pr-detail-col-left,
  .pr-detail-col-center,
  .pr-detail-col-right {
    flex: 1 1 100%;
  }
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

.pr-detail-checks-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
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
  flex-shrink: 0;

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
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  flex-shrink: 0;
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
  background: rgba(248, 81, 73, 0.06);
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

.pr-detail-stat-grid {
  display: flex;
  gap: 12px;
  text-align: center;
}

.pr-detail-stat-grid > * {
  flex: 1;
}

.pr-detail-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
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

.pr-detail-labels-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.pr-detail-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 8px;
  border: 1px solid;
  border-radius: 20px;
  white-space: nowrap;
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

.pr-detail-add-label {
  position: relative;
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
  z-index: 100;
  max-height: 260px;
  display: flex;
  flex-direction: column;
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
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
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
  flex-shrink: 0;
}

.pr-detail-empty {
  color: var(--text-tertiary);
  font-size: 13px;
}
</style>
